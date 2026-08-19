'use strict';

/**
 * ToolValidator
 * - 블랙박스 유효성 검사 (설계문서 7장)
 *
 * 도구의 소스는 읽지 않는다. 정해진 입력을 넣고 **거동만** 본다.
 * 반환값에 규격이 없으므로 "무엇을 반환했는가"가 아니라 "어떻게 행동했는가"를 검사한다.
 *
 * 이 모듈은 ValidationPanel이 띄운 전용 임시 패널에서 실행된다. 도구가 무한 루프에
 * 빠지면 확장이 그 패널을 dispose해서 회수하므로, 여기서는 시간을 재기만 하면 된다.
 */

import { importTool } from './ToolLoader.js';
import { createContext, createHost, shapeError, isThenable } from './ToolHost.js';
import { messageOf } from '../js/util.js';

import normal    from './fixtures/normal.js';
import empty     from './fixtures/empty.js';
import deleted   from './fixtures/deleted.js';
import recursive from './fixtures/recursive.js';
import legacy    from './fixtures/legacy.js';

/** 주입 순서 고정 (설계문서 7.2) */
const FIXTURES = [
  ['normal',    normal],
  ['empty',     empty],
  ['deleted',   deleted],
  ['recursive', recursive],
  ['legacy',    legacy]
];

const FIXTURE_BUDGET_MS = 3_000;
/** 전체 예산. 확장의 15초 타임아웃보다 먼저 끝나야 리포트를 돌려줄 수 있다. */
const TOTAL_BUDGET_MS   = 13_000;

const CHECK = {
  LOAD        : '로드',
  SHAPE       : '형태',
  SIDE_EFFECT : '최상위 부작용',
  ANALYZE     : 'analyze 실행',
  SYNC        : '동기성',
  IMMUTABLE   : '입력 불변',
  DETERMINISM : 'analyze 결정성',
  RENDER      : 'render 실행',
  RENDER_DET  : '렌더 결정성',
  ISOLATION   : '영역 격리',
  CLEANUP     : '정리',
  DURATION    : '실행 시간'
};

/**
 * @param {{toolId: string, toolUri: string}} payload
 * @returns {Promise<ValidationReport>}
 */
export async function runValidation({ toolId, toolUri }) {
  const report = new Report(toolId);
  const started = now();

  // --- 1. 로드 · 3. 최상위 부작용 ---
  // 모듈 최상위 코드는 import 시점에 실행된다. 목록을 만들 때도 한 번 돌기 때문에
  // 여기서 DOM을 건드리거나 전역을 늘리면 사이드바를 여는 것만으로 부작용이 난다.
  const globalsBefore = globalKeys();
  const domWatch = watchDom(null);

  let tool;
  try {
    // 검사 때마다 새로 로드해야 앞선 검사가 남긴 모듈 상태에 영향받지 않는다.
    tool = await importTool(toolUri, `check${started}`);
  } catch (err) {
    domWatch.stop();
    report.fail(CHECK.LOAD, `import에 실패했습니다: ${messageOf(err)}`);
    return report.build();
  }

  const outsideDom = domWatch.stop();
  const newGlobals = diffKeys(globalsBefore, globalKeys());

  if (!tool || typeof tool !== 'object') {
    report.fail(CHECK.LOAD, 'default export가 객체가 아닙니다.');
    return report.build();
  }
  report.pass(CHECK.LOAD, 'import에 성공했고 default export가 객체입니다.');

  if (outsideDom.length > 0) {
    report.fail(CHECK.SIDE_EFFECT, `import만으로 DOM이 변경되었습니다: ${outsideDom[0]}`);
  } else if (newGlobals.length > 0) {
    report.fail(CHECK.SIDE_EFFECT, `import만으로 전역이 추가되었습니다: ${newGlobals.join(', ')}`);
  } else {
    report.pass(CHECK.SIDE_EFFECT, '모듈 최상위에서 부작용이 없습니다.');
  }

  // --- 2. 형태 ---
  const problem = shapeError(tool, toolId);
  if (problem) {
    report.fail(CHECK.SHAPE, problem);
    return report.build();   // analyze/render를 돌릴 수 없다
  }
  report.pass(CHECK.SHAPE, 'meta와 analyze/render가 계약대로 있습니다.');

  if (typeof tool.dispose !== 'function') {
    report.warn(CHECK.CLEANUP, 'dispose()가 없습니다. 타이머·전역 리스너를 쓴다면 반드시 구현하세요.');
  }

  // --- 픽스처별 검사 ---
  for (const [name, logs] of FIXTURES) {
    if (now() - started > TOTAL_BUDGET_MS) {
      report.fail(CHECK.DURATION, `전체 검사가 ${TOTAL_BUDGET_MS / 1000}초를 넘겨 ${name} 이후를 건너뛰었습니다.`);
      break;
    }
    runFixture(report, tool, name, logs);
  }

  return report.build();
}

