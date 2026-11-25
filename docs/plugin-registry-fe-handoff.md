# 플러그인 레지스트리 1~3단계: FE 작업 인계

`PLUGIN_REGISTRY_PLAN.md` 1~3단계 중 **BE 범위는 `feature/plugin-registry-BE`에 구현되어 있다.**
이 문서는 FE(웹뷰) 담당이 이어서 할 일과, BE가 바꾼 계약 중 FE에 영향을 주는 것을 정리한다.

- Tool 계약(정본): [`assets/templates/osciloscope-tool.d.ts`](../assets/templates/osciloscope-tool.d.ts) — Host API 1.0.0
- plugin.json · installed.json 계약: [`src/tool/plugin.ts`](../src/tool/plugin.ts)
- 프로토콜(정본): [`src/ApiTable.ts`](../src/ApiTable.ts) → `osciloscope/js/constants.js` 자동 생성

---

## 1. 현재 상태 — 지금 FE 코드로도 돌아간다

BE 변경 후에도 **기존 FE 코드는 그대로 동작한다.** 기본 도구 코드는 내용을 바꾸지 않고 위치만 옮겼고,
옛 인터페이스(`meta`/`analyze`/`render`)를 그대로 쓰고 있다.

| 흐름 | 지금 동작 |
| --- | --- |
| 사이드바 목록 | `TOOLS_LIST` → 각 도구 import → `meta`로 이름 표시 (기존과 같음) |
| START | `UPDATE_ALL_DATA`의 `tool.uri`(전역 저장소 진입 파일)를 import → analyze → render |
| 검사 | `RUN_VALIDATION`의 `toolUri`로 기존 12항목 검사 |
| 만들기 / 복사 버튼 | **눌러도 아무 일도 없다** — BE 커맨드가 제거됨. FE에서 버튼 제거 필요 (§3.4) |

---

## 2. BE가 바꾼 계약 (FE 영향)

### 2.1 도구 로드 경로: 전역 저장소 하나

```
<globalStorageUri>/
├── installed.json                     { "<id>": { "version": "1.0.0", "enabled": true } }
└── plugins/<id>/<version>/
    ├── plugin.json                    { id, name, version, description, entry, hostApi }
    └── index.js                       진입 파일 (ES 모듈)
```

- 기본 도구 2개는 저장소 `plugins/<id>/{plugin.json, index.js}`에 있고, 확장 활성화 때 전역 저장소로
  **시드**된다(처음 설치한 사용자도 바로 2개가 생긴다). 개발 모드(F5)에서는 매번 다시 복사하므로
  `plugins/<id>/index.js`를 고치고 창을 다시 열면 반영된다.
- 워크스페이스 도구(`.osciloscope/tools/`)와 `<확장>/tools/`는 더 이상 읽지 않는다.
- 웹뷰 `localResourceRoots`는 `<확장>/osciloscope` + `<globalStorageUri>/plugins` 두 곳이다.
  CSP는 그대로(`script-src cspSource`로 함께 허용).
- 실제 저장소 경로는 출력 채널 `OsciloScope` 첫 줄에 찍힌다.

### 2.2 `TOOLS_LIST` payload (변경)

```ts
interface ToolsListPayload {
  tools: ToolInfo[];            // trusted · workspaceReady 제거
}

interface ToolInfo {
  id          : string;
  name        : string;         // ★ plugin.json에서 — 표시용으로 바로 쓸 수 있다
  version     : string;         // ★
  description : string;         // ★
  hostApi     : string;         // ★ 예: "^1.0.0"
  source      : 'builtin' | 'user';   // builtin = 시드된 기본 도구, user = 수동 설치
  uri         : string;         // 사이드바 웹뷰 기준. error가 있으면 '' 일 수 있다
  mtime       : number;
  error?      : string;         // plugin.json 오류 · hostApi 비호환 · 진입 파일 없음 등
}                               // overrides 제거 (id가 저장소에서 유일)
```

- **이름·버전을 얻으려고 도구를 import할 필요가 없어졌다.** 목록용 `loadToolInfo`/`loadToolInfos`의
  import는 제거해도 된다. 그러면 "목록만 열어도 모듈 최상위 코드가 실행된다"는 문제도 사라진다.
- `hostApi` 호환성은 BE가 판정한다. 비호환이면 `error`가 채워져 온다. FE는 semver를 다룰 필요가 없다.
- 비활성(`enabled: false`) 플러그인은 목록에 아예 오지 않는다.

### 2.3 제거된 커맨드

