import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    outbound,
    route,
    OsciloScopeMessage,
    CommandTypes,
    StartRenderPayload,
    ToolErrorPayload
} from './ApiTable';
import { ToolRegistry } from './tool/ToolRegistry';
import { ValidationPanel } from './tool/ValidationPanel';
import { injectCspSource, webviewResourceRoots } from './WebviewSupport';

export class SidebarProvider implements vscode.WebviewViewProvider {

    private view?: vscode.WebviewView;
    private selectedLogPath?: string;
    private selectedToolId?: string;

    // 사이드바로 보내는 발신은 전부 이 테이블을 거친다 (BE-API Table).
    private readonly api = outbound(message => this.view?.webview.postMessage(message));

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly registry: ToolRegistry,
        private readonly validation: ValidationPanel,
        private readonly output: vscode.OutputChannel,
        private readonly onLogFileSelected: (absolutePath: string, toolId?: string) => Promise<void>
    ) {}

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: webviewResourceRoots(this.extensionUri, this.registry.globalStorageUri)
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        // 핸들러는 async라 실패가 처리되지 않은 Promise로 사라지지 않게 run()으로 감싼다.
        webviewView.webview.onDidReceiveMessage((message: OsciloScopeMessage) => route(message, {
            [CommandTypes.SELECT_LOG_FILE]: () => this.run('로그 파일 선택', () => this.selectLogFile()),
            [CommandTypes.START_RENDER]:    payload => this.run('렌더링', () => this.startRender(payload)),
            [CommandTypes.GET_TOOLS_LIST]:  () => this.run('도구 목록', () => this.sendToolsList()),
            [CommandTypes.SELECT_TOOL]:     payload => { this.selectedToolId = payload.toolId; },
            [CommandTypes.OPEN_TOOL]:       payload => this.run('도구 열기', () => this.openTool(payload.toolId)),
            [CommandTypes.VALIDATE_TOOL]:   payload => this.run('도구 검사', () => this.validateTool(payload.toolId))
        }));
    }

    private async selectLogFile(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Log Files': ['jsonl'] },
            openLabel: '로그 파일 선택'
        });

        if (!uris || uris.length === 0) {
            return;
        }

        // 파일 선택은 경로 저장 + 사이드바 행 갱신까지만. 실제 렌더링은 START 버튼에서.
        const selectedPath = uris[0].fsPath;
        this.selectedLogPath = selectedPath;

        this.api.logFileLoaded({
            fileName: uris[0].path.split('/').pop() ?? '',
            filePath: selectedPath
        });
    }

    // START 버튼: 선택된 로그 파일로 메인 패널 렌더링 (창을 닫았어도 다시 열림)
    // 도구 id를 START에도 실어 보내 사이드바와 확장의 선택 상태 불일치를 없앤다 (설계문서 §9.2).
    private async startRender(payload: StartRenderPayload): Promise<void> {
        if (!this.selectedLogPath) {
            vscode.window.showWarningMessage('OsciloScope: 먼저 로그 파일을 선택하세요.');
            return;
        }
        if (payload?.toolId) {
            this.selectedToolId = payload.toolId;
        }
        await this.onLogFileSelected(this.selectedLogPath, this.selectedToolId);
    }

    // 확장은 전역 저장소의 plugin.json만 읽는다. 도구 코드는 실행하지 않는다.
    private async sendToolsList(): Promise<void> {
        const view = this.view;
        if (!view) {
            return;
        }
        this.api.toolsList(await this.registry.toPayload(view.webview));
    }

    // 진입 파일을 에디터로 연다. 문제가 있는 플러그인이라도 진입 파일이 있으면 열 수 있다 —
    // 원인을 봐야 고칠 수 있기 때문이다.
    private async openTool(toolId: string): Promise<void> {
        const tool = await this.registry.find(toolId);
        if (!tool || !tool.fileUri) {
            vscode.window.showErrorMessage(
                `OsciloScope: 도구 파일을 열 수 없습니다. (${toolId}${tool?.error ? `: ${tool.error}` : ''})`
            );
            return;
        }
        const document = await vscode.workspace.openTextDocument(tool.fileUri);
        await vscode.window.showTextDocument(document);
    }

    // 검사는 전용 임시 패널에서 돌고, 결과 리포트만 사이드바로 돌아온다.
    private async validateTool(toolId: string): Promise<void> {
        const report = await this.validation.run(toolId);
        this.api.validationResult(report);
    }

    // 전역 저장소 변경 알림. 사이드바가 받으면 GET_TOOLS_LIST로 목록을 다시 요청한다.
    public notifyToolsChanged(): void {
        this.api.toolsChanged();
    }

    // 메인 패널에서 실행 중 실패한 도구를 사이드바에 알린다 (선택 해제·실패 표시는 사이드바 몫).
    public notifyToolError(payload: ToolErrorPayload): void {
        if (this.selectedToolId === payload.toolId) {
            this.selectedToolId = undefined;
        }
        this.api.toolError(payload);
    }

    private async run(what: string, task: () => Promise<void>): Promise<void> {
        try {
            await task();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.output.appendLine(`[SidebarProvider] ${what} 실패: ${message}`);
            vscode.window.showErrorMessage(`OsciloScope: ${what}에 실패했습니다. (${message})`);
        }
    }

    // osciloscope/sidebar-view/index.html을 읽어와서 css/js 상대경로를
    // 웹뷰가 접근 가능한 URI로 치환 (OsciloScopeWebviewPanel.ts와 동일한 방식)
    private getHtml(webview: vscode.Webview): string {
        const htmlPath = path.join(this.extensionUri.fsPath, 'osciloscope', 'sidebar-view', 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');

        html = html.replace(/(href|src)="(css|js)\/([^"]+)"/g, (match, attr, folder, file) => {
            const resourcePath = vscode.Uri.joinPath(this.extensionUri, 'osciloscope', 'sidebar-view', folder, file);
            const webviewUri = webview.asWebviewUri(resourcePath);
            return `${attr}="${webviewUri}"`;
        });

        return injectCspSource(html, webview);
    }
}
