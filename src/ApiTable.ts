import { CommandTypes, OsciloScopeMessage } from './OsciloScopeMessage';
import {
    LogFileLoadedPayload,
    RunValidationPayload,
    ToolCreatedPayload,
    ToolErrorPayload,
    ToolsListPayload,
    UpdateAllDataPayload,
    ValidationReport
} from './tool/types';

/**
 * ApiTable (BE) — 확장의 단일 통신 창구 (그림의 "BE-API Table")
 *
 * 세 웹뷰(메인 패널·사이드바·검사 패널)의 송·수신이 이 테이블로 모인다. 각 채널은
 * 자기 전송 함수를 `outbound(post)`에 넘겨 이름 붙은 발신 엔드포인트를 얻고, 수신은
 * `route()`로 command → 핸들러 라우팅만 한다. 실제 처리(로그 파싱·도구 관리·검사)는
 * 뒤의 모듈(LogParser·ToolRegistry/ToolTemplate·ValidationPanel)이 맡는다 —
 * 테이블은 "누구에게 넘길지"만 정한다.
 *
 * 커맨드 문자열 정본은 OsciloScopeMessage.ts이고, 프론트는 osciloscope/js/ApiTable.js가 쓴다.
 */

export type PostMessage = (message: OsciloScopeMessage) => void;

// ext → webview 발신 엔드포인트. 채널의 post 함수에 bind해서 쓴다.
export function outbound(post: PostMessage) {
    return {
        updateAllData    : (payload: UpdateAllDataPayload) => post({ command: CommandTypes.UPDATE_ALL_DATA, payload }),
        logFileLoaded    : (payload: LogFileLoadedPayload) => post({ command: CommandTypes.LOG_FILE_LOADED, payload }),
        toolsList        : (payload: ToolsListPayload)     => post({ command: CommandTypes.TOOLS_LIST, payload }),
        toolCreated      : (payload: ToolCreatedPayload)   => post({ command: CommandTypes.TOOL_CREATED, payload }),
        toolsChanged     : ()                              => post({ command: CommandTypes.TOOLS_CHANGED, payload: {} }),
        validationResult : (payload: ValidationReport)     => post({ command: CommandTypes.VALIDATION_RESULT, payload }),
        runValidation    : (payload: RunValidationPayload) => post({ command: CommandTypes.RUN_VALIDATION, payload }),
        toolError        : (payload: ToolErrorPayload)     => post({ command: CommandTypes.TOOL_ERROR, payload })
    };
}

// webview → ext 수신 라우팅 테이블. command → 핸들러.
export type MessageHandlers = Partial<Record<CommandTypes, (payload: any) => void>>;

export function route(message: OsciloScopeMessage, handlers: MessageHandlers): void {
    const handler = handlers[message.command];
    if (handler) {
        handler(message.payload);
    }
}
