import * as semver from 'semver';
import * as vscode from 'vscode';
import { ToolInfo, ToolSource } from './types';
import { ToolsListPayload } from '../ApiTable';
import {
    BUNDLED_PLUGINS_DIR,
    INSTALLED_FILE,
    InstalledEntry,
    InstalledPlugins,
    PLUGIN_MANIFEST_FILE,
    PLUGINS_DIR,
    parseInstalled,
    validateManifest
} from './plugin';

// 스캔 결과의 확장 호스트 내부 표현.
// ToolInfo와 달리 진입 파일 URI를 그대로 들고 있다. asWebviewUri는 웹뷰마다 결과가 다르므로
// 여기서 문자열로 굳히지 않고, 어느 웹뷰에 보낼지 정해지는 시점에 변환한다.
export interface ToolFile {
    id          : string;
    name        : string;
    version     : string;
    description : string;
    hostApi     : string;
    source      : ToolSource;
    fileUri    ?: vscode.Uri;   // 진입 파일. error가 있으면 없을 수 있다
    mtime       : number;
    error      ?: string;
}

export interface ToolRegistryOptions {
    /**
     * true면 활성화 때마다 번들 기본 도구를 전역 저장소에 다시 복사한다.
     * 개발 중(F5)에 기본 도구 코드를 고치면 버전을 올리지 않아도 반영되게 하기 위함이다.
     * 배포 환경에서는 false — 이미 설치된 버전 폴더는 건드리지 않는다.
     */
    refreshBundled: boolean;
}

/**
 * 전역 저장소(globalStorageUri)의 플러그인을 찾고 감시한다 (PLUGIN_REGISTRY_PLAN.md §3.1, 3단계).
 *
 *   <globalStorageUri>/
 *   ├── installed.json                      id → { version, enabled }
 *   └── plugins/<id>/<version>/plugin.json  실행 정보 + 진입 파일
 *
 * 도구 로드 경로는 이 저장소 하나다. 기본 도구도 확장 폴더에서 바로 실행하지 않고,
 * initialize() 때 전역 저장소로 시드한 뒤 같은 경로로 읽는다.
 *
 * 도구 코드는 실행하지 않는다. 목록의 이름·버전은 plugin.json에서 읽는다.
 * 파일 접근은 원격 개발 환경(WSL·SSH)에서도 동작하도록 vscode.workspace.fs만 쓴다.
 */
export class ToolRegistry implements vscode.Disposable {

    private watcher?: vscode.FileSystemWatcher;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly bundledIds = new Set<string>();
    private lastProblems = '';
    private changeTimer?: ReturnType<typeof setTimeout>;
    // initialize()가 끝나기 전에 목록을 요청받으면(사이드바가 먼저 뜨는 경우) 시드를 기다렸다 읽는다.
    // 안 그러면 처음 설치한 사용자의 첫 목록이 빈 채로 그려진다.
    private ready: Promise<void> = Promise.resolve();

    constructor(
        private readonly extensionUri: vscode.Uri,
        public  readonly globalStorageUri: vscode.Uri,
        private readonly output: vscode.OutputChannel,
        private readonly options: ToolRegistryOptions = { refreshBundled: false }
    ) {}

