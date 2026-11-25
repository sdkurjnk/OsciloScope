// 도구(플러그인) ID 형식. plugin.json의 id·installed.json의 키·설치 폴더명이 모두 이 규칙을 공유한다.
export const TOOL_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// 도구를 고르지 않았을 때 실행되는 기본 도구 (시드로 전역 저장소에 설치된다).
export const DEFAULT_TOOL_ID = 'change-detector';

// 검사 전체 제한 시간. 초과하면 패널을 dispose해서 그 안에서 돌던 코드까지 함께 없앤다.
// 도구가 while(true)에 빠져도 회수할 수 있으므로 실행 시간은 warn이 아니라 fail이다 (설계문서 §7.4).
export const VALIDATION_TIMEOUT_MS = 15_000;

// 검사 로직은 웹뷰에서 돈다. 확장은 이 모듈을 로드할 껍데기 패널만 띄운다.
export const VALIDATOR_MODULE = ['osciloscope', 'tool-host', 'ToolValidator.js'];

// 도구의 출처. 로드 경로는 전역 저장소 하나이고, 이 값은 표시용 구분이다.
// - builtin : 확장에 함께 배포되어 시드로 설치된 기본 도구
// - user    : 사용자가 전역 저장소에 직접(수동) 설치한 플러그인
export type ToolSource = 'builtin' | 'user';

// TOOLS_LIST의 항목. 확장은 도구 코드를 실행하지 않는다.
// 표시 정보(name/version/description/hostApi)는 plugin.json에서 읽으므로
// 웹뷰가 목록을 만들기 위해 도구를 import할 필요가 없다.
export interface ToolInfo {
    id          : string;       // plugin.json의 id (= installed.json 키)
    name        : string;       // 표시 이름. plugin.json을 읽지 못했으면 id
    version     : string;       // 설치된 버전 (installed.json 기준)
    description : string;
    hostApi     : string;       // plugin.json의 hostApi. 읽지 못했으면 빈 문자열
    source      : ToolSource;
    uri         : string;       // 진입 파일의 asWebviewUri 결과 — 받는 웹뷰 기준. error면 빈 문자열
    mtime       : number;       // ESM 캐시 무효화용 (import(uri + '?v=' + mtime))
    error      ?: string;       // 확장 단계에서 이미 실패 (plugin.json 오류, hostApi 비호환, 진입 파일 없음 등)
}

// 메시지 payload(ToolsListPayload·UpdateAllDataPayload·ToolErrorPayload 등)와 ToolErrorPhase는
// 프로토콜 정의라서 src/ApiTable.ts에 있다. 여기에는 도구 도메인 타입만 둔다.
// plugin.json · installed.json 계약은 src/tool/plugin.ts에 있다.

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
