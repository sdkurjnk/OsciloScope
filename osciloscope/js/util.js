'use strict';

/**
 * 프론트 공용 유틸.
 */

/** Error 객체(또는 아무 값)에서 사람이 읽을 메시지를 뽑는다. */
export function messageOf(err) {
  return err?.message ?? String(err);
}
