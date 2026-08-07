import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogParser } from './LogParser';
import { OsciloScopeWebviewPanel } from './OsciloScopeWebviewPanel';
import { CommandTypes } from './OsciloScopeMessage';
import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('[ExtensionManager] OsciloScope Extension 시작!');

    // 기존 커맨드 안에 있던 로직을 재사용 가능한 함수로 분리
    // (사이드바에서 파일 선택했을 때도 동일한 로직을 타야 하므로)
    const loadLogFile = (logPath: string) => {
        if (!fs.existsSync(logPath)) {
            vscode.window.showErrorMessage(`OsciloScope: 로그 파일을 찾을 수 없습니다. (${logPath})`);
            return;
        }

        const parser = new LogParser(logPath);
        const rawLogs = parser.parseLogFile();
        const data = parser.transformData(rawLogs);

        OsciloScopeWebviewPanel.createOrShow(context.extensionUri);

        OsciloScopeWebviewPanel.sendDataToWebview({
            command: CommandTypes.UPDATE_ALL_DATA,
            payload: data
        });
    };

    // 사이드바 웹뷰 프로바이더 등록
    const sidebarProvider = new SidebarProvider(context.extensionUri, (absolutePath) => {
        loadLogFile(absolutePath);
    });

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('osciloscope.sidebarView', sidebarProvider)
    );

    const command = vscode.commands.registerCommand('osciloscope.openVisualizer', () => {
        const defaultLogPath = path.join(context.extensionUri.fsPath, 'log.jsonl');
        loadLogFile(defaultLogPath);
    });

    context.subscriptions.push(command);
}

export function deactivate() {}
