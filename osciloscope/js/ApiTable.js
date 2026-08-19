'use strict';

/**
 * ApiTable (FE) — 프론트의 단일 통신 창구 (그림의 "FE-API Table")
 *
 * SideBar와 메인 패널은 확장과 raw 메시지({ command, payload })를 직접 주고받지 않고,
 * 이 테이블의 이름 붙은 엔드포인트만 호출한다. 확장과의 통신선이 이 파일 하나로 모인다.
 *
 * Tool(플러그인)은 이 테이블을 쓰지 않는다 — 도구는 host 계약(analyze/render/host)으로만
 * 동작하며, acquireVsCodeApi는 웹뷰 진입점이 이미 회수했다 (설계문서 §3.3). 그림의
 * Tool ↔ FE-API Table 화살표는 "도구가 FE가 준 API(host)를 쓴다"는 뜻이지 메시지 통신이 아니다.
 *
 * 커맨드 문자열 정본은 src/OsciloScopeMessage.ts이고 constants.js가 그걸 미러한다.
 * 이 테이블은 그 위에 엔드포인트를 얹기만 한다.
 */

import { CommandTypes, ToolErrorPhase } from './constants.js';

export { CommandTypes, ToolErrorPhase };

/**
 * 웹뷰 하나의 API 테이블을 만든다.
 * @param {{ postMessage(message: any): void } | null} vscode acquireVsCodeApi() 결과
 */
export function createApiTable(vscode) {
  const send = (command, payload = {}) => {
    if (vscode) {
      vscode.postMessage({ command, payload });
    } else {
      // 브라우저에서 직접 열어 본 경우 등 확장이 없을 때
      console.log('[OsciloScope → ext]', command, payload);
    }
  };

  return {
    // ── 발신: webview → ext ───────────────────────────────
    uiReady          : ()        => send(CommandTypes.UI_READY),
    toolError        : (payload) => send(CommandTypes.TOOL_ERROR, payload),        // { toolId, message, phase }
    selectLogFile    : ()        => send(CommandTypes.SELECT_LOG_FILE),
    startRender      : (toolId)  => send(CommandTypes.START_RENDER, { toolId }),
    getToolsList     : ()        => send(CommandTypes.GET_TOOLS_LIST),
    selectTool       : (toolId)  => send(CommandTypes.SELECT_TOOL, { toolId }),
    createTool       : ()        => send(CommandTypes.CREATE_TOOL),
    copyTool         : (toolId)  => send(CommandTypes.COPY_TOOL, { toolId }),
    openTool         : (toolId)  => send(CommandTypes.OPEN_TOOL, { toolId }),
    validateTool     : (toolId)  => send(CommandTypes.VALIDATE_TOOL, { toolId }),
    validationResult : (report)  => send(CommandTypes.VALIDATION_RESULT, report),

    /**
     * ── 수신 라우팅: ext → webview ───────────────────────
     * command → handler 테이블을 걸면 하나의 리스너가 알아서 라우팅한다.
     * @param {Record<string, (payload: any) => void>} handlers CommandTypes 값을 키로
     */
    route(handlers) {
      window.addEventListener('message', event => {
        const { command, payload } = event.data || {};
        const handler = handlers[command];
        if (handler) {
          handler(payload || {});
        }
      });
    }
  };
}
