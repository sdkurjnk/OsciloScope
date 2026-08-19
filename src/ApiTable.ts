import { RawLog } from './LogParser';
import { ToolInfo, ValidationReport } from './tool/types';

/**
 * ApiTable (BE) — 확장의 단일 통신 창구이자 프로토콜 정의의 단일 출처 (그림의 "BE-API Table")
 *
 * "어떤 메시지가 있고(커맨드), 무엇을 싣고(payload), 어떻게 주고받는가(outbound/route)"가
 * 이 파일 한 곳에 모여 있다. 세 웹뷰(메인 패널·사이드바·검사 패널)의 송·수신이 여기로 모인다.
 *
 * 커맨드 문자열의 정본도 여기다. osciloscope/js/constants.js는 이 파일의 enum에서 자동 생성된다
 * (scripts/gen-constants.mjs, npm run compile에 포함). 커맨드/페이즈를 바꾸면 여기만 고치고
 * `npm run gen:constants`로 웹뷰용 미러를 갱신한다 — constants.js를 직접 손대지 말 것.
 *
 * payload가 참조하는 도구 도메인 타입(RawLog·ToolInfo·ValidationReport)은 각자의 집
 * (LogParser·tool/types)에 두고 여기서 import한다.
 */

// ===== 프로토콜 어휘 (커맨드) =====

export enum CommandTypes {
    UPDATE_ALL_DATA   = "UPDATE_ALL_DATA",   // ext → 메인 웹뷰: 원본 로그 + 실행할 도구 (UpdateAllDataPayload)
    UI_READY          = "UI_READY",
    SELECT_LOG_FILE   = "SELECT_LOG_FILE",   // sidebar webview → ext: 파일 다이얼로그로 로그 파일 선택 요청
    LOG_FILE_LOADED   = "LOG_FILE_LOADED",   // ext → sidebar webview: 선택된 로그 파일의 절대경로 통지
    START_RENDER      = "START_RENDER",      // sidebar webview → ext: 선택된 로그 파일 + 도구로 메인 패널 렌더링 시작
    GET_TOOLS_LIST    = "GET_TOOLS_LIST",    // sidebar webview → ext: 도구 목록 요청
    TOOLS_LIST        = "TOOLS_LIST",        // ext → sidebar webview: 도구 파일 목록 (ToolsListPayload)

    // --- 플러그인 구조 ---
    // 확장은 도구 코드를 실행하지 않는다. 목록의 meta(name/version)는 웹뷰가 import해서 채운다.
    SELECT_TOOL       = "SELECT_TOOL",       // sidebar webview → ext: 실행할 도구 선택 (SelectToolPayload)
    CREATE_TOOL       = "CREATE_TOOL",       // sidebar webview → ext: 스켈레톤 도구 파일 생성 요청 (payload 없음)
    COPY_TOOL         = "COPY_TOOL",         // sidebar webview → ext: 번들 도구를 워크스페이스로 복사 (CopyToolPayload)
    OPEN_TOOL         = "OPEN_TOOL",         // sidebar webview → ext: 도구 파일을 에디터로 열기 (OpenToolPayload)
    TOOL_CREATED      = "TOOL_CREATED",      // ext → sidebar webview: 생성 완료 통지 (ToolCreatedPayload)
    TOOLS_CHANGED     = "TOOLS_CHANGED",     // ext → sidebar webview: 파일 감시 알림, 목록 재요청 유도 (payload 없음)
    VALIDATE_TOOL     = "VALIDATE_TOOL",     // sidebar webview → ext: 유효성 검사 실행 요청 (ValidateToolPayload)
    RUN_VALIDATION    = "RUN_VALIDATION",    // ext → 검사 패널: 검사 실행 지시 (RunValidationPayload)
    VALIDATION_RESULT = "VALIDATION_RESULT", // 검사 패널 → ext → sidebar webview: 검사 리포트 (ValidationReport)
    TOOL_ERROR        = "TOOL_ERROR"         // ext ↔ sidebar webview: 도구 로드/실행 실패 통지 (ToolErrorPayload)
}

// TOOL_ERROR payload의 phase. 도구 생명주기의 어느 단계에서 실패했는지 구분한다.
export enum ToolErrorPhase {
    LOAD    = "load",
    ANALYZE = "analyze",
    RENDER  = "render"
}

// 전선 위의 느슨한 봉투. 커맨드별 payload 타입은 아래 ProtocolMap이 묶는다.
export interface OsciloScopeMessage {
    command : CommandTypes;
    payload : Object;
}

// ===== payload =====

export interface UpdateAllDataPayload {
    filePath : string;
    rawLogs  : RawLog[];        // 파싱만 한 원본. 가공은 도구의 analyze()가 담당
    tool     : ToolRef;
}

