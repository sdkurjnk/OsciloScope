'use strict';

// 이름이 같고 소유 프레임이 다른 변수들. 변수 정체성 키잉을 제대로 하는지 본다.
//
// 대응하는 파이썬:
//   def fact(n):      # n=3 → call_id 10, n=2 → 11, n=1 → 12
//       acc = 1
//       if n > 1: acc = n * fact(n - 1)
//       return acc
//
// name만으로 키를 만들면 세 프레임의 acc가 한 변수로 뭉개진다.
// varKeyOf()를 쓰면 acc@10 / acc@11 / acc@12로 나뉜다.
//
// 마지막 두 줄은 소유 프레임과 수정 프레임이 다른 경우다. var_id는 10인데
// call_id는 11이다 — 자식 프레임이 부모의 변수를 고친 상황으로, call_id로
// 키를 만들면 여기서 잘못 갈라진다.
export default [
    { name: 'n',   data: 3, event: 'init',    domain: 'LOCAL', line: 5, func: 'fact', call_id: 10, parent_call_id: 1,  call_depth: 2, var_id: 10 },
    { name: 'acc', data: 1, event: 'init',    domain: 'LOCAL', line: 6, func: 'fact', call_id: 10, parent_call_id: 1,  call_depth: 2, var_id: 10 },
    { name: 'n',   data: 2, event: 'init',    domain: 'LOCAL', line: 5, func: 'fact', call_id: 11, parent_call_id: 10, call_depth: 3, var_id: 11 },
    { name: 'acc', data: 1, event: 'init',    domain: 'LOCAL', line: 6, func: 'fact', call_id: 11, parent_call_id: 10, call_depth: 3, var_id: 11 },
    { name: 'n',   data: 1, event: 'init',    domain: 'LOCAL', line: 5, func: 'fact', call_id: 12, parent_call_id: 11, call_depth: 4, var_id: 12 },
    { name: 'acc', data: 1, event: 'init',    domain: 'LOCAL', line: 6, func: 'fact', call_id: 12, parent_call_id: 11, call_depth: 4, var_id: 12 },
    { name: 'acc', data: 2, event: 'updated', domain: 'LOCAL', line: 7, func: 'fact', call_id: 11, parent_call_id: 10, call_depth: 3, var_id: 11 },
    { name: 'acc', data: 6, event: 'updated', domain: 'LOCAL', line: 7, func: 'fact', call_id: 11, parent_call_id: 10, call_depth: 3, var_id: 10 }
];
