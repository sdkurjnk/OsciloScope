import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogParser } from './LogParser';
import { OsciloScopeWebviewPanel } from './OsciloScopeWebviewPanel';
import { CommandTypes } from './OsciloScopeMessage';
import { ToolsProvider } from './ToolsProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('[ExtensionManager] OsciloScope Extension 시작!');

    const loadLogFile = (logPath: string) => {
        if (!fs.existsSync(logPath)) {
            vscode.window.showErrorMessage(`OsciloScope: 로그 파일을 찾을 수 없습니다. (${logPath})`);
            return;
        }

        const parser = new LogParser(logPath);
        const rawLogs = parser.parseLogFile();
        const data = parser.transformData(rawLogs);

        OsciloScopeWebviewPanel.sendDataToWebview({
            command: CommandTypes.LOG_FILE_LOADED,
            payload: { fileName: path.basename(logPath), filePath: logPath }
        });

        OsciloScopeWebviewPanel.sendDataToWebview({
            command: CommandTypes.UPDATE_ALL_DATA,
            payload: data
        });
    };

    const selectLogFile = async () => {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Log Files': ['jsonl'] },
            openLabel: '로그 파일 선택'
        });

        if (!uris || uris.length === 0) {
            return;
        }

        loadLogFile(uris[0].fsPath);
    };

    const sendToolsList = () => {
        const tools = ToolsProvider.listTools(context.extensionUri.fsPath);
        OsciloScopeWebviewPanel.sendDataToWebview({
            command: CommandTypes.TOOLS_LIST,
            payload: { tools }
        });
    };

    const command = vscode.commands.registerCommand('osciloscope.openVisualizer', () => {
        OsciloScopeWebviewPanel.createOrShow(context.extensionUri, {
            [CommandTypes.SELECT_LOG_FILE]: selectLogFile,
            [CommandTypes.GET_TOOLS_LIST]: sendToolsList
        });

        const defaultLogPath = path.join(context.extensionUri.fsPath, 'log.jsonl');
        loadLogFile(defaultLogPath);
    });

    context.subscriptions.push(command);
}

export function deactivate() {}