# 프론트엔드 (Webview)

Webview UI는 번들러 없는 **순수 JS/HTML/CSS**다. `index.html`이 스크립트를 순서대로
로드하고 전역 클래스로 노출하며, `main.js`가 앱을 부팅한다.

## 스크립트 로드 순서 (중요)

`index.html` 하단에서 아래 순서로 로드된다. 모듈 시스템이 없으므로 **정의 순서가 곧 의존성**이다.

```
constants.js        →  CommandTypes 전역 상수
DataManager.js      →  class DataManager
SidebarManager.js   →  class SidebarManager
TimelineViewer.js   →  class TimelineViewer
VisualizerApp.js    →  class VisualizerApp (위 3개 클래스에 의존)
mockData.js         →  브라우저 단독 실행 시 목업 주입
main.js             →  new VisualizerApp().init()
```

## 컴포넌트

### VisualizerApp — 조율자 + 브릿지
- 세 매니저(`DataManager`/`SidebarManager`/`TimelineViewer`)를 소유한다.
- `acquireVsCodeApi()` 존재 여부로 VS Code / 브라우저 환경을 판별한다.
- `init()`: `message` 리스너 등록 → 상태 뱃지 "로드 중" → `UI_READY` 송신.
- `handleMessageFromBackend()`: `UPDATE_ALL_DATA` 수신 시 데이터 갱신 + 사이드바 재렌더 +
  이미 선택된 변수가 있으면 타임라인도 재렌더.
- `_onVarSelected(varKey)`: 선택 변수 저장 → 타임라인 렌더 → `VARIABLE_CHANGED` 송신.

### DataManager — 데이터 보관/조회
- 백엔드가 이미 그룹핑한 payload를 **그대로 보관**한다(프론트는 재가공하지 않음).
- `getVarByKey(varKey)`: 모든 그룹을 순회하며 `varKey`로 변수를 찾는다.
  이름이 아닌 키로 찾는 이유는 [data-model.md](./data-model.md)의 정체성 키 참고.
- `currentVarKey` getter/setter로 현재 선택 상태를 유지한다.

### SidebarManager — 스코프 그룹 렌더
- `renderSidebar(groupedData)`: 그룹(Global/Local)마다 접이식 섹션 생성.
  데이터가 비면 "데이터 없음" 표시.
- `_createVarItem`: 변수 행에 타입 칩·이름 표시. **Local이고 `callId`가 있으면 `#call_id` 칩**을
  붙여 재귀/중복 호출 인스턴스를 구분한다(Global은 칩 없음).
- 클릭 시 활성 표시를 옮기고 생성자에서 받은 `onSelectVar(varKey)` 콜백 호출.

### TimelineViewer — 값 변화 히스토리 렌더
- `renderHeader(varData)`: **변수 단위 메타를 헤더에 1회** 표시 — `func`/`call #id`/
  `← #parentId`/`depth`를 뱃지로. (행마다 반복하지 않는 것이 핵심.)
- `renderTimeline(rows)`: `history` 각 행을 스텝 단위로 렌더, 총 변경 횟수 표시.
- `_calcChange(prev, curr, idx, event)`: 값 변화 태그 계산
  - `deleted` → `deleted`
  - `idx===0` 또는 `event==='init'` → `init`
  - 숫자 변환 가능 → 증감 delta(`+n`/`-n`/`±0`)
  - 그 외 → 문자열 비교로 `—`(유지) / `changed`
- `_formatValue`: null/undefined는 `—`, 60자 초과 문자열은 말줄임.
- `clearTimeline`: 선택 없음 상태의 빈 화면으로 초기화.

## 개발 편의: mockData

- `mockData.js`는 `acquireVsCodeApi`가 없으면(=브라우저) 지연 후
  `UPDATE_ALL_DATA` `MessageEvent`를 직접 디스패치해 실제 백엔드 없이 UI를 확인하게 해준다.
- VS Code 환경에서는 즉시 `return`으로 스킵되므로 프로덕션에 영향 없다.
- payload 형식은 백엔드 `transformData` 출력과 동일 스키마를 따라야 한다
  (재귀로 같은 이름 변수가 `call_id`별로 분리되는 케이스 포함).

## DOM 앵커 (`index.html`)

| id | 용도 |
| --- | --- |
| `badge` | 연결 상태 뱃지 (대기 중 / 로드 중 / 연결됨) |
| `sbList` | 사이드바 변수 목록 컨테이너 |
| `tlHdr` · `tlName` · `tlScope` · `tlBadges` · `tlCnt` | 타임라인 헤더/메타/카운트 |
| `tlBody` | 타임라인 본문(스텝 행 또는 빈 상태) |
