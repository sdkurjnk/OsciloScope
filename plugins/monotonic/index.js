/// <reference path="./osciloscope-tool.d.ts" />

/**
 * monotonic — 단조 증가 변수 추출 (기본 도구)
 *
 * 숫자 변수 중 값이 계속 증가하기만 한 것을 골라낸다. 루프 카운터나 누적 합계를
 * 찾는 용도다 (설계문서 8장).
 *
 * change-detector와 달리 **표준 위젯을 하나도 쓰지 않는다.** 분석 결과 기준으로
 * 그룹을 새로 만들고, 화면도 직접 그린다 — 자유 시각화가 실제로 가능하다는 것을
 * 코드로 보여주기 위한 참고 구현이다.
 *
 * @type {OsciloScopeTool}
 */

const SPARK_W = 120;
const SPARK_H = 28;
const PAD     = 3;

export default {
  meta: {
    id: 'monotonic',
    name: '단조 증가 변수',
    version: '1.0.0',
    description: '값이 계속 증가하기만 한 숫자 변수를 골라내 값 추이를 그립니다.'
  },

  /**
   * 조건 필터링 + 분석 결과 기준 그룹 재구성.
   * change-detector가 스코프(Global/Local)로 나누는 것과 달리, 여기서는
   * '단조 증가' / '그 외'로 나눈다 — 그룹 축이 분석 내용이 될 수 있다는 예시다.
   *
   * @param {RawLog[]} rawLogs
   * @param {ToolContext} ctx
   */
  analyze(rawLogs, ctx) {
    const index = {};

    for (const log of rawLogs) {
      const varKey = ctx.helpers.varKeyOf(log);

      if (!index[varKey]) {
        index[varKey] = {
          varKey,
          varName : log.name,
          scope   : ctx.helpers.groupOf(log),
          func    : log.func,
          callId  : log.call_id,
          values  : []
        };
      }

      // deleted는 값이 없으므로 추이에서 뺀다. 숫자가 아닌 값이 하나라도 섞이면
      // 그 변수는 숫자 변수가 아니라고 보고 아래에서 탈락시킨다.
      if (log.event !== 'deleted') {
        index[varKey].values.push(log.data);
      }
    }

    const rising = [];
    const others = [];

    for (const entry of Object.values(index)) {
      const numbers = toNumbers(entry.values);
      const result  = { ...entry, numbers, numeric: numbers !== null };

      if (numbers !== null && isStrictlyIncreasing(numbers)) {
        result.delta = numbers[numbers.length - 1] - numbers[0];
        rising.push(result);
      } else {
        others.push(result);
      }
    }

    // 증가폭이 큰 순으로. 같으면 varKey로 묶어 순서를 고정한다 —
    // 정렬이 불안정하면 같은 입력에도 화면이 달라져 렌더 결정성 검사에 걸린다.
    rising.sort((a, b) => b.delta - a.delta || compareKey(a, b));
    others.sort(compareKey);

    ctx.log(`단조 증가 ${rising.length}건 / 전체 ${rising.length + others.length}건`);

    const groups = {};
    if (rising.length) { groups['단조 증가'] = rising; }
    if (others.length) { groups['그 외']    = others; }

    return { groups, total: rising.length + others.length, risingCount: rising.length };
  },

  /**
   * 위젯 없이 직접 그린다. 스타일은 인라인 속성으로만 준다 —
   * <style> 태그를 넣으면 mount 밖까지 영향이 가고, 도구끼리 클래스명이 섞인다.
   *
   * @param {any} model
   * @param {ToolHost} host
   */
  render(model, host) {
    host.mount.textContent = '';

    const root = el('div', {
      overflowY : 'auto',
      height    : '100%',
      padding   : '16px 20px',
      fontFamily: "'Consolas', 'Courier New', monospace"
    });

    if (model.total === 0) {
      root.appendChild(notice('분석할 변수가 없습니다.'));
      host.mount.appendChild(root);
      return;
    }

    root.appendChild(summary(model));

    for (const [groupName, entries] of Object.entries(model.groups)) {
      root.appendChild(section(groupName, entries, groupName === '단조 증가'));
    }

    host.mount.appendChild(root);
  },

  /** 타이머·전역 리스너를 쓰지 않으므로 비워 둔다. */
  dispose() {}
};

// ── 화면 조각 ──────────────────────────────────────────────

function summary(model) {
  const box = el('div', {
    fontSize    : '11px',
    color       : '#858585',
    marginBottom: '14px'
  });
  box.textContent = `변수 ${model.total}개 중 ${model.risingCount}개가 단조 증가입니다.`;
  return box;
}

