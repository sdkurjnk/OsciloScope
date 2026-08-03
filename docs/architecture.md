# 아키텍처

## 두 개의 실행 컨텍스트

VS Code 확장은 서로 다른 두 프로세스로 나뉜다. OsciloScope도 이 경계를 그대로 따른다.

| 컨텍스트 | 위치 | 언어 | 역할 |
| --- | --- | --- | --- |
| **Extension Host** | `src/` (→ `dist/extension.js`) | TypeScript | 파일 읽기, 파싱/변환, 패널 수명 관리 |
| **Webview UI** | `osciloscope/` | JS / HTML / CSS | 사이드바·타임라인 렌더링, 사용자 상호작용 |

두 컨텍스트는 직접 함수 호출이 불가능하고 **`postMessage` 메시지**로만 통신한다.
프로토콜은 [message-protocol.md](./message-protocol.md) 참고.

## 모듈 구성

### Extension Host (`src/`)

```
extension.ts               진입점. 커맨드 등록 및 실행 흐름 조율
├─ LogParser.ts            log.jsonl 읽기 + 시각화용 구조로 변환
├─ OsciloScopeWebviewPanel.ts   Webview 패널 생성/표시/메시지 브릿지 (정적 싱글턴)
└─ OsciloScopeMessage.ts   메시지 타입(CommandTypes)과 인터페이스 정의
```

### Webview (`osciloscope/`)

```
index.html                 DOM 골격 + 스크립트 로드 순서 정의
js/
├─ constants.js            CommandTypes (백엔드와 값이 일치해야 함)
├─ main.js                 진입점: VisualizerApp 생성 후 init()
├─ VisualizerApp.js        전체 흐름 조율 + postMessage 브릿지
├─ DataManager.js          받은 payload 보관 및 varKey 조회
├─ SidebarManager.js       스코프 그룹(Global/Local) 사이드바 렌더
├─ TimelineViewer.js       선택 변수의 값 변화 히스토리 렌더
└─ mockData.js             브라우저 단독 실행 시 목업 주입 (VS Code에선 자동 스킵)
css/ (layout / sidebar / timeline)
```

## 실행 흐름 (`OsciloScope: Open Visualizer`)

`src/extension.ts`의 커맨드 핸들러가 전체를 순차 조율한다.

```
사용자: 커맨드 팔레트에서 "OsciloScope: Open Visualizer"
   │
   ▼  [Extension Host]
① logPath = <extensionUri>/log.jsonl  ─ 없으면 showErrorMessage 후 종료
② parser.parseLogFile()      → RawLog[]      (JSONL 파싱 + null 정규화)
③ parser.transformData(...)  → 그룹 구조     (varKey 키잉 + 스코프 그룹핑)
④ OsciloScopeWebviewPanel.createOrShow()     (패널 생성/재사용)
⑤ sendDataToWebview(UPDATE_ALL_DATA, data)   (프론트로 전송)
   │
   ▼  [Webview]
⑥ VisualizerApp.handleMessageFromBackend()
   → DataManager.updateData()
   → SidebarManager.renderSidebar()
   → (선택된 변수 있으면) TimelineViewer 렌더
   │
   ▼  사용자가 사이드바에서 변수 클릭
⑦ VisualizerApp._onVarSelected(varKey)
   → TimelineViewer 갱신
   → sendMessageToBackend(VARIABLE_CHANGED)  (현재는 백엔드에서 로깅만)
```

> 프론트는 로드 완료 시 `UI_READY`를 먼저 보내지만, 현재 백엔드는 이를 로깅만 하고
> 데이터 전송은 커맨드 실행 시점(⑤)에 곧바로 이뤄진다. `UI_READY` 기반의
> 지연 전송/재전송은 향후 확장 지점이다.

## 알아둘 설계 특성 / 제약

- **로그 경로가 고정.** 항상 확장 루트의 `log.jsonl`을 읽는다(`extension.ts:14`).
  파일 선택 기능은 별도 브랜치(`feature/sideBar_fileSelection`)에서 진행 중.
- **패널은 정적 싱글턴.** `OsciloScopeWebviewPanel.panel`이 static 필드라 동시에 하나만 존재.
  `onDidDispose`에서 참조를 비워 재생성 가능하게 한다.
- **단방향 데이터 로딩.** 파일 변경 감시(watch)나 실시간 스트리밍은 없다. 커맨드 재실행으로 갱신.
- **프론트는 상태를 계산하지 않는다.** 그룹핑·정체성 키잉은 모두 백엔드 `transformData`에서
  끝내고, 프론트는 표현에만 집중한다.
