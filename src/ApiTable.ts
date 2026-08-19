import { CommandTypes, OsciloScopeMessage } from './OsciloScopeMessage';
import {
    CopyToolPayload,
    LogFileLoadedPayload,
    OpenToolPayload,
    RunValidationPayload,
    SelectToolPayload,
    StartRenderPayload,
    ToolCreatedPayload,
    ToolErrorPayload,
    ToolsListPayload,
    UpdateAllDataPayload,
    ValidateToolPayload,
    ValidationReport
} from './tool/types';

/**
 * ApiTable (BE) — 확장의 단일 통신 창구 (그림의 "BE-API Table")
 *
 * 세 웹뷰(메인 패널·사이드바·검사 패널)의 송·수신이 이 테이블로 모인다. 각 채널은
 * 자기 전송 함수를 `outbound(post)`에 넘겨 이름 붙은 발신 엔드포인트를 얻고, 수신은
 * `route()`로 command → 핸들러 라우팅만 한다.
 *
 * 커맨드 ↔ payload는 아래 ProtocolMap 한 곳에 묶여 있다. payload 인터페이스를 고치면
 * 관련 송·수신부에 컴파일 에러가 떠서, 개발 중 계약이 바뀌어도 고칠 곳을 놓치지 않는다.
 */

/** payload가 없는 커맨드(UI_READY 등)의 빈 payload 타입. */
export type EmptyPayload = Record<string, never>;

/**
 * 커맨드 ↔ payload 계약. "어떤 커맨드가 무엇을 싣는가"의 단일 정본.
 * 커맨드를 추가·변경하면 여기에 payload를 연결하면 outbound/route가 타입을 따라간다.
 */
export interface ProtocolMap {
    [CommandTypes.UPDATE_ALL_DATA]:   UpdateAllDataPayload;
    [CommandTypes.UI_READY]:          EmptyPayload;
    [CommandTypes.SELECT_LOG_FILE]:   EmptyPayload;
    [CommandTypes.LOG_FILE_LOADED]:   LogFileLoadedPayload;
    [CommandTypes.START_RENDER]:      StartRenderPayload;
    [CommandTypes.GET_TOOLS_LIST]:    EmptyPayload;
    [CommandTypes.TOOLS_LIST]:        ToolsListPayload;
    [CommandTypes.SELECT_TOOL]:       SelectToolPayload;
    [CommandTypes.CREATE_TOOL]:       EmptyPayload;
    [CommandTypes.COPY_TOOL]:         CopyToolPayload;
    [CommandTypes.OPEN_TOOL]:         OpenToolPayload;
    [CommandTypes.TOOL_CREATED]:      ToolCreatedPayload;
    [CommandTypes.TOOLS_CHANGED]:     EmptyPayload;
    [CommandTypes.VALIDATE_TOOL]:     ValidateToolPayload;
    [CommandTypes.RUN_VALIDATION]:    RunValidationPayload;
    [CommandTypes.VALIDATION_RESULT]: ValidationReport;
    [CommandTypes.TOOL_ERROR]:        ToolErrorPayload;
}

/** 봉투와 payload가 command로 묶인 판별 유니온(원하는 쪽에서 쓴다). */
export type ProtocolMessage = {
    [K in keyof ProtocolMap]: { command: K; payload: ProtocolMap[K] };
}[keyof ProtocolMap];

export type PostMessage = (message: OsciloScopeMessage) => void;

// ext → webview 발신 엔드포인트. payload 타입은 ProtocolMap에서 따온다.
export function outbound(post: PostMessage) {
    const send = <K extends keyof ProtocolMap>(command: K, payload: ProtocolMap[K]) =>
        post({ command, payload });

    return {
        updateAllData:    (payload: ProtocolMap[CommandTypes.UPDATE_ALL_DATA])   => send(CommandTypes.UPDATE_ALL_DATA, payload),
        logFileLoaded:    (payload: ProtocolMap[CommandTypes.LOG_FILE_LOADED])   => send(CommandTypes.LOG_FILE_LOADED, payload),
        toolsList:        (payload: ProtocolMap[CommandTypes.TOOLS_LIST])        => send(CommandTypes.TOOLS_LIST, payload),
        toolCreated:      (payload: ProtocolMap[CommandTypes.TOOL_CREATED])      => send(CommandTypes.TOOL_CREATED, payload),
        toolsChanged:     ()                                                     => send(CommandTypes.TOOLS_CHANGED, {}),
        validationResult: (payload: ProtocolMap[CommandTypes.VALIDATION_RESULT]) => send(CommandTypes.VALIDATION_RESULT, payload),
        runValidation:    (payload: ProtocolMap[CommandTypes.RUN_VALIDATION])    => send(CommandTypes.RUN_VALIDATION, payload),
        toolError:        (payload: ProtocolMap[CommandTypes.TOOL_ERROR])        => send(CommandTypes.TOOL_ERROR, payload)
    };
}

// webview → ext 수신 라우팅. 핸들러는 payload 타입을 ProtocolMap에서 자동으로 받는다(캐스팅 불필요).
export type ProtocolHandlers = {
    [K in keyof ProtocolMap]?: (payload: ProtocolMap[K]) => void;
};

export function route(message: OsciloScopeMessage, handlers: ProtocolHandlers): void {
    const handler = handlers[message.command] as ((payload: unknown) => void) | undefined;
    if (handler) {
        handler(message.payload);
    }
}
