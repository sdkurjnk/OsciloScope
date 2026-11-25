import { TOOL_ID_PATTERN } from './types';

/**
 * 플러그인 패키지 계약 (BE) — plugin.json
 *
 * 플러그인 하나 = 전역 저장소의 폴더 하나다 (PLUGIN_REGISTRY_PLAN.md §3.1).
 *
 *   <globalStorageUri>/plugins/<id>/<version>/
 *   ├── plugin.json      ← 이 파일이 정의하는 실행 정보
 *   └── index.js         ← 진입 파일 (이름은 plugin.json의 entry)
 *
 * plugin.json은 "실행 정보"만 담는다. 다운로드 주소·해시 같은 배포 정보는 원격 레지스트리의
 * index.json 담당이며 여기에 넣지 않는다 (§2.2 — 두 파일은 합치지 않는다).
 *
 * Tool 쪽 계약(ToolHostApi · Tool)은 assets/templates/osciloscope-tool.d.ts에 있다.
 * 플러그인 작성자와 웹뷰(JS)가 함께 보는 파일이라 TS 소스가 아닌 전역 d.ts로 둔다.
 */

/** 플러그인 폴더 안의 실행 정보 파일명. */
export const PLUGIN_MANIFEST_FILE = 'plugin.json';

/**
 * 현재 ToolHost가 제공하는 Host API 버전 (semver).
 *
 * 버전 규칙 (§4 1단계):
 * - ToolHostApi에 함수·필드 추가      → 부 버전 올림 (1.0.0 → 1.1.0). 기존 플러그인은 그대로 동작
 * - 기존 함수 변경·삭제              → 주 버전 올림 (1.x → 2.0.0). 호환되지 않는 플러그인은 로드하지 않음
 *
 * 호환성 판정(plugin.json의 hostApi 범위 ↔ 이 값)은 BE에서 한다.
 * 이 값을 바꾸면 osciloscope-tool.d.ts 첫 줄 스탬프와 TOOL_TYPES_VERSION도 함께 맞춘다.
 */
export const HOST_API_VERSION = '1.0.0';

/** plugin.json의 version 형식. 설치 폴더 <version>과도 같아야 한다. */
export const PLUGIN_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * 플러그인 식별자 형식. 기존 도구 ID 규칙을 그대로 쓴다.
 * 설치 폴더명(plugins/<id>/)과 installed.json의 키로도 쓰이므로 파일 시스템에 안전해야 한다.
 */
export const PLUGIN_ID_PATTERN = TOOL_ID_PATTERN;

/**
 * plugin.json 스키마.
 *
 * 계획서 초안 대비 조정:
 * - 초안의 `name`(식별자)을 `id`(식별자)와 `name`(표시 이름)으로 나눴다.
 *   기존 도구는 meta.id가 식별자(소문자·숫자·하이픈), meta.name이 한글 표시명이었고,
 *   사이드바·헤더가 표시명을 그대로 쓰기 때문이다. (결정 사항 4)
 */
export interface PluginManifest {
    /** 식별자. PLUGIN_ID_PATTERN. 설치 폴더명 · installed.json 키 · Tool.metadata.id와 같아야 한다. */
    id          : string;
    /** 표시 이름. 사이드바 목록과 메인 패널 헤더에 쓰인다. 한글 가능. */
    name        : string;
    /** 플러그인 버전 (X.Y.Z). 설치 폴더 <version>과 같아야 한다. */
    version     : string;
    /** 설명. 사이드바 툴팁·부제에 쓰인다. 없으면 빈 문자열. */
    description : string;
    /** 진입 파일. 플러그인 폴더 기준 상대 경로이며 폴더 밖을 가리킬 수 없다. ES 모듈이어야 한다. */
    entry       : string;
    /** 지원하는 Host API 버전 범위 (예: "^1.0.0"). HOST_API_VERSION과 대조한다. */
    hostApi     : string;
}
