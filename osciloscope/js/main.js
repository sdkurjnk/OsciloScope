'use strict';

/**
 * main.js
 * - 앱 진입점
 */
const app = new VisualizerApp();
app.init();

// SOURCE(SourceSelector) 등 보조 모듈이 백엔드 브릿지를 재사용하도록 노출.
// acquireVsCodeApi는 VisualizerApp이 단일 호출하므로 중복 호출을 피하기 위함.
window.osApp = app;
