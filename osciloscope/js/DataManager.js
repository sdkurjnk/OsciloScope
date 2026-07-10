'use strict';

/**
 * DataManager
 * - 백엔드에서 받은 raw payload 보관
 * - Global / Local 두 버킷으로 그룹화
 * - 변수명으로 히스토리/스코프 조회
 */
class DataManager {
  constructor() {
    this._data = {};
    this._currentVarName = null;
  }

  updateData(payload) {
    this._data = payload || {};
  }

  /** 원본 스코프 키를 Global / Local 두 버킷으로 묶어 반환 */
  getGroupedData() {
    const result = {};
    for (const [scope, vars] of Object.entries(this._data)) {
      const bucket = (scope === 'Global') ? 'Global' : 'Local';
      if (!result[bucket]) result[bucket] = [];
      result[bucket].push(...vars);
    }
    return result;
  }

  getTimelineByVar(varName) {
    for (const vars of Object.values(this._data)) {
      const found = vars.find(v => v.varName === varName);
      if (found) return found;
    }
    return null;
  }

  getScopeByVar(varName) {
    for (const [scope, vars] of Object.entries(this._data)) {
      if (vars.find(v => v.varName === varName))
        return scope === 'Global' ? 'Global' : 'Local';
    }
    return null;
  }

  get currentVarName() { return this._currentVarName; }
  set currentVarName(v) { this._currentVarName = v; }
}
