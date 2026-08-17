import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogParser } from './LogParser';
import { OsciloScopeWebviewPanel } from './OsciloScopeWebviewPanel';
import { CommandTypes } from './OsciloScopeMessage';
import { SidebarProvider } from './SidebarProvider';
import { ToolRegistry } from './tool/ToolRegistry';
import { ToolTemplate } from './tool/ToolTemplate';
import { ValidationPanel } from './tool/ValidationPanel';
import { DEFAULT_TOOL_ID, UpdateAllDataPayload } from './tool/types';

export function activate(context: vscode.ExtensionContext) {
    console.log('[ExtensionManager] OsciloScope Extension 시작!');

    const output = vscode.window.createOutputChannel('OsciloScope');

    // 도구 파일 탐색·감시. 확장은 도구 코드를 실행하지 않고 파일 정보만 다룬다.
    const toolRegistry = new ToolRegistry(context.extensionUri);
    const toolTemplate = new ToolTemplate(context.extensionUri, toolRegistry, output);
    const validation   = new ValidationPanel(context.extensionUri, toolRegistry, output);

    // 기존 커맨드 안에 있던 로직을 재사용 가능한 함수로 분리
    // (사이드바에서 파일 선택했을 때도 동일한 로직을 타야 하므로)
    const loadLogFile = (logPath: string, selectedToolId?: string) => {
        if (!fs.existsSync(logPath)) {
            vscode.window.showErrorMessage(`OsciloScope: 로그 파일을 찾을 수 없습니다. (${logPath})`);
            return;
        }

        // 확장은 파싱만 한다. 가공은 웹뷰에서 도구의 analyze()가 맡는다.
        const parser = new LogParser(logPath);
        const rawLogs = parser.parseLogFile();

        OsciloScopeWebviewPanel.createOrShow(context.extensionUri);

        // 메인 패널 헤더(#hdrPath)에 선택 파일 경로 표시.
        // (UI_READY 전이면 sendDataToWebview가 버퍼링 후 flush)
        OsciloScopeWebviewPanel.sendDataToWebview({
            command: CommandTypes.LOG_FILE_LOADED,
            payload: { fileName: path.basename(logPath), filePath: logPath }
        });

        // 실행할 도구를 정한다. 고르지 않았으면 기본 도구로 떨어진다.
        const toolId = selectedToolId ?? DEFAULT_TOOL_ID;
        const tool   = toolRegistry.find(toolId);

        if (!tool || tool.error) {
            const reason = tool?.error ?? '도구를 찾을 수 없습니다';
            output.appendLine(`[OsciloScope] 도구를 실행할 수 없습니다 (${toolId}): ${reason}`);
            vscode.window.showErrorMessage(`OsciloScope: 도구를 실행할 수 없습니다. (${toolId}: ${reason})`);
            return;
        }

        // URI는 메인 패널 웹뷰 기준으로 계산해야 한다. 사이드바용을 재사용하면 로드에 실패한다.
        const toolUri = OsciloScopeWebviewPanel.toWebviewUri(tool.fileUri);
        if (!toolUri) {
            output.appendLine('[OsciloScope] 메인 패널이 열려 있지 않아 도구 URI를 만들 수 없습니다.');
            return;
        }

        const payload: UpdateAllDataPayload = {
            filePath : logPath,
            rawLogs,
            tool     : { id: tool.id, uri: toolUri }
        };

        OsciloScopeWebviewPanel.sendDataToWebview({
            command: CommandTypes.UPDATE_ALL_DATA,
            payload
        });
    };

    // 사이드바 웹뷰 프로바이더 등록 (파일 선택 단일 진입점)
    const sidebarProvider = new SidebarProvider(
        context.extensionUri,
        toolRegistry,
        toolTemplate,
        validation,
        (absolutePath, toolId) => { loadLogFile(absolutePath, toolId); }
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
