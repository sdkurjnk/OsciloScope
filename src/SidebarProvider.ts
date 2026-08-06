import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OsciloScopeMessage, CommandTypes } from './OsciloScopeMessage';
import { ToolsProvider } from './ToolsProvider';

export class SidebarProvider implements vscode.WebviewViewProvider {

    private view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
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
                case CommandTypes.GET_TOOLS_LIST:
                    this.sendToolsList();
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

        const absolutePath = uris[0].fsPath;

        this.postMessage({
            command: CommandTypes.LOG_FILE_LOADED,
            payload: { fileName: uris[0].path.split('/').pop(), filePath: absolutePath }
        });

        this.onLogFileSelected(absolutePath);
    }

    private sendToolsList(): void {
        const tools = ToolsProvider.listTools(this.extensionUri.fsPath);
        this.postMessage({
            command: CommandTypes.TOOLS_LIST,
            payload: { tools }
        });
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
