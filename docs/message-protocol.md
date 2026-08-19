# 메시지 프로토콜 (Extension Host ↔ Webview)

Extension Host와 Webview는 `postMessage`로만 통신한다.
모든 메시지는 `{ command, payload }` 형태이며, `command`는 `CommandTypes` 값이다.

통신선은 셋이다:

- **메인 패널** `osciloscope/` ↔ `OsciloScopeWebviewPanel`
- **사이드바 뷰** `osciloscope/sidebar-view/` ↔ `SidebarProvider`
- **검사 패널** (임시) ↔ `ValidationPanel`

## API 테이블 (단일 통신 창구)

세 통신선의 `postMessage`/`onmessage`는 화면·핸들러 코드에 흩어져 있지 않고 **양쪽의 API
테이블 한 곳으로 모인다.** 호출부는 raw 메시지(`{ command, payload }`)를 만들지 않고 이름 붙은
엔드포인트 함수를 부른다.

```mermaid
flowchart TB
    subgraph WV["웹뷰 (프론트)"]
        SB["SideBar<br/>sidebar-view/js/main.js"]
        TOOL["Tool (Plug-in)<br/>*.tool.js"]
        DOM["DOM"]
    end

    FEAPI["FE-API Table<br/>osciloscope/js/ApiTable.js"]
    BEAPI["BE-API Table<br/>src/ApiTable.ts"]

    subgraph BEMOD["확장 호스트 (백엔드 처리 모듈)"]
        LOG["LogParser<br/>로그 파싱·렌더"]
        REG["ToolRegistry / ToolTemplate<br/>도구 관리"]
        VAL["ValidationPanel<br/>검사"]
    end

    SB <--> FEAPI
    TOOL -. "host 계약 (analyze/render, 메시지 아님)" .-> DOM
    SB --> DOM
    FEAPI <-->|postMessage| BEAPI
    BEAPI --> LOG
    BEAPI --> REG
    BEAPI --> VAL
```

> **Tool은 FE-API Table을 거치지 않는다.** 도구는 `analyze/render/host` 계약으로만 동작하고
> `acquireVsCodeApi`는 진입점이 회수하므로 확장과 직접 통신할 수 없다 (§3.3). 위 그림의 점선은
> "도구가 FE가 준 host API로 DOM을 그린다"는 뜻이지 메시지 통신선이 아니다.

- **FE-API Table** — `osciloscope/js/ApiTable.js`. `createApiTable(vscode)` → 발신 엔드포인트
  (`uiReady()`, `selectLogFile()`, …) + 수신 라우팅 `route({ [command]: handler })`.
  SideBar와 메인 패널이 쓴다. **Tool(플러그인)은 쓰지 않는다** — 도구는 `analyze/render/host`
  계약으로만 동작하고 `acquireVsCodeApi`는 진입점이 회수한다 (§3.3).
- **BE-API Table** — `src/ApiTable.ts`. `outbound(post)` → 발신 엔드포인트(`updateAllData()`,
  `toolsList()`, …), `route(message, handlers)` → 수신 라우팅. 세 채널이 자기 전송 함수를
  `outbound`에 bind해 쓰고, 실제 처리(로그 파싱·도구 관리·검사)는 뒤의 모듈이 맡는다.

아래 표는 그 엔드포인트들이 실어 나르는 커맨드·payload 명세다.

> **커맨드 문자열의 정본은 하나다.**
> - 정본: `src/OsciloScopeMessage.ts` (`enum CommandTypes` · `enum ToolErrorPhase`).
> - 웹뷰용 `osciloscope/js/constants.js`는 정본에서 **자동 생성**된다 (`scripts/gen-constants.mjs`,
>   `npm run compile`에 포함). 직접 편집하지 말 것 — 재생성 때 덮어써진다. `ApiTable.js`가 이 파일을
>   유일하게 import하고, 두 프론트는 `ApiTable.js`를 통해 커맨드를 받는다.
>
> 커맨드/페이즈를 추가·변경하면 정본만 고치고 `npm run gen:constants`(또는 compile)로 미러를 갱신한다.

