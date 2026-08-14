# 데이터 모델

## 입력: `log.jsonl` (RawLog)

[oscilo](https://github.com/sdkurjnk/oscilo)가 남긴 JSON Lines 파일. **한 줄 = 하나의 변수 이벤트**.
스키마는 `src/LogParser.ts`의 `RawLog` 인터페이스가 기준이며, 생성자 쪽 계약은
[upstream-oscilo.md](./upstream-oscilo.md)에 정리되어 있다.

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `name` | string | 변수 이름 |
| `data` | any | 이벤트 시점의 값 (`deleted`면 값 없음으로 취급) |
| `event` | string | `init` \| `updated` \| `deleted` |
| `domain` | string | `GLOBAL` \| `LOCAL` — **소유 프레임 기준** 스코프 |
| `line` | number \| null | 이벤트가 발생한 소스 라인 |
| `func` | string \| null | 이벤트가 발생한 함수. 모듈 최상위는 `<module>` |
| `call_id` | number \| null | 이벤트가 발생한 **프레임**의 고유 ID (불투명 ID) |
| `parent_call_id` | number \| null | 부모 프레임의 `call_id`, 최상위면 null |
| `call_depth` | number \| null | 호출 스택 깊이 (1부터) |
| `var_id` | number \| null | 변수가 **정의된 소유 프레임**의 call_id → 정체성 키 |

예시 (`log.jsonl`):

```json
{"name":"acc","var_id":47,"data":0,"event":"init","domain":"LOCAL","line":12,"func":"process","call_id":47,"parent_call_id":1,"call_depth":2}
{"name":"acc","var_id":47,"data":1,"event":"updated","domain":"LOCAL","line":14,"func":"process","call_id":47,"parent_call_id":1,"call_depth":2}
```

### 파싱과 하위 호환 (`parseLogFile`)

- 파일을 통째로 읽어 `\n`으로 분리하고 각 줄을 `JSON.parse`한다.
- 구버전 로그 호환: `line`/`func`/`call_id`/`parent_call_id`/`call_depth`/`var_id`가
  `undefined`면 `?? null`로 정규화한다. 이후 로직은 "없으면 null" 규약에 의존한다.

## 핵심 개념: 변수 정체성 키 (`varKey`)

같은 이름의 변수라도 **재귀나 반복 호출**로 여러 인스턴스가 존재할 수 있다.
이를 구분하기 위해 `var_id`(소유 프레임의 call_id)로 키를 만든다.

```
varKey = var_id 있으면  →  `${name}@${var_id}`
         var_id 없으면  →  name           (구버전 폴백)
```

- **소유 프레임 기준**이 중요하다. 값을 *수정*한 프레임(`call_id`)이 달라도,
  변수가 *정의된* 프레임(`var_id`)이 같으면 같은 변수로 묶인다.
- 그래서 변수는 `varName`이 아니라 반드시 `varKey`로 조회한다.
  키잉은 `ctx.helpers.varKeyOf(log)`가 해 준다.

## 그룹핑

`groupOf(log)` 헬퍼가 `domain`을 그룹명으로 매핑한다.

```
GLOBAL → 'Global'
그 외   → 'Local'
```

도구가 이 헬퍼를 쓰지 않고 자기 축으로 그룹을 만들어도 된다 — 예를 들어 기본 도구
`monotonic`은 `단조 증가` / `그 외`로 나눈다.

## 출력: 도구가 만드는 model

**가공은 더 이상 확장이 하지 않는다.** `LogParser`는 `RawLog[]`를 읽기만 하고, 변수별 묶기·
그룹핑·이력 구성은 웹뷰에서 도구의 `analyze()`가 맡는다(플러그인 구조 이후).

`analyze()`가 반환하는 model의 **형식에는 규격이 없다.** 시스템은 들여다보지 않고 `render()`에
그대로 넘긴다. 도구가 히트맵을 그리든 요약 표를 내든 자기 자료구조를 쓰면 된다.

> 예전 `transformData`가 하던 일은 기본 도구 `change-detector`로 옮겨졌다.
> 동작이 같으므로 결과 화면도 이전과 같다.

## 위젯 권장 규격 (`VarEntry`)

규격이 없다는 것과 별개로, **표준 위젯(`varList`/`timeline`)을 쓰려면** 데이터가 아래 모양이어야
한다. 위젯을 쓰지 않는 도구는 지키지 않아도 되고, **검사기도 이 모양을 강제하지 않는다.**

```ts
// varList의 groups: { [그룹명]: VarEntry[] }
interface VarEntry {
  varKey        : string;   // 정체성 키
  varName       : string;
  history       : HistoryRow[];
  type?         : string;   // 보통 첫 등장 값의 typeof
  scope?        : string;   // 'Global' | 'Local'
  func?         : string | null;
  callId?       : number | null;
  parentCallId? : number | null;
  callDepth?    : number | null;
}

interface HistoryRow {
  step  : number;          // 변수별 이벤트 순번 (전역 타임라인 순번이 아님)
  value : any;             // deleted는 보통 null
  event : string;          // 'init' | 'updated' | 'deleted'
  line? : number | null;
}
```

`varList`는 `scope !== 'Global'`이고 `callId`가 있을 때 `#call_id` 칩을 붙여 재귀/중복 호출
인스턴스를 구분한다. `timeline`은 `func`/`callId`/`parentCallId`/`callDepth`를 헤더 배지로
**한 번만** 표시한다 — 행마다 반복하지 않는 것이 핵심이다.

`change-detector`가 만드는 model이 이 규격의 참고 구현이다.

```jsonc
{
  "groups": {                       // Global을 항상 먼저 둔다 (렌더 결정성)
    "Global": [ { "varKey": "total@1", "varName": "total", /* ... */ "history": [ /* ... */ ] } ],
    "Local":  [ /* ... */ ]
  },
  "index": { "total@1": { /* 위와 같은 객체 참조 */ } }   // render에서 빠르게 찾기 위해
}
```

> **`type`은 첫 이벤트 값 기준**이고 이후 값 타입이 바뀌어도 갱신하지 않는다.
> `deleted` 이벤트의 `value`는 `null`로 둔다.

## 검사용 표준 픽스처

`osciloscope/tool-host/fixtures/`에 5종이 JS 모듈(배열을 `export default`)로 있다.
유효성 검사가 이 순서로 주입한다.

| 픽스처 | 내용 |
| --- | --- |
| `normal` | Global/Local 혼재, `init`+`updated` |
| `empty` | `[]` |
| `deleted` | `deleted` 이벤트 포함 |
| `recursive` | 같은 `name`, 다른 `var_id` |
| `legacy` | `var_id`/`call_id`가 모두 `null` |

`legacy`가 있는 이유는 `parseLogFile()`이 이미 구버전 호환 정규화(`?? null`)를 하고 있어
도구도 `null`을 만날 수 있기 때문이다. `varKeyOf()`를 쓰면 자동으로 처리되지만, 키잉을 직접
구현한 도구는 여기서 깨진다.