// ── 픽스처 한 건 ────────────────────────────────────────────

function runFixture(report, tool, fixture, logs) {
  const began = now();

  // 6. 입력 불변 — 도구가 입력 배열을 제자리 수정하면 재실행이나 다른 도구 실행에
  //    영향을 준다. 원본의 깊은 복사본과 대조한다.
  const snapshot = safeClone(logs);
  const ctx = createContext({ filePath: '/validation/fixture.jsonl', log: () => {} });

  // 4·5. analyze 실행 · 동기성
  let model;
  try {
    model = tool.analyze(logs, ctx);
  } catch (err) {
    report.fail(CHECK.ANALYZE, `analyze()에서 예외가 발생했습니다: ${messageOf(err)}`, fixture);
    return;
  }
  report.pass(CHECK.ANALYZE, 'analyze()가 예외 없이 반환했습니다.', fixture);

  if (isThenable(model)) {
    report.fail(CHECK.SYNC, 'analyze()가 Promise를 반환했습니다. 비동기 도구는 지원하지 않습니다.', fixture);
    return;
  }

  if (snapshot !== CLONE_FAILED && !deepEqual(snapshot, logs)) {
    report.fail(CHECK.IMMUTABLE, 'analyze() 실행 후 rawLogs가 변경되었습니다.', fixture);
  } else {
    report.pass(CHECK.IMMUTABLE, '입력을 수정하지 않았습니다.', fixture);
  }

  // 7. analyze 결정성 — model에 규격이 없으므로 structuredClone으로 복제해 비교한다.
  //    함수나 DOM 노드가 섞여 복제할 수 없으면 skip으로 두고 9번으로 대신 판정한다.
  checkAnalyzeDeterminism(report, tool, ctx, logs, model, fixture);

  // 8·5·10·11. render 실행 · 동기성 · 영역 격리 · 정리
  const rendered = checkRender(report, tool, model, fixture);

  // 9. 렌더 결정성 — 분리된 컨테이너 두 개에 각각 렌더해 innerHTML을 비교한다.
  if (rendered) {
    checkRenderDeterminism(report, tool, ctx, logs, fixture);
  }

  // 12. 실행 시간
  const elapsed = now() - began;
  if (elapsed > FIXTURE_BUDGET_MS) {
    report.fail(CHECK.DURATION,
      `${Math.round(elapsed)}ms가 걸려 픽스처당 제한(${FIXTURE_BUDGET_MS}ms)을 넘겼습니다.`, fixture);
  } else {
    report.pass(CHECK.DURATION, `${Math.round(elapsed)}ms`, fixture);
  }
}

function checkAnalyzeDeterminism(report, tool, ctx, logs, first, fixture) {
  const cloned = safeClone(first);
  if (cloned === CLONE_FAILED) {
    report.skip(CHECK.DETERMINISM,
      '반환값에 복제할 수 없는 값(함수·DOM 노드 등)이 있어 렌더 결정성으로 대신 판정합니다.', fixture);
    return;
  }

  let second;
  try {
    second = tool.analyze(logs, ctx);
  } catch (err) {
    report.fail(CHECK.DETERMINISM, `두 번째 analyze()에서 예외가 발생했습니다: ${messageOf(err)}`, fixture);
    return;
  }

  if (deepEqual(cloned, second)) {
    report.pass(CHECK.DETERMINISM, '2회 실행 결과가 같습니다.', fixture);
  } else {
    report.fail(CHECK.DETERMINISM,
      '2회 실행 결과가 다릅니다. Date.now()나 Math.random()을 쓰지 않았는지 확인하세요.', fixture);
  }
}

