# 분석 도구 만들기

OsciloScope의 분석 화면은 **도구(tool)** 가 그린다. 기본 도구를 쓸 수도 있고, 직접 만들어
자기 방식대로 로그를 분석하고 그릴 수도 있다. 이 문서는 도구를 만드는 방법을 다룬다.

내부 구조가 궁금하면 [architecture.md](./architecture.md)를, 화면 쪽 API의 정확한 시그니처는
[api-frontend.md](./api-frontend.md)를 보라.

---

## 5분 만에 하나 만들기

1. Activity Bar에서 OsciloScope 뷰를 연다.
2. TOOLS 옆의 **+ 만들기**를 누른다.
3. 도구 ID를 입력한다 — 소문자·숫자·하이픈만 쓸 수 있다 (예: `value-range`).
4. `.osciloscope/tools/value-range.tool.js`가 만들어지고 에디터에 열린다.
5. SOURCE에서 로그 파일을 고르고, TOOLS에서 방금 만든 도구를 선택한 뒤 **START**.

생성된 파일은 **그 상태로도 동작한다.** 기본 도구와 같은 화면이 나오므로,
빈 껍데기부터 시작하는 대신 돌아가는 것을 조금씩 고쳐 나가면 된다.

> 폴더를 연 상태여야 도구를 만들 수 있다. 또 워크스페이스를 신뢰하지 않으면 사용자 도구를
> 아예 불러오지 않는다 — 남이 만든 코드를 실행하는 일이라 VS Code의 신뢰 설정을 따른다.

---

## 도구는 어떻게 생겼나

도구 파일은 브라우저 ES 모듈이고, 객체 하나를 `export default`한다.

```js
/// <reference path="./osciloscope-tool.d.ts" />

/** @type {OsciloScopeTool} */
export default {
  meta: {
    id: 'value-range',        // 파일명과 같아야 한다
    name: '값 범위',           // 사이드바 표시명 — 한글 가능
    version: '1.0.0',
    description: '변수마다 최솟값과 최댓값을 보여줍니다.'
  },

  analyze(rawLogs, ctx) { /* 계산 */ return model; },
  render(model, host)   { /* 표현 */ },
  dispose() { /* 정리 (선택) */ }
};
```

`/// <reference>` 한 줄이 타입 정의를 연결한다. 도구를 만들 때 `osciloscope-tool.d.ts`가 같은
폴더에 함께 배치되므로, VS Code에서 **자동완성과 타입 검사가 그대로 동작한다.**

### 파일 위치와 이름

| | 위치 | 비고 |
| --- | --- | --- |
| 내 도구 | `<워크스페이스>/.osciloscope/tools/<id>.tool.js` | 여기에 만들어진다 |
| 기본 도구 | 확장 설치 경로의 `tools/` | 직접 고칠 수 없다 — 복사해서 쓴다 |

- 파일명은 반드시 `<id>.tool.js`이고, `<id>`는 `meta.id`와 같아야 한다.
- 같은 ID의 기본 도구가 있으면 내 도구가 **재정의**한다(사이드바에 `재정의` 배지).
- 같은 폴더의 다른 파일을 `import`해서 쓰는 것은 된다. 목록에 안 뜰 뿐이다.

---

## 두 단계: analyze → render

계산과 표현을 나눈 이유는 검사와 재사용 때문이다. `analyze`는 화면을 모르고, `render`는
로그를 다시 훑지 않는다.

### `analyze(rawLogs, ctx)` — 계산

```js
analyze(rawLogs, ctx) {
  const byVar = {};
  for (const log of rawLogs) {
    const key = ctx.helpers.varKeyOf(log);   // "acc@47"
    (byVar[key] = byVar[key] || []).push(log.data);
  }
  return byVar;   // 형식은 자유
}
```

- **반환값의 형식은 자유다.** 시스템은 들여다보지 않고 `render`에 그대로 넘긴다.
- `rawLogs`의 스키마는 [data-model.md](./data-model.md)를 보라.
- `ctx.helpers.varKeyOf(log)` / `ctx.helpers.groupOf(log)`를 쓰는 것을 권한다.
  변수 정체성 키잉을 직접 구현하면 재귀 호출에서 어긋나기 쉽다.