## 메시지 봉투

```ts
interface OsciloScopeMessage {
  command : CommandTypes;
  payload : Object;
}
```

`OsciloScopeMessage`는 전선 위의 느슨한 봉투다. 커맨드별 payload 타입은 `src/ApiTable.ts`의
**`ProtocolMap`** 한 곳에 묶여 있고, `outbound`(발신)와 `route`(수신)가 이 맵을 따라 타입을
맞춘다. 그래서 payload 인터페이스(`src/tool/types.ts`)를 고치면 관련 송·수신부에 **컴파일 에러**가
떠서 고칠 곳을 놓치지 않고, 수신 핸들러는 payload 타입을 자동으로 받아 캐스팅이 필요 없다.

## 메인 패널 ↔ Extension Host

| command | 방향 | payload | 처리 |
| --- | --- | --- | --- |
| `UI_READY` | 패널 → ext | `{}` | ext: 버퍼된 메시지 flush |
| `UPDATE_ALL_DATA` | ext → 패널 | `{ filePath, rawLogs, tool: { id, uri } }` | 패널: `tool.uri`를 import해 `analyze` → `render` |
| `LOG_FILE_LOADED` | ext → 패널 | `{ fileName, filePath }` | 패널: 헤더 경로(`#hdrPath`) 표시 |
| `TOOL_ERROR` | 패널 → ext | `{ toolId, message, phase }` | 패널: 안내 화면 표시 후 통지 (`phase`: `load`\|`analyze`\|`render`) |

> **`UPDATE_ALL_DATA`의 payload가 바뀌었다.** 예전에는 `transformData` 결과(그룹 구조)를 보냈지만,
> 이제 **원본 로그 + 실행할 도구**를 보낸다. 가공은 웹뷰에서 도구의 `analyze()`가 한다.
> 커맨드 이름은 유지했다 — "이 데이터로 패널을 다시 그려라"는 의미가 여전히 맞다.

> **`tool.uri`는 메인 패널 웹뷰 기준으로 만들어야 한다.** `asWebviewUri`가 만드는 URL은 웹뷰
> 인스턴스마다 다르다. `TOOLS_LIST`의 `uri`(사이드바 기준)를 재사용하면 로드에 실패한다.

> **`tool`에 `name`·`version`이 없는 이유:** 확장은 도구를 실행하지 않으므로 `meta`를 모른다.
> 메인 패널이 import 직후 `meta`를 읽어 헤더의 도구명을 채운다.

> **`VARIABLE_CHANGED`는 제거되었다.** 변수 선택은 이제 도구 내부의 관심사이고 확장이 알 필요가 없다.

## 사이드바 뷰 ↔ Extension Host

