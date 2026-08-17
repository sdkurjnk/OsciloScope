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

export interface OsciloScopeMessage {
    command : CommandTypes;
    payload : Object;
}
