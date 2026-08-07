# API 명세: Frontend (Webview)

`osciloscope/`의 순수 JS/HTML/CSS로 된 Webview UI의 공개 API.
웹뷰는 둘이다 — **메인 패널**(`osciloscope/`, 전역 클래스 기반)과 **사이드바 뷰**(`osciloscope/sidebar-view/`, 단일 IIFE).
번들러·모듈 시스템이 없어 메인 패널의 각 클래스는 전역으로 노출되고, `index.html`의 로드 순서가 곧 의존성이다.

관련 문서: [frontend.md](./frontend.md)(구성·로드 순서) · [message-protocol.md](./message-protocol.md)(백엔드 통신).
시그니처는 JS라 정적 타입이 없고, `_` 접두 멤버는 내부용이다.

## `constants.js` (메인 패널)

```js
const CommandTypes = Object.freeze({
  UPDATE_ALL_DATA:  'UPDATE_ALL_DATA',  // 백엔드 → 프론트
  UI_READY:         'UI_READY',         // 프론트 → 백엔드
  VARIABLE_CHANGED: 'VARIABLE_CHANGED', // 프론트 → 백엔드
  SELECT_LOG_FILE:  'SELECT_LOG_FILE',  // 프론트 → 백엔드
  LOG_FILE_LOADED:  'LOG_FILE_LOADED',  // 백엔드 → 프론트 { fileName, filePath }
  GET_TOOLS_LIST:   'GET_TOOLS_LIST',   // 프론트 → 백엔드
  TOOLS_LIST:       'TOOLS_LIST',       // 백엔드 → 프론트 { tools: string[] }
});
```

백엔드 `src/OsciloScopeMessage.ts`의 `CommandTypes`(정본)와 문자열 값이 같아야 한다.
정본에 있는 `START_RENDER`는 사이드바 전용이라 여기엔 없다. 사이드바 뷰는 이 파일을 불러오지 않고
문자열 리터럴을 직접 쓴다.

## `VisualizerApp` (`js/VisualizerApp.js`)

세 매니저를 소유하고 postMessage를 중계한다.

| 멤버 | 시그니처 | 설명 |
| --- | --- | --- |
| `constructor` | `()` | `DataManager`/`SidebarManager`/`TimelineViewer` 생성. `SidebarManager`엔 `onSelectVar` 콜백을 넘긴다. `acquireVsCodeApi`가 있으면 `_vscode`에, 없으면(브라우저) `null` |
| `init` | `(): void` | `message` 리스너 등록 → 뱃지 "로드 중" → `UI_READY` 송신 |
| `handleMessageFromBackend` | `(message): void` | `UPDATE_ALL_DATA` 시 데이터 갱신 + 사이드바 재렌더 + 뱃지 "연결됨"(선택 변수 있으면 타임라인도). `LOG_FILE_LOADED` 시 헤더 경로(`#hdrPath`)에 `filePath` 표시 |
| `sendMessageToBackend` | `(message): void` | VS Code면 `_vscode.postMessage`, 브라우저면 콘솔 출력 |
| `_onVarSelected` *(private)* | `(varKey): void` | 선택 변수 저장 → 타임라인 렌더 → `VARIABLE_CHANGED {varKey, varName}` 송신 |
| `_renderTimeline` *(private)* | `(varKey): void` | `getVarByKey`로 조회해 헤더+타임라인 렌더. 못 찾으면 `clearTimeline` |
| `_setStatus` *(private)* | `(text, cls): void` | `#badge` 텍스트/클래스 갱신 |

`message`는 `{ command: CommandTypes, payload }` 형태다.

## `DataManager` (`js/DataManager.js`)

백엔드가 그룹핑해 보낸 payload를 그대로 들고만 있는다. 프론트는 재가공하지 않는다.

| 멤버 | 시그니처 | 반환/설명 |
| --- | --- | --- |
| `constructor` | `()` | `_data = {}`, `_currentVarKey = null` |
| `updateData` | `(payload): void` | `_data = payload || {}` |
| `getGroupedData` | `(): Object` | 보관 중인 그룹 구조 반환 |
| `getVarByKey` | `(varKey): (varData\|null)` | 모든 그룹을 훑어 `varKey`가 맞는 변수를 찾는다. 이름은 중복될 수 있어 키로 찾는다. 없으면 `null` |
| `currentVarKey` | `get / set` | 현재 선택된 `varKey` |

