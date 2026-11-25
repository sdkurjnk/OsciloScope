'use strict';

/**
 * ⚠ AUTO-GENERATED — 편집하지 마세요.
 * 정본: src/ApiTable.ts (프로토콜) · src/tool/plugin.ts (Host API 버전).
 * 재생성: npm run gen:constants (npm run compile에 포함).
 *
 * 웹뷰는 raw ESM이라 TypeScript를 import할 수 없어, 정본의 문자열 값만 여기로 미러한다.
 * 프로토콜 상수는 ApiTable.js가 import한다. HOST_API_VERSION은 ToolHostApi.apiVersion 값으로
 * 웹뷰 ToolHost가 쓰기 위한 것이다 (BE는 같은 정본으로 plugin.json의 hostApi를 판정한다).
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
  OPEN_TOOL         : 'OPEN_TOOL',
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

export const HOST_API_VERSION = '1.0.0';
