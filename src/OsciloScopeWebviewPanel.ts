import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OsciloScopeMessage, CommandTypes } from './OsciloScopeMessage';

export class OsciloScopeWebviewPanel {

    private static panel: vscode.WebviewPanel;

    public static createOrShow(extensionUri: vscode.Uri): void {
    if (OsciloScopeWebviewPanel.panel) {
        OsciloScopeWebviewPanel.panel.reveal(vscode.ViewColumn.One);
        return;
    }

    OsciloScopeWebviewPanel.panel = vscode.window.createWebviewPanel(
        'osciloScope',
        'OsciloScope',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'osciloscope')
            ]
        }
    );

    const webview = OsciloScopeWebviewPanel.panel.webview;

    const htmlPath = path.join(extensionUri.fsPath, 'osciloscope', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    html = html.replace(/(href|src)="(css|js)\/([^"]+)"/g, (match, attr, folder, file) => {
        const resourcePath = vscode.Uri.joinPath(extensionUri, 'osciloscope', folder, file);
        const webviewUri = webview.asWebviewUri(resourcePath);
        return `${attr}="${webviewUri}"`;
    });

    webview.html = html;

    OsciloScopeWebviewPanel.panel.onDidDispose(() => {
        OsciloScopeWebviewPanel.panel = undefined as any;
    });

    OsciloScopeWebviewPanel.receiveDataFromWebview();
    }

    public static sendDataToWebview(message: OsciloScopeMessage): void {
        if (!OsciloScopeWebviewPanel.panel) {
            console.error('[OsciloScopeWebviewPanel] 창이 열려있지 않아요!');
            return;
        }
        OsciloScopeWebviewPanel.panel.webview.postMessage(message);
    }

    public static receiveDataFromWebview(): void {
        OsciloScopeWebviewPanel.panel.webview.onDidReceiveMessage((message: OsciloScopeMessage) => {
            switch (message.command) {
                case CommandTypes.UI_READY:
                    console.log('[OsciloScopeWebviewPanel] 프론트 로딩 완료!');
                    break;
                case CommandTypes.VARIABLE_CHANGED:
                    console.log('[OsciloScopeWebviewPanel] 선택된 변수 변경:', message.payload);
                    break;
            }
        });
    }
}
