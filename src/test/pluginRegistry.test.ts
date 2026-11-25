import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    HOST_API_VERSION,
    entryPathError,
    isHostApiCompatible,
    parseInstalled,
    validateManifest
} from '../tool/plugin';
import { ToolRegistry } from '../tool/ToolRegistry';

// out/test/*.test.js → 저장소 루트 (번들 기본 도구 plugins/가 있는 곳)
const EXTENSION_ROOT = path.resolve(__dirname, '..', '..');

const silentOutput = { appendLine: () => {} } as unknown as vscode.OutputChannel;

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'sample', name: '샘플', version: '1.0.0', description: '',
        entry: 'index.js', hostApi: '^1.0.0', ...overrides
    };
}

suite('plugin.json 검증', () => {
    const expected = { id: 'sample', version: '1.0.0' };

    test('정상 manifest는 통과한다', () => {
        const result = validateManifest(manifest(), expected);
        assert.strictEqual(result.error, undefined);
        assert.strictEqual(result.manifest?.name, '샘플');
    });

    test('description이 없으면 빈 문자열로 채운다', () => {
        const raw = manifest();
        delete raw.description;
        assert.strictEqual(validateManifest(raw, expected).manifest?.description, '');
    });

    test('필수 필드가 없으면 실패한다', () => {
        for (const field of ['id', 'name', 'version', 'entry', 'hostApi']) {
            const raw = manifest();
            delete raw[field];
            assert.match(validateManifest(raw, expected).error ?? '', new RegExp(field), field);
        }
    });

    test('설치 위치와 id·version이 다르면 실패한다', () => {
        assert.ok(validateManifest(manifest({ id: 'other' }), expected).error);
        assert.ok(validateManifest(manifest({ version: '1.0.1' }), expected).error);
    });

    test('hostApi가 현재 Host API와 호환되지 않으면 실패한다', () => {
        assert.match(validateManifest(manifest({ hostApi: '^2.0.0' }), expected).error ?? '', /호환되지 않습니다/);
        assert.match(validateManifest(manifest({ hostApi: 'not-a-range' }), expected).error ?? '', /버전 범위/);
    });

    test('entry는 폴더 안의 ES 모듈 상대 경로여야 한다', () => {
        assert.strictEqual(entryPathError('index.js'), null);
        assert.strictEqual(entryPathError('dist/main.mjs'), null);
        assert.ok(entryPathError('../other/index.js'));
        assert.ok(entryPathError('a/../../x.js'));
        assert.ok(entryPathError('/abs/index.js'));
        assert.ok(entryPathError('C:\\abs\\index.js'));
        assert.ok(entryPathError('https://example.com/x.js'));
        assert.ok(entryPathError('index.ts'));
    });
});

suite('Host API 호환성 (semver)', () => {
    test(`현재 버전 ${HOST_API_VERSION} 기준 판정`, () => {
        assert.ok(isHostApiCompatible('^1.0.0'));
        assert.ok(isHostApiCompatible('~1.0.0'));
        assert.ok(isHostApiCompatible('>=1.0.0'));
        assert.ok(isHostApiCompatible('1.x'));
        assert.ok(!isHostApiCompatible('^2.0.0'));
        assert.ok(!isHostApiCompatible('^1.1.0'));
        assert.ok(!isHostApiCompatible('garbage'));
    });
});

suite('installed.json 파싱', () => {
    test('잘못된 항목만 빼고 나머지는 유지한다', () => {
        const { entries, problems } = parseInstalled({
            'good'      : { version: '1.0.0', enabled: true },
            'Bad_Id'    : { version: '1.0.0', enabled: true },
            'no-version': { enabled: true },
            'no-enabled': { version: '1.0.0' }
        });
        assert.deepStrictEqual(Object.keys(entries), ['good']);
        assert.strictEqual(problems.length, 3);
    });

    test('객체가 아니면 빈 목록이다', () => {
        assert.deepStrictEqual(parseInstalled([]).entries, {});
        assert.deepStrictEqual(parseInstalled(null).entries, {});
    });
});

