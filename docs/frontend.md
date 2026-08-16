# 프론트엔드 (Webview)

Webview UI는 번들러 없는 순수 JS/HTML/CSS다. 다만 **ES 모듈**을 쓴다 —
도구를 동적으로 `import`해야 하기 때문에 전역 클래스 방식을 더 이상 쓸 수 없다.

구성은 세 덩어리다.

| 위치 | 역할 |
| --- | --- |
| `osciloscope/` | 메인 패널 — 헤더를 그리고 도구를 실행한다 |
| `osciloscope/sidebar-view/` | 사이드바 뷰 — 파일 선택, 도구 목록·관리 |
| `osciloscope/tool-host/` | 도구 실행 기반 — 로더·호스트·위젯·검사기 |

`tool-host/`는 두 웹뷰가 함께 쓴다. 사이드바도 도구를 `import`해야 목록에 이름·버전을
채울 수 있기 때문이다([architecture.md](./architecture.md) 참고).

## 화면 분담

메인 패널에서 **헤더를 뺀 전 영역이 도구 몫**이다. 예전처럼 변수 사이드바와 타임라인을
패널이 직접 그리지 않는다 — 그 UI는 표준 위젯으로 옮겨졌고, 기본 도구가 그것을 호출한다.

```
┌ 헤더 ─ 로그 경로 · 도구명 · 상태 배지 ── 우리가 그림 ─┐
├────────────────────────────────────────────────────────┤
│                    #pluginRoot                         │
│                 (host.mount, 도구가 전부 그린다)         │
└────────────────────────────────────────────────────────┘
```

## 메인 패널 (`osciloscope/`)

`index.html`이 `js/main.js` 하나를 `type="module"`로 불러오고, 나머지는 ESM import로 이어진다.

```
js/main.js            진입점: new VisualizerApp().init()
├─ js/VisualizerApp.js   메시지 수신 → 도구 로드 → analyze → render
├─ js/constants.js       CommandTypes (백엔드와 값이 일치해야 함)
└─ tool-host/*           로더 · 호스트 · 위젯
```

### VisualizerApp

- 생성자에서 `acquireVsCodeApi()`를 잡고 **전역에서 지운다**. 이 API는 한 번만 호출할 수
  있으므로, 먼저 잡아 두면 도구가 확장으로 메시지를 보낼 수 없다.
- `init()`: `message` 리스너 등록 → 배지 "로드 중" → `UI_READY` 송신.
- `UPDATE_ALL_DATA` 수신 → `_run(payload)`:
  1. 이전 `ToolSession`을 `dispose` (타이머를 쓴 도구가 새 화면 위에서 계속 돌지 않게)
  2. `loadToolForRun(tool.uri, ...)`로 도구를 `import`
  3. `session.analyze(rawLogs)` → `session.render(#pluginRoot)`
  4. 헤더 도구명 갱신 + 배지 "연결됨"
- 실패하면 단계(`load`/`analyze`/`render`)를 담아 `TOOL_ERROR`를 보내고, `#pluginRoot`에
  안내 화면(`.tool-error`)을 그린다.
- `_runSeq`로 실행 순번을 센다. START를 연타하면 늦게 끝난 이전 실행이 새 화면을 덮어쓰는데,
  순번이 맞지 않는 결과는 버린다.

> **캐시 무효화.** ESM 모듈 캐시는 지울 수 없어 URL에 쿼리를 붙여 다른 모듈로 만든다.
> `UPDATE_ALL_DATA`의 `tool`에는 `mtime`이 없어서 현재는 실행 순번을 쓴다 — START마다
> 새로 로드되는 대신 항상 최신 코드가 돈다.

### DOM 앵커

| id | 용도 |
| --- | --- |
| `hdrPath` | 로드된 로그 파일 경로 (미선택 시 "로그 파일 미선택") |
| `hdrTool` | 실행 중인 도구명 + 버전. 도구가 없으면 비어 숨겨진다 |
| `badge` | 상태 (대기 중 / 로드 중 / 도구 로드 중 / 연결됨 / 실행 실패) |
| `pluginRoot` | `host.mount` — 도구 전용 영역 |