`varData`는 백엔드 `transformData` 출력의 변수 객체와 같다([api-backend.md](./api-backend.md)).

## `SidebarManager` (`js/SidebarManager.js`)

메인 패널의 스코프 그룹(Global/Local)을 그린다.

| 멤버 | 시그니처 | 설명 |
| --- | --- | --- |
| `constructor` | `(onSelectVar)` | `#sbList` 참조와 `onSelectVar: (varKey) => void` 콜백 보관 |
| `renderSidebar` | `(groupedData): void` | 그룹마다 접이식 섹션 생성. 데이터가 비면 "데이터 없음" |
| `setActiveVariable` | `(el): void` | 이전 활성 항목의 `active`를 떼고 `el`에 붙인다 |
| `_createScopeGroup` *(private)* | `(scope, vars): HTMLElement` | 그룹 라벨(개수 포함) + 변수 목록. 라벨 클릭 시 `collapsed` 토글 |
| `_createVarItem` *(private)* | `(varData): HTMLElement` | 타입 칩 + 이름. Local이면서 `callId`가 있으면 `#call_id` 칩을 붙인다. 클릭 시 활성 표시를 옮기고 `onSelectVar(varKey)` 호출 |

## `TimelineViewer` (`js/TimelineViewer.js`)

선택한 변수의 값 변화 히스토리를 그린다.

| 멤버 | 시그니처 | 설명 |
| --- | --- | --- |
| `constructor` | `()` | 헤더/본문 DOM(`#tlBody`·`#tlHdr`·`#tlName`·`#tlScope`·`#tlBadges`·`#tlCnt`) 참조 보관 |
| `renderHeader` | `(varData): void` | 변수 단위 메타를 헤더에 한 번 표시 — `func`/`call #id`/`← #parentId`/`depth` 뱃지. 값이 null이면 해당 뱃지는 생략 |
| `renderTimeline` | `(rows): void` | `history` 각 행을 렌더하고 변경 횟수(`N회`)를 표시. 비면 "기록된 변경사항이 없습니다" |
| `clearTimeline` | `(): void` | 빈 화면으로 초기화하고 헤더를 숨긴다 |
| `_createRow` *(private)* | `(row, idx, rows): HTMLElement` | 행 하나 생성. `changed`/`deleted` 클래스, 라인 라벨 `L{line}`, 값 + 변화 태그 |
| `_formatValue` *(private)* | `(v): string` | null/undefined는 `—`, 60자 넘는 문자열은 말줄임 |
| `_calcChange` *(private)* | `(prev, curr, idx, event): {cls, text}` | 값 변화 태그 계산(아래) |

`_calcChange`가 태그를 정하는 순서:

| 조건 | `text` |
| --- | --- |
| `event === 'deleted'` | `deleted` |
| `idx === 0` 또는 `event === 'init'` | `init` |
| 양쪽 `parseFloat` 가능 | 증감 delta — `+n` / `n`(음수) / `±0` |
| 그 외, 문자열이 같으면 | `—` |
| 그 외, 문자열이 다르면 | `changed` |

## 부팅 (`js/main.js`)

```js
const app = new VisualizerApp();
app.init();
```

## 사이드바 뷰 (`sidebar-view/js/main.js`)

메인 패널과 별개인 단일 IIFE. 클래스도 공유 상수도 없이 `acquireVsCodeApi()`로 직접 통신한다.

- 로드 시 `GET_TOOLS_LIST`를 보낸다.
- `pickBtn` 클릭 → `SELECT_LOG_FILE`, `startBtn` 클릭 → `START_RENDER` 송신.
- `message` 수신: `LOG_FILE_LOADED` → 파일명 표시 + START 활성화, `TOOLS_LIST` → `renderTools`.
- `renderTools(tools: string[])`: 도구별 체크박스 행 생성. 비면 "표시할 도구가 없습니다"(체크박스는 동작 없음).

로드 순서와 DOM 앵커 표는 [frontend.md](./frontend.md)에 있다.
