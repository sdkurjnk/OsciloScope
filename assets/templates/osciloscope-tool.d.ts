// @osciloscope-types 1.0.0 — 이 파일은 확장이 생성합니다. 직접 수정하지 마세요.
//
// 분석 도구 플러그인의 계약 (Tool API Table, Host API 1.0.0).
//
//   ToolHost → Tool : ToolHostApi  — Tool이 쓸 수 있는 것은 이 객체뿐입니다.
//   Tool → ToolHost : Tool         — 진입 파일이 `export default`로 내보내는 객체입니다.
//
// 플러그인의 plugin.json `hostApi` 범위가 이 버전과 맞아야 로드됩니다.
// - 함수·필드 추가: 부 버전 올림 (1.0 → 1.1). 기존 플러그인은 그대로 동작합니다.
// - 기존 함수 변경·삭제: 주 버전 올림 (1.x → 2.0). 호환되지 않는 플러그인은 로드하지 않습니다.
//
// 진입 파일 첫 줄의 /// <reference path="./osciloscope-tool.d.ts" /> 로 연결합니다.
// 여기 선언된 타입은 전역입니다. 이 파일에 import/export를 추가하면 모듈로 바뀌어
// 진입 파일에서 타입이 보이지 않게 되므로 주의하세요.

// ─────────────────────────────────────────────────────────────
// 데이터
// ─────────────────────────────────────────────────────────────

/**
 * oscilo가 로그 파일에 남긴 이벤트 한 줄 (계획서의 LogData).
 * getLogs()와 onLogUpdate 콜백이 주는 배열의 원소이며, 절대 수정하면 안 됩니다.
 */
interface RawLog {
    /** 변수 이름 */
    name: string;
    /** 변수 값. 타입은 로그마다 다릅니다 */
    data: any;
    /** "init" | "updated" | "deleted" */
    event: string;
    /** "GLOBAL" | "LOCAL" — 소유 프레임 기준 */
    domain: string;
    /** 이벤트가 발생한 줄 번호 */
    line: number | null;
    /** 이벤트가 발생한 함수. 모듈 최상위는 "<module>" */
    func: string | null;
    /** 이벤트가 발생한 프레임의 고유 ID (불투명 ID로 취급하세요) */
    call_id: number | null;
    /** 부모 프레임의 call_id. 최상위면 null */
    parent_call_id: number | null;
    /** 호출 스택 깊이, 1부터 */
    call_depth: number | null;
    /** 변수가 정의된 소유 프레임의 call_id — 변수 정체성 키 */
    var_id: number | null;
}

/** 현재 VS Code 테마 */
type ToolTheme = 'light' | 'dark' | 'high-contrast';

// ─────────────────────────────────────────────────────────────
// 헬퍼 · 표준 위젯 (ToolHostApi를 통해 제공)
// ─────────────────────────────────────────────────────────────

/**
 * 변수 정체성 키잉·그룹핑·이스케이프 헬퍼.
 * 도구마다 다르게 구현하면 결과가 어긋나므로 이 함수들을 쓰는 것을 권합니다.
 */
interface ToolHelpers {
    /**
     * RawLog → varKey 문자열.
     * var_id가 있으면 `name@var_id`, 없으면(구버전 로그) name만 씁니다.
     * 재귀 호출처럼 이름이 같고 프레임이 다른 변수를 구분해 줍니다.
     */
    varKeyOf(log: RawLog): string;
    /** RawLog → 'Global' | 'Local' */
    groupOf(log: RawLog): 'Global' | 'Local';
    /** HTML 특수문자를 이스케이프합니다. innerHTML에 값을 넣어야 할 때 쓰세요 */
    escape(str: string): string;
}

/**
 * 한 변수의 이력 한 줄.
 * 표준 위젯(varList/timeline)을 쓸 때만 지키면 되는 권장 규격입니다.
 */
interface HistoryRow {
    /** 1부터 증가하는 순번 */
    step: number;
    /** 값. deleted 이벤트는 보통 null로 둡니다 */
    value: any;
    /** 'init' | 'updated' | 'deleted' */
    event: string;
    line?: number | null;
}

/**
 * 표준 위젯이 기대하는 변수 항목.
 * 검사기는 이 모양을 강제하지 않습니다 — 위젯을 쓰지 않는 도구는 자유롭게 설계하세요.
 */
interface VarEntry {
    varKey: string;
    varName: string;
    history: HistoryRow[];
    type?: string;
    scope?: string;
    func?: string | null;
    callId?: number | null;
    parentCallId?: number | null;
    callDepth?: number | null;
}

/** varList 위젯이 돌려주는 조작 핸들 */
interface VarListHandle {
    /** 지정한 varKey 행을 선택 상태로 표시합니다 */
    setActive(varKey: string): void;
}

interface VarListOptions {
    /** 변수 행을 클릭했을 때 호출됩니다 */
    onSelect?(varKey: string): void;
}

