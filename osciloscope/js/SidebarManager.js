'use strict';

/**
 * SidebarManager
 * - 스코프 단위 그룹 (Global / Local) 렌더링
 * - 같은 이름 변수가 여러 호출 인스턴스로 존재할 수 있으므로
 *   변수 행에 #call_id 칩을 붙여 구분 (재귀 대응)
 * - func/call 정보는 varData 에 그대로 있으므로 추후 함수별 그룹핑 확장 가능
 */
class SidebarManager {
  constructor(onSelectVar) {
    this._listEl = document.getElementById('sbList');
    this._onSelectVar = onSelectVar;   // (varKey) => void
    this._activeEl = null;
  }

  renderSidebar(groupedData) {
    this._listEl.innerHTML = '';
    if (!groupedData || Object.keys(groupedData).length === 0) {
      this._listEl.innerHTML = '<div style="padding:12px;color:#555;font-size:12px;">데이터 없음</div>';
      return;
    }

    for (const [scope, vars] of Object.entries(groupedData)) {
      this._listEl.appendChild(this._createScopeGroup(scope, vars));
    }
  }

  _createScopeGroup(scope, vars) {
    const g = document.createElement('div');
    g.className = 'sg';

    const lbl = document.createElement('div');
    lbl.className = 'sg-lbl';
    lbl.innerHTML = `<span class="chev">▶</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${scope}</span><span class="sg-cnt">${vars.length}</span>`;
    lbl.addEventListener('click', () => g.classList.toggle('collapsed'));

    const vl = document.createElement('div');
    vl.className = 'vl';
    for (const varData of vars) {
      vl.appendChild(this._createVarItem(varData));
    }

    g.appendChild(lbl);
    g.appendChild(vl);
    return g;
  }

  _createVarItem(varData) {
    const vi = document.createElement('div');
    vi.className = 'vi';
    // Local 변수는 호출 인스턴스별로 분리되므로 #call_id 칩으로 구분
    const idChip = (varData.scope !== 'Global' && varData.callId !== null && varData.callId !== undefined)
      ? `<span class="vc">#${varData.callId}</span>` : '';
    vi.innerHTML = `<span class="vt">${varData.type || '?'}</span><span class="vn">${varData.varName}</span>${idChip}`;
    vi.addEventListener('click', () => {
      this.setActiveVariable(vi);
      this._onSelectVar(varData.varKey);
    });
    return vi;
  }

  setActiveVariable(el) {
    if (this._activeEl) this._activeEl.classList.remove('active');
    this._activeEl = el;
    el.classList.add('active');
  }
}