| command | 방향 | payload | 처리 |
| --- | --- | --- | --- |
| `SELECT_LOG_FILE` | 사이드바 → ext | `{}` | ext: `showOpenDialog`로 `.jsonl` 선택 |
| `LOG_FILE_LOADED` | ext → 사이드바 | `{ fileName, filePath }` | 사이드바: 파일명 표시 + START 활성화 |
| `START_RENDER` | 사이드바 → ext | `{ toolId }` | ext: 선택 경로 + 도구로 `loadLogFile` |
| `GET_TOOLS_LIST` | 사이드바 → ext | `{}` | ext: `ToolRegistry`로 스캔 후 회신 |
| `TOOLS_LIST` | ext → 사이드바 | 아래 참조 | 사이드바: 각 도구를 import해 meta를 채운 뒤 렌더 |
| `SELECT_TOOL` | 사이드바 → ext | `{ toolId }` | ext: 선택 도구 보관 |
| `CREATE_TOOL` | 사이드바 → ext | `{}` | ext: ID 입력받아 스켈레톤 생성 후 에디터로 열기 |
| `COPY_TOOL` | 사이드바 → ext | `{ toolId }` | ext: 기본 도구를 워크스페이스로 복사 |
| `OPEN_TOOL` | 사이드바 → ext | `{ toolId }` | ext: 도구 파일을 에디터로 열기 |
| `TOOL_CREATED` | ext → 사이드바 | `{ toolId, filePath }` | 사이드바: 새 도구를 선택 상태로 |
| `TOOLS_CHANGED` | ext → 사이드바 | `{}` | 사이드바: `GET_TOOLS_LIST` 재요청 |
| `VALIDATE_TOOL` | 사이드바 → ext | `{ toolId }` | ext: 검사 패널을 띄워 실행 |
| `VALIDATION_RESULT` | ext → 사이드바 | `ValidationReport` | 사이드바: 행에 결과 아이콘 |
| `TOOL_ERROR` | ext ↔ 사이드바 | `{ toolId, message, phase }` | 사이드바: 해당 행을 실패 표시 |

`TOOLS_LIST`의 payload — **확장은 파일 정보만 보낸다.** 이름·버전은 사이드바가 import해서 채운다.

```ts
{
  tools: Array<{
    id         : string;              // 파일명에서 추출 (<id>.tool.js)
    source     : 'builtin' | 'user';
    uri        : string;              // 사이드바 웹뷰 기준 asWebviewUri
    mtime      : number;              // ESM 캐시 무효화용
    overrides? : boolean;             // 같은 id의 기본 도구를 재정의한 사용자 도구
    error?     : string;              // 확장 단계에서 이미 실패 (ID 형식 위반, 멀티루트 중복 등)
  }>;
  trusted        : boolean;           // 워크스페이스 신뢰 — false면 사용자 도구 미로드
  workspaceReady : boolean;           // 워크스페이스 유무 — false면 '만들기' 비활성
}
```

> `START_RENDER`에 `toolId`를 실어 보내는 이유: 선택 상태는 `SELECT_TOOL`로도 저장하지만,
> START 시점에 함께 보내 사이드바와 확장의 상태 불일치를 없앤다. `toolId`가 없으면 확장이
> 기본 도구(`change-detector`)로 떨어뜨린다.

> `LOG_FILE_LOADED`는 목적지가 둘이다. 파일 선택 직후엔 사이드바(행 갱신용)로,
> START 후 렌더 시엔 메인 패널(헤더 경로용)로 각각 보낸다.

## 검사 패널 ↔ Extension Host

| command | 방향 | payload | 처리 |
| --- | --- | --- | --- |
| `UI_READY` | 검사 패널 → ext | `{}` | ext: `RUN_VALIDATION` 송신 |
| `RUN_VALIDATION` | ext → 검사 패널 | `{ toolId, toolUri }` | 패널: `runValidation()` 실행 |
| `VALIDATION_RESULT` | 검사 패널 → ext | `ValidationReport` | ext: 출력 채널에 상세, 사이드바로 중계 |

```ts
interface ValidationReport {
  toolId : string;
  ok     : boolean;                    // fail이 하나도 없으면 true (warn만이면 true)
  checks : Array<{
    name    : string;                  // '영역 격리', '렌더 결정성' 등
    status  : 'pass' | 'fail' | 'warn' | 'skip';
    fixture?: string;                  // 어느 픽스처에서 났는지
    message : string;                  // 실패 시 구체적 위치 포함
  }>;
}
```

`checks`는 **항상 12행**이고 검사 번호 순으로 정렬된다. 실행되지 않은 항목은 `skip`이다.
`toolUri`도 **검사 패널 웹뷰 기준**으로 만들어야 한다.

## 시퀀스 (사이드바 → 메인 패널)

