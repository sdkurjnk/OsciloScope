'use strict';

/**
 * ToolHost
 * - 도구에 넘길 ctx / host 객체를 만들고, analyze → render → dispose 생명주기를 관리한다.
 *   (설계문서 4.3 ~ 4.5)
 *
 * 여기가 도구와 우리 앱 사이의 유일한 접점이다. 도구는 여기서 받은 것만 쓸 수 있고,
 * acquireVsCodeApi·fs·네트워크로 가는 통로는 host에 담지 않는다 (4.4).
 *
 * 검사기(ToolValidator)도 같은 함수를 쓴다. 검사와 실제 실행이 다른 경로를 타면
 * "검사는 통과했는데 실행하면 깨진다"가 생기기 때문이다.
 */

import { layout } from './widgets/LayoutWidget.js';
import { varList } from './widgets/VarListWidget.js';
import { timeline } from './widgets/TimelineWidget.js';

export const widgets = Object.freeze({ layout, varList, timeline });

// --- helpers (설계문서 4.3 / 4.4) ---

/**
 * RawLog → varKey.
 * var_id(소유 프레임)로 키잉하므로, 수정 프레임(call_id)이 달라도 소유 프레임이 같으면
 * 같은 변수로 묶인다. var_id가 null인 구버전 로그는 이름만으로 폴백한다 (legacy 픽스처).
 */
export function varKeyOf(log) {
  if (!log) {
    return '';
  }
  if (log.var_id === null || log.var_id === undefined) {
    return String(log.name);
  }
  return `${log.name}@${log.var_id}`;
}

/** RawLog → 'Global' | 'Local' */
export function groupOf(log) {
  return log && log.domain === 'GLOBAL' ? 'Global' : 'Local';
}

/**
 * HTML 특수문자 이스케이프.
 * 표준 위젯은 전부 textContent를 쓰므로 필요 없지만, 도구가 직접 innerHTML을 쓸 때를
 * 위해 제공한다 — 없으면 각자 엉성하게 구현하게 된다.
 */
export function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const analyzeHelpers = Object.freeze({ varKeyOf, groupOf });
const renderHelpers  = Object.freeze({ varKeyOf, groupOf, escape });

// --- ctx / host 생성 ---

/** analyze()에 넘길 ToolContext. DOM으로 가는 통로가 없다 (4.3) */
export function createContext({ filePath, log }) {
  return Object.freeze({
    filePath : filePath ?? '',
    log      : typeof log === 'function' ? log : () => {},
    helpers  : analyzeHelpers
  });
}

/** render()에 넘길 ToolHost (4.4) */
export function createHost({ mount, filePath, theme, log }) {
  return Object.freeze({
    mount,
    filePath : filePath ?? '',
    theme    : theme || detectTheme(),
    log      : typeof log === 'function' ? log : () => {},
    helpers  : renderHelpers,
    widgets
  });
}

/**
 * 현재 VS Code 테마. body에 붙는 vscode-* 클래스로 판별한다.
 * 검사 패널처럼 body 클래스가 없는 곳에서는 'dark'로 떨어진다.
 */
export function detectTheme() {
  const cls = (typeof document !== 'undefined' && document.body && document.body.className) || '';
  if (cls.includes('vscode-high-contrast')) {
    return 'high-contrast';
  }
  if (cls.includes('vscode-light')) {
    return 'light';
  }
  return 'dark';
}

// --- 형태 검사 (검사 항목 2번 / 로딩 실패 처리 5.6) ---

/**
 * 도구 객체가 계약대로 생겼는지 본다. 문제가 없으면 null, 있으면 사유 문자열.
 * expectedId를 주면 meta.id와 파일명 일치까지 확인한다.
 */
export function shapeError(tool, expectedId) {
  if (!tool || typeof tool !== 'object') {
    return 'default export가 객체가 아닙니다.';
  }
  if (!tool.meta || typeof tool.meta !== 'object') {
    return 'meta가 없습니다.';
  }
  for (const field of ['id', 'name', 'version']) {
    if (typeof tool.meta[field] !== 'string' || tool.meta[field] === '') {
      return `meta.${field}가 없거나 문자열이 아닙니다.`;
    }
  }
  if (typeof tool.analyze !== 'function') {
    return 'analyze가 함수가 아닙니다.';
  }
  if (typeof tool.render !== 'function') {
    return 'render가 함수가 아닙니다.';
  }
  if (expectedId && tool.meta.id !== expectedId) {
    return `meta.id("${tool.meta.id}")와 파일명("${expectedId}")이 다릅니다.`;
  }
  return null;
}

/** 반환값이 Promise인지 (검사 항목 5번 — 동기성) */
export function isThenable(value) {
  return !!value && (typeof value === 'object' || typeof value === 'function') &&
         typeof value.then === 'function';
}

// --- 생명주기 ---

/**
 * 도구 한 번의 실행을 감싼다.
 *
 *   const session = new ToolSession(tool, { filePath, log });
 *   session.analyze(rawLogs);
 *   session.render(mountEl);
 *   ...
 *   session.dispose();      // 도구 교체 / 로그 재선택 / 패널 닫힘
 *
 * dispose()는 도구가 구현했으면 부르고, mount는 어느 쪽이든 우리가 비운다 (4.5).
 */
export class ToolSession {
  constructor(tool, { filePath, log } = {}) {
    this._tool     = tool;
    this._filePath = filePath ?? '';
    this._log      = typeof log === 'function' ? log : () => {};
    this._mount    = null;
    this._model    = undefined;
    this._disposed = false;
  }

  get meta() {
    return this._tool && this._tool.meta ? this._tool.meta : null;
  }

  /**
   * 1단계 — 계산. 반환값이 Promise면 계약 위반이므로 여기서 끊는다.
   * 그냥 두면 render(model)이 Promise를 받아 엉뚱한 곳에서 터진다.
   */
  analyze(rawLogs) {
    const ctx   = createContext({ filePath: this._filePath, log: this._log });
    const model = this._tool.analyze(rawLogs, ctx);
    if (isThenable(model)) {
      throw new Error('analyze()가 Promise를 반환했습니다. 도구는 동기 함수여야 합니다.');
    }
    this._model = model;
    return model;
  }

  /** 2단계 — 표현. mount는 도구 전용 컨테이너이며 밖은 도구의 영역이 아니다. */
  render(mount) {
    this._mount = mount;
    const host = createHost({ mount, filePath: this._filePath, log: this._log });
    const result = this._tool.render(this._model, host);
    if (isThenable(result)) {
      throw new Error('render()가 Promise를 반환했습니다. 도구는 동기 함수여야 합니다.');
    }
  }

  /** 도구의 dispose는 선택 구현. 실패해도 mount 정리는 반드시 끝낸다. */
  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;

    try {
      if (typeof this._tool?.dispose === 'function') {
        this._tool.dispose();
      }
    } catch (err) {
      this._log(`[ToolHost] dispose() 실패: ${err?.message ?? err}`);
    } finally {
      if (this._mount) {
        this._mount.textContent = '';
      }
      this._mount = null;
      this._model = undefined;
    }
  }
}
