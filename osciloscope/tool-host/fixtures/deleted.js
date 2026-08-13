'use strict';

// deleted 이벤트가 섞인 경우. 값 없음을 어떻게 다루는지 본다.
//
// deleted의 data는 신뢰할 수 없다(값 없음으로 취급). 기존 구현은 history에
// value: null로 저장했다. 마지막 이벤트가 deleted인 변수(tmp, cache)를 두어
// "현재 값"을 뽑는 도구가 삭제된 변수를 살아 있는 것처럼 보여주지 않는지 확인한다.
export default [
    { name: 'cache', data: {},   event: 'init',    domain: 'GLOBAL', line: 3,  func: '<module>', call_id: 1,  parent_call_id: null, call_depth: 1, var_id: 1 },
    { name: 'tmp',   data: 10,   event: 'init',    domain: 'LOCAL',  line: 21, func: 'compute',  call_id: 52, parent_call_id: 1,    call_depth: 2, var_id: 52 },
    { name: 'tmp',   data: 20,   event: 'updated', domain: 'LOCAL',  line: 23, func: 'compute',  call_id: 52, parent_call_id: 1,    call_depth: 2, var_id: 52 },
    { name: 'tmp',   data: null, event: 'deleted', domain: 'LOCAL',  line: 25, func: 'compute',  call_id: 52, parent_call_id: 1,    call_depth: 2, var_id: 52 },
    { name: 'keep',  data: 'x',  event: 'init',    domain: 'LOCAL',  line: 26, func: 'compute',  call_id: 52, parent_call_id: 1,    call_depth: 2, var_id: 52 },
    { name: 'cache', data: null, event: 'deleted', domain: 'GLOBAL', line: 40, func: '<module>', call_id: 1,  parent_call_id: null, call_depth: 1, var_id: 1 }
];