// UPDATE_ALL_DATA에 실리는 도구 참조.
// 주의: uri는 메인 패널 웹뷰 기준으로 계산해야 한다. ToolInfo.uri(사이드바 기준)를 재사용하면 로드 실패.
export interface ToolRef {
    id  : string;
    uri : string;
}

export interface LogFileLoadedPayload {
    fileName : string;
    filePath : string;
}

export interface StartRenderPayload {
    toolId : string;
}

export interface SelectToolPayload {
    toolId : string;
}

export interface CopyToolPayload {
    toolId : string;
}

export interface OpenToolPayload {
    toolId : string;
}

export interface ValidateToolPayload {
    toolId : string;
}

export interface ToolCreatedPayload {
    toolId   : string;
    filePath : string;
}

export interface RunValidationPayload {
    toolId  : string;
    toolUri : string;           // 검사 패널 웹뷰 기준 URI
}

export interface ToolErrorPayload {
    toolId  : string;
    message : string;
    phase   : ToolErrorPhase;
}

// TOOLS_LIST의 payload. 확장은 도구를 실행할 수 없어 파일 정보(ToolInfo)만 담는다.
export interface ToolsListPayload {
    tools          : ToolInfo[];
    trusted        : boolean;   // vscode.workspace.isTrusted — false면 사용자 도구 미로드
    workspaceReady : boolean;   // 워크스페이스 유무 — false면 '만들기' 비활성
}

// ===== 커맨드 ↔ payload 계약 =====

/** payload가 없는 커맨드(UI_READY 등)의 빈 payload 타입. */
export type EmptyPayload = Record<string, never>;

/**
 * 커맨드 ↔ payload 계약. "어떤 커맨드가 무엇을 싣는가"의 단일 정본.
 * 커맨드를 추가·변경하면 여기에 payload를 연결하면 outbound/route가 타입을 따라간다.
 * payload 인터페이스를 고치면 관련 송·수신부에 컴파일 에러가 떠서 고칠 곳을 놓치지 않는다.
 */
export interface ProtocolMap {
    // 방향(보내는 쪽 → 받는 쪽) · 무엇을
    [CommandTypes.UPDATE_ALL_DATA]:   UpdateAllDataPayload;   // ext → 메인패널: 원본 로그 + 실행할 도구
    [CommandTypes.UI_READY]:          EmptyPayload;           // 웹뷰 → ext: 프론트 준비 완료 신호
    [CommandTypes.SELECT_LOG_FILE]:   EmptyPayload;           // 사이드바 → ext: 로그 파일 선택 요청
    [CommandTypes.LOG_FILE_LOADED]:   LogFileLoadedPayload;   // ext → 사이드바/메인: 선택된 파일명·경로
    [CommandTypes.START_RENDER]:      StartRenderPayload;     // 사이드바 → ext: 선택 도구로 렌더 시작 요청
    [CommandTypes.GET_TOOLS_LIST]:    EmptyPayload;           // 사이드바 → ext: 도구 목록 요청
    [CommandTypes.TOOLS_LIST]:        ToolsListPayload;       // ext → 사이드바: 도구 파일 목록 회신
    [CommandTypes.SELECT_TOOL]:       SelectToolPayload;      // 사이드바 → ext: 선택한 도구 id 통지
    [CommandTypes.CREATE_TOOL]:       EmptyPayload;           // 사이드바 → ext: 스켈레톤 도구 생성 요청
    [CommandTypes.COPY_TOOL]:         CopyToolPayload;        // 사이드바 → ext: 번들 도구 복사 요청
    [CommandTypes.OPEN_TOOL]:         OpenToolPayload;        // 사이드바 → ext: 도구 파일 열기 요청
    [CommandTypes.TOOL_CREATED]:      ToolCreatedPayload;     // ext → 사이드바: 생성·복사된 도구 통지
    [CommandTypes.TOOLS_CHANGED]:     EmptyPayload;           // ext → 사이드바: 도구 파일 변경 알림(목록 재요청 유도)
    [CommandTypes.VALIDATE_TOOL]:     ValidateToolPayload;    // 사이드바 → ext: 유효성 검사 실행 요청
    [CommandTypes.RUN_VALIDATION]:    RunValidationPayload;   // ext → 검사패널: 검사 실행 지시(도구 URI 포함)
    [CommandTypes.VALIDATION_RESULT]: ValidationReport;       // 검사패널 → ext → 사이드바: 검사 리포트
    [CommandTypes.TOOL_ERROR]:        ToolErrorPayload;       // 웹뷰 → ext: 도구 로드/실행 실패 통지
}

/** 봉투와 payload가 command로 묶인 판별 유니온(원하는 쪽에서 쓴다). */
export type ProtocolMessage = {
    [K in keyof ProtocolMap]: { command: K; payload: ProtocolMap[K] };
}[keyof ProtocolMap];

// ===== 발신 / 수신 =====

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
