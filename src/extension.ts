import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogParser } from './LogParser';
import { OsciloScopeWebviewPanel } from './OsciloScopeWebviewPanel';
import { CommandTypes } from './OsciloScopeMessage';

export function activate(context: vscode.ExtensionContext) {
    console.log('[ExtensionManager] OsciloScope Extension 시작!');

    const command = vscode.commands.registerCommand('osciloscope.openVisualizer', () => {

        // ① LogParser 생성
        const logPath = path.join(context.extensionUri.fsPath, 'log.jsonl');

        if (!fs.existsSync(logPath)) {
            vscode.window.showErrorMessage(`OsciloScope: 로그 파일을 찾을 수 없습니다. (${logPath})`);
            return;
        }

        const parser = new LogParser(logPath);

        // ② 파일 읽기
        const rawLogs = parser.parseLogFile();

        // ③ 데이터 변환
        const data = parser.transformData(rawLogs);

        // ④ Webview 창 열기
        OsciloScopeWebviewPanel.createOrShow(context.extensionUri);

        // ⑤ 프론트로 데이터 전송
        OsciloScopeWebviewPanel.sendDataToWebview({
            command: CommandTypes.UPDATE_ALL_DATA,
            payload: data
        });
    });

    context.subscriptions.push(command);
}

export function deactivate() {}