/**
 * 기본 UI를 재사용하기 위한 표준 위젯.
 * 위젯 스타일은 ToolHost가 컨테이너의 shadow root 안에 넣어 둡니다.
 *
 * 실험적(experimental) API입니다 — 마이너 버전에서 시그니처가 바뀔 수 있습니다.
 */
interface ToolWidgets {
    /** 좌측 목록 + 우측 본문 2단 골격을 만듭니다 */
    layout(el: HTMLElement): { left: HTMLElement; right: HTMLElement };
    /** 그룹별 변수 목록을 그립니다. groups는 그룹명 → VarEntry[] */
    varList(
        el: HTMLElement,
        groups: Record<string, VarEntry[]>,
        opts?: VarListOptions
    ): VarListHandle;
    /** 한 변수의 변경 이력을 그립니다 (증감 태그 포함). entry가 null이면 빈 화면 */
    timeline(el: HTMLElement, entry: VarEntry | null): void;
}

// ─────────────────────────────────────────────────────────────
// Tool API Table
// ─────────────────────────────────────────────────────────────

/**
 * ToolHost → Tool. activate()의 인자로 전달됩니다.
 *
 * 여기 없는 것은 의도적으로 제공하지 않습니다 — 파일 접근, 네트워크,
 * 확장으로 메시지를 보내는 통로(acquireVsCodeApi), LogParser는 쓸 수 없습니다.
 */
interface ToolHostApi {
    /** Host API 버전 (semver). 이 파일 첫 줄의 버전과 같습니다 */
    readonly apiVersion: string;

    /** 현재 파싱된 로그. 반환된 배열과 원소는 수정하지 마세요 */
    getLogs(): readonly RawLog[];

    /**
     * 로그 변경 구독. 반환값을 호출하면 구독이 해제됩니다.
     *
     * 현재는 같은 도구로 로그를 다시 읽었을 때(START 재실행) 호출됩니다.
     * 실시간 갱신 경로가 생기면 그때도 같은 콜백이 호출됩니다.
     * deactivate() 시점에 남은 구독은 ToolHost가 자동으로 해제합니다.
     */
    onLogUpdate(cb: (logs: readonly RawLog[]) => void): () => void;

    /**
     * 도구 전용 마운트 지점. ToolHost가 만든 shadow root(open) 안의 div입니다.
     * 이 안에만 DOM을 만드세요.
     *
     * - 바깥 페이지 스타일은 들어오지 않고, 여기 넣은 <style>도 바깥으로 새지 않습니다.
     * - document.getElementById로는 이 안의 노드를 찾을 수 없습니다.
     *   container.querySelector(...)를 쓰세요.
     * - VS Code 테마 변수(--vscode-*)는 그대로 쓸 수 있습니다.
     */
    getContainer(): HTMLElement;

    /** 분석 중인 로그 파일의 절대경로 (표시용 문자열) */
    getFilePath(): string;

    /** 현재 VS Code 테마 */
    getTheme(): ToolTheme;

    /** 출력 채널에 기록합니다. 검사 중에는 캡처만 되고 표시되지 않습니다 */
    log(message: string): void;

    readonly helpers: ToolHelpers;
    readonly widgets: ToolWidgets;
}

/** 도구 정보. plugin.json의 같은 이름 필드와 일치해야 합니다 */
interface ToolMetadata {
    /** 식별자. ^[a-z0-9][a-z0-9-]*$ 이며 plugin.json의 id와 같아야 합니다 */
    id: string;
    /** 표시 이름. 한글을 써도 됩니다 */
    name: string;
    /** major.minor.patch. plugin.json의 version과 같아야 합니다 */
    version: string;
    /** 도구 설명 */
    description: string;
}

/**
 * Tool → ToolHost. 진입 파일에서 `export default`로 내보내세요.
 *
 * 지켜야 할 규약:
 * - activate/deactivate와 onLogUpdate 콜백은 **동기 함수**여야 합니다.
 *   Promise를 반환하면 실패로 처리됩니다.
 * - getLogs()가 준 로그를 변형하면 안 됩니다.
 * - 화면은 결정적이어야 합니다. 같은 로그로 두 번 activate했을 때 같은 DOM이 나와야 합니다
 *   (Date.now()·Math.random()으로 만든 id·좌표는 검사에서 걸립니다).
 * - getContainer() 밖의 DOM을 건드리지 마세요.
 * - 모듈 최상위에서 부작용을 만들지 마세요.
 * - 도구 객체는 실행마다 재사용됩니다(activate → deactivate → activate).
 *   이전 실행의 상태는 deactivate()에서 모두 비우세요.
 */
interface Tool {
    readonly metadata: ToolMetadata;

    /**
     * 도구를 시작합니다. api.getLogs()로 로그를 읽고 api.getContainer()에 그리세요.
     * 로그 갱신을 반영하려면 api.onLogUpdate()를 구독하세요.
     */
    activate(api: ToolHostApi): void;

    /**
     * 도구를 종료합니다. 직접 등록한 타이머·전역 리스너·observer를 여기서 해제하세요.
     * 컨테이너 비우기와 onLogUpdate 구독 해제는 ToolHost가 합니다.
     */
    deactivate(): void;
}