- `ctx.log(msg)`로 출력 채널에 기록할 수 있다.

### `render(model, host)` — 표현

```js
render(model, host) {
  // 쉬운 길 — 기본 UI 재사용
  const { left, right } = host.widgets.layout(host.mount);
  host.widgets.varList(left, model.groups, {
    onSelect: key => host.widgets.timeline(right, model.index[key])
  });

  // 어려운 길 — 직접 그리기
  // host.mount.appendChild(myChart);
}
```

`host`가 주는 것:

| 필드 | 설명 |
| --- | --- |
| `mount` | 도구 전용 컨테이너. **이 안에만** DOM을 만든다 |
| `filePath` | 분석 중인 로그 파일 경로 (표시용) |
| `theme` | `'light'` \| `'dark'` \| `'high-contrast'` |
| `log(msg)` | 출력 채널 기록 |
| `helpers` | `varKeyOf` / `groupOf` / `escape` |
| `widgets` | 표준 위젯 (아래) |

### `dispose()` — 정리 (선택)

`setInterval`이나 `window.addEventListener`, `ResizeObserver`를 썼다면 여기서 해제한다.
안 썼으면 비워 두면 된다. `mount`를 비우는 것은 시스템이 하므로 신경 쓰지 않아도 된다.

---

## 표준 위젯

기존 UI를 그대로 쓰고 싶을 때를 위한 것이다. 안 써도 된다.

| 위젯 | 시그니처 | 설명 |
| --- | --- | --- |
| `layout(el)` | → `{ left, right }` | 좌측 목록 + 우측 본문 2단 골격 |
| `varList(el, groups, opts)` | → `{ setActive(varKey) }` | 그룹별 변수 목록. `opts.onSelect(varKey)` |
| `timeline(el, entry)` | → `void` | 한 변수의 변경 이력 (증감 태그 포함) |

위젯을 쓰려면 데이터가 아래 모양이어야 한다. **검사기가 강제하지는 않는다** — 위젯을 안 쓰는
도구는 완전히 다른 자료구조를 써도 된다.

```ts
// varList의 groups: { [그룹명]: VarEntry[] }
interface VarEntry {
  varKey  : string;
  varName : string;
  history : Array<{ step: number; value: any; event: string; line?: number | null }>;
  type?   : string;
  scope?  : string;
  callId? : number | null;
  // parentCallId, callDepth, func도 있으면 타임라인 헤더에 배지로 표시된다
}
```

> 위젯 API는 **실험적**이다. 마이너 버전에서 시그니처가 바뀔 수 있다.

---

## 지켜야 할 규약

이걸 어기면 유효성 검사에서 걸린다.

| 규약 | 이유 |
| --- | --- |
| `analyze`·`render`는 **동기 함수** | 비동기 도구는 아직 지원하지 않는다 |
| `rawLogs`를 수정하지 않는다 | 다른 도구 실행과 재실행에 영향을 준다 |
| `analyze`에서 DOM에 접근하지 않는다 | 계산과 표현을 나눈 이유가 사라진다 |
| `analyze`는 결정적이어야 한다 | `Date.now()`·`Math.random()`을 쓰면 걸린다 |
| `host.mount` 밖의 DOM을 건드리지 않는다 | 헤더·다른 패널은 도구의 영역이 아니다 |
| 모듈 최상위에서 부작용을 만들지 않는다 | 목록을 만들 때 한 번 `import`된다 |

할 수 있는 것과 없는 것:

| 가능 | 불가능 |
| --- | --- |
| 그래프·차트·트리 등 임의의 시각화 | `host.mount` 밖의 DOM 조작 |
| 커스텀 인터랙션(클릭·드래그·툴팁) | 확장(Node)에 요청 보내기 |
| 색상·레이아웃 자유 구성 | 파일 읽기·쓰기, 외부 네트워크 |
| 표준 위젯 재사용 또는 완전 무시 | 외부 라이브러리(CDN) 로드 |
| 비순수 계산 | 비동기(`async`) 처리 |

> **CSP가 걸려 있다.** 인라인 스크립트와 외부 요청이 차단된다. 스타일은 `element.style.color = ...`
> 같은 인라인 스타일로 주는 것을 권한다 — `<style>` 태그를 넣으면 다른 도구와 섞인다.

