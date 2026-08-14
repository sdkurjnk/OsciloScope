'use strict';

/**
 * 사이드바 뷰 진입점
 *
 * 하는 일 (설계문서 5.4 ~ 5.7):
 * - 로그 파일 선택(SOURCE) / 렌더링 시작(START)
 * - 도구 목록 표시 — 확장은 파일 정보만 주므로, 이름·버전은 여기서 import해 채운다
 * - 도구 관리 액션: 만들기 / 복사 / 열기 / 검사
 *
 * 확장이 도구를 실행할 수 없어서 목록을 만드는 일조차 웹뷰 몫이다.
 * 그래서 이 파일이 tool-host의 로더를 함께 쓴다.
 */

import { CommandTypes } from '../../js/constants.js';
import { loadToolInfos } from '../../tool-host/ToolLoader.js';

// 도구를 import하기 전에 API를 잡고 전역에서 지운다 (설계문서 3.3).
const vscode = acquireVsCodeApi();
delete window.acquireVsCodeApi;

const el = {
  srcRow    : document.getElementById('srcRow'),
  srcName   : document.getElementById('srcName'),
  pickBtn   : document.getElementById('pickBtn'),
  startBtn  : document.getElementById('startBtn'),
  createBtn : document.getElementById('createBtn'),
  notice    : document.getElementById('toolNotice'),
  list      : document.getElementById('toolList')
};

const state = {
  hasLogFile : false,
  selectedId : null,
  tools      : [],          // loadToolInfos 결과
  checks     : new Map(),   // toolId → 'pass' | 'warn' | 'fail' | 'running'
  listSeq    : 0            // 늦게 끝난 이전 로드가 새 목록을 덮어쓰지 않도록
};

// --- 발신 ---

const send = (command, payload = {}) => vscode.postMessage({ command, payload });

el.pickBtn.addEventListener('click', () => send(CommandTypes.SELECT_LOG_FILE));
el.createBtn.addEventListener('click', () => send(CommandTypes.CREATE_TOOL));

// 선택 상태는 SELECT_TOOL로도 보내지만, START에도 실어 불일치를 없앤다 (설계문서 9.2)
el.startBtn.addEventListener('click', () => {
  send(CommandTypes.START_RENDER, { toolId: state.selectedId ?? undefined });
});

send(CommandTypes.GET_TOOLS_LIST);

// --- 수신 ---

window.addEventListener('message', event => {
  const { command, payload } = event.data || {};

  switch (command) {
    case CommandTypes.LOG_FILE_LOADED:
      onLogFileLoaded(payload);
      break;

    case CommandTypes.TOOLS_LIST:
      onToolsList(payload);
      break;

    case CommandTypes.TOOLS_CHANGED:
      // 파일 감시 알림. 목록을 직접 받지 않고 다시 요청한다.
      send(CommandTypes.GET_TOOLS_LIST);
      break;

    case CommandTypes.TOOL_CREATED:
      // 만들거나 복사한 도구를 바로 선택 상태로 둔다. 목록 자체는 감시가 갱신한다.
      state.selectedId = payload?.toolId ?? state.selectedId;
      state.checks.delete(payload?.toolId);
      break;

    case CommandTypes.VALIDATION_RESULT:
      onValidationResult(payload);
      break;

    case CommandTypes.TOOL_ERROR:
      onToolError(payload);
      break;
  }
});

function onLogFileLoaded(payload) {
  if (!payload || !payload.fileName) {
    return;
  }
  state.hasLogFile = true;
  el.srcName.textContent = payload.fileName;
  el.srcRow.classList.add('set');
  el.srcRow.title = payload.filePath || '';
  syncStart();
}

async function onToolsList(payload) {
  const seq = ++state.listSeq;
  const { tools = [], trusted = true, workspaceReady = true } = payload || {};

  // '만들기'는 워크스페이스가 있어야 가능하다 (설계문서 5.2)
  el.createBtn.disabled = !workspaceReady;
  showNotice(trusted, workspaceReady);

  // 각 도구를 import해서 meta를 채운다. 실패한 것도 목록에 남는다 (설계문서 5.6).
  const loaded = await loadToolInfos(tools);
  if (seq !== state.listSeq) {
    return;   // 그 사이 목록이 다시 왔다
  }

  state.tools = loaded;

  // 선택했던 도구가 사라졌거나 깨졌으면 선택을 푼다
  const current = loaded.find(tool => tool.id === state.selectedId);
  if (!current || !current.ok) {
    state.selectedId = null;
  }

  renderList();
  syncStart();
}

function onValidationResult(report) {
  if (!report || !report.toolId) {
    return;
  }
  const status = report.ok
    ? (report.checks?.some(check => check.status === 'warn') ? 'warn' : 'pass')
    : 'fail';
  state.checks.set(report.toolId, status);
  renderList();
}

