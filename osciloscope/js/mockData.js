'use strict';

/**
 * mockData
 * - 개발/브라우저 환경 전용 목업 데이터 주입 (VS Code 환경에서는 자동 스킵)
 * - 신규 스키마: 그룹 = 스코프 단위(Global/Local), varKey + 변수 단위 메타 포함
 * - 재귀로 같은 이름 변수 r 이 call_id 별 인스턴스로 분리되는 케이스 포함
 */
(function injectMockData() {
  if (typeof acquireVsCodeApi !== 'undefined') return;

  setTimeout(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        command: 'UPDATE_ALL_DATA',
        payload: {
          'Global': [
            { varKey: 'total', varName: 'total', type: 'number', scope: 'Global',
              func: '<module>', callId: 1, parentCallId: null, callDepth: 1, group: 'Global',
              history: [
                { step: 1, line: 5,  value: 0,   event: 'init' },
                { step: 2, line: 20, value: 7,   event: 'updated' },
                { step: 3, line: 33, value: 107, event: 'updated' },
              ] },
          ],
          'Local': [
            { varKey: 'acc@2', varName: 'acc', type: 'number', scope: 'Local',
              func: 'process', callId: 2, parentCallId: 1, callDepth: 2, group: 'Local',
              history: [
                { step: 1, line: 17, value: 0, event: 'init' },
                { step: 2, line: 18, value: 1, event: 'updated' },
                { step: 3, line: 18, value: 4, event: 'updated' },
                { step: 4, line: 18, value: 7, event: 'updated' },
              ] },
            { varKey: 'y@22', varName: 'y', type: 'number', scope: 'Local',
              func: 'helper', callId: 22, parentCallId: 2, callDepth: 3, group: 'Local',
              history: [
                { step: 1, line: 10, value: 0, event: 'init' },
                { step: 2, line: 12, value: 1, event: 'updated' },
              ] },
            { varKey: 'y@42', varName: 'y', type: 'number', scope: 'Local',
              func: 'helper', callId: 42, parentCallId: 2, callDepth: 3, group: 'Local',
              history: [
                { step: 1, line: 10, value: 2, event: 'init' },
                { step: 2, line: 12, value: 3, event: 'updated' },
              ] },
            { varKey: 'r@162', varName: 'r', type: 'number', scope: 'Local',
              func: 'fib', callId: 162, parentCallId: 1, callDepth: 2, group: 'Local',
              history: [
                { step: 1, line: 25, value: 4, event: 'init' },
                { step: 2, line: 29, value: 3, event: 'updated' },
              ] },
            { varKey: 'r@182', varName: 'r', type: 'number', scope: 'Local',
              func: 'fib', callId: 182, parentCallId: 162, callDepth: 3, group: 'Local',
              history: [
                { step: 1, line: 25, value: 3,    event: 'init' },
                { step: 2, line: 29, value: 2,    event: 'updated' },
                { step: 3, line: 30, value: null, event: 'deleted' },
              ] },
          ],
        }
      }
    }));
  }, 400);
})();
