(function () {
  const vscode = acquireVsCodeApi();

  const srcRow = document.getElementById('srcRow');
  const srcName = document.getElementById('srcName');
  const pickBtn = document.getElementById('pickBtn');
  const toolList = document.getElementById('toolList');
  const toolEmpty = document.getElementById('toolEmpty');

  // SOURCE: 파일 선택 요청 (OsciloScopeMessage.ts의 CommandTypes.SELECT_LOG_FILE)
  pickBtn.addEventListener('click', () => {
    vscode.postMessage({ command: 'SELECT_LOG_FILE', payload: {} });
  });

  // TOOLS: 사이드바 로드 시 목록 요청 (CommandTypes.GET_TOOLS_LIST)
  vscode.postMessage({ command: 'GET_TOOLS_LIST', payload: {} });

  window.addEventListener('message', (event) => {
    const { command, payload } = event.data;

    if (command === 'LOG_FILE_LOADED') {
      // payload: { fileName, filePath }
      srcName.textContent = payload.fileName;
      srcRow.classList.add('set');
    }

    if (command === 'TOOLS_LIST') {
      // payload: { tools: string[] }
      renderTools(payload.tools || []);
    }
  });

  function renderTools(tools) {
    toolList.innerHTML = '';
    if (!tools.length) {
      toolEmpty.textContent = '표시할 도구가 없습니다';
      toolList.appendChild(toolEmpty);
      return;
    }
    tools.forEach((tool) => {
      const item = document.createElement('label');
      item.className = 'tool-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';

      const name = document.createElement('span');
      name.className = 'tn';
      name.textContent = tool;

      item.appendChild(checkbox);
      item.appendChild(name);
      toolList.appendChild(item);
    });
  }
})();
