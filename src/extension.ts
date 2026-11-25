import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LogParser, RawLog } from './LogParser';
import { OsciloScopeWebviewPanel } from './OsciloScopeWebviewPanel';
import { outbound, UpdateAllDataPayload } from './ApiTable';
import { SidebarProvider } from './SidebarProvider';
import { ToolRegistry } from './tool/ToolRegistry';
import { ValidationPanel } from './tool/ValidationPanel';
import { DEFAULT_TOOL_ID } from './tool/types';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('[ExtensionManager] OsciloScope Extension 시작!');

    const output = vscode.window.createOutputChannel('OsciloScope');

    // 플러그인 전역 저장소. 개발 중(F5)에도 프로젝트 폴더가 아니라 VS Code 사용자 데이터 폴더 아래에 있어서
    // 샘플 플러그인을 어디에 복사해야 하는지 알 수 있게 실제 경로를 남긴다 (계획서 3단계).
    const storagePath = context.globalStorageUri.fsPath;
    output.appendLine(`[OsciloScope] 플러그인 저장소: ${storagePath}`);
    console.log(`[ExtensionManager] globalStorageUri: ${storagePath}`);

    // 도구(플러그인) 탐색·감시. 확장은 도구 코드를 실행하지 않고 plugin.json만 읽는다.
    // 개발 모드에서는 기본 도구를 매번 다시 시드해, 번들 코드 수정이 버전을 올리지 않아도 반영되게 한다.
    const toolRegistry = new ToolRegistry(context.extensionUri, context.globalStorageUri, output, {
        refreshBundled: context.extensionMode === vscode.ExtensionMode.Development
    });
    const validation = new ValidationPanel(context.extensionUri, toolRegistry, output);

    // 메인 패널로 보내는 발신은 전부 이 테이블을 거친다 (BE-API Table).
    // sendDataToWebview가 UI_READY 전 메시지 버퍼링·패널 부재 처리를 맡는다.
    const panelApi = outbound(message => OsciloScopeWebviewPanel.sendDataToWebview(message));

    // 사이드바 START에서 호출된다.
    const loadLogFile = async (logPath: string, selectedToolId?: string): Promise<void> => {
        if (!fs.existsSync(logPath)) {
            vscode.window.showErrorMessage(`OsciloScope: 로그 파일을 찾을 수 없습니다. (${logPath})`);
            return;
        }

        // 확장은 파싱만 한다. 가공은 웹뷰에서 도구가 맡는다.
        // 빈 파일·깨진 줄은 JSON.parse에서 던지므로, 사용자에게 사유를 보여주고 멈춘다.
        let rawLogs: RawLog[];
        try {
            rawLogs = new LogParser(logPath).parseLogFile();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            output.appendLine(`[OsciloScope] 로그 파싱 실패 (${logPath}): ${message}`);
            vscode.window.showErrorMessage(`OsciloScope: 로그 파일을 읽지 못했습니다. (${message})`);
            return;
        }

        // 실행할 도구를 정한다. 고르지 않았으면 기본 도구로 떨어진다.
        const toolId = selectedToolId ?? DEFAULT_TOOL_ID;
        const tool   = await toolRegistry.find(toolId);

        if (!tool || tool.error || !tool.fileUri) {
            const reason = tool?.error
                ?? (selectedToolId ? '설치되지 않았거나 비활성화된 도구입니다' : '기본 도구가 비활성화되어 있습니다. 도구를 선택하세요');
            output.appendLine(`[OsciloScope] 도구를 실행할 수 없습니다 (${toolId}): ${reason}`);
            vscode.window.showErrorMessage(`OsciloScope: 도구를 실행할 수 없습니다. (${toolId}: ${reason})`);
            return;
        }

        OsciloScopeWebviewPanel.createOrShow(context.extensionUri, context.globalStorageUri);

        // 메인 패널 헤더(#hdrPath)에 선택 파일 경로 표시.
        // (UI_READY 전이면 sendDataToWebview가 버퍼링 후 flush)
        panelApi.logFileLoaded({ fileName: path.basename(logPath), filePath: logPath });

        // URI는 메인 패널 웹뷰 기준으로 계산해야 한다. 사이드바용을 재사용하면 로드에 실패한다.
        const toolUri = OsciloScopeWebviewPanel.toWebviewUri(tool.fileUri);
        if (!toolUri) {
            output.appendLine('[OsciloScope] 메인 패널이 열려 있지 않아 도구 URI를 만들 수 없습니다.');
            return;
        }

        // mtime: 웹뷰가 같은 도구의 START 재실행(onLogUpdate)과 파일 수정(새로 import)을 구분하는 키.
        const payload: UpdateAllDataPayload = {
            filePath : logPath,
            rawLogs,
            tool     : { id: tool.id, uri: toolUri, mtime: tool.mtime }
        };

        panelApi.updateAllData(payload);
    };

    // 사이드바 웹뷰 프로바이더 등록 (파일 선택 단일 진입점)
    const sidebarProvider = new SidebarProvider(
        context.extensionUri,
        toolRegistry,
        validation,
        output,
        loadLogFile
    );

    // 메인 패널에서 도구가 실패하면 사이드바에 알린다 (실패 표시·선택 해제).
    OsciloScopeWebviewPanel.onToolError = payload => {
        output.appendLine(`[OsciloScope] 도구 실행 실패 (${payload.toolId} / ${payload.phase}): ${payload.message}`);
        sidebarProvider.notifyToolError(payload);
    };

    // 저장소가 바뀌면(installed.json 수정, 플러그인 폴더 추가·삭제) 사이드바가 목록을 다시 받게 한다.
    toolRegistry.watch(() => sidebarProvider.notifyToolsChanged());

    context.subscriptions.push(
        output,
        toolRegistry,
        vscode.window.registerWebviewViewProvider('osciloscope.sidebarView', sidebarProvider),
        { dispose: () => { OsciloScopeWebviewPanel.onToolError = undefined; } }
    );

    // plugins/ 폴더 생성 + 기본 도구 시드. 그 사이 목록 요청은 registry가 시드를 기다렸다 응답한다.
    await toolRegistry.initialize();
}

export function deactivate() {}