## 도구 실행 기반 (`osciloscope/tool-host/`)

```
ToolLoader.js       import + 캐시 무효화 + meta 수집 + 실패 처리
ToolHost.js         helpers · widgets · ctx/host 생성 · ToolSession 생명주기
ToolValidator.js    픽스처 주입 + 12개 검사 항목
widgets/
├─ LayoutWidget.js     2단 골격
├─ VarListWidget.js    변수 목록 (기존 SidebarManager 이관)
└─ TimelineWidget.js   변경 이력 (기존 TimelineViewer 이관)
fixtures/              검사용 표준 입력 5종
```

시그니처는 [api-frontend.md](./api-frontend.md)에 있다.

### 위젯으로 옮기면서 바뀐 것

1. **컨테이너 주입.** `document.getElementById('sbList')` 같은 고정 앵커를 쓰지 않는다.
   도구가 넘긴 엘리먼트 안에 그린다.
2. **`innerHTML` 제거.** 변수명과 값은 로그에서 오는 문자열이라 그대로 넣으면 주입이 된다.
   전부 `textContent`로 바꿨다.
3. **CSS 스코핑.** 위젯 마크업의 최상위에 `.osc-widget`이 붙고, 스타일은 그 하위로만 적용된다.
   클래스명이 `.vi`, `.hr`, `.ln`처럼 짧아서 사용자 도구와 충돌하기 쉬웠다.
4. **타임라인 헤더가 위젯 안으로.** 예전에는 패널 크롬(`#tlHdr`)에 있었는데, 이제 그 영역이
   도구 몫이라 패널이 들고 있을 수 없다.

## 사이드바 뷰 (`osciloscope/sidebar-view/`)

`js/main.js`가 `type="module"`로 로드되며, 메인 패널의 `constants.js`와 `tool-host/ToolLoader.js`를
공유한다. (예전에는 단일 IIFE에 커맨드 문자열을 직접 썼다.)

- **SOURCE** — 파일 선택 버튼 → `SELECT_LOG_FILE`. `LOG_FILE_LOADED` 수신 시 파일명 표시 +
  START 활성화.
- **START** — `START_RENDER { toolId }`. 도구를 안 골랐으면 `toolId` 없이 보내고 확장이
  기본 도구로 떨어뜨린다.
- **TOOLS** — `GET_TOOLS_LIST` → `TOOLS_LIST`(파일 정보만) 수신 → 각 도구를 `import`해서
  `meta.name`/`version`/`description`을 채운 뒤 목록을 그린다.
  - 라디오 단일 선택. 선택 시 `SELECT_TOOL`.
  - 행 액션: **✎** 열기(`OPEN_TOOL`), **⧉** 복사(`COPY_TOOL`, 기본 도구만), **✓** 검사(`VALIDATE_TOOL`).
    평소엔 숨기고 hover·선택 시 노출한다 — 사이드바 폭이 좁다.
  - 로드에 실패한 도구도 목록에 남는다. 선택은 못 하고 오류 메시지를 보여주며 **열기만** 된다.
    목록에서 조용히 사라지면 원인을 찾을 수 없기 때문이다.
  - `VALIDATION_RESULT`를 받으면 행에 아이콘(✓ / ! / ✕)을 표시한다. 상세는 출력 채널에.
  - `TOOLS_CHANGED`를 받으면 목록을 직접 갱신하지 않고 `GET_TOOLS_LIST`를 다시 보낸다.
  - `trusted`가 false면 신뢰 안내를, `workspaceReady`가 false면 만들기 버튼을 비활성화한다.

DOM 앵커: `srcRow`·`srcName`(선택 파일 행), `pickBtn`·`startBtn`, `createBtn`(만들기),
`toolNotice`(안내), `toolList`(목록).

## 도구를 만드는 쪽 문서

사용자가 도구를 작성하는 방법은 [plugin-tools.md](./plugin-tools.md)에 따로 있다.