`CREATE_TOOL` · `COPY_TOOL` · `TOOL_CREATED` — `constants.js`에서도 빠졌다.
`ApiTable.js`의 `createTool`/`copyTool` 엔드포인트와 사이드바의 `TOOL_CREATED` 핸들러는 지금
`undefined` 커맨드를 가리킨다. 제거해야 한다.

`OPEN_TOOL`(진입 파일 열기), `VALIDATE_TOOL`(검사)은 유지된다.

### 2.4 `UPDATE_ALL_DATA.tool`에 `mtime` 추가

```ts
tool: { id: string; uri: string; mtime: number }
```

START 재실행 규칙(§3.3)에서 "같은 도구 재실행"과 "파일이 수정됨"을 가르는 키다. ESM 캐시 무효화 키로도 쓴다.

### 2.5 `TOOL_ERROR` 중계 버그 수정

메인 패널이 보낸 `TOOL_ERROR`가 이제 **사이드바까지 전달된다**(예전엔 확장에서 버려졌다).
사이드바의 기존 `onToolError`가 처음으로 실제로 호출되니 동작을 확인할 것.

### 2.6 `HOST_API_VERSION`

`constants.js`에 `export const HOST_API_VERSION = '1.0.0'`이 생성된다(정본: `src/tool/plugin.ts`).
`ToolHostApi.apiVersion` 값으로 쓰면 된다.

### 2.7 `ToolErrorPhase` — 아직 안 바꿈 (FE와 맞춰서 변경)

새 생명주기에 맞는 값은 아래로 제안한다. 지금 바꾸면 기존 `VisualizerApp`(`ANALYZE`/`RENDER`)이 깨지므로
**FE 전환 PR에 맞춰 BE가 `src/ApiTable.ts`를 바꾸고 `npm run gen:constants`로 재생성**한다.

```ts
enum ToolErrorPhase {
  LOAD       = "load",        // import 실패 또는 Tool 규격 위반
  ACTIVATE   = "activate",    // activate() 예외·Promise 반환
  UPDATE     = "update",      // onLogUpdate 콜백 예외 (START 재실행 시)
  CALLBACK   = "callback",    // 위젯 콜백(onSelect 등) 예외
  DEACTIVATE = "deactivate"   // deactivate() 예외
}
```

---

## 3. FE 할 일

### 3.1 ToolHost 재작성 (Tool API Table 구현)

`osciloscope-tool.d.ts`의 `ToolHostApi`를 구현한다. 확정된 결정:

- `ToolSession`은 **mount와 activate를 나눈다.** 검사기가 "우리가 만든 DOM"(shadow host·`<link>`)과
  "도구가 만든 DOM"을 구분하려면, shadow root를 만든 뒤 도구를 부르기 전에 관찰을 시작해야 한다.

  ```js
  const session = new ToolSession(tool, { filePath, logs, log, onCallbackError });
  session.mount(parentEl);     // shadow root + <link> + 컨테이너
  session.activate();          // tool.activate(api)
  session.update(newLogs);     // onLogUpdate 구독자 호출
  session.deactivate();        // tool.deactivate() + 구독 해제 + shadow host 제거
  ```
- 모든 도구 호출(`activate`/`deactivate`/`onLogUpdate` 콜백/위젯 콜백)을 감싼다. Promise 반환은
  일반 예외와 구분되는 오류(예: `ToolContractError`)로 던져야 검사기가 "실행 실패"와 "동기성 위반"을
  다른 항목으로 기록할 수 있다.
- **위젯 콜백**(`varList`의 `onSelect`)은 ToolHost가 감싸서 예외를 `onCallbackError`로 보고한다.
  클릭 핸들러 안의 예외는 우리 스택을 거치지 않아 그대로면 아무도 모르게 사라진다.
  (도구가 자기 DOM에 직접 건 리스너는 감쌀 수 없다 — 한계로 문서화.)
- `deactivate()` 후 `onLogUpdate` 구독은 받지 않는다. 남은 구독은 ToolHost가 자동 해제한다.
- 도구 객체는 모듈 싱글턴이라 실행마다 **재사용**된다(activate → deactivate → activate).

### 3.2 Shadow DOM (계획서 §3.2) — 확정안과 구현 중 알게 된 점

