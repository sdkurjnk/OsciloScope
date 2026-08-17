'use strict';

/**
 * LayoutWidget
 * - 좌측 목록 + 우측 본문의 2단 골격을 만든다 (설계문서 4.6)
 *
 * 도구가 host.widgets.layout(host.mount)로 호출한다.
 * 전달받은 el의 기존 내용을 비우고 골격을 새로 만들므로, 같은 el에 두 번 호출해도
 * 결과가 같다 (렌더 결정성 검사 9번 대응).
 *
 * 모든 위젯 마크업의 최상위에는 .osc-widget이 붙는다. 스타일이 이 클래스 하위로만
 * 적용되므로, 도구가 자기 DOM에 같은 클래스명을 써도 서로 섞이지 않는다.
 */
export function layout(el) {
  if (!el) {
    throw new Error('layout(el): 컨테이너 엘리먼트가 필요합니다.');
  }

  el.textContent = '';

  const root = document.createElement('div');
  root.className = 'osc-widget osc-layout';

  const left = document.createElement('div');
  left.className = 'osc-pane-left';

  const right = document.createElement('div');
  right.className = 'osc-pane-right';

  root.appendChild(left);
  root.appendChild(right);
  el.appendChild(root);

  return { left, right };
}
