# 아키텍처

## 두 개의 실행 컨텍스트

VS Code 확장은 서로 다른 두 프로세스로 나뉜다. OsciloScope도 이 경계를 그대로 따른다.

| 컨텍스트 | 위치 | 언어 | 역할 |
| --- | --- | --- | --- |
| **Extension Host** | `src/` (→ `dist/extension.js`) | TypeScript | 파일 선택/읽기, 파싱·변환, 뷰·패널 수명 관리 |
| **Webview UI** | `osciloscope/` | JS / HTML / CSS | 사이드바·메인 패널 렌더링, 사용자 상호작용 |

두 컨텍스트는 직접 함수 호출이 불가능하고 `postMessage` 메시지로만 통신한다.
프로토콜은 [message-protocol.md](./message-protocol.md) 참고.

## 웹뷰가 둘이다

UI는 성격이 다른 두 웹뷰로 구성된다.

| 웹뷰 | 프론트 | 백엔드 | 하는 일 |
| --- | --- | --- | --- |
| **사이드바 뷰** | `osciloscope/sidebar-view/` | `SidebarProvider` (WebviewView) | 로그 파일 선택(SOURCE), START 버튼, 도구 목록(TOOLS) |
| **메인 패널** | `osciloscope/` (`index.html`) | `OsciloScopeWebviewPanel` (WebviewPanel) | 변수 사이드바 + 값 타임라인 시각화 |

사이드바 뷰는 Activity Bar에 상주하는 진입점이고, 메인 패널은 START를 누를 때 열린다.

## 모듈 구성

### Extension Host (`src/`)

```
extension.ts               진입점. 사이드바 프로바이더 등록 + loadLogFile 조율
├─ SidebarProvider.ts      사이드바 웹뷰 뷰. 파일 선택 다이얼로그·START·도구 목록 처리
├─ ToolsProvider.ts        tools/ 폴더 파일명 목록 제공 (표시용, 동작 미구현)
├─ LogParser.ts            로그 파일 읽기 + 시각화용 구조로 변환
├─ OsciloScopeWebviewPanel.ts   메인 패널 생성/표시/메시지 브릿지 (정적 싱글턴)
└─ OsciloScopeMessage.ts   메시지 타입(CommandTypes)과 인터페이스 정의
```

### Webview (`osciloscope/`)

```
index.html                 메인 패널 DOM 골격 + 스크립트 로드 순서
js/
├─ constants.js            CommandTypes (백엔드와 값이 일치해야 함)
├─ main.js                 진입점: VisualizerApp 생성 후 init()
├─ VisualizerApp.js        전체 흐름 조율 + postMessage 브릿지
├─ DataManager.js          받은 payload 보관 및 varKey 조회
├─ SidebarManager.js       스코프 그룹(Global/Local) 사이드바 렌더
├─ TimelineViewer.js       선택 변수의 값 변화 히스토리 렌더
└─ mockData.js             브라우저 단독 실행 시 목업 주입 (VS Code에선 자동 스킵)
css/ (layout / sidebar / timeline)

sidebar-view/              사이드바 뷰 프론트 (메인 패널과 별도)
├─ index.html              SOURCE / START / TOOLS 골격
├─ js/main.js              단일 IIFE. 클래스·공유 상수 없이 문자열 커맨드 직접 사용
└─ css/style.css
```

## 실행 흐름 (파일 선택 → 렌더링)

파일 선택 단일 진입점은 사이드바 뷰다. 커맨드 팔레트 커맨드는 없다.

```
사용자: Activity Bar에서 OsciloScope 뷰 열기
   │
   ▼  [사이드바 웹뷰 로드]
① js/main.js → GET_TOOLS_LIST 송신
   ◀ TOOLS_LIST (tools/ 파일명) 받아 목록 렌더
   │
   ▼  사용자가 SOURCE의 파일 선택 버튼 클릭
② SELECT_LOG_FILE ─▶ [Ext] SidebarProvider.selectLogFile()
   → showOpenDialog로 .jsonl 선택 → 경로 저장
   ◀ LOG_FILE_LOADED {fileName, filePath}  → 사이드바 행 갱신 + START 활성화
   │
   ▼  사용자가 START 클릭
③ START_RENDER ─▶ [Ext] SidebarProvider.startRender()
   → onLogFileSelected(선택경로) → extension.ts의 loadLogFile()
   │
   ▼  [Ext] loadLogFile(logPath)
④ 파일 없으면 showErrorMessage 후 종료
⑤ parseLogFile() → transformData()
⑥ OsciloScopeWebviewPanel.createOrShow()  (패널 생성/재사용)
⑦ 메인 패널로 LOG_FILE_LOADED(헤더 경로) + UPDATE_ALL_DATA 전송
   │
   ▼  [메인 패널]
⑧ VisualizerApp.handleMessageFromBackend()
   → DataManager.updateData() → SidebarManager.renderSidebar()
   → (선택된 변수 있으면) TimelineViewer 렌더
   │
   ▼  사용자가 사이드바에서 변수 클릭
⑨ VisualizerApp._onVarSelected(varKey)
   → TimelineViewer 갱신 → VARIABLE_CHANGED 송신 (백엔드는 로깅만)
```

> 메인 패널은 로드 완료 시 `UI_READY`를 보낸다. 그 전에 도착한 메시지(⑦)는 VS Code가
> 버퍼링하지 않아 유실될 수 있으므로, `OsciloScopeWebviewPanel`이 자체 큐에 모아뒀다가
> `UI_READY` 수신 시 flush한다. 자세한 내용은 [message-protocol.md](./message-protocol.md).

## 알아둘 설계 특성 / 제약

- **로그 파일은 사용자가 고른다.** 사이드바 SOURCE에서 `.jsonl`을 선택하고 START로 렌더한다.
  경로는 `SidebarProvider`가 들고 있다가 START 시점에 넘긴다.
- **패널은 정적 싱글턴.** `OsciloScopeWebviewPanel.panel`이 static이라 메인 패널은 하나만 존재.
  `onDidDispose`에서 참조·핸드셰이크 상태를 비워 재생성 가능하게 한다.
- **단방향 데이터 로딩.** 파일 변경 감시(watch)나 실시간 스트리밍은 없다. START 재실행으로 갱신.
- **프론트는 상태를 계산하지 않는다.** 그룹핑·정체성 키잉은 모두 백엔드 `transformData`에서
  끝내고, 프론트는 표현에만 집중한다.
- **TOOLS는 표시용.** `ToolsProvider`가 `tools/` 폴더의 파일명만 나열한다. 선택·실행 로직은 아직 없다.
