import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { VmlMessage, CommandTypes } from './VmlMessage';

export class VMLWebviewPanel {

    private static panel: vscode.WebviewPanel;

    public static createOrShow(extensionUri: vscode.Uri): void {
    if (VMLWebviewPanel.panel) {
        VMLWebviewPanel.panel.reveal(vscode.ViewColumn.One);
        return;
    }

    VMLWebviewPanel.panel = vscode.window.createWebviewPanel(
        'vmlVisualizer',
        'VML Visualizer',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'vml_visualizer')
            ]
        }
    );

    // ⭐ webview 변수 정의
    const webview = VMLWebviewPanel.panel.webview;

    // ⭐ HTML 파일을 변수로 읽기 (let html으로 정의!)
    const htmlPath = path.join(extensionUri.fsPath, 'vml_visualizer', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    // ⭐ 상대경로를 Webview URI로 변환
    html = html.replace(/(href|src)="(css|js)\/([^"]+)"/g, (match, attr, folder, file) => {
        const resourcePath = vscode.Uri.joinPath(extensionUri, 'vml_visualizer', folder, file);
        const webviewUri = webview.asWebviewUri(resourcePath);
        return `${attr}="${webviewUri}"`;
    });

    // ⭐ 변환된 HTML을 webview에 할당
    webview.html = html;

    VMLWebviewPanel.panel.onDidDispose(() => {
        VMLWebviewPanel.panel = undefined as any;
    });

    VMLWebviewPanel.receiveDataFromWebview();
    }

    public static sendDataToWebview(message: VmlMessage): void {
        if (!VMLWebviewPanel.panel) {
            console.error('[VMLWebviewPanel] 창이 열려있지 않아요!');
            return;
        }
        VMLWebviewPanel.panel.webview.postMessage(message);
    }

    public static receiveDataFromWebview(): void {
        VMLWebviewPanel.panel.webview.onDidReceiveMessage((message: VmlMessage) => {
            switch (message.command) {
                case CommandTypes.UI_READY:
                    console.log('[VMLWebviewPanel] 프론트 로딩 완료!');
                    break;
                case CommandTypes.VARIABLE_CHANGED:
                    console.log('[VMLWebviewPanel] 선택된 변수 변경:', message.payload);
                    break;
            }
        });
    }
}