function onToolError(payload) {
  if (!payload || !payload.toolId) {
    return;
  }
  state.checks.set(payload.toolId, 'fail');
  renderList();
}

// --- 렌더 ---

function showNotice(trusted, workspaceReady) {
  let message = '';
  if (!trusted) {
    message = '워크스페이스가 신뢰되지 않아 사용자 도구를 불러오지 않습니다. 신뢰를 부여하면 목록에 나타납니다.';
  } else if (!workspaceReady) {
    message = '폴더를 연 상태에서만 도구를 만들 수 있습니다.';
  }
  el.notice.textContent = message;
  el.notice.hidden = message === '';
}

function renderList() {
  el.list.textContent = '';

  if (state.tools.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tool-empty';
    empty.textContent = '표시할 도구가 없습니다';
    el.list.appendChild(empty);
    return;
  }

  for (const tool of state.tools) {
    el.list.appendChild(createRow(tool));
  }
}

function createRow(tool) {
  const broken = !tool.ok;

  const item = document.createElement('label');
  item.className = 'tool-item' + (broken ? ' broken' : '') +
                   (tool.id === state.selectedId ? ' selected' : '');

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'osc-tool';
  radio.checked = tool.id === state.selectedId;
  radio.disabled = broken;   // 깨진 도구는 선택할 수 없다 (설계문서 5.6)
  radio.addEventListener('change', () => selectTool(tool.id));
  item.appendChild(radio);

  const main = document.createElement('div');
  main.className = 'tool-main';

  const line = document.createElement('div');
  line.className = 'tool-line';

  const name = document.createElement('span');
  name.className = 'tn';
  name.textContent = tool.name || tool.id;   // 로드 실패면 파일명 id가 남는다
  line.appendChild(name);

  if (tool.version) {
    const version = document.createElement('span');
    version.className = 'tool-ver';
    version.textContent = 'v' + tool.version;
    line.appendChild(version);
  }
  if (tool.source === 'builtin') {
    line.appendChild(badge('기본', 'builtin'));
  }
  if (tool.overrides) {
    line.appendChild(badge('재정의', 'override'));
  }

  main.appendChild(line);

  // 설명 또는 오류 메시지. 도구가 준 문자열이라 textContent로 넣는다.
  const sub = broken ? tool.error : tool.description;
  if (sub) {
    const subEl = document.createElement('div');
    subEl.className = 'tool-sub' + (broken ? ' err' : '');
    subEl.textContent = sub;
    main.appendChild(subEl);
  }

  item.appendChild(main);
  item.appendChild(checkIcon(tool.id));
  item.appendChild(actions(tool, broken));

  item.title = broken ? tool.error : (tool.description || tool.id);
  return item;
}

/** 검사 결과 아이콘. 상세 리포트는 확장이 출력 채널에 띄운다 (설계문서 7.5) */
function checkIcon(toolId) {
  const status = state.checks.get(toolId);
  const icon = document.createElement('span');
  icon.className = 'tool-check' + (status ? ' ' + status : '');
  icon.textContent = { pass: '✓', warn: '!', fail: '✕', running: '…' }[status] ?? '';
  if (status) {
    icon.title = {
      pass: '검사 통과', warn: '경고 있음', fail: '검사 실패', running: '검사 중'
    }[status];
  }
  return icon;
}

function actions(tool, broken) {
  const wrap = document.createElement('span');
  wrap.className = 'tool-acts';

  // 깨진 도구도 열 수는 있어야 한다 — 원인을 봐야 고친다
  wrap.appendChild(actButton('✎', '파일 열기', () => send(CommandTypes.OPEN_TOOL, { toolId: tool.id })));

  if (tool.source === 'builtin') {
    // 번들 도구는 직접 못 고치므로 워크스페이스로 복사해서 쓴다 (설계문서 5.7)
    wrap.appendChild(actButton('⧉', '워크스페이스로 복사', () => send(CommandTypes.COPY_TOOL, { toolId: tool.id })));
  }

  if (!broken) {
    wrap.appendChild(actButton('✓', '유효성 검사', () => {
      state.checks.set(tool.id, 'running');
      renderList();
      send(CommandTypes.VALIDATE_TOOL, { toolId: tool.id });
    }));
  }

  return wrap;
}

function actButton(text, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'act-btn';
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', event => {
    // 행 전체가 <label>이라 막지 않으면 라디오까지 눌린다
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function badge(text, cls) {
  const span = document.createElement('span');
  span.className = 'tool-badge ' + cls;
  span.textContent = text;
  return span;
}

// --- 상태 ---

function selectTool(toolId) {
  state.selectedId = toolId;
  send(CommandTypes.SELECT_TOOL, { toolId });
  renderList();
}

/** 도구는 안 골라도 기본 도구로 떨어지므로, START는 로그 파일만 있으면 열어 준다 */
function syncStart() {
  el.startBtn.disabled = !state.hasLogFile;
}