function checkRender(report, tool, model, fixture) {
  // 화면에 보이지 않게 두되 document에는 붙인다. 완전히 떼어 두면 크기를 재는 도구가
  // 실제와 다르게 동작하고, MutationObserver로 mount 밖 변경을 가려내기도 어렵다.
  const stage = document.createElement('div');
  stage.setAttribute('style', 'position:absolute;left:-99999px;top:0;width:800px;height:600px;');
  const mount = document.createElement('div');
  stage.appendChild(mount);
  document.body.appendChild(stage);

  const domWatch = watchDom(mount);
  const timers   = instrumentTimers();
  // 전역 스냅샷은 계측을 건 뒤에 뜬다. instrumentTimers가 addEventListener 등을
  // window의 own property로 얹기 때문에, 먼저 뜨면 우리 계측이 "도구가 추가한 전역"으로 잡힌다.
  const globalsBefore = globalKeys();

  let ok = false;
  try {
    const host = createHost({ mount, filePath: '/validation/fixture.jsonl', log: () => {} });
    const result = tool.render(model, host);

    if (isThenable(result)) {
      report.fail(CHECK.SYNC, 'render()가 Promise를 반환했습니다. 비동기 도구는 지원하지 않습니다.', fixture);
    } else {
      report.pass(CHECK.SYNC, 'analyze/render 모두 동기 함수입니다.', fixture);
      report.pass(CHECK.RENDER, 'render()가 예외 없이 완료했습니다.', fixture);
      ok = true;
    }
  } catch (err) {
    report.fail(CHECK.RENDER, `render()에서 예외가 발생했습니다: ${messageOf(err)}`, fixture);
  }

  const outside = domWatch.stop();
  const newGlobals = diffKeys(globalsBefore, globalKeys());

  // 10. 영역 격리
  if (outside.length > 0) {
    report.fail(CHECK.ISOLATION, `host.mount 밖의 DOM이 변경되었습니다: ${outside[0]}`, fixture);
  } else if (newGlobals.length > 0) {
    report.fail(CHECK.ISOLATION, `window에 전역이 추가되었습니다: ${newGlobals.join(', ')}`, fixture);
  } else {
    report.pass(CHECK.ISOLATION, 'mount 안에서만 그렸습니다.', fixture);
  }

  // 11. 정리 — dispose 후 mount가 비고, 등록한 타이머·리스너가 남지 않아야 한다
  checkCleanup(report, tool, mount, timers, fixture);

  timers.restore();
  stage.remove();
  return ok;
}

function checkCleanup(report, tool, mount, timers, fixture) {
  const hasDispose = typeof tool.dispose === 'function';

  if (hasDispose) {
    try {
      tool.dispose();
    } catch (err) {
      report.fail(CHECK.CLEANUP, `dispose()에서 예외가 발생했습니다: ${messageOf(err)}`, fixture);
      return;
    }
  }

  const leaks = timers.outstanding();
  if (leaks.length === 0) {
    // mount를 비우는 것은 우리 몫이라 도구가 남긴 DOM 자체는 문제가 아니다 (설계문서 4.5).
    // 여기서는 타이머·전역 리스너만 본다.
    if (hasDispose) {
      report.pass(CHECK.CLEANUP, '남은 타이머·전역 리스너가 없습니다.', fixture);
    }
    return;
  }

  const detail = leaks.join(', ');
  if (hasDispose) {
    report.fail(CHECK.CLEANUP, `dispose() 후에도 해제되지 않은 항목이 있습니다: ${detail}`, fixture);
  } else {
    report.warn(CHECK.CLEANUP, `dispose()가 없어 해제되지 않은 항목이 남습니다: ${detail}`, fixture);
  }
}

