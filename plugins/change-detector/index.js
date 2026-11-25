/// <reference path="./osciloscope-tool.d.ts" />

/**
 * change-detector — 변수 변화 감지 (기본 도구)
 *
 * v0.1.2까지 LogParser.transformData()가 하던 일을 그대로 옮긴 것이다.
 * 도구를 고르지 않았을 때 실행되는 기본값이기도 하다 (설계문서 8장).
 *
 * 표준 위젯을 그대로 쓰는 쪽의 참고 구현이다. 반대편 예시는 monotonic을 보라.
 *
 * @type {OsciloScopeTool}
 */
export default {
  meta: {
    id: 'change-detector',
    name: '변수 변화 감지',
    version: '1.0.0',
    description: '모든 변수의 값 변화를 스코프별로 묶어 타임라인으로 보여줍니다.'
  },

  /**
   * 모든 변수를 var_id로 키잉하고 domain으로 Global/Local 그룹핑한 뒤,
   * 전체 이벤트를 시간순 history로 쌓는다.
   *
   * @param {RawLog[]} rawLogs
   * @param {ToolContext} ctx
   */
  analyze(rawLogs, ctx) {
    const groups = {};   // 'Global' | 'Local' → VarEntry[]
    const index  = {};   // varKey → VarEntry

    for (const log of rawLogs) {
      const varKey = ctx.helpers.varKeyOf(log);
      const group  = ctx.helpers.groupOf(log);

      if (!index[varKey]) {
        // 변수 단위 메타는 첫 등장 때 한 번만 잡는다. history 행마다 반복하지 않는다.
        index[varKey] = {
          varKey,
          varName      : log.name,
          type         : typeof log.data,
          scope        : group,
          func         : log.func,
          callId       : log.call_id,
          parentCallId : log.parent_call_id,
          callDepth    : log.call_depth,
          history      : []
        };
        (groups[group] = groups[group] || []).push(index[varKey]);
      }

      index[varKey].history.push({
        step  : index[varKey].history.length + 1,
        line  : log.line,
        value : log.event === 'deleted' ? null : log.data,
        event : log.event
      });
    }

    // Global을 항상 위에 둔다. 객체 키 순서는 첫 로그가 무엇이냐에 따라 달라지는데,
    // 그러면 같은 파일도 로그 순서에 따라 목록 순서가 뒤집혀 보인다.
    const ordered = {};
    if (groups.Global) { ordered.Global = groups.Global; }
    if (groups.Local)  { ordered.Local  = groups.Local; }

    return { groups: ordered, index };
  },

  /**
   * 표준 위젯 재사용 — layout으로 2단을 만들고, 왼쪽에 변수 목록, 오른쪽에 타임라인.
   *
   * @param {any} model
   * @param {ToolHost} host
   */
  render(model, host) {
    const { left, right } = host.widgets.layout(host.mount);

    const list = host.widgets.varList(left, model.groups, {
      onSelect: key => host.widgets.timeline(right, model.index[key])
    });

    // 첫 변수를 미리 열어 둔다. 빈 화면부터 보여주면 한 번 더 클릭해야 뭔가 나온다.
    // 목록 순서에 의존하므로 analyze에서 그룹 순서를 고정해 둔 것과 짝이다.
    const first = firstEntry(model.groups);
    if (first) {
      list.setActive(first.varKey);
      host.widgets.timeline(right, first);
    } else {
      host.widgets.timeline(right, null);
    }
  },

  /** 타이머·전역 리스너를 쓰지 않으므로 비워 둔다. mount 정리는 시스템 몫이다. */
  dispose() {}
};

/** 그룹 순서를 따라 첫 번째 변수를 찾는다. 빈 입력이면 null. */
function firstEntry(groups) {
  for (const vars of Object.values(groups)) {
    if (vars && vars.length > 0) {
      return vars[0];
    }
  }
  return null;
}
