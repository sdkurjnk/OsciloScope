import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OsciloScopeMessage, CommandTypes } from './OsciloScopeMessage';
import { outbound, route } from './ApiTable';
import { ToolRegistry } from './tool/ToolRegistry';
import { ToolTemplate } from './tool/ToolTemplate';
import { ValidationPanel } from './tool/ValidationPanel';
import { injectCspSource, webviewResourceRoots } from './WebviewSupport';
import { StartRenderPayload } from './tool/types';

export class SidebarProvider implements vscode.WebviewViewProvider {

    private view?: vscode.WebviewView;
    private selectedLogPath?: string;
    private selectedToolId?: string;

    // 사이드바로 보내는 발신은 전부 이 테이블을 거친다 (BE-API Table).
    private readonly api = outbound(message => this.view?.webview.postMessage(message));

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly registry: ToolRegistry,
        private readonly template: ToolTemplate,
        private readonly validation: ValidationPanel,
        private readonly onLogFileSelected: (absolutePath: string, toolId?: string) => void
    ) {}

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: webviewResourceRoots(this.extensionUri)
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((message: OsciloScopeMessage) => route(message, {
            [CommandTypes.SELECT_LOG_FILE]: () => this.selectLogFile(),
            [CommandTypes.START_RENDER]:    payload => this.startRender(payload),
            [CommandTypes.GET_TOOLS_LIST]:  () => this.sendToolsList(),
            [CommandTypes.SELECT_TOOL]:     payload => { this.selectedToolId = payload.toolId; },
            [CommandTypes.CREATE_TOOL]:     () => this.createTool(),
            [CommandTypes.COPY_TOOL]:       payload => this.copyTool(payload.toolId),
            [CommandTypes.OPEN_TOOL]:       payload => this.template.openTool(payload.toolId),
            [CommandTypes.VALIDATE_TOOL]:   payload => this.validateTool(payload.toolId)
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
    private startRender(payload: StartRenderPayload): void {
        if (!this.selectedLogPath) {
            vscode.window.showWarningMessage('OsciloScope: 먼저 로그 파일을 선택하세요.');
            return;
        }
        if (payload?.toolId) {
            this.selectedToolId = payload.toolId;
        }
        this.onLogFileSelected(this.selectedLogPath, this.selectedToolId);
    }

    // 확장은 파일 시스템 스캔만 한다. 도구의 name/version은 사이드바가 import해서 채운다.
    private sendToolsList(): void {
        if (!this.view) {
            return;
        }
        this.api.toolsList(this.registry.toPayload(this.view.webview));
    }

    // 생성·복사 결과는 TOOL_CREATED로 알린다. 목록 갱신은 파일 감시가 알아서 처리하므로
    // 여기서 따로 보내지 않는다 (사이드바는 TOOLS_CHANGED를 받고 다시 요청한다).
    private async createTool(): Promise<void> {
        const created = await this.template.createTool();
        if (created) {
            this.selectedToolId = created.toolId;
            this.api.toolCreated(created);
        }
    }

    private async copyTool(toolId: string): Promise<void> {
        const created = await this.template.copyTool(toolId);
        if (created) {
            this.selectedToolId = created.toolId;
            this.api.toolCreated(created);
        }
    }

    // 검사는 전용 임시 패널에서 돌고, 결과 리포트만 사이드바로 돌아온다.
    private async validateTool(toolId: string): Promise<void> {
        const report = await this.validation.run(toolId);
        this.api.validationResult(report);
    }

    // 파일 감시 알림. 사이드바가 받으면 GET_TOOLS_LIST로 목록을 다시 요청한다.
    public notifyToolsChanged(): void {
        this.api.toolsChanged();
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