function checkRenderDeterminism(report, tool, ctx, logs, fixture) {
  // model은 한 번만 만들고 render만 2회 반복한다.
  // draw()마다 analyze를 다시 돌리면 (1) 무거운 analyze 비용이 픽스처당 2배로 붙어
  // 실행 시간(12번) 오탐을 만들고, (2) analyze가 비결정적일 때 이 검사가 render가 아니라
  // analyze의 변동을 잡아 오진한다. analyze의 결정성은 7번이 따로 본다.
  let model;
  try {
    model = tool.analyze(logs, ctx);
  } catch (err) {
    report.fail(CHECK.RENDER_DET, `재분석 중 예외가 발생했습니다: ${messageOf(err)}`, fixture);
    return;
  }

  const draw = () => {
    const container = document.createElement('div');   // 분리된 컨테이너
    tool.render(model, createHost({ mount: container, filePath: '/validation/fixture.jsonl', log: () => {} }));
    const html = container.innerHTML;
    if (typeof tool.dispose === 'function') {
      // 두 번째 렌더가 첫 번째의 잔여 상태에 영향받지 않게 한다
      tool.dispose();
    }
    return html;
  };

  let a, b;
  try {
    a = draw();
    b = draw();
  } catch (err) {
    report.fail(CHECK.RENDER_DET, `재렌더 중 예외가 발생했습니다: ${messageOf(err)}`, fixture);
    return;
  }

  if (a === b) {
    report.pass(CHECK.RENDER_DET, '2회 렌더 결과가 같습니다.', fixture);
    return;
  }

  // 같은 model을 두 번 넘겼는데 결과가 다르다면, render가 난수·시각을 쓰거나
  // 첫 렌더에서 model을 변형시킨 것이다. 후자는 model을 매번 새로 만들 때는 가려진다.
  report.fail(CHECK.RENDER_DET,
    `같은 model로 2회 렌더한 결과가 다릅니다 (첫 차이: 문자 ${firstDiff(a, b)} 부근). ` +
    'Date.now()·Math.random()으로 만든 id나 좌표가 있는지, ' +
    'render가 model을 수정하지는 않는지 확인하세요.', fixture);
}

// ── 리포트 누적 ─────────────────────────────────────────────

const RANK = { pass: 0, skip: 1, warn: 2, fail: 3 };

/**
 * 항목별로 가장 나쁜 결과 하나만 남긴다.
 * 픽스처 5종을 돌리므로 그대로 쌓으면 같은 이름이 다섯 줄씩 나와 읽기 어렵다.
 */
class Report {
  constructor(toolId) {
    this.toolId = toolId;
    this.map = new Map();
  }

  pass(name, message, fixture) { this._put(name, 'pass', message, fixture); }
  warn(name, message, fixture) { this._put(name, 'warn', message, fixture); }
  fail(name, message, fixture) { this._put(name, 'fail', message, fixture); }
  skip(name, message, fixture) { this._put(name, 'skip', message, fixture); }

  _put(name, status, message, fixture) {
    const prev = this.map.get(name);
    if (prev && RANK[prev.status] >= RANK[status]) {
      return;   // 이미 더 나쁜(혹은 같은) 결과가 있다 — 첫 실패 위치를 유지한다
    }
    this.map.set(name, { name, status, message, ...(fixture ? { fixture } : {}) });
  }

  /** 한 번도 기록되지 않은 항목을 skip으로 채운다 (형태 실패로 조기 종료한 경우 등) */
  _settle() {
    for (const name of Object.values(CHECK)) {
      if (!this.map.has(name)) {
        this.map.set(name, { name, status: 'skip', message: '실행되지 않았습니다.' });
      }
    }
  }

  build() {
    this._settle();

    // 선언 순서(=검사 번호 순)로 정렬해 리포트가 매번 같은 모양이 되게 한다
    const order = Object.values(CHECK);
    const checks = [...this.map.values()]
      .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

    return {
      toolId : this.toolId,
      ok     : !checks.some(check => check.status === 'fail'),
      checks
    };
  }
}

// ── 계측 ────────────────────────────────────────────────────

/**
 * document 전체를 관찰하되 allowed(=mount) 하위 변경은 무시한다.
 * allowed가 null이면 모든 변경이 위반이다 (import 단계).
 */
function watchDom(allowed) {
  if (typeof MutationObserver === 'undefined') {
    return { stop: () => [] };
  }

  const violations = [];
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (allowed && (record.target === allowed || allowed.contains(record.target))) {
        continue;
      }
      violations.push(describeMutation(record));
    }
  });

  observer.observe(document, {
    childList: true, subtree: true, attributes: true, characterData: true
  });

  return {
    stop() {
      // 아직 큐에 남은 레코드까지 받아야 마지막 변경을 놓치지 않는다
      observer.takeRecords().forEach(record => {
        if (!(allowed && (record.target === allowed || allowed.contains(record.target)))) {
          violations.push(describeMutation(record));
        }
      });
      observer.disconnect();
      return violations;
    }
  };
}

function describeMutation(record) {
  const target = nodeName(record.target);
  if (record.type === 'childList') {
    const added = [...record.addedNodes].map(nodeName).join(', ');
    return added
      ? `${target}에 ${added} 추가`
      : `${target}에서 노드 제거`;
  }
  if (record.type === 'attributes') {
    return `${target}의 ${record.attributeName} 속성 변경`;
  }
  return `${target}의 텍스트 변경`;
}

