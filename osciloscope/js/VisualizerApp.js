'use strict';

/**
 * VisualizerApp
 * - 메인 패널의 흐름 조율: 메시지 수신 → 도구 로드 → analyze → render
 *
 * v0.1.2까지는 이 파일이 데이터를 직접 들고 화면을 그렸다. 이제 그 일은 전부
 * 도구가 하고, 여기는 도구를 불러와 생명주기를 돌리는 역할만 한다 (설계문서 4.5).
 */

import { createApiTable, CommandTypes, ToolErrorPhase } from './ApiTable.js';
import { messageOf } from './util.js';
import { loadToolForRun } from '../tool-host/ToolLoader.js';
import { ToolSession } from '../tool-host/ToolHost.js';

export class VisualizerApp {
  constructor() {
    // 도구를 import하기 전에 우리가 먼저 API를 잡고 전역에서 지운다 (설계문서 3.3).
    // acquireVsCodeApi()는 한 번만 호출할 수 있으므로, 이렇게 하면 도구는 확장으로
    // 메시지를 보낼 수 없다 — 확장 ↔ 웹뷰 통신을 우리 코드가 독점한다.
    this._vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;
    if (typeof window !== 'undefined') {
      delete window.acquireVsCodeApi;
    }

    // 확장과의 통신은 전부 이 테이블을 거친다 (FE-API Table).
    this._api = createApiTable(this._vscode);

    this._session  = null;   // 현재 실행 중인 ToolSession
    this._filePath = '';
    this._runSeq   = 0;      // 늦게 도착한 이전 실행을 무시하기 위한 순번
  }

  init() {
    // 수신 라우팅을 테이블에 등록한다 (command → handler).
    this._api.route({
      [CommandTypes.LOG_FILE_LOADED]: payload => {
        const { filePath } = payload;
        if (filePath) {
          this._filePath = filePath;
          this._setPath(filePath);
        }
      },
      // await를 기다리지 않는다. 핸들러를 붙잡고 있으면 그 사이 도착한 메시지가
      // 밀리기 때문. 순번(_runSeq)으로 경쟁만 정리한다.
      [CommandTypes.UPDATE_ALL_DATA]: payload => this._run(payload)
    });

    this._setStatus('로드 중', 'loading');
    this._api.uiReady();
  }

  // --- 실행 ---

  async _run(payload) {
    const seq  = ++this._runSeq;
    const tool = payload.tool || {};

    this._filePath = payload.filePath || this._filePath;
    this._setPath(this._filePath);
    this._setStatus('도구 로드 중', 'loading');

    // 이전 도구를 먼저 정리한다. 타이머·리스너를 쓴 도구가 남아 있으면
    // 새 도구 화면 위에서 계속 돈다 (설계문서 4.5).
    this._disposeSession();

    let loaded;
    try {
      // 캐시 무효화 — 도구 파일을 고치고 START를 다시 눌렀을 때 옛 코드가 돌면 안 된다.
      // ToolRef에 mtime이 없어서 실행 순번을 쓴다. START마다 새로 로드되는 대신
      // 항상 최신 코드가 도는 쪽을 택했다 (설계문서 5.5의 트레이드오프).
      loaded = await loadToolForRun(tool.uri, `run${seq}`, tool.id);
    } catch (err) {
      this._fail(tool.id, ToolErrorPhase.LOAD, err);
      return;
    }

    if (seq !== this._runSeq) {
      return;   // 그 사이 새 START가 들어왔다
    }

    const session = new ToolSession(loaded, {
      filePath : this._filePath,
      log      : msg => console.log(`[${tool.id}] ${msg}`)
    });

    try {
      session.analyze(payload.rawLogs || []);
    } catch (err) {
      this._fail(tool.id, ToolErrorPhase.ANALYZE, err);
      return;
    }

    const mount = this._mount();
    mount.textContent = '';

    try {
      session.render(mount);
    } catch (err) {
      // 도구가 절반쯤 그리다 터졌을 수 있으므로 화면을 비우고 안내로 갈아끼운다.
      mount.textContent = '';
      this._fail(tool.id, ToolErrorPhase.RENDER, err);
      return;
    }

    this._session = session;
    this._setToolName(session.meta);
    this._setStatus('연결됨', 'connected');
  }

  _disposeSession() {
    if (!this._session) {
      return;
    }
    try {
      this._session.dispose();
    } catch (err) {
      console.error('[VisualizerApp] 도구 정리 실패:', err);
    }
    this._session = null;
  }

  // --- 실패 처리 ---

  _fail(toolId, phase, err) {
    const message = messageOf(err);
    console.error(`[VisualizerApp] 도구 실패 (${toolId} / ${phase}):`, err);

    this._setToolName(null);
    this._setStatus('실행 실패', 'error');
    this._renderError(phase, message);

    this._api.toolError({ toolId, message, phase });
  }

  _renderError(phase, message) {
    const labels = {
      [ToolErrorPhase.LOAD]    : '도구를 불러오지 못했습니다',
      [ToolErrorPhase.ANALYZE] : 'analyze() 실행 중 오류가 발생했습니다',
      [ToolErrorPhase.RENDER]  : 'render() 실행 중 오류가 발생했습니다'
    };

    const mount = this._mount();
    mount.textContent = '';

    const box = document.createElement('div');
    box.className = 'tool-error';

    const icon = document.createElement('div');
    icon.className = 'te-ico';
    icon.textContent = '⚠';

    const title = document.createElement('div');
    title.textContent = labels[phase] || '도구 실행에 실패했습니다';

    // 오류 메시지에 도구 코드 조각이 섞여 들어올 수 있으므로 textContent로 넣는다.
    const detail = document.createElement('div');
    detail.className = 'te-msg';
    detail.textContent = message;

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(detail);
    mount.appendChild(box);
  }

  // --- DOM ---

  _mount() {
    return document.getElementById('pluginRoot');
  }

  _setPath(filePath) {
    const el = document.getElementById('hdrPath');
    if (el && filePath) {
      el.textContent = filePath;
    }
  }

  /** 헤더의 도구명. 확장은 meta를 모르므로 여기서 채운다 (설계문서 9.2) */
  _setToolName(meta) {
    const el = document.getElementById('hdrTool');
    if (!el) {
      return;
    }
    el.textContent = meta ? `${meta.name} v${meta.version}` : '';
  }

  _setStatus(text, cls) {
    const el = document.getElementById('badge');
    if (!el) {
      return;
    }
    el.textContent = text;
    el.className = 'badge ' + (cls || 'waiting');
  }
}