function section(title, entries, highlight) {
  const wrap = el('div', { marginBottom: '18px' });

  const head = el('div', {
    display     : 'flex',
    alignItems  : 'center',
    gap         : '6px',
    fontSize    : '11px',
    letterSpacing: '.08em',
    color       : highlight ? '#4ec9b0' : '#858585',
    borderBottom: '1px solid #3c3c3c',
    paddingBottom: '5px',
    marginBottom : '8px'
  });

  const label = el('span');
  label.textContent = title;

  const count = el('span', { marginLeft: 'auto', color: '#858585' });
  count.textContent = String(entries.length);

  head.appendChild(label);
  head.appendChild(count);
  wrap.appendChild(head);

  for (const entry of entries) {
    wrap.appendChild(card(entry, highlight));
  }
  return wrap;
}

function card(entry, highlight) {
  const row = el('div', {
    display      : 'flex',
    alignItems   : 'center',
    gap          : '10px',
    padding      : '8px 10px',
    marginBottom : '6px',
    borderRadius : '4px',
    border       : '1px solid ' + (highlight ? '#2f4a44' : '#3c3c3c'),
    background   : highlight ? 'rgba(78,201,176,.07)' : '#252526'
  });

  const name = el('span', {
    fontSize  : '12px',
    color     : highlight ? '#4ec9b0' : '#cccccc',
    minWidth  : '110px',
    overflow  : 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  });
  name.textContent = entry.varName;
  row.appendChild(name);

  if (entry.scope !== 'Global' && entry.callId !== null && entry.callId !== undefined) {
    row.appendChild(chip('#' + entry.callId, '#4fc1ff', '#1b4f72'));
  }

  const spacer = el('span', { flex: '1' });
  row.appendChild(spacer);

  if (entry.numeric && entry.numbers.length >= 2) {
    row.appendChild(sparkline(entry.numbers, highlight ? '#4ec9b0' : '#6b6b6b'));
    const range = el('span', { fontSize: '10px', color: '#858585', whiteSpace: 'nowrap' });
    range.textContent = `${format(entry.numbers[0])} → ${format(entry.numbers[entry.numbers.length - 1])}`;
    row.appendChild(range);
  } else {
    const reason = el('span', { fontSize: '10px', color: '#6b6b6b' });
    reason.textContent = entry.numeric ? '값 1개' : '숫자 아님';
    row.appendChild(reason);
  }

  if (highlight) {
    row.appendChild(chip('+' + format(entry.delta), '#4ec9b0', '#2f4a44'));
  }

  return row;
}

/** 값 추이를 인라인 SVG 폴리라인으로 그린다. 난수·시각을 쓰지 않아 결정적이다. */
function sparkline(numbers, color) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${SPARK_W} ${SPARK_H}`);
  svg.setAttribute('width', String(SPARK_W));
  svg.setAttribute('height', String(SPARK_H));
  svg.style.flexShrink = '0';

  const min  = Math.min(...numbers);
  const max  = Math.max(...numbers);
  const span = max - min || 1;
  const step = numbers.length > 1 ? (SPARK_W - PAD * 2) / (numbers.length - 1) : 0;

  const points = numbers.map((value, i) => {
    const x = PAD + step * i;
    const y = SPARK_H - PAD - ((value - min) / span) * (SPARK_H - PAD * 2);
    return `${round(x)},${round(y)}`;
  }).join(' ');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', points);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(line);

  return svg;
}

function chip(text, color, border) {
  const span = el('span', {
    fontSize    : '10px',
    padding     : '1px 5px',
    borderRadius: '3px',
    color,
    border      : '1px solid ' + border,
    whiteSpace  : 'nowrap',
    flexShrink  : '0'
  });
  span.textContent = text;
  return span;
}

function notice(text) {
  const box = el('div', { padding: '24px', color: '#555', fontSize: '12px', textAlign: 'center' });
  box.textContent = text;
  return box;
}

function el(tag, styles) {
  const node = document.createElement(tag);
  if (styles) {
    Object.assign(node.style, styles);
  }
  return node;
}

// ── 계산 ───────────────────────────────────────────────────

/** 값이 전부 유한한 숫자면 숫자 배열, 하나라도 아니면 null (true/false·문자열 제외) */
function toNumbers(values) {
  const numbers = [];
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    numbers.push(value);
  }
  return numbers;
}

function isStrictlyIncreasing(numbers) {
  if (numbers.length < 2) {
    return false;
  }
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] <= numbers[i - 1]) {
      return false;
    }
  }
  return true;
}

function compareKey(a, b) {
  return a.varKey < b.varKey ? -1 : a.varKey > b.varKey ? 1 : 0;
}

function format(value) {
  return Number.isInteger(value) ? String(value) : String(+value.toFixed(4));
}

function round(value) {
  return Math.round(value * 100) / 100;
}
