'use strict';

/**
 * VisualizerApp
 * - 전체 흐름 조율
 * - VS Code Webview postMessage 브릿지
 */
class VisualizerApp {
  constructor() {
    this._dataManager    = new DataManager();
    this._sidebarManager = new SidebarManager(k => this._onVarSelected(k));
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
      if (this._dataManager.currentVarKey)
        this._renderTimeline(this._dataManager.currentVarKey);
    }
    if (message.command === CommandTypes.LOG_FILE_LOADED) {
      const { filePath } = message.payload || {};
      const hdrPath = document.getElementById('hdrPath');
      if (hdrPath && filePath) hdrPath.textContent = filePath;
    }
  }

  /** 프론트 → 백엔드 발신 */
  sendMessageToBackend(message) {
    if (this._vscode) this._vscode.postMessage(message);
    else console.log('[OsciloScope → Backend]', message);
  }

  _onVarSelected(varKey) {
    this._dataManager.currentVarKey = varKey;
    this._renderTimeline(varKey);
    const found = this._dataManager.getVarByKey(varKey);
    this.sendMessageToBackend({
      command: CommandTypes.VARIABLE_CHANGED,
      payload: { varKey, varName: found ? found.varName : null }
    });
  }

  _renderTimeline(varKey) {
    const found = this._dataManager.getVarByKey(varKey);
    if (!found) { this._timelineViewer.clearTimeline(); return; }
    this._timelineViewer.renderHeader(found);
    this._timelineViewer.renderTimeline(found.history);
  }

  _setStatus(text, cls) {
    const el = document.getElementById('badge');
    el.textContent = text;
    el.className = 'badge ' + (cls || 'waiting');
  }
}
