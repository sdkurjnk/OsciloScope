'use strict';

/**
 * SourceSelector
 * - 사이드바 SOURCE 영역(로그 파일 선택) 배선
 * - 버튼 클릭 → SELECT_LOG_FILE 발신
 * - LOG_FILE_LOADED 수신 → 파일명/절대경로 표시
 * - 백엔드 브릿지는 VisualizerApp(window.osApp)을 재사용 (acquireVsCodeApi 중복 호출 방지)
 */
(function () {
  const srcRow  = document.getElementById('srcRow');
  const srcName = document.getElementById('srcName');
  const hdrPath = document.getElementById('hdrPath');
  const pickBtn = document.getElementById('pickBtn');
  if (!pickBtn) return;

  function setLogFile(fileName, filePath) {
    if (!filePath) return;
    srcRow.classList.add('set');
    srcName.textContent = fileName || filePath.split(/[\\/]/).pop();
    if (hdrPath) hdrPath.textContent = filePath;
  }

  // 외부(백엔드 수신 외)에서도 갱신 가능한 진입점 유지
  window.OsciloScopeSource = { setLogFile };

  // 버튼 클릭 → 백엔드에 파일 선택 다이얼로그 요청
  pickBtn.addEventListener('click', () => {
    if (window.osApp) {
      window.osApp.sendMessageToBackend({ command: CommandTypes.SELECT_LOG_FILE, payload: {} });
    } else {
      console.log('[SourceSelector] SELECT_LOG_FILE (브라우저 프리뷰)');
    }
  });

  // 백엔드 → 선택된 로그 파일 통지 수신
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || msg.command !== CommandTypes.LOG_FILE_LOADED) return;
    const { fileName, filePath } = msg.payload || {};
    setLogFile(fileName, filePath);
  });
})();
