'use strict';

/**
 * ToolLoader
 * - 도구 파일을 import하고 meta를 읽는다 (설계문서 5.4 ~ 5.6)
 *
 * 확장은 도구 코드를 실행할 수 없으므로 목록의 이름·버전은 웹뷰가 채운다.
 * 즉 "목록을 만드는 것"부터가 이미 도구 코드를 한 번 돌리는 일이다 —
 * 그래서 계약에 "모듈 최상위에서 부작용 금지"가 들어가 있다.
 */

import { shapeError } from './ToolHost.js';
import { messageOf } from '../js/util.js';

/**
 * 도구 모듈을 불러온다.
 *
 * ESM 모듈 캐시는 지울 수 없으므로 URL에 ?v=mtime을 붙여 다른 모듈로 만든다 (5.5).
 * mtime을 쓰면 파일이 바뀔 때만 새로 로드되므로, "저장하고 바로 START" 흐름이 된다.
 */
export async function importTool(uri, mtime) {
  const module = await import(/* @vite-ignore */ withVersion(uri, mtime));
  return module?.default;
}

/**
 * 캐시 무효화용 쿼리를 안전하게 붙인다.
 * asWebviewUri가 만든 URL에 이미 쿼리가 들어 있는 경우가 있어서, 무조건 '?'를 붙이면
 * 두 번째 '?'가 되어 로드에 실패한다.
 */
export function withVersion(uri, version) {
  if (version === undefined || version === null || version === '') {
    return uri;
  }
  const separator = String(uri).includes('?') ? '&' : '?';
  return `${uri}${separator}v=${encodeURIComponent(version)}`;
}

/**
 * 목록 표시용으로 도구 하나를 로드한다. **예외를 던지지 않는다.**
 *
 * 실패해도 목록에서 빼지 않고 error를 담아 돌려준다 (5.6). 사용자가 자기 도구에
 * 문법 오류를 냈을 때 목록에서 조용히 사라지면 원인을 찾을 수가 없기 때문이다.
 *
 * @param {{id, source, uri, mtime, overrides?, error?}} info  TOOLS_LIST의 항목
 * @returns {{id, source, uri, mtime, overrides?, name, version, description, ok, error?}}
 */
export async function loadToolInfo(info) {
  const base = {
    id          : info.id,
    source      : info.source,
    uri         : info.uri,
    mtime       : info.mtime,
    overrides   : info.overrides,
    name        : info.id,
    version     : '',
    description : '',
    ok          : false
  };

  // 확장 단계에서 이미 실패한 것(ID 형식 위반, 멀티루트 중복)은 import하지 않는다.
  if (info.error) {
    return { ...base, error: info.error };
  }

  let tool;
  try {
    tool = await importTool(info.uri, info.mtime);
  } catch (err) {
    return { ...base, error: `불러오지 못했습니다: ${messageOf(err)}` };
  }

  const problem = shapeError(tool, info.id);
  if (problem) {
    return { ...base, error: problem };
  }

  return {
    ...base,
    name        : tool.meta.name,
    version     : tool.meta.version,
    description : tool.meta.description ?? '',
    ok          : true
  };
}

/** 목록 전체를 병렬로 로드한다. 한 도구가 실패해도 나머지는 그대로 표시된다. */
export function loadToolInfos(infos) {
  return Promise.all((infos || []).map(loadToolInfo));
}

/**
 * 실행할 도구를 불러온다. 목록용과 달리 **실패하면 던진다** —
 * 호출자가 TOOL_ERROR(phase: 'load')로 처리해야 하기 때문이다.
 */
export async function loadToolForRun(uri, mtime, expectedId) {
  let tool;
  try {
    tool = await importTool(uri, mtime);
  } catch (err) {
    throw new Error(`도구를 불러오지 못했습니다: ${messageOf(err)}`);
  }

  const problem = shapeError(tool, expectedId);
  if (problem) {
    throw new Error(problem);
  }
  return tool;
}
