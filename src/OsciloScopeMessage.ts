export enum CommandTypes {
    UPDATE_ALL_DATA  = "UPDATE_ALL_DATA",
    VARIABLE_CHANGED = "VARIABLE_CHANGED",
    UI_READY         = "UI_READY",
    SELECT_LOG_FILE  = "SELECT_LOG_FILE",  // sidebar webview → ext: 파일 다이얼로그로 로그 파일 선택 요청
    LOG_FILE_LOADED  = "LOG_FILE_LOADED",  // ext → sidebar webview: 선택된 로그 파일의 절대경로 통지
    START_RENDER     = "START_RENDER",     // sidebar webview → ext: 선택된 로그 파일로 메인 패널 렌더링 시작
    GET_TOOLS_LIST   = "GET_TOOLS_LIST",   // sidebar webview → ext: tools/ 폴더 목록 요청
    TOOLS_LIST       = "TOOLS_LIST"        // ext → sidebar webview: tools/ 폴더 하위 파일 목록
}

export interface OsciloScopeMessage {
    command : CommandTypes;
    payload : Object;
}
