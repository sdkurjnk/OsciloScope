'use strict';

/**
 * mockData
 * - 개발/브라우저 환경 전용 목업 데이터 주입
 * - VS Code 환경(acquireVsCodeApi 존재)에서는 자동 스킵
 */
(function injectMockData() {
  if (typeof acquireVsCodeApi !== 'undefined') return;

  setTimeout(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        command: 'UPDATE_ALL_DATA',
        payload: {
          'Global': [
            { varName: 'x',    type: 'int',  history: [{ line: 1, value: 10 }, { line: 4, value: 20 }, { line: 8, value: 20 }] },
            { varName: 'data', type: 'dict', history: [{ line: 2, value: '{"a":1,"b":2}' }, { line: 6, value: '{"a":1,"b":2,"c":3}' }] },
          ],
          'func1': [
            { varName: 'result', type: 'float', history: [{ line: 3, value: 0.0 }, { line: 7, value: 0.0 }, { line: 9, value: 3.14 }, { line: 12, value: 3.14 }, { line: 15, value: 6.28 }, { line: 21, value: 9.42 }] },
            { varName: 'items',  type: 'list',  history: [{ line: 5, value: '[]' }, { line: 8, value: '[1]' }, { line: 11, value: '[1,2]' }] },
          ],
          'func2': [
            { varName: 'n', type: 'int', history: [{ line: 2, value: 5 }] },
          ]
        }
      }
    }));
  }, 400);
})();
