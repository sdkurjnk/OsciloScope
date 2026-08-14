# API 명세: Frontend (Webview)

`osciloscope/`의 Webview UI 공개 API. **ES 모듈**이며, `tool-host/`는 두 웹뷰(메인 패널·사이드바 뷰)가
함께 쓴다.

관련 문서: [frontend.md](./frontend.md)(구성) · [message-protocol.md](./message-protocol.md)(통신) ·
[plugin-tools.md](./plugin-tools.md)(도구 작성). 시그니처는 JS라 정적 타입이 없고, `_` 접두 멤버는 내부용이다.

## `js/constants.js`

```js
export const CommandTypes = Object.freeze({ /* 17종 */ });
export const ToolErrorPhase = Object.freeze({ LOAD: 'load', ANALYZE: 'analyze', RENDER: 'render' });
```

`src/OsciloScopeMessage.ts`가 정본이고 문자열 값이 같아야 한다. 사이드바 뷰도 이 파일을 import한다.
전체 목록은 [message-protocol.md](./message-protocol.md).

## `tool-host/ToolHost.js`

도구에 넘길 `ctx`/`host`를 만들고 생명주기를 돌린다. 검사기도 같은 함수를 쓴다 —
검사와 실제 실행이 다른 경로를 타면 "검사는 통과했는데 실행하면 깨진다"가 생긴다.

| export | 시그니처 | 설명 |
| --- | --- | --- |
| `varKeyOf` | `(log): string` | `var_id` 있으면 `name@var_id`, 없으면 `name` (구버전 폴백) |
| `groupOf` | `(log): 'Global'\|'Local'` | `domain === 'GLOBAL'`이면 Global |
| `escape` | `(str): string` | HTML 특수문자 이스케이프. 도구가 `innerHTML`을 쓸 때용 |
| `widgets` | `{ layout, varList, timeline }` | 표준 위젯 (동결) |
| `createContext` | `({filePath, log}): ToolContext` | `analyze`에 넘길 맥락. DOM 통로 없음 |
| `createHost` | `({mount, filePath, theme?, log}): ToolHost` | `render`에 넘길 맥락 |
| `detectTheme` | `(): 'light'\|'dark'\|'high-contrast'` | `body`의 `vscode-*` 클래스로 판별, 없으면 `dark` |
| `shapeError` | `(tool, expectedId?): string\|null` | 계약대로 생겼는지. 문제 없으면 `null` |
| `isThenable` | `(value): boolean` | 반환값이 `Promise`인지 (동기성 검사) |

### `class ToolSession`

```js
const session = new ToolSession(tool, { filePath, log });
session.analyze(rawLogs);
session.render(mountEl);
session.dispose();
```

| 멤버 | 설명 |
| --- | --- |
| `meta` | `tool.meta` (없으면 `null`) |
| `analyze(rawLogs)` | `createContext`로 만든 `ctx`를 넘겨 호출. 반환값이 `Promise`면 예외를 던진다 |
| `render(mount)` | `createHost`로 만든 `host`를 넘겨 호출. 여기서도 `Promise`면 예외 |
| `dispose()` | 도구의 `dispose`를 부르고(있으면) `mount`를 비운다. 도구가 던져도 정리는 끝낸다 |

> 동기성을 검사기뿐 아니라 **실행 시점에도** 막는다. 검사를 안 거친 도구가 `Promise`를 반환하면
> `render(Promise)`가 엉뚱한 곳에서 터지기 때문이다.

## `tool-host/ToolLoader.js`

| export | 시그니처 | 설명 |
| --- | --- | --- |
| `importTool` | `(uri, version): Promise<any>` | `withVersion`으로 캐시를 무효화한 뒤 `import`. `default`를 반환 |
| `withVersion` | `(uri, version): string` | `?v=` 또는 `&v=`를 붙인다. URI에 이미 쿼리가 있는 경우를 처리 |
| `loadToolInfo` | `(info): Promise<Loaded>` | 목록용. **예외를 던지지 않고** `error`를 담아 돌려준다 |
| `loadToolInfos` | `(infos): Promise<Loaded[]>` | 목록 전체를 병렬 로드. 하나가 실패해도 나머지는 그대로 |
| `loadToolForRun` | `(uri, version, expectedId): Promise<tool>` | 실행용. **실패하면 던진다** |

`Loaded`는 `TOOLS_LIST` 항목에 `name`/`version`/`description`/`ok`/`error?`가 더해진 것이다.
`ok`가 false면 사이드바에서 선택할 수 없다.

## `tool-host/widgets/`

| 위젯 | 시그니처 | 설명 |
| --- | --- | --- |
| `layout(el)` | → `{ left, right }` | `el`을 비우고 2단 골격 생성 |
| `varList(el, groups, opts?)` | → `{ setActive(varKey) }` | 그룹별 목록. `opts.onSelect(varKey)`. 빈 groups면 "데이터 없음" |
| `timeline(el, entry)` | → `void` | 헤더(이름·스코프·메타 배지·횟수) + 이력 행. `entry`가 없으면 빈 화면 |

