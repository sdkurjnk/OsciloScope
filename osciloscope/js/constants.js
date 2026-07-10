'use strict';

const CommandTypes = Object.freeze({
  UPDATE_ALL_DATA:  'UPDATE_ALL_DATA',  // 백엔드 → 프론트
  UI_READY:         'UI_READY',         // 프론트 → 백엔드
  VARIABLE_CHANGED: 'VARIABLE_CHANGED', // 프론트 → 백엔드
});
