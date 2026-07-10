export enum CommandTypes {
    UPDATE_ALL_DATA  = "UPDATE_ALL_DATA",
    VARIABLE_CHANGED = "VARIABLE_CHANGED",
    UI_READY         = "UI_READY"
}

export interface OsciloScopeMessage {
    command : CommandTypes;
    payload : Object;
}
