import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogParser } from './LogParser';
import { OsciloScopeWebviewPanel } from './OsciloScopeWebviewPanel';
import { CommandTypes } from './OsciloScopeMessage';
import { SidebarProvider } from './SidebarProvider';
import { ToolRegistry } from './tool/ToolRegistry';
import { ToolTemplate } from './tool/ToolTemplate';

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

        // 메인 패널 헤더(#hdrPath)에 선택 파일 경로 표시.
        // (UI_READY 전이면 sendDataToWebview가 버퍼링 후 flush)
        OsciloScopeWebviewPanel.sendDataToWebview({
            command: CommandTypes.LOG_FILE_LOADED,
            payload: { fileName: path.basename(logPath), filePath: logPath }
        });

        OsciloScopeWebviewPanel.sendDataToWebview({
            command: CommandTypes.UPDATE_ALL_DATA,
            payload: data
        });
    };

    const output = vscode.window.createOutputChannel('OsciloScope');

    // 도구 파일 탐색·감시. 확장은 도구 코드를 실행하지 않고 파일 정보만 다룬다.
    const toolRegistry = new ToolRegistry(context.extensionUri);
    const toolTemplate = new ToolTemplate(context.extensionUri, toolRegistry, output);

    // 사이드바 웹뷰 프로바이더 등록 (파일 선택 단일 진입점)
    const sidebarProvider = new SidebarProvider(
        context.extensionUri,
        toolRegistry,
        toolTemplate,
        (absolutePath) => { loadLogFile(absolutePath); }
    );

    // 도구 파일이 바뀌면 사이드바가 목록을 다시 받게 한다.
    // 이게 없으면 사용자가 파일을 만들어도 사이드바를 다시 열기 전까지 나타나지 않는다.
    toolRegistry.watch(() => sidebarProvider.notifyToolsChanged());

    context.subscriptions.push(
        output,
        toolRegistry,
        vscode.window.registerWebviewViewProvider('osciloscope.sidebarView', sidebarProvider)
    );
}

export function deactivate() {}
