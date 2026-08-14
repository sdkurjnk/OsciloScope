'use strict';

/**
 * VarListWidget
 * - 그룹별 변수 목록을 그린다 (기존 SidebarManager.js 이관)
 *
 * 기존 대비 바뀐 점 (설계문서 3.4 / 4.6):
 * 1. 컨테이너를 주입받는다 — document.getElementById('sbList')에 의존하지 않는다.
 *    도구가 layout()의 left를 넘기든 자기 div를 넘기든 동작해야 하기 때문.
 * 2. innerHTML 템플릿 리터럴을 전부 제거했다. 변수명·타입은 로그에서 온 값이라
 *    <img src=x onerror=...> 같은 문자열이 섞일 수 있었다. 전부 textContent로 넣는다.
 * 3. setActive(varKey)를 핸들로 돌려준다. 도구가 코드로 선택 상태를 옮길 수 있다.
 */

/** 그룹 접힘 상태는 DOM 클래스로만 관리한다 (모듈 전역 상태 금지 — 렌더 결정성) */
export function varList(el, groups, opts) {
  if (!el) {
    throw new Error('varList(el, groups): 컨테이너 엘리먼트가 필요합니다.');
  }

  const onSelect = opts && typeof opts.onSelect === 'function' ? opts.onSelect : null;
  const itemsByKey = new Map();
  let activeEl = null;

  el.textContent = '';

  const root = document.createElement('div');
  root.className = 'osc-widget osc-varlist';

  const entries = groups ? Object.entries(groups) : [];

  if (entries.length === 0) {
    // 빈 입력(empty 픽스처)에서 예외 없이 빈 화면을 내야 한다 (검사 4·8번)
    const empty = document.createElement('div');
    empty.className = 'osc-list-empty';
    empty.textContent = '데이터 없음';
    root.appendChild(empty);
    el.appendChild(root);
    return { setActive() {} };
  }

  for (const [groupName, vars] of entries) {
    root.appendChild(createGroup(groupName, vars || []));
  }

  el.appendChild(root);

  return {
    setActive(varKey) {
      const target = itemsByKey.get(varKey);
      if (target) {
        markActive(target);
      }
    }
  };

  function createGroup(groupName, vars) {
    const group = document.createElement('div');
    group.className = 'sg';

    const label = document.createElement('div');
    label.className = 'sg-lbl';

    const chev = document.createElement('span');
    chev.className = 'chev';
    chev.textContent = '▶';

    const name = document.createElement('span');
    name.className = 'sg-name';
    name.textContent = groupName;

    const count = document.createElement('span');
    count.className = 'sg-cnt';
    count.textContent = String(vars.length);

    label.appendChild(chev);
    label.appendChild(name);
    label.appendChild(count);
    label.addEventListener('click', () => group.classList.toggle('collapsed'));

    const list = document.createElement('div');
    list.className = 'vl';
    for (const entry of vars) {
      list.appendChild(createItem(entry));
    }

    group.appendChild(label);
    group.appendChild(list);
    return group;
  }

  function createItem(entry) {
    const item = document.createElement('div');
    item.className = 'vi';

    const type = document.createElement('span');
    type.className = 'vt';
    type.textContent = entry.type || '?';

    const name = document.createElement('span');
    name.className = 'vn';
    name.textContent = String(entry.varName ?? '');

    item.appendChild(type);
    item.appendChild(name);

    // Local 변수는 호출 인스턴스별로 분리되므로 #call_id 칩으로 구분한다 (재귀 대응)
    if (entry.scope !== 'Global' && entry.callId !== null && entry.callId !== undefined) {
      const chip = document.createElement('span');
      chip.className = 'vc';
      chip.textContent = '#' + entry.callId;
      item.appendChild(chip);
    }

    if (entry.varKey !== undefined && entry.varKey !== null) {
      itemsByKey.set(entry.varKey, item);
    }

    item.addEventListener('click', () => {
      markActive(item);
      if (onSelect) {
        onSelect(entry.varKey);
      }
    });

    return item;
  }

  function markActive(item) {
    if (activeEl) {
      activeEl.classList.remove('active');
    }
    activeEl = item;
    item.classList.add('active');
  }
}
