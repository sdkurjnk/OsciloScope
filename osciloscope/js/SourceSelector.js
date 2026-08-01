'use strict';

/**
 * SourceSelector
 * - 사이드바 SOURCE 영역(로그 파일 선택)의 화면 전용 핸들러
 * - 실제 파일 다이얼로그(showOpenDialog)와 경로 수신은 백엔드 연동 시 구현 (follow-up)
 * - VisualizerApp 이 acquireVsCodeApi() 를 이미 단일 호출하므로 여기선 재호출하지 않는다
 *   (중복 호출은 예외 발생). 백엔드 배선은 VisualizerApp 브릿지를 통해 붙일 예정.
 */
(function () {
  const srcRow  = document.getElementById('srcRow');
  const srcName = document.getElementById('srcName');
  const hdrPath = document.getElementById('hdrPath');
  const pickBtn = document.getElementById('pickBtn');
  if (!pickBtn) return;

  // 백엔드가 절대경로를 넘겨주면 화면을 갱신하는 진입점
  window.OsciloScopeSource = {
    setLogPath(absolutePath) {
      if (!absolutePath) return;
      const base = absolutePath.split(/[\\/]/).pop();
      srcRow.classList.add('set');
      srcName.textContent = base;
      hdrPath.textContent = absolutePath;
    }
  };

  pickBtn.addEventListener('click', () => {
    // TODO(backend): 여기서 로그 파일 선택 요청을 백엔드로 전달
    //   → 백엔드 showOpenDialog(.jsonl, 절대경로) 결과를
    //     window.OsciloScopeSource.setLogPath(path) 로 회신
    console.log('[SourceSelector] 로그 파일 선택 요청 (백엔드 연동 예정)');
  });
})();
