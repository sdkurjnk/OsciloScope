# API 명세: Backend (Extension Host)

`src/`(→ `dist/extension.js`)에서 도는 Extension Host 코드의 공개 API.
시그니처는 TypeScript 기준이며, 어긋나면 코드를 따른다.

관련 문서: [architecture.md](./architecture.md)(전체 흐름) ·
[data-model.md](./data-model.md)(데이터 구조) · [message-protocol.md](./message-protocol.md)(Webview 통신).

## `extension.ts` — 진입점

| 함수 | 시그니처 | 설명 |
| --- | --- | --- |
| `activate` | `(context: vscode.ExtensionContext): void` | `SidebarProvider`를 만들어 `osciloscope.sidebarView` 뷰로 등록. 파일 선택 콜백으로 `loadLogFile`을 넘긴다 |
| `deactivate` | `(): void` | 정리 훅. 현재 비어 있음 |

커맨드 팔레트 커맨드는 없다. 진입점은 사이드바 뷰다.

**`loadLogFile(logPath: string)`** *(activate 내부 클로저)* — 파일 선택 후 렌더까지:

1. 파일이 없으면 `showErrorMessage` 후 반환.
2. `new LogParser(logPath)` → `parseLogFile()` → `transformData()`.
3. `OsciloScopeWebviewPanel.createOrShow(extensionUri)`.
4. 메인 패널로 `LOG_FILE_LOADED { fileName, filePath }`(헤더 경로) → `UPDATE_ALL_DATA`(데이터) 순 전송.

## `SidebarProvider` (`src/SidebarProvider.ts`)

`vscode.WebviewViewProvider` 구현체. 사이드바 뷰를 그리고 파일 선택·START·도구 목록을 처리한다.

| 멤버 | 시그니처 | 설명 |
| --- | --- | --- |
| `constructor` | `(extensionUri: vscode.Uri, onLogFileSelected: (absolutePath: string) => void)` | 확장 URI와 START 콜백 보관 |
| `resolveWebviewView` | `(webviewView: vscode.WebviewView): void` | 스크립트 활성화, `localResourceRoots`를 `osciloscope/`로 제한, HTML 주입, `onDidReceiveMessage`로 `SELECT_LOG_FILE`/`START_RENDER`/`GET_TOOLS_LIST` 라우팅 |
| `selectLogFile` *(private)* | `(): Promise<void>` | `showOpenDialog`(`.jsonl`)로 파일 선택. 경로를 `selectedLogPath`에 저장하고 사이드바로 `LOG_FILE_LOADED` 회신 |
| `startRender` *(private)* | `(): void` | `selectedLogPath` 없으면 경고. 있으면 `onLogFileSelected(경로)` 호출 |
| `sendToolsList` *(private)* | `(): void` | `ToolsProvider.listTools` 결과를 `TOOLS_LIST`로 회신 |
| `postMessage` *(private)* | `(message: OsciloScopeMessage): void` | `view?.webview.postMessage` |
| `getHtml` *(private)* | `(webview): string` | `sidebar-view/index.html`을 읽어 `css/`·`js/` 경로를 `asWebviewUri`로 치환 |

파일 선택(경로 저장)과 렌더(START)를 분리한 게 핵심이다. 선택만으로는 메인 패널이 열리지 않는다.

## `ToolsProvider` (`src/ToolsProvider.ts`)

| 멤버 | 시그니처 | 반환/설명 |
| --- | --- | --- |
| `listTools` | `static (extensionRoot: string): string[]` | `<root>/tools/`의 파일명 배열. 폴더가 없으면 `[]`. 표시용이며 선택·실행 로직은 없다 |

## `LogParser` (`src/LogParser.ts`)

선택된 로그 파일을 읽어 Webview용 그룹 구조로 바꾼다.

| 멤버 | 시그니처 | 반환/설명 |
| --- | --- | --- |
| `constructor` | `(logFilePath: string)` | 로그 파일 경로 보관 |
| `parseLogFile` | `(): RawLog[]` | 파일을 읽어 줄 단위 `JSON.parse`. 누락 필드(`line`/`func`/`call_id`/`parent_call_id`/`call_depth`/`var_id`)는 `?? null` 처리 |
| `transformData` | `(rawLogs: RawLog[]): Object` | 평면 이벤트 배열을 그룹 → 변수 → 히스토리 3계층으로 접는다 |
| `getVarKey` *(private)* | `(log: RawLog): string` | `var_id` 있으면 `` `${name}@${var_id}` ``, 없으면 `name` |
| `getGroupKey` *(private)* | `(log: RawLog): string` | `domain === 'GLOBAL' ? 'Global' : 'Local'` |
| `DOMAIN_LABELS` *(static, private)* | `{ LOCAL:'Local', GLOBAL:'Global' }` | `scope` 라벨 매핑 |

