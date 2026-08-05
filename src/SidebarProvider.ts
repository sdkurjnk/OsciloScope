import * as vscode from 'vscode';
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
            enableScripts: true
        };

        webviewView.webview.html = this.getPlaceholderHtml();

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

    // FE 담당자가 실제 사이드바 화면(HTML/CSS/JS)으로 교체할 임시 placeholder
    private getPlaceholderHtml(): string {
        return /* html */ `<!DOCTYPE html>
<html lang="ko">
<body>
    <p>OsciloScope Sidebar (placeholder)</p>
</body>
</html>`;
    }
}
