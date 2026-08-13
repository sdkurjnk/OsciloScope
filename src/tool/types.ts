import { RawLog } from '../LogParser';

// 도구 파일명 규칙: <id>.tool.js — 로더/스캐너는 이 패턴에 맞는 파일만 도구로 인식한다.
export const TOOL_FILE_SUFFIX = '.tool.js';

// 도구 ID 형식. 파일명·meta.id·생성 시 InputBox 검증이 모두 이 규칙을 공유한다.
export const TOOL_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// 워크스페이스 내 사용자 도구 위치 (<워크스페이스 루트>/.osciloscope/tools/)
export const USER_TOOLS_DIR = ['.osciloscope', 'tools'];

// 번들 도구 위치 (<확장 설치 경로>/tools/)
export const BUILTIN_TOOLS_DIR = 'tools';

export type ToolSource = 'builtin' | 'user';

// TOOLS_LIST의 항목. 확장은 도구를 실행할 수 없으므로 파일 정보만 담는다.
// name/version은 사이드바 웹뷰가 import 후 meta에서 읽어 채운다.
export interface ToolInfo {
    id         : string;        // 파일명에서 추출 (<id>.tool.js)
    source     : ToolSource;
    uri        : string;        // asWebviewUri 변환 결과 — 사이드바 웹뷰 기준
    mtime      : number;        // ESM 캐시 무효화용 (import(uri + '?v=' + mtime))
    overrides ?: boolean;       // 같은 id의 번들 도구를 재정의한 사용자 도구
    error     ?: string;        // 확장 단계에서 이미 실패 (ID 중복, 형식 위반 등)
}

export interface ToolsListPayload {
    tools          : ToolInfo[];
    trusted        : boolean;   // vscode.workspace.isTrusted — false면 사용자 도구 미로드
    workspaceReady : boolean;   // 워크스페이스 유무 — false면 '만들기' 비활성
}

// UPDATE_ALL_DATA에 실리는 도구 참조.
// 주의: uri는 메인 패널 웹뷰 기준으로 계산해야 한다. ToolInfo.uri(사이드바 기준)를 재사용하면 로드 실패.
export interface ToolRef {
    id  : string;
    uri : string;
}

export interface UpdateAllDataPayload {
    filePath : string;
    rawLogs  : RawLog[];        // 파싱만 한 원본. 가공은 도구의 analyze()가 담당
    tool     : ToolRef;
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

export type ToolErrorPhase = 'load' | 'analyze' | 'render';

export interface ToolErrorPayload {
    toolId  : string;
    message : string;
    phase   : ToolErrorPhase;
}

// --- 유효성 검사 ---

// 표준 픽스처. ToolValidator가 이 순서대로 주입한다.
export type FixtureName = 'normal' | 'empty' | 'deleted' | 'recursive' | 'legacy';

export type ValidationStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface ValidationCheck {
    name     : string;          // '영역 격리', '렌더 결정성' 등
    status   : ValidationStatus;
    fixture ?: FixtureName;     // 어느 픽스처에서 났는지
    message  : string;          // 실패 시 구체적 위치 포함
}

export interface ValidationReport {
    toolId : string;
    ok     : boolean;           // fail이 하나도 없으면 true
    checks : ValidationCheck[];
}