| 항목 | 결정 |
| --- | --- |
| 모드 | **open**. 같은 JS 실행 환경이라 closed의 보안 이득이 없고, open이어야 검사기 관찰·DevTools 디버깅이 된다 |
| 구조 | `#pluginRoot` › `div.osc-tool-host`(shadow host) › shadowRoot › `<link>` + `div.osc-tool-root`(= `getContainer()`) |
| 위젯 CSS | `layout.css`의 위젯 부분 + `sidebar.css` + `timeline.css`를 `tool-host/widgets/widgets.css` 하나로 모으고, shadow root마다 `<link rel="stylesheet">`로 넣는다. 주소는 `new URL('./widgets/widgets.css', import.meta.url)` — BE가 경로를 계산할 필요 없음. 헤더·`.tool-error` 스타일은 전역에 남긴다 |
| CSS 로드 방식 | `fetch` + `adoptedStyleSheets`는 **불가**(CSP `connect-src 'none'`). `<link>`는 `style-src cspSource`로 이미 허용됨 |
| 검사기 관찰 | MutationObserver **2개**: ① `document` 전체 — 잡히는 변경은 모두 위반 ② shadow root — 컨테이너 하위만 허용, 우리 `<link>` 제거 등은 위반 |
| getElementById | 기본 도구·위젯 모두 쓰지 않음(확인함) → 수정 불필요. d.ts에 `container.querySelector` 안내 있음 |

구현하면서 알게 된 주의점 (초안 작성 중 확인):

1. **전역 리셋이 shadow 안에 안 들어간다.** `layout.css`의 `* { box-sizing: border-box; margin: 0; padding: 0; }`가
   shadow 안 요소에 적용되지 않는다. 그대로 두면 위젯의 `<p>`(빈 화면 문구) 여백과 box-sizing이 달라져
   화면이 리팩토링 전과 달라진다. **`widgets.css` 맨 위에 같은 리셋을 넣어야 한다.**
2. **상속 속성은 들어온다.** `font-family`, `color` 같은 상속 속성은 shadow host에서 상속되므로 따로 줄 필요 없다.
   `--vscode-*` 변수도 마찬가지.
3. **shadow host 크기는 인라인으로.** 검사 패널은 `layout.css`를 로드하지 않으므로, host에
   `display:block; height:100%`를 인라인으로 줘야 메인 패널과 검사 패널에서 같은 크기가 나온다.
   컨테이너(`.osc-tool-root`)의 `height:100%`는 `widgets.css`에 둔다.
4. **`<link>`는 비동기 로드다.** 첫 렌더에 아주 짧게 스타일 없는 화면이 보일 수 있다. 캐시 후엔 거의 안 보인다.
   문제가 되면 `.osc-tool-root`를 스타일 로드 전까지 숨기는 방식을 검토.
5. **document에 건 observer는 shadow 안쪽 변경을 보고하지 않는다.** 영역 격리 검사를 shadow root
   observer 없이 두면 "mount 밖 변경 없음"이 항상 통과하는 거짓 양성이 된다.
6. **도구의 `<style>`이 이제 스코프된다.** 기존 가이드("`<style>` 태그를 넣으면 다른 도구와 섞인다")는
   더 이상 사실이 아니다. `monotonic` 주석과 `docs/plugin-tools.md`를 고칠 것.

### 3.3 VisualizerApp — START 재실행 규칙 (확정)

`UPDATE_ALL_DATA`를 받았을 때:

| 조건 | 동작 |
| --- | --- |
| 실행 중인 도구와 `id`·`uri`·`mtime`이 모두 같고, `onLogUpdate` 구독자가 있음 | 다시 import·activate하지 않고 `session.update(rawLogs, filePath)` |
| 위와 같지만 구독자가 없음 | 같은 모듈로 deactivate → activate |
| `id`·`uri`가 다르거나 **`mtime`이 다름(파일 수정)** | 이전 세션 deactivate → `import(uri + '?v=' + mtime)`로 새로 로드 → activate |

- 캐시 키를 지금의 실행 순번(`run${seq}`) 대신 `mtime`으로 바꾼다. 그래야 파일이 그대로면 같은 모듈을
  재사용하고, 수정됐을 때만 새 코드가 돈다.
- `_runSeq`로 늦게 끝난 이전 로드를 버리는 처리는 유지.
- 실패 시 `TOOL_ERROR { toolId, message, phase }` 송신 + 안내 화면(기존과 같음).

### 3.4 사이드바

- **만들기(+), 복사(⧉) 버튼과 엔드포인트 제거.** 열기(✎)·검사(✓)는 유지.
- 목록은 `ToolInfo`의 `name`/`version`/`description`을 바로 쓴다(도구 import 제거).
- `error`가 있는 항목은 기존처럼 목록에 남기고 선택 불가 + 사유 표시. `uri`가 `''`일 수 있다.
- 신뢰 안내(`trusted`)·`workspaceReady` 처리 제거. 기본 배지는 `source === 'builtin'` 그대로.

