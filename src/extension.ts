import * as vscode from 'vscode';
import * as path from 'path';
import { LogParser } from './LogParser';
import { VMLWebviewPanel } from './VMLWebviewPanel';
import { CommandTypes } from './VmlMessage';

export function activate(context: vscode.ExtensionContext) {
    console.log('[ExtensionManager] VML Visualizer Extension 시작!');

    const command = vscode.commands.registerCommand('vml.openVisualizer', () => {

        // ① LogParser 생성
        const logPath = path.join(context.extensionUri.fsPath, 'log.jsonl');
		const parser = new LogParser(logPath);

        // ② 파일 읽기
        const rawLogs = parser.parseLogFile();

        // ③ 데이터 변환
        const data = parser.transformData(rawLogs);

        // ④ Webview 창 열기
        VMLWebviewPanel.createOrShow(context.extensionUri);

        // ⑤ 프론트로 데이터 전송
        VMLWebviewPanel.sendDataToWebview({
            command: CommandTypes.UPDATE_ALL_DATA,
            payload: data
        });
    });

    context.subscriptions.push(command);
}

export function deactivate() {}