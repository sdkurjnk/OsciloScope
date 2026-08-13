import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OsciloScopeMessage, CommandTypes } from './OsciloScopeMessage';

export class OsciloScopeWebviewPanel {

    private static panel: vscode.WebviewPanel;

    // 웹뷰 JS가 message 리스너를 등록(UI_READY 발신)하기 전에 보낸 메시지는
    // VS Code가 버퍼링하지 않아 유실된다. UI_READY 수신 전까지는 여기 모아뒀다가 한 번에 flush.
    private static isReady: boolean = false;
    private static pendingMessages: OsciloScopeMessage[] = [];

    public static createOrShow(extensionUri: vscode.Uri): void {
    if (OsciloScopeWebviewPanel.panel) {
        OsciloScopeWebviewPanel.panel.reveal(vscode.ViewColumn.One);
        return;
    }

    // 새 패널을 만들 때마다 핸드셰이크 상태 초기화
    OsciloScopeWebviewPanel.isReady = false;
    OsciloScopeWebviewPanel.pendingMessages = [];

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
        OsciloScopeWebviewPanel.isReady = false;
        OsciloScopeWebviewPanel.pendingMessages = [];
    });

    OsciloScopeWebviewPanel.receiveDataFromWebview();
    }

    public static sendDataToWebview(message: OsciloScopeMessage): void {
        if (!OsciloScopeWebviewPanel.panel) {
            console.error('[OsciloScopeWebviewPanel] 창이 열려있지 않아요!');
            return;
        }
        // 프론트가 아직 준비되지 않았으면 버퍼링 (UI_READY 수신 시 flush)
        if (!OsciloScopeWebviewPanel.isReady) {
            OsciloScopeWebviewPanel.pendingMessages.push(message);
            return;
        }
        OsciloScopeWebviewPanel.panel.webview.postMessage(message);
    }

    public static receiveDataFromWebview(): void {
        OsciloScopeWebviewPanel.panel.webview.onDidReceiveMessage((message: OsciloScopeMessage) => {
            switch (message.command) {
                case CommandTypes.UI_READY:
                    console.log('[OsciloScopeWebviewPanel] 프론트 로딩 완료!');
                    OsciloScopeWebviewPanel.isReady = true;
                    OsciloScopeWebviewPanel.pendingMessages.forEach(
                        m => OsciloScopeWebviewPanel.panel.webview.postMessage(m)
                    );
                    OsciloScopeWebviewPanel.pendingMessages = [];
                    break;
            }
        });
    }
}
