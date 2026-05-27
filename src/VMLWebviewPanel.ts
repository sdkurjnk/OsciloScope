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
            { enableScripts: true }
        );

        const htmlPath = path.join(extensionUri.fsPath, 'webview', 'index.html');
        VMLWebviewPanel.panel.webview.html = fs.readFileSync(htmlPath, 'utf-8');

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