```mermaid
sequenceDiagram
    participant SB as 사이드바 뷰
    participant EXT as Extension Host
    participant MP as 메인 패널

    SB->>EXT: GET_TOOLS_LIST
    EXT-->>SB: TOOLS_LIST (파일 정보만)
    Note over SB: 각 도구를 import해 meta 수집

    SB->>EXT: SELECT_LOG_FILE
    Note over EXT: showOpenDialog
    EXT-->>SB: LOG_FILE_LOADED (파일명·START 활성화)

    SB->>EXT: SELECT_TOOL { toolId }
    SB->>EXT: START_RENDER { toolId }
    Note over EXT: parseLogFile() — 가공은 하지 않는다
    EXT->>MP: createOrShow (패널 오픈)
    MP-->>EXT: UI_READY
    EXT->>MP: LOG_FILE_LOADED (헤더 경로)
    EXT->>MP: UPDATE_ALL_DATA { filePath, rawLogs, tool }
    Note over MP: tool.uri import → analyze → render
```

## 브릿지 구현 위치

모든 채널이 API 테이블(`src/ApiTable.ts` · `osciloscope/js/ApiTable.js`)을 거친다.

- **메인 패널 송신**: `extension.ts`가 `outbound(m => OsciloScopeWebviewPanel.sendDataToWebview(m))`로
  발신. `sendDataToWebview`는 패널 부재 시 무시하고, `UI_READY` 이전 메시지는 `pendingMessages`에
  버퍼링했다가 flush.
- **메인 패널 수신**: `OsciloScopeWebviewPanel.receiveDataFromWebview`가 `route`로 라우팅
  (`createOrShow` 시 1회 등록).
- **사이드바 송수신**: `SidebarProvider`가 `outbound`(필드 `api`)로 발신, `route`로 수신.
- **검사 패널**: `ValidationPanel`이 껍데기 HTML을 만들고, 인라인 셸도 FE-API Table을 import해
  통신한다. `runValidation` 결과를 15초까지 기다리고, 초과하면 `dispose` 후 실패 리포트.
- **프론트 송수신**: 메인 패널 `VisualizerApp`(`this._api`), 사이드바 `sidebar-view/js/main.js`(`api`).
  둘 다 `createApiTable`로 테이블을 만들어 발신·`route` 수신.

## 확장 시 유의점

- **커맨드는 정본 한 곳만**: 새 커맨드/페이즈는 `OsciloScopeMessage.ts`에만 추가하고
  `npm run gen:constants`로 `constants.js`를 재생성한다 (수동 미러 금지).
- **payload는 ProtocolMap에 연결**: 커맨드↔payload는 `ApiTable.ts`의 `ProtocolMap`에 묶는다.
  타입이 맞물려 있어 계약이 바뀌면 컴파일러가 고칠 곳을 짚어 준다.

### 새 커맨드 추가 절차

1. `src/OsciloScopeMessage.ts`의 `CommandTypes`에 커맨드를 추가한다 (constants.js는 빌드가 생성).
2. payload 인터페이스를 `src/tool/types.ts`에 정의한다.
3. `src/ApiTable.ts`의 `ProtocolMap`에 `커맨드 → payload`를 연결한다.
4. 발신이 필요하면 `outbound`에 엔드포인트 한 줄, 프론트는 `ApiTable.js`에 대응 엔드포인트를 추가한다.
5. 수신 쪽 `route({ [커맨드]: 핸들러 })`에 핸들러를 건다 — payload 타입은 자동으로 따라온다.
- **웹뷰별 URI**: 도구 URI를 넘길 때는 받을 웹뷰 기준으로 `asWebviewUri`를 호출해야 한다.
  한쪽 URL을 다른 쪽에 넘기면 로드에 실패한다.
- **`UI_READY` 핸드셰이크**: 웹뷰가 리스너를 걸기 전에 보낸 메시지는 VS Code가 버퍼링하지
  않아 유실된다. 메인 패널과 검사 패널 모두 `UI_READY`를 기다린 뒤 보낸다.