---

## 유효성 검사

도구 행의 **✓** 버튼을 누르면 검사가 돈다. 결과는 행에 아이콘으로 뜨고(✓ 통과 / ! 경고 /
✕ 실패), 상세 리포트는 출력 채널의 `OsciloScope` 채널에 나온다.

검사는 **도구의 소스를 읽지 않는다.** 정해진 입력 5종을 넣고 거동만 본다.

| 픽스처 | 내용 | 노리는 것 |
| --- | --- | --- |
| `normal` | Global/Local 혼재, `init`+`updated` | 기본 동작 |
| `empty` | `[]` | 빈 입력에 예외 없이 빈 화면을 내는가 |
| `deleted` | `deleted` 이벤트 포함 | 값 없음 처리 |
| `recursive` | 같은 이름, 다른 `var_id` | 변수 정체성 키잉 |
| `legacy` | `var_id`/`call_id`가 모두 `null` | 구버전 로그 폴백 |

검사 항목 12가지:

| # | 검사 | 보는 것 |
| --- | --- | --- |
| 1 | 로드 | `import` 성공 + `default export`가 객체 |
| 2 | 형태 | `meta.id`/`name`/`version`, `analyze`·`render`가 함수 |
| 3 | 최상위 부작용 | `import`만으로 DOM 변경·전역 추가가 없음 |
| 4 | analyze 실행 | 픽스처 5종 각각에서 예외 없이 반환 |
| 5 | 동기성 | 반환값이 `Promise`가 아님 |
| 6 | 입력 불변 | `analyze` 전후로 `rawLogs`가 그대로 |
| 7 | analyze 결정성 | 2회 실행 결과가 같음 |
| 8 | render 실행 | 픽스처 5종 각각에서 예외 없이 완료 |
| 9 | 렌더 결정성 | 같은 입력 2회 렌더의 결과가 같음 |
| 10 | 영역 격리 | `mount` 밖 DOM 변경 없음 + 전역 추가 없음 |
| 11 | 정리 | `dispose()` 후 타이머·전역 리스너 잔존 없음 |
| 12 | 실행 시간 | 픽스처당 3초, 전체 15초 이내 |

몇 가지 참고:

- **7번이 `skip`으로 나올 수 있다.** 반환값에 함수나 DOM 노드가 섞여 복제할 수 없을 때다.
  이때는 9번(렌더 결정성)으로 대신 판정한다 — 최종적으로 화면이 같으면 되기 때문이다.
- **11번은 `dispose()`가 없으면 경고**로 끝난다. 타이머를 안 썼다면 문제가 아니다.
- **12번은 실측이다.** 동기 함수는 도중에 끊을 수 없어서, 시간을 재고 초과하면 실패로 남긴다.
  진짜 무한 루프는 검사 패널을 강제로 닫아 회수한다.

---

## 알아 둘 한계

- **검사를 거치지 않고 실행한 도구가 무한 루프에 빠지면 메인 패널이 멈춘다.**
  패널을 닫았다 열면 복구된다. 확장과 편집기는 영향받지 않는다.
- 도구를 여러 번 고쳐 저장하면 옛 모듈이 메모리에 쌓인다. 오래 편집했다면 패널을 한 번
  닫았다 여는 것이 좋다.
- 지금은 도구를 하나만 고를 수 있다. 다중 선택, 도구별 설정값, 비동기 도구는 후속 과제다.

---

## 기본 도구 읽어 보기

`tools/`의 두 도구가 참고 구현을 겸한다. 각각 다른 길을 보여준다.

| 도구 | 보여 주는 것 |
| --- | --- |
| `change-detector` | 표준 위젯을 그대로 쓰는 쪽. 도구를 안 골랐을 때의 기본값이기도 하다 |
| `monotonic` | 위젯을 쓰지 않고 직접 그리는 쪽. 조건 필터링 + 그룹 재구성 + 인라인 SVG 스파크라인 |

사이드바에서 기본 도구 행의 **⧉**(복사)를 누르면 워크스페이스로 복사되어 마음껏 고칠 수 있다.
