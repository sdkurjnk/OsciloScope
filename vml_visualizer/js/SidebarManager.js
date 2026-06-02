'use strict';

/**
 * SidebarManager
 * - 변수 목록 렌더링
 * - scope 접기 / 펼치기
 * - 활성 변수 하이라이트
 */
class SidebarManager {
  constructor(onSelectVar) {
    this._listEl = document.getElementById('sbList');
    this._onSelectVar = onSelectVar;
    this._activeEl = null;
  }

  renderSidebar(groupedData) {
    this._listEl.innerHTML = '';
    if (!groupedData || Object.keys(groupedData).length === 0) {
      this._listEl.innerHTML = '<div style="padding:12px;color:#555;font-size:12px;">데이터 없음</div>';
      return;
    }

    for (const [scopeId, vars] of Object.entries(groupedData)) {
      const group = this._createScopeGroup(scopeId, vars);
      this._listEl.appendChild(group);
    }
  }

  _createScopeGroup(scopeId, vars) {
    const g = document.createElement('div');
    g.className = 'sg';

    const lbl = document.createElement('div');
    lbl.className = 'sg-lbl';
    lbl.innerHTML = `<span class="chev">▶</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${scopeId}</span>`;
    lbl.addEventListener('click', () => g.classList.toggle('collapsed'));

    const vl = document.createElement('div');
    vl.className = 'vl';

    for (const { varName, type } of vars) {
      vl.appendChild(this._createVarItem(varName, type));
    }

    g.appendChild(lbl);
    g.appendChild(vl);
    return g;
  }

  _createVarItem(varName, type) {
    const vi = document.createElement('div');
    vi.className = 'vi';
    vi.innerHTML = `<span class="vt">${type || '?'}</span><span class="vn">${varName}</span>`;
    vi.addEventListener('click', () => {
      this.setActiveVariable(vi);
      this._onSelectVar(varName);
    });
    return vi;
  }

  setActiveVariable(el) {
    if (this._activeEl) this._activeEl.classList.remove('active');
    this._activeEl = el;
    el.classList.add('active');
  }
}