### `RawLog` (입력 스키마)

```ts
interface RawLog {
  name           : string;         // 변수 이름
  data           : any;            // 이벤트 시점 값 (deleted면 무시)
  event          : string;         // "init" | "updated" | "deleted"
  domain         : string;         // "GLOBAL" | "LOCAL" (소유 프레임 기준)
  line           : number | null;
  func           : string | null;  // 모듈 최상위는 "<module>"
  call_id        : number | null;  // 이벤트 발생 프레임 ID
  parent_call_id : number | null;  // 부모 프레임 call_id, 최상위면 null
  call_depth     : number | null;  // 호출 스택 깊이 (1부터)
  var_id         : number | null;  // 변수가 정의된 소유 프레임 call_id (정체성 키)
}
```

### `transformData` 반환 구조

```jsonc
{
  "Global": [
    {
      "varKey": "total@1", "varName": "total",
      "type": "number",           // 첫 등장 값의 typeof, 이후 갱신 없음
      "scope": "Global",          // DOMAIN_LABELS 매핑, 미지 domain은 'Unknown'
      "func": "<module>", "callId": 1, "parentCallId": null, "callDepth": 1,
      "group": "Global",
      "history": [                 // 이벤트마다 1행
        { "step": 1, "line": 1,  "value": 0, "event": "init" },
        { "step": 2, "line": 30, "value": 6, "event": "updated" }
      ]
    }
  ],
  "Local": [ /* ... */ ]
}
```

- 변수 메타는 첫 등장 때 1회, `history` 행은 이벤트마다 쌓인다.
- `event === 'deleted'`면 `value`는 `null`.
- `step`은 변수별 순번이지 전역 타임라인 순번이 아니다.

## `OsciloScopeWebviewPanel` (`src/OsciloScopeWebviewPanel.ts`)

메인 패널을 만들고 메시지를 중계한다. 멤버는 모두 static이고, 패널은 정적 싱글턴(`private static panel`)이라 한 번에 하나만 뜬다.

| 메서드 | 시그니처 | 설명 |
| --- | --- | --- |
| `createOrShow` | `static (extensionUri: vscode.Uri): void` | 패널이 있으면 `reveal`, 없으면 생성. 핸드셰이크 상태(`isReady`/`pendingMessages`)를 초기화하고, `index.html`의 `css/`·`js/` 경로를 `asWebviewUri`로 치환. `localResourceRoots`는 `osciloscope/`로 제한. `onDidDispose`에서 패널·버퍼를 비운다. 끝에 `receiveDataFromWebview()`를 한 번 건다 |
| `sendDataToWebview` | `static (message: OsciloScopeMessage): void` | 패널 없으면 에러 로그 후 무시. `UI_READY` 전이면 `pendingMessages`에 버퍼링, 준비됐으면 `postMessage` |
| `receiveDataFromWebview` | `static (): void` | `onDidReceiveMessage` 등록. `UI_READY`에서 `isReady=true`로 바꾸고 버퍼를 flush. `VARIABLE_CHANGED`는 `console.log` |

메인 패널을 여는 즉시 `sendDataToWebview`를 부르면, 프론트가 `message` 리스너를 걸기 전이라 VS Code가
메시지를 버린다. `isReady`/`pendingMessages` 버퍼가 이 유실을 막는다.

## 프로토콜 (`src/ApiTable.ts`)

`CommandTypes`·`OsciloScopeMessage` 봉투·payload·`ProtocolMap`·`outbound`/`route`의 단일 정본.
웹뷰용 `constants.js`는 여기서 자동 생성된다(수동 미러 아님).

```ts
enum CommandTypes {
  UPDATE_ALL_DATA  = "UPDATE_ALL_DATA",   // ext → 메인 패널
  VARIABLE_CHANGED = "VARIABLE_CHANGED",  // 메인 패널 → ext
  UI_READY         = "UI_READY",          // 메인 패널 → ext
  SELECT_LOG_FILE  = "SELECT_LOG_FILE",   // 사이드바 → ext
  LOG_FILE_LOADED  = "LOG_FILE_LOADED",   // ext → 사이드바 / 메인 패널
  START_RENDER     = "START_RENDER",      // 사이드바 → ext
  GET_TOOLS_LIST   = "GET_TOOLS_LIST",    // 사이드바 → ext
  TOOLS_LIST       = "TOOLS_LIST"         // ext → 사이드바
}

interface OsciloScopeMessage {
  command : CommandTypes;
  payload : Object;
}
```

커맨드별 방향·payload·시퀀스는 [message-protocol.md](./message-protocol.md)에 있다.
