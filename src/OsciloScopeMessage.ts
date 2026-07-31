export enum CommandTypes {
    UPDATE_ALL_DATA  = "UPDATE_ALL_DATA",
    VARIABLE_CHANGED = "VARIABLE_CHANGED",
    UI_READY         = "UI_READY",
    SELECT_LOG_FILE  = "SELECT_LOG_FILE",  // webview → ext: 파일 다이얼로그로 로그 파일 선택 요청
    LOG_FILE_LOADED  = "LOG_FILE_LOADED",  // ext → webview: 선택된 로그 파일의 절대경로 통지
    GET_TOOLS_LIST   = "GET_TOOLS_LIST",   // webview → ext: tools/ 폴더 목록 요청
    TOOLS_LIST       = "TOOLS_LIST"        // ext → webview: tools/ 폴더 하위 파일 목록
}

export interface OsciloScopeMessage {
    command : CommandTypes;
    payload : Object;
}

export type MessageHandlers = Partial<Record<CommandTypes, (payload: any) => void>>;
