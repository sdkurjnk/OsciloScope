import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OsciloScopeMessage, CommandTypes } from './OsciloScopeMessage';
import { ToolRegistry } from './tool/ToolRegistry';
import { SelectToolPayload, StartRenderPayload } from './tool/types';

export class SidebarProvider implements vscode.WebviewViewProvider {

    private view?: vscode.WebviewView;
    private selectedLogPath?: string;
    private selectedToolId?: string;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly registry: ToolRegistry,
        private readonly onLogFileSelected: (absolutePath: string) => void
    ) {}

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, 'osciloscope')
            ]
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((message: OsciloScopeMessage) => {
            switch (message.command) {
                case CommandTypes.SELECT_LOG_FILE:
                    this.selectLogFile();
                    break;
                case CommandTypes.START_RENDER:
                    this.startRender(message.payload as StartRenderPayload);
                    break;
                case CommandTypes.GET_TOOLS_LIST:
                    this.sendToolsList();
                    break;
                case CommandTypes.SELECT_TOOL:
                    this.selectedToolId = (message.payload as SelectToolPayload).toolId;
                    break;
            }
        });
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
        this.selectedLogPath = uris[0].fsPath;

        this.postMessage({
            command: CommandTypes.LOG_FILE_LOADED,
            payload: { fileName: uris[0].path.split('/').pop(), filePath: this.selectedLogPath }
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
        this.onLogFileSelected(this.selectedLogPath);
    }

    // 확장은 파일 시스템 스캔만 한다. 도구의 name/version은 사이드바가 import해서 채운다.
    private sendToolsList(): void {
        if (!this.view) {
            return;
        }
        this.postMessage({
            command: CommandTypes.TOOLS_LIST,
            payload: this.registry.toPayload(this.view.webview)
        });
    }

    // 파일 감시 알림. 사이드바가 받으면 GET_TOOLS_LIST로 목록을 다시 요청한다.
    public notifyToolsChanged(): void {
        this.postMessage({ command: CommandTypes.TOOLS_CHANGED, payload: {} });
    }

    public getSelectedToolId(): string | undefined {
        return this.selectedToolId;
    }

    private postMessage(message: OsciloScopeMessage): void {
        this.view?.webview.postMessage(message);
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

        return html;
    }
}