### 3.5 기본 도구 전환

`plugins/change-detector/index.js`, `plugins/monotonic/index.js`를 `Tool` 인터페이스로 바꾼다.
계획서대로 **가장 단순한 `change-detector`를 먼저** 전환해 구조를 검증한 뒤 `monotonic`.

- `meta` → `metadata`(4개 필드, `id`는 plugin.json과 같게), `analyze`+`render` → `activate(api)`,
  `dispose` → `deactivate`(필수).
- `onLogUpdate`를 구독해 다시 그리면 START 재실행 시 재활성화 없이 갱신된다.
- 첫 줄 `/// <reference path="./osciloscope-tool.d.ts" />`는 새 위치에서 깨진 경로다. 고치거나 d.ts 배포 방식을 정할 것.
- **도구 코드를 바꿀 때 plugin.json의 version은 그대로 1.0.0**이어도 된다(아직 배포 전). 배포 후 변경은 버전을 올린다.
- `assets/templates/tool-skeleton.js`도 새 인터페이스로 갱신(만들기 기능은 없어졌지만 작성 예시로 쓴다).

### 3.6 검사기 재설계 (12 → 11항목, 확정)

| # | 항목 | 기존 대비 |
| --- | --- | --- |
| 1 | 로드 | 유지 |
| 2 | 형태 | `metadata` 4필드(description은 빈 문자열 허용), `activate`·`deactivate` 함수, `metadata.id` = 도구 ID |
| 3 | 최상위 부작용 | 유지 |
| 4 | activate 실행 | 기존 4(analyze 실행)+8(render 실행) 통합. 픽스처 5종에서 예외 없음 |
| 5 | 동기성 | 대상: activate · deactivate · onLogUpdate 콜백 |
| 6 | 입력 불변 | activate·갱신 콜백 후 `getLogs()` 결과가 그대로. 픽스처는 복제본을 넘기고 원본과 비교 권장 |
| 7 | 결정성 | 기존 7(analyze 결정성) **삭제**, 기존 9 변경: activate → deactivate → activate를 새 컨테이너에 반복해 DOM 비교 (도구 객체 재사용 시 잔여 상태도 잡힘) |
| 8 | 로그 갱신 (신규) | activate 후 다른 픽스처로 onLogUpdate 발생 → 예외·Promise 없음. 구독 안 하면 skip |
| 9 | 영역 격리 | shadow root 기준 (§3.2 observer 2개) + 전역 추가 없음 |
| 10 | 정리 | deactivate 후 타이머·전역 리스너 잔존 = fail. 기존 "dispose 없음 경고"는 2번 fail로 흡수 |
| 11 | 실행 시간 | 유지 (픽스처당 3초, 전체 13초 — 확장 15초 타임아웃 전에 리포트) |

- 검사기도 실제 실행과 **같은 `ToolSession`**을 써야 한다.
- 리포트 행 수가 12 → 11로 바뀐다. `docs/message-protocol.md`·`docs/plugin-tools.md`의 "항상 12행" 문구 수정.
- BE `ValidationPanel`은 변경 없음(패널 수명·15초 타임아웃·`RUN_VALIDATION { toolId, toolUri }`).
  plugin.json 오류·hostApi 비호환 플러그인은 BE가 웹뷰를 띄우기 전에 `로드` 실패 리포트로 끝낸다.

---

## 4. 테스트용 샘플 플러그인 (3단계 완료 기준 확인용)

FE 전환이 끝나면 아래로 수동 설치를 확인할 수 있다.

1. 출력 채널 `OsciloScope`에서 저장소 경로 확인.
2. `<저장소>/plugins/sample-detector/1.0.0/`에 `plugin.json`(id `sample-detector`)과 `index.js`를 둔다.
   `index.js`는 전환된 `change-detector`를 복사해 `metadata.id`만 바꾸면 된다.
3. `installed.json`에 `"sample-detector": { "version": "1.0.0", "enabled": true }` 추가 → 목록 갱신.
4. `enabled: false` → 목록에서 사라짐. `hostApi: "^2.0.0"` → 목록에 오류 표시, 선택 불가.

BE 쪽 동작(시드·수동 설치·enabled·hostApi·진입 파일 없음·installed.json 손상)은
`src/test/pluginRegistry.test.ts`가 자동으로 검증한다.
