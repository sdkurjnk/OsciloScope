'use strict';

/**
 * CommandTypes
 * - src/OsciloScopeMessage.ts가 정본이다. 값이 어긋나면 메시지가 조용히 유실되므로
 *   커맨드를 추가·변경할 때 양쪽을 함께 고쳐야 한다 (설계문서 9장).
 */
export const CommandTypes = Object.freeze({
  // 로그 · 렌더링
  UPDATE_ALL_DATA   : 'UPDATE_ALL_DATA',    // ext → 메인: { filePath, rawLogs, tool: { id, uri } }
  UI_READY          : 'UI_READY',           // 웹뷰 → ext
  SELECT_LOG_FILE   : 'SELECT_LOG_FILE',    // 사이드바 → ext
  LOG_FILE_LOADED   : 'LOG_FILE_LOADED',    // ext → 웹뷰: { fileName, filePath }
  START_RENDER      : 'START_RENDER',       // 사이드바 → ext: { toolId }

  // 도구 목록 · 관리
  GET_TOOLS_LIST    : 'GET_TOOLS_LIST',     // 사이드바 → ext
  TOOLS_LIST        : 'TOOLS_LIST',         // ext → 사이드바: { tools, trusted, workspaceReady }
  SELECT_TOOL       : 'SELECT_TOOL',        // 사이드바 → ext: { toolId }
  CREATE_TOOL       : 'CREATE_TOOL',        // 사이드바 → ext
  COPY_TOOL         : 'COPY_TOOL',          // 사이드바 → ext: { toolId }
  OPEN_TOOL         : 'OPEN_TOOL',          // 사이드바 → ext: { toolId }
  TOOL_CREATED      : 'TOOL_CREATED',       // ext → 사이드바: { toolId, filePath }
  TOOLS_CHANGED     : 'TOOLS_CHANGED',      // ext → 사이드바: 목록 재요청 유도

  // 유효성 검사
  VALIDATE_TOOL     : 'VALIDATE_TOOL',      // 사이드바 → ext: { toolId }
  RUN_VALIDATION    : 'RUN_VALIDATION',     // ext → 검사 패널: { toolId, toolUri }
  VALIDATION_RESULT : 'VALIDATION_RESULT',  // 검사 패널 → ext → 사이드바: ValidationReport

  // 오류
  TOOL_ERROR        : 'TOOL_ERROR'          // ext ↔ 웹뷰: { toolId, message, phase }
});

/** TOOL_ERROR의 phase 값 (src/tool/types.ts의 ToolErrorPhase) */
export const ToolErrorPhase = Object.freeze({
  LOAD    : 'load',
  ANALYZE : 'analyze',
  RENDER  : 'render'
});
