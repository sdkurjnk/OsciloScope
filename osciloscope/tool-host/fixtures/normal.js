'use strict';

// 기본 동작 확인용. Global/Local이 섞여 있고 init + updated만 나온다.
//
// 대응하는 파이썬:
//   total = 0            # <module>, GLOBAL
//   def process(items):  # call_id 47, depth 2
//       acc = 0
//       for it in items: acc += it
//       return acc
//   total = process([1, 2, 3])
export default [
    { name: 'total', data: 0,   event: 'init',    domain: 'GLOBAL', line: 1,  func: '<module>', call_id: 1,  parent_call_id: null, call_depth: 1, var_id: 1 },
    { name: 'acc',   data: 0,   event: 'init',    domain: 'LOCAL',  line: 12, func: 'process',  call_id: 47, parent_call_id: 1,    call_depth: 2, var_id: 47 },
    { name: 'acc',   data: 1,   event: 'updated', domain: 'LOCAL',  line: 14, func: 'process',  call_id: 47, parent_call_id: 1,    call_depth: 2, var_id: 47 },
    { name: 'acc',   data: 3,   event: 'updated', domain: 'LOCAL',  line: 14, func: 'process',  call_id: 47, parent_call_id: 1,    call_depth: 2, var_id: 47 },
    { name: 'acc',   data: 6,   event: 'updated', domain: 'LOCAL',  line: 14, func: 'process',  call_id: 47, parent_call_id: 1,    call_depth: 2, var_id: 47 },
    { name: 'total', data: 6,   event: 'updated', domain: 'GLOBAL', line: 30, func: '<module>', call_id: 1,  parent_call_id: null, call_depth: 1, var_id: 1 },
    { name: 'label', data: 'ok', event: 'init',   domain: 'GLOBAL', line: 31, func: '<module>', call_id: 1,  parent_call_id: null, call_depth: 1, var_id: 1 }
];
