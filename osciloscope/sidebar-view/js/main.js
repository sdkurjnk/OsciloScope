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

import { createApiTable, CommandTypes } from '../../js/ApiTable.js';
import { loadToolInfos } from '../../tool-host/ToolLoader.js';

// 도구를 import하기 전에 API를 잡고 전역에서 지운다 (설계문서 3.3).
const vscode = acquireVsCodeApi();
delete window.acquireVsCodeApi;

// 확장과의 통신은 전부 이 테이블을 거친다 (FE-API Table).
const api = createApiTable(vscode);

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

el.pickBtn.addEventListener('click', () => api.selectLogFile());
el.createBtn.addEventListener('click', () => api.createTool());

// 선택 상태는 selectTool로도 보내지만, START에도 실어 불일치를 없앤다 (설계문서 9.2)
el.startBtn.addEventListener('click', () => {
  api.startRender(state.selectedId ?? undefined);
});

api.getToolsList();

// --- 수신 라우팅 ---

api.route({
  [CommandTypes.LOG_FILE_LOADED]: onLogFileLoaded,
  [CommandTypes.TOOLS_LIST]:      onToolsList,

  // 파일 감시 알림. 목록을 직접 받지 않고 다시 요청한다.
  [CommandTypes.TOOLS_CHANGED]:   () => api.getToolsList(),

  // 만들거나 복사한 도구를 바로 선택 상태로 둔다. 목록 자체는 감시가 갱신한다.
  [CommandTypes.TOOL_CREATED]: payload => {
    state.selectedId = payload?.toolId ?? state.selectedId;
    state.checks.delete(payload?.toolId);
  },

  [CommandTypes.VALIDATION_RESULT]: onValidationResult,
  [CommandTypes.TOOL_ERROR]:        onToolError
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

  // 이미 선택해 둔 도구가 재검사에서 fail이 되면 선택을 푼다
  if (status === 'fail' && state.selectedId === report.toolId) {
    state.selectedId = null;
    api.selectTool(undefined);
  }

  renderList();
  syncStart();
}

function onToolError(payload) {
  if (!payload || !payload.toolId) {
    return;
  }
  state.checks.set(payload.toolId, 'fail');

  if (state.selectedId === payload.toolId) {
    state.selectedId = null;
    api.selectTool(undefined);
  }

  renderList();
  syncStart();
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
  const failed = isFailed(tool.id);
  // 검사에서 fail이 난 도구는 깨진 도구와 같이 취급한다. 검사가 결과 아이콘만 그리고
  // 실행을 막지 않으면, fail을 보고도 그대로 렌더할 수 있어 검사를 신뢰할 수 없게 된다.
  const blocked = broken || failed;

  const item = document.createElement('label');
  item.className = 'tool-item' + (blocked ? ' broken' : '') +
                   (tool.id === state.selectedId ? ' selected' : '');

  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'osc-tool';
  radio.checked = tool.id === state.selectedId;
  radio.disabled = blocked;   // 깨진 도구·검사 실패 도구는 선택할 수 없다 (설계문서 5.6)
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
  const reason = broken ? tool.error
               : failed ? '유효성 검사에 실패해 실행할 수 없습니다. 고친 뒤 다시 검사하세요.'
               : null;
  const sub = reason ?? tool.description;
  if (sub) {
    const subEl = document.createElement('div');
    subEl.className = 'tool-sub' + (blocked ? ' err' : '');
    subEl.textContent = sub;
    main.appendChild(subEl);
  }

  item.appendChild(main);
  item.appendChild(checkIcon(tool.id));
  item.appendChild(actions(tool, broken));

  item.title = reason ?? (tool.description || tool.id);
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
  wrap.appendChild(actButton('✎', '파일 열기', () => api.openTool(tool.id)));

  if (tool.source === 'builtin') {
    // 번들 도구는 직접 못 고치므로 워크스페이스로 복사해서 쓴다 (설계문서 5.7)
    wrap.appendChild(actButton('⧉', '워크스페이스로 복사', () => api.copyTool(tool.id)));
  }

  if (!broken) {
    wrap.appendChild(actButton('✓', '유효성 검사', () => {
      state.checks.set(tool.id, 'running');
      renderList();
      api.validateTool(tool.id);
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

function isFailed(toolId) {
  return state.checks.get(toolId) === 'fail';
}

function selectTool(toolId) {
  if (isFailed(toolId)) {
    renderList();   // 라디오가 눌린 것처럼 보이는 상태를 되돌린다
    return;
  }
  state.selectedId = toolId;
  api.selectTool(toolId);
  renderList();
  syncStart();
}

/**
 * START 조건: 로그 파일이 있고, 선택한 도구가 검사에서 fail이 아닐 것.
 *
 * 도구를 안 골랐으면 확장이 기본 도구로 떨어뜨리므로 그대로 열어 준다.
 * 미검사(아이콘 없음) 상태까지 막지 않는 이유는 검사 결과가 세션 메모리에만 있어서다 —
 * 사이드바를 접었다 펴면 전부 미검사로 돌아가 START가 잠긴다. 확장 쪽에 mtime과 함께
 * 결과를 영속화한 뒤에 게이트를 넓히는 것이 맞다.
 */
function syncStart() {
  const selectedFailed = state.selectedId !== null && isFailed(state.selectedId);
  el.startBtn.disabled = !state.hasLogFile || selectedFailed;
}
