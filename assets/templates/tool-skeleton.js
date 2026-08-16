/// <reference path="./osciloscope-tool.d.ts" />

/** @type {OsciloScopeTool} */
export default {
  meta: {
    id: '{{TOOL_ID}}',
    name: '{{TOOL_ID}}',        // 사이드바 표시명 — 한글 가능, 자유롭게 수정하세요
    version: '1.0.0',
    description: ''
  },

  /**
   * 1단계 — 계산. 로그를 분석해 그리기에 필요한 자료를 만듭니다.
   * 반환값의 형식은 자유입니다. render()가 받을 뿐 시스템은 들여다보지 않습니다.
   *
   * @param {RawLog[]} rawLogs  oscilo가 남긴 이벤트 배열 (수정하지 마세요)
   * @param {ToolContext} ctx   { filePath, log, helpers }
   */
  analyze(rawLogs, ctx) {
    const groups = {};   // 그룹명 → 항목 배열
    const index  = {};   // varKey → 항목 (render에서 빠르게 찾기 위해)

    for (const log of rawLogs) {
      const varKey = ctx.helpers.varKeyOf(log);   // "name@var_id"
      const group  = ctx.helpers.groupOf(log);    // 'Global' | 'Local'

      if (!index[varKey]) {
        index[varKey] = {
          varKey,
          varName : log.name,
          type    : typeof log.data,
          scope   : group,
          history : []
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

    return { groups, index };
  },

  /**
   * 2단계 — 표현. host.mount 안에 화면을 그립니다.
   * mount 밖의 DOM은 건드리지 마세요(검사에서 실패합니다).
   *
   * @param {any} model      analyze()가 반환한 값
   * @param {ToolHost} host  { mount, filePath, theme, log, helpers, widgets }
   */
  render(model, host) {
    // 표준 위젯으로 기본 화면을 그립니다. 직접 그리려면 이 아래를 지우고
    // host.mount에 원하는 DOM을 만들면 됩니다.
    const { left, right } = host.widgets.layout(host.mount);
    host.widgets.varList(left, model.groups, {
      onSelect: key => host.widgets.timeline(right, model.index[key])
    });

    // TODO: 여기부터 자유롭게 바꿔 보세요.
    // 완성된 예시는 기본 도구를 참고하세요: change-detector / monotonic
  },

  /** 타이머나 전역 리스너를 썼다면 여기서 정리하세요. 안 썼으면 비워 두면 됩니다. */
  dispose() {}
};
