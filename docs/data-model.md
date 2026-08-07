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
- 그래서 프론트는 `varName`이 아니라 반드시 `varKey`로 변수를 조회한다
  (`DataManager.getVarByKey`).

## 그룹핑

`getGroupKey`는 `domain`을 사이드바 그룹으로 매핑한다.

```
GLOBAL → 'Global'
그 외   → 'Local'
```

표시용 라벨은 `DOMAIN_LABELS`(`LOCAL→Local`, `GLOBAL→Global`)로 별도 매핑한다.

## 출력: `transformData`의 결과 구조

`transformData(rawLogs)`는 이벤트의 평면 배열을 **그룹 → 변수 → 히스토리** 3계층으로 접는다.
핵심은 **변수 단위 메타는 첫 등장 시 한 번만, 스텝 단위 속성은 이벤트마다** 기록하는 분리다.

```jsonc
{
  "Global": [
    {
      "varKey": "total@1",       // 정체성 키
      "varName": "total",
      "type": "number",          // 첫 등장 값의 typeof
      "scope": "Global",         // DOMAIN_LABELS 매핑
      "func": "<module>",
      "callId": 1,
      "parentCallId": null,
      "callDepth": 1,
      "group": "Global",
      "history": [               // 스텝 단위 (이벤트마다 1행)
        { "step": 1, "line": 1,  "value": 0, "event": "init" },
        { "step": 2, "line": 30, "value": 6, "event": "updated" }
      ]
    }
  ],
  "Local": [ /* ... */ ]
}
```

변환 규칙 요약:

1. 각 로그의 `varKey`를 계산한다.
2. 처음 보는 키면 변수 메타(위 필드들)를 `varMap`에 1회 생성하고 `stepCounter=0`.
3. 매 이벤트마다 `stepCounter++` 후 `history`에 스텝 행을 push.
   `event === 'deleted'`면 `value`는 `null`로 저장한다.
4. 마지막에 `varMap`의 변수들을 `group`별로 배열에 담아 반환한다.

> **`type`은 첫 이벤트 값 기준.** 이후 값 타입이 바뀌어도 갱신하지 않는다.
> **`step`은 변수별 이벤트 순번**이지 전역 타임라인 순번이 아니다.
