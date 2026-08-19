'use strict';

/**
 * ⚠ AUTO-GENERATED — 편집하지 마세요.
 * 정본: src/ApiTable.ts. 재생성: npm run gen:constants (npm run compile에 포함).
 *
 * 웹뷰는 raw ESM이라 TypeScript를 import할 수 없어, 정본 enum의 문자열 값만 여기로 미러한다.
 * ApiTable.js가 이 파일을 유일하게 import한다.
 */

export const CommandTypes = Object.freeze({
  UPDATE_ALL_DATA   : 'UPDATE_ALL_DATA',
  UI_READY          : 'UI_READY',
  SELECT_LOG_FILE   : 'SELECT_LOG_FILE',
  LOG_FILE_LOADED   : 'LOG_FILE_LOADED',
  START_RENDER      : 'START_RENDER',
  GET_TOOLS_LIST    : 'GET_TOOLS_LIST',
  TOOLS_LIST        : 'TOOLS_LIST',
  SELECT_TOOL       : 'SELECT_TOOL',
  CREATE_TOOL       : 'CREATE_TOOL',
  COPY_TOOL         : 'COPY_TOOL',
  OPEN_TOOL         : 'OPEN_TOOL',
  TOOL_CREATED      : 'TOOL_CREATED',
  TOOLS_CHANGED     : 'TOOLS_CHANGED',
  VALIDATE_TOOL     : 'VALIDATE_TOOL',
  RUN_VALIDATION    : 'RUN_VALIDATION',
  VALIDATION_RESULT : 'VALIDATION_RESULT',
  TOOL_ERROR        : 'TOOL_ERROR'
});

export const ToolErrorPhase = Object.freeze({
  LOAD    : 'load',
  ANALYZE : 'analyze',
  RENDER  : 'render'
});
