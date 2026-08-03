# 메시지 프로토콜 (Extension Host ↔ Webview)

Extension Host와 Webview는 `postMessage`로만 통신한다.
모든 메시지는 `{ command, payload }` 형태이며, `command`는 `CommandTypes` 열거값이다.

> **타입 정의가 두 곳에 존재한다.**
> - 백엔드: `src/OsciloScopeMessage.ts` (`enum CommandTypes`, `interface OsciloScopeMessage`)
> - 프론트: `osciloscope/js/constants.js` (`Object.freeze` 상수)
>
> 두 파일의 **문자열 값이 일치**해야 통신이 성립한다. 커맨드를 추가/변경하면 양쪽을 함께 고쳐야 한다.

## 메시지 봉투

```ts
interface OsciloScopeMessage {
  command: CommandTypes;
  payload: Object;
}
```

## 커맨드 목록

| command | 방향 | payload | 처리 |
| --- | --- | --- | --- |
| `UI_READY` | 프론트 → 백엔드 | `{}` | 백엔드: 로딩 완료 로그만 (`receiveDataFromWebview`) |
| `UPDATE_ALL_DATA` | 백엔드 → 프론트 | `transformData` 결과(그룹 구조) | 프론트: 데이터 저장 + 사이드바 렌더 |
| `VARIABLE_CHANGED` | 프론트 → 백엔드 | `{ varKey, varName }` | 백엔드: 선택 변경 로그만 |

## 시퀀스

```
[Webview]                                   [Extension Host]
   │                                              │
   │  init() 시 ── UI_READY ─────────────────────▶│  (로깅)
   │                                              │
   │                                              │  커맨드 실행 →
   │◀──────────── UPDATE_ALL_DATA (그룹 데이터) ──│  sendDataToWebview
   │  renderSidebar()                             │
   │                                              │
   │  사용자 변수 클릭                             │
   │  ── VARIABLE_CHANGED {varKey,varName} ──────▶│  (로깅)
   │                                              │
```

## 브릿지 구현 위치

- **백엔드 송신**: `OsciloScopeWebviewPanel.sendDataToWebview` — 패널이 없으면 에러 로그 후 무시.
- **백엔드 수신**: `OsciloScopeWebviewPanel.receiveDataFromWebview` — `createOrShow` 시 1회 등록.
  현재 `UI_READY`/`VARIABLE_CHANGED`를 `console.log`로만 처리한다.
- **프론트 송수신**: `VisualizerApp`
  - `sendMessageToBackend` — VS Code 환경이면 `acquireVsCodeApi().postMessage`,
    아니면(브라우저 단독) 콘솔 출력.
  - `handleMessageFromBackend` — `window`의 `message` 이벤트를 받아 `UPDATE_ALL_DATA` 처리.

## 확장 시 유의점

- **양방향 값 일치**: 새 커맨드는 `OsciloScopeMessage.ts`와 `constants.js`에 동일 문자열로 추가.
- **`VARIABLE_CHANGED`는 현재 미소비**: 백엔드가 로깅만 하므로, 선택 기반 후속 동작
  (예: 소스 라인으로 점프)은 여기에 로직을 붙이는 지점이다.
- **`UI_READY` 핸드셰이크 미완**: 지연/재전송을 지원하려면 백엔드가 `UI_READY` 수신 후
  마지막 데이터를 다시 보내도록 확장할 수 있다.