function nodeName(node) {
  if (!node) {
    return '알 수 없는 노드';
  }
  if (node === document.body) {
    return 'document.body';
  }
  if (node.nodeType === 3) {
    return '텍스트 노드';
  }
  const tag = (node.nodeName || '').toLowerCase();
  const id = node.id ? '#' + node.id : '';
  return `<${tag}${id}>`;
}

/**
 * setTimeout/setInterval과 window·document 리스너 등록을 세어, 해제되지 않은 것을 찾는다.
 * 검사 전용 패널에서만 도므로 전역을 잠시 바꿔도 안전하다.
 */
function instrumentTimers() {
  const originals = {
    setTimeout       : window.setTimeout,
    clearTimeout     : window.clearTimeout,
    setInterval      : window.setInterval,
    clearInterval    : window.clearInterval,
    winAdd           : window.addEventListener,
    winRemove        : window.removeEventListener,
    docAdd           : document.addEventListener,
    docRemove        : document.removeEventListener
  };

  const timeouts  = new Set();
  const intervals = new Set();
  const listeners = new Map();   // 'window:resize' → count

  window.setTimeout = function (...args) {
    const id = originals.setTimeout.apply(window, args);
    timeouts.add(id);
    return id;
  };
  window.clearTimeout = function (id) {
    timeouts.delete(id);
    return originals.clearTimeout.call(window, id);
  };
  window.setInterval = function (...args) {
    const id = originals.setInterval.apply(window, args);
    intervals.add(id);
    return id;
  };
  window.clearInterval = function (id) {
    intervals.delete(id);
    return originals.clearInterval.call(window, id);
  };

  const track = (scope, delta) => (type, ...rest) => {
    const key = `${scope}:${type}`;
    const next = (listeners.get(key) ?? 0) + delta;
    if (next <= 0) {
      listeners.delete(key);
    } else {
      listeners.set(key, next);
    }
    return rest;
  };

  const winAdd = track('window', 1);
  const winRemove = track('window', -1);
  const docAdd = track('document', 1);
  const docRemove = track('document', -1);

  window.addEventListener = function (type, ...rest) {
    winAdd(type);
    return originals.winAdd.call(window, type, ...rest);
  };
  window.removeEventListener = function (type, ...rest) {
    winRemove(type);
    return originals.winRemove.call(window, type, ...rest);
  };
  document.addEventListener = function (type, ...rest) {
    docAdd(type);
    return originals.docAdd.call(document, type, ...rest);
  };
  document.removeEventListener = function (type, ...rest) {
    docRemove(type);
    return originals.docRemove.call(document, type, ...rest);
  };

  return {
    outstanding() {
      const items = [];
      if (intervals.size) { items.push(`setInterval ${intervals.size}건`); }
      if (timeouts.size)  { items.push(`setTimeout ${timeouts.size}건`); }
      for (const [key, count] of listeners) {
        items.push(`${key} 리스너 ${count}건`);
      }
      return items;
    },
    restore() {
      // 검사 중 남은 타이머는 우리가 치운다. 안 그러면 다음 픽스처 결과에 섞인다.
      intervals.forEach(id => originals.clearInterval.call(window, id));
      timeouts.forEach(id => originals.clearTimeout.call(window, id));

      window.setTimeout    = originals.setTimeout;
      window.clearTimeout  = originals.clearTimeout;
      window.setInterval   = originals.setInterval;
      window.clearInterval = originals.clearInterval;
      window.addEventListener    = originals.winAdd;
      window.removeEventListener = originals.winRemove;
      document.addEventListener    = originals.docAdd;
      document.removeEventListener = originals.docRemove;
    }
  };
}

// ── 유틸 ────────────────────────────────────────────────────

const CLONE_FAILED = Symbol('clone-failed');

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return CLONE_FAILED;
  }
}

function globalKeys() {
  try {
    return new Set(Object.keys(window));
  } catch {
    return new Set();
  }
}

function diffKeys(before, after) {
  const added = [];
  for (const key of after) {
    if (!before.has(key)) {
      added.push(key);
    }
  }
  return added.slice(0, 5);
}

/** 순환 참조를 허용하는 깊은 비교 */
function deepEqual(a, b, seen = new Map()) {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (seen.get(a) === b) {
    return true;
  }
  seen.set(a, b);

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  return keysA.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key], seen));
}

function firstDiff(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      return i;
    }
  }
  return len;
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