셋 다 컨테이너를 비우고 새로 그리므로 같은 `el`에 반복 호출해도 결과가 같다(렌더 결정성).
마크업 최상위에 `.osc-widget`이 붙고 스타일은 그 하위로만 적용된다.

`timeline`의 변화 태그 계산 순서:

| 조건 | 태그 |
| --- | --- |
| `event === 'deleted'` | `deleted` |
| `idx === 0` 또는 `event === 'init'` | `init` |
| 양쪽 `parseFloat` 가능 | 증감 delta — `+n` / `n`(음수) / `±0` |
| 그 외, 문자열이 같으면 | `—` |
| 그 외, 다르면 | `changed` |

값 표시는 `null`/`undefined`가 `—`, 객체·배열은 `JSON.stringify`, 60자 초과는 말줄임이다.

## `tool-host/ToolValidator.js`

```js
export async function runValidation({ toolId, toolUri }): Promise<ValidationReport>
```

검사 패널이 `RUN_VALIDATION`을 받았을 때 호출한다. 12항목의 내용은
[plugin-tools.md](./plugin-tools.md)에, 리포트 형식은 [message-protocol.md](./message-protocol.md)에 있다.

동작 요약:

- 픽스처 5종을 정해진 순서로 주입하고, **항목별로 가장 나쁜 결과 하나만** 남긴다.
  5종을 그대로 쌓으면 같은 이름이 다섯 줄씩 나와 읽기 어렵다.
- 리포트는 **항상 12행**이다. 형태 검사 실패로 조기 종료해도 나머지는 `skip`으로 채운다.
- `ok`는 `fail`이 하나도 없을 때 true다. `warn`만 있으면 true.
- 계측: `MutationObserver`(`mount` 하위 제외)로 영역 격리, `Object.keys(window)` 스냅샷으로
  전역 추가, `setTimeout`/`setInterval`/`window`·`document` 리스너 래핑으로 정리 검사.
  전역 스냅샷은 **계측을 건 뒤에** 뜬다 — 먼저 뜨면 계측 자신이 "도구가 추가한 전역"으로 잡힌다.
- 렌더는 화면 밖(`position:absolute; left:-99999px`) 스테이지에 붙여 실행한다. 완전히 떼어 두면
  크기를 재는 도구가 실제와 다르게 동작한다. 렌더 결정성 비교만 분리된 컨테이너 두 개를 쓴다.
- 전체 예산은 13초다. 확장의 15초 타임아웃보다 먼저 리포트를 돌려주기 위해서다.

> **실행 시간(12번)은 실측 판정이다.** 동기 함수는 도중에 끊을 수 없어 시간을 재고 초과하면
> 실패로 남긴다. 진짜 무한 루프는 확장이 검사 패널을 `dispose`해서 회수한다.

## `js/VisualizerApp.js`

| 멤버 | 시그니처 | 설명 |
| --- | --- | --- |
| `constructor` | `()` | `acquireVsCodeApi()`를 잡고 전역에서 삭제 |
| `init` | `(): void` | `message` 리스너 등록 → 배지 "로드 중" → `UI_READY` |
| `_onMessage` *(private)* | `(message): void` | `LOG_FILE_LOADED` → 헤더 경로, `UPDATE_ALL_DATA` → `_run` |
| `_run` *(private)* | `(payload): Promise<void>` | 이전 세션 dispose → 도구 로드 → analyze → render. 순번(`_runSeq`)이 어긋나면 중단 |
| `_fail` *(private)* | `(toolId, phase, err): void` | 배지·안내 화면 갱신 + `TOOL_ERROR` 송신 |
| `_setToolName` *(private)* | `(meta): void` | 헤더에 `이름 v버전`. 확장은 `meta`를 모르므로 여기서 채운다 |

## 사이드바 뷰 (`sidebar-view/js/main.js`)

모듈 최상위에서 `acquireVsCodeApi()`를 잡아 전역에서 지운 뒤 배선한다. 클래스 없이 함수와
`state` 객체로 구성된다.

| 상태 | 용도 |
| --- | --- |
| `hasLogFile` | START 활성화 여부 |
| `selectedId` | 선택된 도구 ID. 목록 갱신 후 사라졌거나 깨졌으면 해제 |
| `tools` | `loadToolInfos` 결과 |
| `checks` | `toolId → 'pass'\|'warn'\|'fail'\|'running'` |
| `listSeq` | 목록 로드 순번. 늦게 끝난 이전 로드가 새 목록을 덮어쓰지 않게 한다 |

> `VALIDATION_RESULT`의 `ok`가 true여도 `checks`에 `warn`이 있으면 **warn 아이콘**으로 표시한다.
> `ok`는 fail 없음만 뜻해서, 그대로 pass로 쓰면 `dispose` 미구현 경고가 묻힌다.
