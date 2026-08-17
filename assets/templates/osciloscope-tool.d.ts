// @osciloscope-types 0.2.0 — 이 파일은 확장이 생성합니다. 직접 수정하지 마세요.
//
// 분석 도구(<id>.tool.js)를 작성할 때 자동완성과 타입 검사를 제공합니다.
// 도구 파일 첫 줄의 /// <reference path="./osciloscope-tool.d.ts" /> 로 연결됩니다.
//
// 여기 선언된 타입은 전역입니다. 이 파일에 import/export를 추가하면 모듈로 바뀌어
// 도구 파일에서 타입이 보이지 않게 되므로 주의하세요.

/**
 * oscilo가 로그 파일에 남긴 이벤트 한 줄.
 * analyze()가 받는 배열의 원소이며, 절대 수정하면 안 됩니다(입력 불변성은 검사 항목입니다).
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

/** 사이드바 목록에 표시되는 도구 정보 */
interface ToolMeta {
    /** 고유 식별자. ^[a-z0-9][a-z0-9-]*$ 이며 파일명과 일치해야 합니다 */
    id: string;
    /** 사이드바 표시명. 한글을 써도 됩니다 */
    name: string;
    /** major.minor.patch */
    version: string;
    /** 도구 설명. 사이드바 툴팁에 쓰입니다 */
    description?: string;
}

/**
 * 변수 정체성 키잉·그룹핑 헬퍼.
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
}

/** analyze()에 전달되는 실행 맥락. DOM으로 가는 통로는 없습니다 */
interface ToolContext {
    /** 분석 중인 로그 파일의 절대경로 (표시용 문자열) */
    filePath: string;
    /** 출력 채널에 기록합니다. 검사 중에는 캡처만 되고 표시되지 않습니다 */
    log(msg: string): void;
    helpers: ToolHelpers;
}

/** render()에서 쓰는 헬퍼. ToolHelpers에 문자열 이스케이프가 더해집니다 */
interface ToolHostHelpers extends ToolHelpers {
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
    /** 한 변수의 변경 이력을 그립니다 (증감 태그 포함) */
    timeline(el: HTMLElement, entry: VarEntry): void;
}

/**
 * render()에 전달되는 화면 쪽 맥락.
 *
 * 여기 없는 것은 의도적으로 제공하지 않습니다 — 파일 접근, 네트워크,
 * 확장으로 메시지를 보내는 통로(acquireVsCodeApi)는 쓸 수 없습니다.
 */
interface ToolHost {
    /** 도구 전용 컨테이너. 이 안에만 DOM을 만드세요 */
    mount: HTMLElement;
    /** 로그 파일 절대경로 */
    filePath: string;
    /** 현재 VS Code 테마 */
    theme: 'light' | 'dark' | 'high-contrast';
    /** 출력 채널에 기록합니다 */
    log(msg: string): void;
    helpers: ToolHostHelpers;
    widgets: ToolWidgets;
}

/**
 * 분석 도구. `export default`로 내보내세요.
 *
 * 지켜야 할 규약:
 * - analyze/render는 **동기 함수**여야 합니다. Promise를 반환하면 검사에서 실패합니다.
 * - rawLogs를 변형하면 안 됩니다.
 * - analyze는 DOM에 접근하면 안 되고, 결정적이어야 합니다
 *   (Date.now()·Math.random()을 쓰면 결정성 검사에서 걸립니다).
 * - 모듈 최상위에서 부작용을 만들지 마세요. 목록을 만들 때 한 번 import됩니다.
 */
interface OsciloScopeTool {
    meta: ToolMeta;

    /**
     * 1단계 — 계산. 반환값의 형식은 자유이며 시스템은 들여다보지 않습니다.
     * @param rawLogs 수정하지 마세요
     */
    analyze(rawLogs: RawLog[], ctx: ToolContext): any;

    /**
     * 2단계 — 표현. host.mount 안에만 DOM을 만드세요.
     * @param model analyze()가 반환한 값
     */
    render(model: any, host: ToolHost): void;

    /** 선택 구현 — 타이머·전역 리스너를 썼다면 여기서 해제하세요 */
    dispose?(): void;
}