    public get pluginsUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.globalStorageUri, PLUGINS_DIR);
    }

    public get installedUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.globalStorageUri, INSTALLED_FILE);
    }

    /**
     * 저장소 준비. plugins/ 폴더를 만들고(globalStorageUri는 처음엔 존재하지 않는다) 기본 도구를 시드한다.
     * 시드가 실패해도 예외를 던지지 않는다 — 사용자가 수동 설치한 플러그인은 계속 쓸 수 있어야 한다.
     */
    public initialize(): Promise<void> {
        this.ready = (async () => {
            try {
                await vscode.workspace.fs.createDirectory(this.pluginsUri);
                await this.seedBundled();
            } catch (err) {
                this.output.appendLine(`[ToolRegistry] 저장소 준비 실패: ${messageOf(err)}`);
            }
        })();
        return this.ready;
    }

    /**
     * 저장소 변경(installed.json 수정, 플러그인 폴더 복사·삭제, 진입 파일 수정)을 한 콜백으로 모은다.
     * 복사처럼 파일 이벤트가 몰려 오는 경우를 위해 짧게 묶어서 한 번만 알린다.
     */
    public watch(onChanged: () => void): void {
        this.watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.globalStorageUri, '**/*')
        );
        const notify = () => {
            if (this.changeTimer) {
                clearTimeout(this.changeTimer);
            }
            this.changeTimer = setTimeout(onChanged, 200);
        };
        this.watcher.onDidCreate(notify, null, this.disposables);
        this.watcher.onDidChange(notify, null, this.disposables);
        this.watcher.onDidDelete(notify, null, this.disposables);
    }

    /**
     * 활성화된 플러그인 목록. 문제가 있는 플러그인도 error를 담아 목록에 남긴다 —
     * 조용히 사라지면 사용자가 원인을 찾을 수 없다. 비활성(enabled: false)은 목록에 올리지 않는다.
     */
    public async listTools(): Promise<ToolFile[]> {
        await this.ready;
        const { entries } = await this.readInstalled();

        const tools = await Promise.all(
            Object.entries(entries)
                .filter(([, entry]) => entry.enabled)
                .map(([id, entry]) => this.loadEntry(id, entry))
        );

        // 기본 도구를 먼저, 그다음 id 순. installed.json의 키 순서에 화면이 흔들리지 않게 한다.
        return tools.sort((a, b) =>
            (a.source === b.source ? 0 : a.source === 'builtin' ? -1 : 1) ||
            a.id.localeCompare(b.id)
        );
    }

    public async find(toolId: string): Promise<ToolFile | undefined> {
        return (await this.listTools()).find(tool => tool.id === toolId);
    }

    public async toPayload(webview: vscode.Webview): Promise<ToolsListPayload> {
        const tools = await this.listTools();
        return { tools: tools.map(tool => this.toToolInfo(webview, tool)) };
    }

    // 진입 파일을 해당 웹뷰가 로드할 수 있는 URI로 변환한다.
    // 주의: 웹뷰 인스턴스마다 결과가 다르다. 사이드바용 URI를 메인 패널에 넘기면 로드에 실패한다.
    public toToolInfo(webview: vscode.Webview, tool: ToolFile): ToolInfo {
        return {
            id          : tool.id,
            name        : tool.name,
            version     : tool.version,
            description : tool.description,
            hostApi     : tool.hostApi,
            source      : tool.source,
            uri         : tool.fileUri ? webview.asWebviewUri(tool.fileUri).toString() : '',
            mtime       : tool.mtime,
            error       : tool.error
        };
    }

    public dispose(): void {
        if (this.changeTimer) {
            clearTimeout(this.changeTimer);
        }
        this.watcher?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables.length = 0;
    }

    // ===== 한 플러그인 읽기 =====

    private async loadEntry(id: string, entry: InstalledEntry): Promise<ToolFile> {
        const dir = vscode.Uri.joinPath(this.pluginsUri, id, entry.version);
        const base: ToolFile = {
            id,
            name        : id,
            version     : entry.version,
            description : '',
            hostApi     : '',
            source      : this.bundledIds.has(id) ? 'builtin' : 'user',
            mtime       : Date.now()
        };

        let raw: unknown;
        try {
            raw = await this.readJson(vscode.Uri.joinPath(dir, PLUGIN_MANIFEST_FILE));
        } catch (err) {
            return {
                ...base,
                error: isFileNotFound(err)
                    ? `plugin.json을 찾을 수 없습니다 (${PLUGINS_DIR}/${id}/${entry.version}/${PLUGIN_MANIFEST_FILE})`
                    : `plugin.json을 읽지 못했습니다: ${messageOf(err)}`
            };
        }

        const result = validateManifest(raw, { id, version: entry.version });
        if (result.error !== undefined) {
            // 검증에 실패해도 읽을 수 있는 표시 이름은 살려서 목록에서 알아볼 수 있게 한다.
            const name = (raw as { name?: unknown })?.name;
            return { ...base, name: typeof name === 'string' && name ? name : id, error: result.error };
        }

        const manifest = result.manifest;
        const fileUri  = vscode.Uri.joinPath(dir, ...manifest.entry.replace(/\\/g, '/').split('/'));
        const withMeta: ToolFile = {
            ...base,
            name        : manifest.name,
            description : manifest.description,
            hostApi     : manifest.hostApi
        };

        try {
            const stat = await vscode.workspace.fs.stat(fileUri);
            if (stat.type !== vscode.FileType.File) {
                return { ...withMeta, error: `진입 파일이 파일이 아닙니다: ${manifest.entry}` };
            }
            return { ...withMeta, fileUri, mtime: stat.mtime };
        } catch {
            return { ...withMeta, error: `진입 파일이 없습니다: ${manifest.entry}` };
        }
    }

    // ===== installed.json =====

    /**
     * installed.json을 읽는다. 파일이 없으면 빈 목록이다.
     * clean이 false면(JSON 오류·잘못된 항목) 다시 쓰지 않는다 — 덮어쓰면 사용자가 고치려던 항목이 사라진다.
     */
    private async readInstalled(): Promise<{ entries: InstalledPlugins; clean: boolean }> {
        let raw: unknown;
        try {
            raw = await this.readJson(this.installedUri);
        } catch (err) {
            if (isFileNotFound(err)) {
                return { entries: {}, clean: true };
            }
            this.reportProblems([`${INSTALLED_FILE}을 읽지 못했습니다: ${messageOf(err)}. 빈 목록으로 간주합니다.`]);
            return { entries: {}, clean: false };
        }

        const { entries, problems } = parseInstalled(raw);
        this.reportProblems(problems);
        return { entries, clean: problems.length === 0 };
    }

    private async writeInstalled(entries: InstalledPlugins): Promise<void> {
        const text = JSON.stringify(entries, null, 2) + '\n';
        await vscode.workspace.fs.writeFile(this.installedUri, new TextEncoder().encode(text));
    }

    // 목록을 요청할 때마다 읽으므로, 같은 문제를 출력 채널에 반복해서 찍지 않는다.
    private reportProblems(problems: string[]): void {
        const key = problems.join('\n');
        if (key === this.lastProblems) {
            return;
        }
        this.lastProblems = key;
        problems.forEach(problem => this.output.appendLine(`[ToolRegistry] ${problem}`));
    }

    // ===== 기본 도구 시드 =====

    /**
     * <확장>/plugins/<id>/ 의 기본 도구를 전역 저장소에 설치하고 installed.json에 등록한다.
     *
     * - 버전 폴더가 없으면 복사한다 (refreshBundled면 항상 다시 복사).
     * - installed.json에 항목이 없으면 enabled: true로 추가한다.
     * - 항목이 있으면 enabled는 건드리지 않는다 — 사용자가 끈 기본 도구를 다시 켜지 않는다.
     * - 확장 업데이트로 번들 버전이 더 높아졌으면 version만 올린다.
     */
    private async seedBundled(): Promise<void> {
        const bundledRoot = vscode.Uri.joinPath(this.extensionUri, BUNDLED_PLUGINS_DIR);

        let children: [string, vscode.FileType][];
        try {
            children = await vscode.workspace.fs.readDirectory(bundledRoot);
        } catch {
            this.output.appendLine(`[ToolRegistry] 번들 기본 도구 폴더가 없습니다: ${bundledRoot.fsPath}`);
            return;
        }

        const { entries, clean } = await this.readInstalled();
        let changed = false;

        for (const [dirName, type] of children) {
            if (type !== vscode.FileType.Directory) {
                continue;
            }
            const source = vscode.Uri.joinPath(bundledRoot, dirName);

            let raw: unknown;
            try {
                raw = await this.readJson(vscode.Uri.joinPath(source, PLUGIN_MANIFEST_FILE));
            } catch (err) {
                this.output.appendLine(`[ToolRegistry] 기본 도구 ${dirName}의 plugin.json을 읽지 못했습니다: ${messageOf(err)}`);
                continue;
            }
            const version = (raw as { version?: unknown })?.version;
            const result  = validateManifest(raw, { id: dirName, version: typeof version === 'string' ? version : '' });
            if (result.error !== undefined) {
                this.output.appendLine(`[ToolRegistry] 기본 도구 ${dirName}을(를) 건너뜁니다: ${result.error}`);
                continue;
            }

            const { id, version: bundledVersion } = result.manifest;
            this.bundledIds.add(id);

            const parent = vscode.Uri.joinPath(this.pluginsUri, id);
            const target = vscode.Uri.joinPath(parent, bundledVersion);
            if (this.options.refreshBundled || !(await this.exists(target))) {
                await this.installFolder(source, parent, bundledVersion);
            }

            const current = entries[id];
            if (!current) {
                entries[id] = { version: bundledVersion, enabled: true };
                changed = true;
            } else if (semver.gt(bundledVersion, current.version)) {
                current.version = bundledVersion;
                changed = true;
            }
        }

        if (!changed) {
            return;
        }
        if (!clean) {
            this.output.appendLine(
                `[ToolRegistry] ${INSTALLED_FILE}에 문제가 있어 기본 도구 등록을 저장하지 않았습니다. 파일을 고친 뒤 다시 여세요.`
            );
            return;
        }
        await this.writeInstalled(entries);
    }

    /**
     * 폴더를 버전 폴더로 설치한다. 같은 위치의 임시 폴더에 먼저 복사한 뒤 이름을 바꾼다 —
     * 복사가 중간에 끊겨도 반쯤 찬 버전 폴더가 "설치됨"으로 보이지 않게 하기 위함이다 (§3.1).
     */
    private async installFolder(source: vscode.Uri, parent: vscode.Uri, version: string): Promise<void> {
        const target  = vscode.Uri.joinPath(parent, version);
        const partial = vscode.Uri.joinPath(parent, `.${version}.partial`);

        await vscode.workspace.fs.createDirectory(parent);
        await this.remove(partial);
        await vscode.workspace.fs.copy(source, partial, { overwrite: true });
        await this.remove(target);
        await vscode.workspace.fs.rename(partial, target, { overwrite: false });
        this.output.appendLine(`[ToolRegistry] 기본 도구를 설치했습니다: ${target.fsPath}`);
    }

    // ===== 파일 유틸 =====

    private async readJson(uri: vscode.Uri): Promise<unknown> {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(new TextDecoder('utf-8').decode(bytes).replace(/^﻿/, ''));
    }

    private async exists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    private async remove(uri: vscode.Uri): Promise<void> {
        if (await this.exists(uri)) {
            await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
        }
    }
}

function isFileNotFound(err: unknown): boolean {
    return err instanceof vscode.FileSystemError && err.code === 'FileNotFound';
}

function messageOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}