suite('ToolRegistry (전역 저장소)', () => {
    let storageDir: string;
    let registry: ToolRegistry;

    const storage   = () => vscode.Uri.file(storageDir);
    const installed = () => path.join(storageDir, 'installed.json');
    const readInstalledFile = () => JSON.parse(fs.readFileSync(installed(), 'utf-8'));
    const writeInstalledFile = (value: unknown) => fs.writeFileSync(installed(), JSON.stringify(value));

    function newRegistry(): ToolRegistry {
        registry?.dispose();
        registry = new ToolRegistry(vscode.Uri.file(EXTENSION_ROOT), storage(), silentOutput);
        return registry;
    }

    /** 수동 설치를 흉내 낸다: plugins/<id>/<version>/ 에 파일을 두고 installed.json에 등록 */
    function installManual(id: string, files: Record<string, string>, entry = { version: '1.0.0', enabled: true }) {
        const dir = path.join(storageDir, 'plugins', id, entry.version);
        fs.mkdirSync(dir, { recursive: true });
        for (const [name, content] of Object.entries(files)) {
            fs.writeFileSync(path.join(dir, name), content);
        }
        writeInstalledFile({ ...readInstalledFile(), [id]: entry });
    }

    setup(async () => {
        storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'osc-registry-'));
        // globalStorageUri는 처음엔 존재하지 않는다 — 그 상황을 재현한다.
        fs.rmSync(storageDir, { recursive: true, force: true });
        await newRegistry().initialize();
    });

    teardown(() => {
        registry.dispose();
        fs.rmSync(storageDir, { recursive: true, force: true });
    });

    test('처음 설치: plugins/ 생성 + 기본 도구 2개 시드', async () => {
        assert.ok(fs.existsSync(path.join(storageDir, 'plugins', 'change-detector', '1.0.0', 'plugin.json')));
        assert.ok(fs.existsSync(path.join(storageDir, 'plugins', 'monotonic', '1.0.0', 'index.js')));
        assert.deepStrictEqual(readInstalledFile(), {
            'change-detector': { version: '1.0.0', enabled: true },
            'monotonic'      : { version: '1.0.0', enabled: true }
        });

        const tools = await registry.listTools();
        assert.deepStrictEqual(tools.map(t => [t.id, t.source, t.error]), [
            ['change-detector', 'builtin', undefined],
            ['monotonic', 'builtin', undefined]
        ]);
        assert.strictEqual(tools[0].name, '변수 변화 감지');
        assert.ok(tools[0].fileUri);
    });

    test('수동 설치한 플러그인이 목록에 나타난다', async () => {
        installManual('sample', {
            'plugin.json': JSON.stringify(manifest()),
            'index.js'   : 'export default {};'
        });
        const sample = await registry.find('sample');
        assert.ok(sample);
        assert.strictEqual(sample.source, 'user');
        assert.strictEqual(sample.error, undefined);
        assert.strictEqual(sample.hostApi, '^1.0.0');
        assert.ok(sample.fileUri?.fsPath.endsWith(path.join('sample', '1.0.0', 'index.js')));
    });

    test('enabled: false면 목록에 없다', async () => {
        installManual('sample', {
            'plugin.json': JSON.stringify(manifest()),
            'index.js'   : 'export default {};'
        }, { version: '1.0.0', enabled: false });
        assert.strictEqual(await registry.find('sample'), undefined);
    });

    test('문제가 있는 플러그인은 error를 달고 나머지는 정상이다', async () => {
        installManual('incompatible', {
            'plugin.json': JSON.stringify(manifest({ id: 'incompatible', hostApi: '^2.0.0' })),
            'index.js'   : ''
        });
        installManual('no-entry', {
            'plugin.json': JSON.stringify(manifest({ id: 'no-entry' }))
        });
        installManual('no-manifest', { 'index.js': '' });
        installManual('bad-json', { 'plugin.json': '{ not json', 'index.js': '' });

        const tools = await registry.listTools();
        const byId = Object.fromEntries(tools.map(t => [t.id, t]));

        assert.match(byId['incompatible'].error ?? '', /호환되지 않습니다/);
        assert.match(byId['no-entry'].error ?? '', /진입 파일이 없습니다/);
        assert.match(byId['no-manifest'].error ?? '', /plugin\.json을 찾을 수 없습니다/);
        assert.match(byId['bad-json'].error ?? '', /plugin\.json을 읽지 못했습니다/);
        assert.strictEqual(byId['change-detector'].error, undefined);
        assert.strictEqual(byId['monotonic'].error, undefined);
    });

    test('사용자가 끈 기본 도구는 다시 켜지 않는다', async () => {
        const value = readInstalledFile();
        value['change-detector'].enabled = false;
        writeInstalledFile(value);

        await newRegistry().initialize();
        assert.strictEqual(readInstalledFile()['change-detector'].enabled, false);
        assert.strictEqual(await registry.find('change-detector'), undefined);
    });

    test('번들 버전이 더 높으면 version만 올린다', async () => {
        writeInstalledFile({ ...readInstalledFile(), 'change-detector': { version: '0.9.0', enabled: false } });
        await newRegistry().initialize();
        assert.deepStrictEqual(readInstalledFile()['change-detector'], { version: '1.0.0', enabled: false });
    });

    test('installed.json이 깨져 있으면 빈 목록이고 파일을 덮어쓰지 않는다', async () => {
        fs.writeFileSync(installed(), '{ broken');
        await newRegistry().initialize();
        assert.strictEqual(fs.readFileSync(installed(), 'utf-8'), '{ broken');
        assert.deepStrictEqual(await registry.listTools(), []);
    });

    test('파일 수정 시 mtime이 바뀐다 (웹뷰 재import 키)', async () => {
        const before = (await registry.find('monotonic'))!.mtime;
        const entry  = path.join(storageDir, 'plugins', 'monotonic', '1.0.0', 'index.js');
        const later  = new Date(Date.now() + 5_000);
        fs.utimesSync(entry, later, later);
        const after = (await registry.find('monotonic'))!.mtime;
        assert.notStrictEqual(after, before);
    });
});
