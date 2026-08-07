# 업스트림 계약: oscilo

> 로그 생성자: **oscilo** — <https://github.com/sdkurjnk/oscilo>

OsciloScope는 독립 실행되지 않는다. **oscilo**가 만든 `.jsonl` 로그를 소비하는 뷰어다.
따라서 이 문서는 두 저장소 사이의 **데이터 계약**을 정리한다. 계약이 깨지면(필드 추가/의미 변경)
OsciloScope의 파싱·시각화가 조용히 어긋날 수 있으므로, oscilo 스키마 변경 시 이 문서와
[data-model.md](./data-model.md)를 함께 갱신한다.

## oscilo가 하는 일

- **코드 무침습** 파이썬 변수 변화 추적기. 소스를 수정하지 않는다.
- 흐름: `oscilo.register("변수명")`이 `sys.settrace` 훅 설치 → 실행 중 라인마다
  C 확장이 값 비교(identity/size/equality) → `atexit`에서 버퍼를 한 번에 파일로 flush.
- 재대입·변형(mutation)·삭제를 포착해 이력을 JSON Lines로 남긴다.

## 로그 스키마 (계약)

oscilo가 출력하는 한 줄 = 하나의 변수 이벤트. 필드는 OsciloScope의 `RawLog`와 1:1 대응한다.

| 필드 | 의미 | OsciloScope에서의 사용 |
| --- | --- | --- |
| `name` | 추적 변수 이름 | `varName`, `varKey`의 일부 |
| `var_id` | 바인딩 고유 ID (전역/클로저는 프레임 간 안정) | **정체성 키** `name@var_id` |
| `data` | 현재 값 (삭제 시 `null`) | `history[].value`, 첫 값의 `typeof`→`type` |
| `event` | `init` \| `updated` \| `deleted` | 값 변화 태그·`deleted` 처리 |
| `domain` | `LOCAL` \| `GLOBAL` (소유 프레임 기준) | 그룹핑(Global/Local), `scope` 라벨 |
| `line` | 변화 감지 소스 라인 | 타임라인 행 `L{line}` |
| `func` | 변화가 발생한 함수명 | 헤더 뱃지 |
| `call_id` | 프레임/호출 고유 ID | 사이드바 `#call_id` 칩, 헤더 뱃지 |
| `parent_call_id` | 호출 프레임의 `call_id` (루트는 null) | 헤더 `← #parent` 뱃지 |
| `call_depth` | 등록 프레임 기준 상대 깊이 | 헤더 `depth` 뱃지 |

### 정체성 추적의 핵심

- **`var_id`가 변수 정체성의 열쇠.** 값을 수정한 프레임(`call_id`)이 달라도 변수가 정의된
  소유 프레임이 같으면 같은 변수다. OsciloScope는 이 규약에 맞춰 `name@var_id`로 키잉한다.
- **`call_id` 계층**(`call_id`/`parent_call_id`/`call_depth`)으로 호출 트리를 재구성할 수 있다.
  현재 OsciloScope는 이를 사이드바 칩·헤더 뱃지로만 노출하지만, 향후 함수/호출별 그룹핑의 근거다.

## 파일 선택

- oscilo 문서는 산출물을 `oscilo.jsonl`로 소개하지만, OsciloScope는 파일명·위치를 가리지 않는다.
  사이드바 SOURCE에서 `.jsonl`을 직접 고르고(→ `showOpenDialog`) START로 렌더한다. 선택 경로는
  `SidebarProvider`가 들고 있다가 렌더 시 백엔드로 넘긴다(`src/extension.ts`의 `loadLogFile`).

## 하위 호환 규약

- oscilo 구버전 로그는 `var_id` 등 일부 필드가 없을 수 있다. OsciloScope는 `parseLogFile`에서
  누락 필드를 `null`로 정규화하고, `var_id`가 없으면 `name`만으로 키잉하는 폴백을 둔다
  ([data-model.md](./data-model.md) 참고). 즉 **필드 추가는 안전, 의미 변경은 위험**하다.
