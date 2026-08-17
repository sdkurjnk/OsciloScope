'use strict';

// 구버전 로그. var_id와 call_id 계열이 모두 null이다.
//
// parseLogFile()이 undefined를 ?? null로 정규화하므로 도구는 null을 만난다.
// ctx.helpers.varKeyOf()를 쓰면 name 폴백으로 처리되지만, `${name}@${var_id}`를
// 직접 조립한 도구는 여기서 "total@null" 같은 키를 만들어 깨진다.
//
// count가 같은 이름으로 두 번 init되는 것은 의도된 것이다. 구버전 로그에는
// 프레임 정보가 없어 서로 다른 인스턴스를 구분할 방법이 아예 없다 —
// 이 경우 한 변수로 합쳐지는 것이 폴백 규칙상 맞는 동작이다.
export default [
    { name: 'total', data: 0,  event: 'init',    domain: 'GLOBAL', line: null, func: null, call_id: null, parent_call_id: null, call_depth: null, var_id: null },
    { name: 'total', data: 5,  event: 'updated', domain: 'GLOBAL', line: null, func: null, call_id: null, parent_call_id: null, call_depth: null, var_id: null },
    { name: 'count', data: 1,  event: 'init',    domain: 'LOCAL',  line: null, func: null, call_id: null, parent_call_id: null, call_depth: null, var_id: null },
    { name: 'count', data: 2,  event: 'updated', domain: 'LOCAL',  line: null, func: null, call_id: null, parent_call_id: null, call_depth: null, var_id: null },
    { name: 'count', data: 1,  event: 'init',    domain: 'LOCAL',  line: null, func: null, call_id: null, parent_call_id: null, call_depth: null, var_id: null }
];
