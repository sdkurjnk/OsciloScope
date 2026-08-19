import { RawLog } from '../LogParser';

// 도구 파일명 규칙: <id>.tool.js — 로더/스캐너는 이 패턴에 맞는 파일만 도구로 인식한다.
export const TOOL_FILE_SUFFIX = '.tool.js';

// 도구 ID 형식. 파일명·meta.id·생성 시 InputBox 검증이 모두 이 규칙을 공유한다.
export const TOOL_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// 워크스페이스 내 사용자 도구 위치 (<워크스페이스 루트>/.osciloscope/tools/)
export const USER_TOOLS_DIR = ['.osciloscope', 'tools'];

// 번들 도구 위치 (<확장 설치 경로>/tools/)
export const BUILTIN_TOOLS_DIR = 'tools';

// 워크스페이스에 배치하는 타입 정의 파일과 그 버전 스탬프.
// 확장이 가진 버전과 파일 첫 줄이 다르면 덮어쓴다 (설계문서 §5.8).
// 인터페이스가 바뀌었는데 옛 정의가 남아 실제와 어긋나는 것을 막기 위함.
export const TOOL_TYPES_FILE    = 'osciloscope-tool.d.ts';
export const TOOL_TYPES_VERSION = '0.2.0';
export const TOOL_TYPES_STAMP   = /^\/\/ @osciloscope-types\s+(\S+)/;

// 도구를 고르지 않았을 때 실행되는 번들 도구.
// 기존 transformData + 고정 화면을 그대로 옮긴 것이라 동작이 지금과 같다 (설계문서 §8).
export const DEFAULT_TOOL_ID = 'change-detector';

// 검사 전체 제한 시간. 초과하면 패널을 dispose해서 그 안에서 돌던 코드까지 함께 없앤다.
// 도구가 while(true)에 빠져도 회수할 수 있으므로 실행 시간은 warn이 아니라 fail이다 (설계문서 §7.4).
export const VALIDATION_TIMEOUT_MS = 15_000;

// 검사 로직은 웹뷰에서 돈다. 확장은 이 모듈을 로드할 껍데기 패널만 띄운다.
export const VALIDATOR_MODULE = ['osciloscope', 'tool-host', 'ToolValidator.js'];

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

// phase 값의 정본은 OsciloScopeMessage.ts의 enum이다. 여기서는 재노출만 한다.
import { ToolErrorPhase } from '../OsciloScopeMessage';
export { ToolErrorPhase };

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
