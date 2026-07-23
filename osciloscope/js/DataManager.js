'use strict';

/**
 * DataManager
 * - 백엔드에서 받은 raw payload 보관 (그룹핑은 백엔드 transformData에서 완료)
 * - varKey(고유 키)로 변수 조회 — 재귀/중복 호출로 같은 이름 변수가
 *   여러 개 있어도 정확한 인스턴스를 찾는다
 */
class DataManager {
  constructor() {
    this._data = {};
    this._currentVarKey = null;
  }

  updateData(payload) {
    this._data = payload || {};
  }

  /** 백엔드가 만든 그룹 구조(Global / func #call_id)를 그대로 반환 */
  getGroupedData() {
    return this._data;
  }

  /** varKey로 변수 데이터 조회 (varName 아님 — 이름은 중복될 수 있음) */
  getVarByKey(varKey) {
    for (const vars of Object.values(this._data)) {
      const found = vars.find(v => v.varKey === varKey);
      if (found) return found;
    }
    return null;
  }

  get currentVarKey() { return this._currentVarKey; }
  set currentVarKey(v) { this._currentVarKey = v; }
}
