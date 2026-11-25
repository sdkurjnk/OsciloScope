import * as path from 'path';
import * as semver from 'semver';
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
 * 호환성 판정(plugin.json의 hostApi 범위 ↔ 이 값)은 BE에서 한다 (isHostApiCompatible).
 * 웹뷰용 미러는 scripts/gen-constants.mjs가 osciloscope/js/constants.js로 생성한다.
 * 이 값을 바꾸면 osciloscope-tool.d.ts 첫 줄 스탬프도 함께 맞춘다.
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

// ===== 전역 저장소 레이아웃 (§3.1) =====

/** <globalStorageUri>/plugins/<id>/<version>/ */
export const PLUGINS_DIR = 'plugins';

/** <globalStorageUri>/installed.json */
export const INSTALLED_FILE = 'installed.json';

/**
 * 확장에 함께 배포되는 기본 도구 위치: <extensionUri>/plugins/<id>/{plugin.json, 진입 파일}.
 * 실행은 여기서 하지 않는다. 시드 때 전역 저장소로 복사한 뒤 같은 로드 경로를 탄다.
 */
export const BUNDLED_PLUGINS_DIR = 'plugins';

/** installed.json의 항목 하나. */
export interface InstalledEntry {
    /** 사용 중인 버전. plugins/<id>/<version>/ 폴더를 가리킨다. */
    version : string;
    /** false면 목록에 올리지 않고 로드하지 않는다. */
    enabled : boolean;
}

/** installed.json 전체: 플러그인 id → 설치 정보. */
export type InstalledPlugins = Record<string, InstalledEntry>;

// ===== 검증 =====

export type ManifestResult =
    | { manifest: PluginManifest; error?: undefined }
    | { manifest?: undefined; error: string };

/**
 * plugin.json 내용을 검증한다. 예외를 던지지 않고 사유를 돌려준다
 * (실패한 플러그인도 목록에 남겨 원인을 보여주기 위해).
 *
 * @param raw       JSON.parse 결과
 * @param expected  설치 위치에서 알 수 있는 값 (installed.json의 키·버전). 다르면 실패.
 */
export function validateManifest(
    raw: unknown,
    expected: { id: string; version: string }
): ManifestResult {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { error: 'plugin.json이 객체가 아닙니다.' };
    }
    const m = raw as Record<string, unknown>;

    for (const field of ['id', 'name', 'version', 'entry', 'hostApi'] as const) {
        if (typeof m[field] !== 'string' || m[field] === '') {
            return { error: `plugin.json의 ${field}가 없거나 문자열이 아닙니다.` };
        }
    }
    if (m.description !== undefined && typeof m.description !== 'string') {
        return { error: 'plugin.json의 description이 문자열이 아닙니다.' };
    }

    const manifest: PluginManifest = {
        id          : m.id as string,
        name        : m.name as string,
        version     : m.version as string,
        description : (m.description as string | undefined) ?? '',
        entry       : m.entry as string,
        hostApi     : m.hostApi as string
    };

    if (!PLUGIN_ID_PATTERN.test(manifest.id)) {
        return { error: `plugin.json의 id 형식이 잘못되었습니다: "${manifest.id}" (소문자·숫자·하이픈만 사용 가능)` };
    }
    if (manifest.id !== expected.id) {
        return { error: `plugin.json의 id("${manifest.id}")가 설치 항목("${expected.id}")과 다릅니다.` };
    }
    if (!PLUGIN_VERSION_PATTERN.test(manifest.version)) {
        return { error: `plugin.json의 version 형식이 잘못되었습니다: "${manifest.version}" (X.Y.Z)` };
    }
    if (manifest.version !== expected.version) {
        return { error: `plugin.json의 version(${manifest.version})이 설치 폴더 버전(${expected.version})과 다릅니다.` };
    }
    const entryProblem = entryPathError(manifest.entry);
    if (entryProblem) {
        return { error: entryProblem };
    }
    if (semver.validRange(manifest.hostApi) === null) {
        return { error: `plugin.json의 hostApi가 올바른 버전 범위가 아닙니다: "${manifest.hostApi}"` };
    }
    if (!isHostApiCompatible(manifest.hostApi)) {
        return {
            error: `Host API ${HOST_API_VERSION}과 호환되지 않습니다 (플러그인 요구: ${manifest.hostApi}).`
        };
    }
    return { manifest };
}

/** hostApi 범위가 현재 HOST_API_VERSION을 만족하는지. 범위가 잘못됐으면 false. */
export function isHostApiCompatible(hostApi: string): boolean {
    try {
        return semver.satisfies(HOST_API_VERSION, hostApi);
    } catch {
        return false;
    }
}

/**
 * entry가 플러그인 폴더 안의 상대 경로인지. 문제가 있으면 사유, 없으면 null.
 * 웹뷰 리소스 루트가 plugins/ 전체라서, 폴더 밖을 가리키면 다른 플러그인 파일을 실행하게 된다.
 */
export function entryPathError(entry: string): string | null {
    if (path.isAbsolute(entry) || path.win32.isAbsolute(entry) || /^[a-z][a-z0-9+.-]*:/i.test(entry)) {
        return `plugin.json의 entry는 플러그인 폴더 기준 상대 경로여야 합니다: "${entry}"`;
    }
    const normalized = path.posix.normalize(entry.replace(/\\/g, '/'));
    if (normalized === '..' || normalized.startsWith('../')) {
        return `plugin.json의 entry가 플러그인 폴더 밖을 가리킵니다: "${entry}"`;
    }
    if (!/\.m?js$/.test(normalized)) {
        return `plugin.json의 entry는 ES 모듈(.js/.mjs)이어야 합니다: "${entry}"`;
    }
    return null;
}

/**
 * installed.json 내용을 검증해 정상 항목만 돌려준다. 잘못된 항목은 problems에 사유를 담는다.
 * 파일 전체를 버리지 않는 이유: 항목 하나의 오타로 모든 플러그인이 사라지면 원인을 찾기 어렵다.
 */
export function parseInstalled(raw: unknown): { entries: InstalledPlugins; problems: string[] } {
    const entries: InstalledPlugins = {};
    const problems: string[] = [];

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        problems.push('installed.json이 객체가 아닙니다. 빈 목록으로 간주합니다.');
        return { entries, problems };
    }

    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        const entry = value as Partial<InstalledEntry> | null;
        if (!PLUGIN_ID_PATTERN.test(id)) {
            problems.push(`installed.json: 플러그인 id 형식이 잘못되었습니다: "${id}"`);
            continue;
        }
        if (!entry || typeof entry !== 'object' ||
            typeof entry.version !== 'string' || !PLUGIN_VERSION_PATTERN.test(entry.version)) {
            problems.push(`installed.json: "${id}"의 version이 없거나 X.Y.Z 형식이 아닙니다.`);
            continue;
        }
        if (typeof entry.enabled !== 'boolean') {
            problems.push(`installed.json: "${id}"의 enabled가 true/false가 아닙니다.`);
            continue;
        }
        entries[id] = { version: entry.version, enabled: entry.enabled };
    }
    return { entries, problems };
}
