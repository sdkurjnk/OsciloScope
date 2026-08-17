'use strict';

/**
 * TimelineWidget
 * - 한 변수의 변경 이력을 그린다 (기존 TimelineViewer.js 이관)
 *
 * 기존 대비 바뀐 점 (설계문서 3.4 / 4.6):
 * 1. 헤더가 패널 크롬(#tlHdr)에 흩어져 있던 것을 위젯 안으로 합쳤다.
 *    이제 헤더 위쪽을 뺀 전 영역이 도구 몫이라 패널이 헤더를 들고 있을 수 없다.
 * 2. innerHTML 제거. 값(row.value)과 함수명(entry.func)이 로그에서 오는 값이라
 *    그대로 넣으면 주입이 된다. 전부 textContent로 넣는다.
 * 3. 컨테이너 주입. 같은 el에 다시 호출하면 내용을 갈아끼운다.
 */
export function timeline(el, entry) {
  if (!el) {
    throw new Error('timeline(el, entry): 컨테이너 엘리먼트가 필요합니다.');
  }

  el.textContent = '';

  const root = document.createElement('div');
  root.className = 'osc-widget osc-timeline';

  if (!entry) {
    root.appendChild(createEmpty('변수를 선택하세요'));
    el.appendChild(root);
    return;
  }

  const rows = Array.isArray(entry.history) ? entry.history : [];

  root.appendChild(createHeader(entry, rows.length));

  const body = document.createElement('div');
  body.className = 'tl-body';

  if (rows.length === 0) {
    body.appendChild(createEmpty('기록된 변경사항이 없습니다.'));
  } else {
    rows.forEach((row, idx) => body.appendChild(createRow(row, idx, rows)));
  }

  root.appendChild(body);
  el.appendChild(root);
}

function createHeader(entry, count) {
  const header = document.createElement('div');
  header.className = 'tl-hdr';

  const name = document.createElement('span');
  name.className = 'tl-name';
  name.textContent = String(entry.varName ?? '—');

  const scope = document.createElement('span');
  scope.className = 'tl-scope';
  scope.textContent = '· ' + (entry.scope || '—');

  const badges = document.createElement('span');
  badges.className = 'tl-badges';
  appendBadge(badges, 'mb-func', entry.func, value => String(value));
  appendBadge(badges, 'mb-call', entry.callId, value => 'call #' + value);
  appendBadge(badges, 'mb-parent', entry.parentCallId, value => '← #' + value);
  appendBadge(badges, 'mb-depth', entry.callDepth, value => 'depth ' + value);

  const total = document.createElement('span');
  total.className = 'tl-cnt';
  total.textContent = count > 0 ? count + '회' : '';

  header.appendChild(name);
  header.appendChild(scope);
  header.appendChild(badges);
  header.appendChild(total);
  return header;
}

function appendBadge(container, cls, value, format) {
  if (value === null || value === undefined) {
    return;
  }
  const badge = document.createElement('span');
  badge.className = 'mb ' + cls;
  badge.textContent = format(value);
  container.appendChild(badge);
}

function createRow(row, idx, rows) {
  const prev = idx > 0 ? rows[idx - 1].value : null;
  const changed = idx > 0 && String(prev) !== String(row.value);
  const tag = calcChange(prev, row.value, idx, row.event);
  const lineNum = row.line ?? (row.step ?? idx + 1);
  const deleted = row.event === 'deleted';

  const el = document.createElement('div');
  el.className = 'hr' + (changed ? ' changed' : '') + (deleted ? ' deleted' : '');

  const gutter = document.createElement('div');
  gutter.className = 'li';

  const dot = document.createElement('div');
  dot.className = 'ld';

  const line = document.createElement('div');
  line.className = 'ln';
  line.textContent = 'L' + lineNum;

  gutter.appendChild(dot);
  gutter.appendChild(line);

  const card = document.createElement('div');
  card.className = 'hc';

  const value = document.createElement('span');
  value.className = 'hv';
  value.textContent = deleted ? '—' : formatValue(row.value);

  const change = document.createElement('span');
  change.className = 'ct ' + tag.cls;
  change.textContent = tag.text;

  card.appendChild(value);
  card.appendChild(change);

  el.appendChild(gutter);
  el.appendChild(card);
  return el;
}

function createEmpty(message) {
  const empty = document.createElement('div');
  empty.className = 'empty';

  const icon = document.createElement('div');
  icon.className = 'empty-ico';
  icon.textContent = '⬡';

  const text = document.createElement('p');
  text.textContent = message;

  empty.appendChild(icon);
  empty.appendChild(text);
  return empty;
}

function formatValue(v) {
  if (v === null || v === undefined) {
    return '—';
  }
  if (typeof v === 'string') {
    return v.length > 60 ? v.slice(0, 60) + '…' : v;
  }
  if (typeof v === 'object') {
    // 객체·배열 값도 로그에 들어온다. String(v)면 [object Object]가 되어 정보가 없다.
    try {
      const text = JSON.stringify(v);
      return text.length > 60 ? text.slice(0, 60) + '…' : text;
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function calcChange(prev, curr, idx, event) {
  if (event === 'deleted') {
    return { cls: 'del', text: 'deleted' };
  }
  if (idx === 0 || event === 'init') {
    return { cls: 'new', text: 'init' };
  }
  const pn = parseFloat(prev);
  const cn = parseFloat(curr);
  if (!isNaN(pn) && !isNaN(cn)) {
    const d = cn - pn;
    if (d === 0) {
      return { cls: 'same', text: '±0' };
    }
    const r = +(d.toFixed(4));
    return d > 0 ? { cls: 'inc', text: '+' + r } : { cls: 'dec', text: String(r) };
  }
  return String(prev) === String(curr)
    ? { cls: 'same', text: '—' }
    : { cls: 'inc', text: 'changed' };
}
