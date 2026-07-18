'use strict';

/**
 * TimelineViewer
 * - 선택된 변수의 변경 히스토리 렌더링 (스텝 단위: value / event / line)
 * - 헤더에 변수 단위 속성(func, call_id, parent_call_id, depth)을 뱃지로 한 번만 표시
 * - 값 변화 계산 (증가 / 감소 / 유지 / 초기 / 삭제)
 */
class TimelineViewer {
  constructor() {
    this._container = document.getElementById('tlBody');
    this._headerEl  = document.getElementById('tlHdr');
    this._varNameEl = document.getElementById('tlName');
    this._scopeEl   = document.getElementById('tlScope');
    this._badgesEl  = document.getElementById('tlBadges');
    this._countEl   = document.getElementById('tlCnt');
  }

  /** 변수 단위 메타를 헤더에 렌더링 — 행마다 반복하지 않는다 */
  renderHeader(varData) {
    this._headerEl.style.display = 'flex';
    this._varNameEl.textContent = varData.varName;
    this._scopeEl.textContent = '· ' + (varData.scope || '—');

    const badges = [];
    if (varData.func !== null && varData.func !== undefined) {
      badges.push(`<span class="mb mb-func">${varData.func}</span>`);
    }
    if (varData.callId !== null && varData.callId !== undefined) {
      badges.push(`<span class="mb mb-call">call #${varData.callId}</span>`);
    }
    if (varData.parentCallId !== null && varData.parentCallId !== undefined) {
      badges.push(`<span class="mb mb-parent">← #${varData.parentCallId}</span>`);
    }
    if (varData.callDepth !== null && varData.callDepth !== undefined) {
      badges.push(`<span class="mb mb-depth">depth ${varData.callDepth}</span>`);
    }
    this._badgesEl.innerHTML = badges.join('');
  }

  renderTimeline(rows) {
    this._container.innerHTML = '';
    if (!rows || rows.length === 0) {
      this._container.innerHTML = '<div style="padding:24px;color:#555;font-size:12px;">기록된 변경사항이 없습니다.</div>';
      this._countEl.textContent = '';
      return;
    }

    this._countEl.textContent = rows.length + '회';
    rows.forEach((row, idx) => {
      this._container.appendChild(this._createRow(row, idx, rows));
    });
  }

  clearTimeline() {
    this._container.innerHTML = `
      <div class="empty">
        <div style="font-size:24px">⬡</div>
        <p>사이드바에서 변수를 선택하세요</p>
      </div>`;
    this._headerEl.style.display = 'none';
    this._badgesEl.innerHTML = '';
    this._countEl.textContent = '';
  }

  _createRow(row, idx, rows) {
    const prev = idx > 0 ? rows[idx - 1].value : null;
    const changed = idx > 0 && String(prev) !== String(row.value);
    const tag = this._calcChange(prev, row.value, idx, row.event);
    const lineNum = row.line ?? (row.step ?? idx + 1);
    const deleted = row.event === 'deleted';

    const el = document.createElement('div');
    el.className = 'hr' + (changed ? ' changed' : '') + (deleted ? ' deleted' : '');
    el.innerHTML = `
      <div class="li">
        <div class="ld"></div>
        <div class="ln">L${lineNum}</div>
      </div>
      <div class="hc">
        <span class="hv">${deleted ? '—' : this._formatValue(row.value)}</span>
        <span class="ct ${tag.cls}">${tag.text}</span>
      </div>`;
    return el;
  }

  _formatValue(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…';
    return String(v);
  }

  _calcChange(prev, curr, idx, event) {
    if (event === 'deleted') return { cls: 'del', text: 'deleted' };
    if (idx === 0 || event === 'init') return { cls: 'new', text: 'init' };
    const pn = parseFloat(prev), cn = parseFloat(curr);
    if (!isNaN(pn) && !isNaN(cn)) {
      const d = cn - pn;
      if (d === 0) return { cls: 'same', text: '±0' };
      const r = +(d.toFixed(4));
      return d > 0 ? { cls: 'inc', text: '+' + r } : { cls: 'dec', text: String(r) };
    }
    return String(prev) === String(curr)
      ? { cls: 'same', text: '—' }
      : { cls: 'inc', text: 'changed' };
  }
}
