'use strict';

const CommandTypes = Object.freeze({
  UPDATE_ALL_DATA:  'UPDATE_ALL_DATA',  // 백엔드 → 프론트
  UI_READY:         'UI_READY',         // 프론트 → 백엔드
  VARIABLE_CHANGED: 'VARIABLE_CHANGED', // 프론트 → 백엔드
  SELECT_LOG_FILE:  'SELECT_LOG_FILE',  // 프론트 → 백엔드: 로그 파일 선택 다이얼로그 요청
  LOG_FILE_LOADED:  'LOG_FILE_LOADED',  // 백엔드 → 프론트: 선택된 로그 파일 { fileName, filePath }
  GET_TOOLS_LIST:   'GET_TOOLS_LIST',   // 프론트 → 백엔드: tools/ 목록 요청
  TOOLS_LIST:       'TOOLS_LIST',       // 백엔드 → 프론트: { tools: string[] }
});
