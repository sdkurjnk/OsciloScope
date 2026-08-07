# API 명세: Backend (Extension Host)

`src/`(→ `dist/extension.js`)에서 도는 Extension Host 코드의 공개 API.
시그니처는 TypeScript 기준이며, 어긋나면 코드를 따른다.

관련 문서: [architecture.md](./architecture.md)(전체 흐름) ·
[data-model.md](./data-model.md)(데이터 구조) · [message-protocol.md](./message-protocol.md)(Webview 통신).

## `extension.ts` — 진입점

| 함수 | 시그니처 | 설명 |
| --- | --- | --- |
| `activate` | `(context: vscode.ExtensionContext): void` | `osciloscope.openVisualizer` 커맨드 등록 후 `context.subscriptions`에 push |
| `deactivate` | `(): void` | 정리 훅. 현재 비어 있음 |

`osciloscope.openVisualizer` 핸들러의 순서:

1. `logPath = <extensionUri>/log.jsonl`. 파일이 없으면 `showErrorMessage` 후 반환.
2. `new LogParser(logPath)` → `parseLogFile()` → `transformData()`.
3. `OsciloScopeWebviewPanel.createOrShow(extensionUri)`.
4. `sendDataToWebview({ command: UPDATE_ALL_DATA, payload: data })`.

## `LogParser` (`src/LogParser.ts`)

`log.jsonl`을 읽어 Webview용 그룹 구조로 바꾼다.

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

Webview 패널을 만들고 메시지를 중계한다. 멤버는 모두 static이고, 패널은 정적 싱글턴(`private static panel`)이라 한 번에 하나만 뜬다.

| 메서드 | 시그니처 | 설명 |
| --- | --- | --- |
| `createOrShow` | `static (extensionUri: vscode.Uri): void` | 패널이 있으면 `reveal`, 없으면 생성. `index.html`의 `css/`·`js/` 경로를 `asWebviewUri`로 치환하고 `localResourceRoots`를 `osciloscope/`로 제한. `onDidDispose`에서 `panel`을 비워 재생성을 허용하고, 끝에 `receiveDataFromWebview()`를 한 번 건다 |
| `sendDataToWebview` | `static (message: OsciloScopeMessage): void` | `panel.webview.postMessage`. 패널이 없으면 에러 로그만 남기고 무시 |
| `receiveDataFromWebview` | `static (): void` | `onDidReceiveMessage` 등록. `UI_READY`/`VARIABLE_CHANGED`는 아직 `console.log`만 한다 |

`sendDataToWebview`는 패널이 없으면 예외 없이 그냥 넘어가므로, `createOrShow`보다 먼저 부르면 데이터가 사라진다. 핸들러가 두 호출 순서를 지키는 이유다.

## `OsciloScopeMessage` (`src/OsciloScopeMessage.ts`)

메시지 계약 타입. 프론트 `osciloscope/js/constants.js`와 문자열 값이 같아야 통신이 된다.

```ts
enum CommandTypes {
  UPDATE_ALL_DATA  = "UPDATE_ALL_DATA",   // 백엔드 → 프론트
  VARIABLE_CHANGED = "VARIABLE_CHANGED",  // 프론트 → 백엔드
  UI_READY         = "UI_READY"           // 프론트 → 백엔드
}

interface OsciloScopeMessage {
  command : CommandTypes;
  payload : Object;
}
```

커맨드별 방향·payload·시퀀스는 [message-protocol.md](./message-protocol.md)에 있다.
