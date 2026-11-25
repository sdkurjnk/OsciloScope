#!/usr/bin/env node
// Generate the webview command mirror (osciloscope/js/constants.js) from the
// single source of truth (src/ApiTable.ts).
//
// The webview loads plain ESM and cannot import TypeScript, so the command
// strings used to live in two hand-maintained files that had to be kept in
// sync. Now the protocol is authored in `ApiTable.ts` and this script mirrors
// its string enums into constants.js — drift is impossible because constants.js
// is a build artifact (do not edit it by hand).
//
// Run via `npm run gen:constants` (also runs as part of `npm run compile`).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'src', 'ApiTable.ts');
const PLUGIN_SOURCE = join(ROOT, 'src', 'tool', 'plugin.ts');
const TARGET = join(ROOT, 'osciloscope', 'js', 'constants.js');

// 미러할 enum 목록. 여기 없는 enum은 웹뷰가 쓰지 않는 것으로 본다.
const MIRRORED_ENUMS = ['CommandTypes', 'ToolErrorPhase'];

// 미러할 문자열 상수 (파일 → 이름). Host API 버전은 BE가 호환성을 판정하고
// FE의 ToolHostApi.apiVersion으로도 노출되므로 정본 하나(plugin.ts)에서 양쪽으로 나간다.
const MIRRORED_STRINGS = [[PLUGIN_SOURCE, 'HOST_API_VERSION']];

function parseStringConst(file, name) {
  const source = readFileSync(file, 'utf8');
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*["']([^"']+)["']`));
  if (!match) {
    throw new Error(`gen-constants: 상수 ${name}를 ${file}에서 찾지 못했습니다.`);
  }
  return `export const ${name} = '${match[1]}';`;
}

function parseEnum(source, name) {
  const block = source.match(new RegExp(`enum\\s+${name}\\s*\\{([\\s\\S]*?)\\}`));
  if (!block) {
    throw new Error(`gen-constants: enum ${name}를 ${SOURCE}에서 찾지 못했습니다.`);
  }
  const members = [...block[1].matchAll(/(\w+)\s*=\s*["']([^"']+)["']/g)]
    .map(([, key, value]) => ({ key, value }));
  if (members.length === 0) {
    throw new Error(`gen-constants: enum ${name}에서 멤버를 하나도 읽지 못했습니다.`);
  }
  return members;
}

function renderObject(name, members) {
  const width = Math.max(...members.map(m => m.key.length));
  const lines = members
    .map(m => `  ${m.key.padEnd(width)} : '${m.value}'`)
    .join(',\n');
  return `export const ${name} = Object.freeze({\n${lines}\n});`;
}

const source = readFileSync(SOURCE, 'utf8');
const blocks = [
  ...MIRRORED_ENUMS.map(name => renderObject(name, parseEnum(source, name))),
  ...MIRRORED_STRINGS.map(([file, name]) => parseStringConst(file, name))
];

const output = `'use strict';

/**
 * ⚠ AUTO-GENERATED — 편집하지 마세요.
 * 정본: src/ApiTable.ts (프로토콜) · src/tool/plugin.ts (Host API 버전).
 * 재생성: npm run gen:constants (npm run compile에 포함).
 *
 * 웹뷰는 raw ESM이라 TypeScript를 import할 수 없어, 정본의 문자열 값만 여기로 미러한다.
 * 프로토콜 상수는 ApiTable.js가 import한다. HOST_API_VERSION은 ToolHostApi.apiVersion 값으로
 * 웹뷰 ToolHost가 쓰기 위한 것이다 (BE는 같은 정본으로 plugin.json의 hostApi를 판정한다).
 */

${blocks.join('\n\n')}
`;

writeFileSync(TARGET, output);
const mirrored = [...MIRRORED_ENUMS, ...MIRRORED_STRINGS.map(([, name]) => name)];
console.error(`gen-constants: ${TARGET} 갱신 (${mirrored.join(', ')})`);
