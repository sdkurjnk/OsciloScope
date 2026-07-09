'use strict';

/**
 * VisualizerApp
 * - 전체 흐름 조율
 * - VS Code Webview postMessage 브릿지
 */
class VisualizerApp {
  constructor() {
    this._dataManager    = new DataManager();
    this._sidebarManager = new SidebarManager(v => this._onVarSelected(v));
    this._timelineViewer = new TimelineViewer();
    this._vscode = (typeof acquireVsCodeApi !== 'undefined') ? acquireVsCodeApi() : null;
  }

  init() {
    window.addEventListener('message', e => this.handleMessageFromBackend(e.data));
    this._setStatus('로드 중', 'loading');
    this.sendMessageToBackend({ command: CommandTypes.UI_READY, payload: {} });
  }

  /** 백엔드 → 프론트 수신 */
  handleMessageFromBackend(message) {
    if (!message || !message.command) return;
    if (message.command === CommandTypes.UPDATE_ALL_DATA) {
      this._dataManager.updateData(message.payload);
      this._sidebarManager.renderSidebar(this._dataManager.getGroupedData());
      this._setStatus('연결됨', 'connected');
      if (this._dataManager.currentVarName)
        this._renderTimeline(this._dataManager.currentVarName);
    }
  }

  /** 프론트 → 백엔드 발신 */
  sendMessageToBackend(message) {
    if (this._vscode) this._vscode.postMessage(message);
    else console.log('[VML → Backend]', message);
  }

  _onVarSelected(varName) {
    this._dataManager.currentVarName = varName;
    this._renderTimeline(varName);
    this.sendMessageToBackend({ command: CommandTypes.VARIABLE_CHANGED, payload: { varName } });
  }

  _renderTimeline(varName) {
    const found = this._dataManager.getTimelineByVar(varName);
    if (!found) { this._timelineViewer.clearTimeline(); return; }
    const scope = this._dataManager.getScopeByVar(varName);
    this._timelineViewer.renderHeader(varName, scope);
    this._timelineViewer.renderTimeline(found.history);
  }

  _setStatus(text, cls) {
    const el = document.getElementById('badge');
    el.textContent = text;
    el.className = 'badge ' + (cls || 'waiting');
  }
}
