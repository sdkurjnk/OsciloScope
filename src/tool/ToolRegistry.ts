import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    ToolInfo,
    ToolSource,
    TOOL_FILE_SUFFIX,
    TOOL_ID_PATTERN,
    USER_TOOLS_DIR,
    BUILTIN_TOOLS_DIR
} from './types';
import { ToolsListPayload } from '../ApiTable';

// 스캔 결과의 확장 호스트 내부 표현.
// ToolInfo와 달리 파일 URI를 그대로 들고 있다. asWebviewUri는 웹뷰마다 결과가 다르므로
// 여기서 문자열로 굳히지 않고, 어느 웹뷰에 보낼지 정해지는 시점에 변환한다.
export interface ToolFile {
    id         : string;
    source     : ToolSource;
    fileUri    : vscode.Uri;
    mtime      : number;
    overrides ?: boolean;
    error     ?: string;
}

// 도구 파일을 찾고 감시한다. 도구 코드를 실행하지는 않는다 (설계문서 §5.4).
// 따라서 meta.name/version은 알 수 없고, 목록에는 파일 정보만 담긴다.
export class ToolRegistry implements vscode.Disposable {

    private watcher?: vscode.FileSystemWatcher;
    private readonly disposables: vscode.Disposable[] = [];

    constructor(private readonly extensionUri: vscode.Uri) {}

    // 도구 목록이 바뀔 수 있는 사건을 한 콜백으로 모은다.
    // 파일 변경뿐 아니라 워크스페이스 신뢰 부여·폴더 추가도 목록을 바꾼다.
    public watch(onChanged: () => void): void {
        this.watcher = vscode.workspace.createFileSystemWatcher(
            `**/${USER_TOOLS_DIR.join('/')}/*${TOOL_FILE_SUFFIX}`
        );
        this.watcher.onDidCreate(onChanged, null, this.disposables);
        this.watcher.onDidChange(onChanged, null, this.disposables);
        this.watcher.onDidDelete(onChanged, null, this.disposables);

        // 신뢰가 부여되면 그때부터 사용자 도구를 노출해야 한다.
        vscode.workspace.onDidGrantWorkspaceTrust(onChanged, null, this.disposables);
        vscode.workspace.onDidChangeWorkspaceFolders(onChanged, null, this.disposables);
    }

    public listTools(): ToolFile[] {
        const builtins = this.scanDir(this.builtinDir(), 'builtin');
        const users    = this.scanUserDirs();

        // 사용자 도구가 같은 id의 번들 도구를 재정의한다 (설계문서 §5.1).
        // "복사해서 수정" 흐름을 지원하기 위한 규칙이라 배지로 드러낸다.
        const overriddenIds = new Set(
            users.filter(tool => !tool.error).map(tool => tool.id)
        );

        return [
            ...builtins.filter(tool => !overriddenIds.has(tool.id)),
            ...users.map(tool =>
                !tool.error && builtins.some(builtin => builtin.id === tool.id)
                    ? { ...tool, overrides: true }
                    : tool
            )
        ];
    }

    public find(toolId: string): ToolFile | undefined {
        return this.listTools().find(tool => tool.id === toolId);
    }

    public toPayload(webview: vscode.Webview): ToolsListPayload {
        return {
            tools          : this.listTools().map(tool => this.toToolInfo(webview, tool)),
            trusted        : vscode.workspace.isTrusted,
            workspaceReady : this.workspaceFolders().length > 0
        };
    }

    // 도구 파일을 해당 웹뷰가 로드할 수 있는 URI로 변환한다.
    // 주의: 웹뷰 인스턴스마다 결과가 다르다. 사이드바용 URI를 메인 패널에 넘기면 로드에 실패한다.
    public toToolInfo(webview: vscode.Webview, tool: ToolFile): ToolInfo {
        return {
            id        : tool.id,
            source    : tool.source,
            uri       : webview.asWebviewUri(tool.fileUri).toString(),
            mtime     : tool.mtime,
            overrides : tool.overrides,
            error     : tool.error
        };
    }

    public builtinDir(): string {
        return path.join(this.extensionUri.fsPath, BUILTIN_TOOLS_DIR);
    }

    // 사용자 도구를 만들 위치. 루트가 여러 개면 호출자가 고른 폴더를 넘긴다.
    public userToolsDir(folder: vscode.WorkspaceFolder): string {
        return path.join(folder.uri.fsPath, ...USER_TOOLS_DIR);
    }

    public workspaceFolders(): readonly vscode.WorkspaceFolder[] {
        return vscode.workspace.workspaceFolders ?? [];
    }

    public dispose(): void {
        this.watcher?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables.length = 0;
    }

    // 신뢰되지 않은 워크스페이스에서는 사용자 도구를 아예 읽지 않는다 (설계문서 §3.2 완화책).
    // fs 접근이 없더라도 남이 만든 코드를 자동 실행하는 것 자체가 신뢰 결정의 대상이다.
    private scanUserDirs(): ToolFile[] {
        if (!vscode.workspace.isTrusted) {
            return [];
        }

        const seen: Map<string, vscode.Uri> = new Map();
        const result: ToolFile[] = [];

        // 스캔은 모든 루트를 합치되, id가 겹치면 앞선 루트가 이긴다 (설계문서 §5.2).
        for (const folder of this.workspaceFolders()) {
            for (const tool of this.scanDir(this.userToolsDir(folder), 'user')) {
                const winner = seen.get(tool.id);
                if (winner && !tool.error) {
                    result.push({
                        ...tool,
                        error: `다른 루트의 도구와 ID가 중복됩니다 (${winner.fsPath})`
                    });
                    continue;
                }
                if (!tool.error) {
                    seen.set(tool.id, tool.fileUri);
                }
                result.push(tool);
            }
        }

        return result;
    }

    // 한 폴더의 *.tool.js만 훑는다. 하위 폴더는 뒤지지 않는다 (설계문서 §5.1).
    // 도구가 같은 폴더의 헬퍼 파일을 import하는 것은 허용되며, 목록에 뜨지 않을 뿐이다.
    private scanDir(dirPath: string, source: ToolSource): ToolFile[] {
        if (!fs.existsSync(dirPath)) {
            return [];
        }

        return fs.readdirSync(dirPath, { withFileTypes: true })
            .filter(entry => entry.isFile() && entry.name.endsWith(TOOL_FILE_SUFFIX))
            .map(entry => this.toToolFile(dirPath, entry.name, source));
    }

    private toToolFile(dirPath: string, fileName: string, source: ToolSource): ToolFile {
        const filePath = path.join(dirPath, fileName);
        const id       = fileName.slice(0, -TOOL_FILE_SUFFIX.length);

        return {
            id,
            source,
            fileUri : vscode.Uri.file(filePath),
            mtime   : this.mtimeOf(filePath),
            error   : TOOL_ID_PATTERN.test(id)
                ? undefined
                : `도구 ID 형식이 잘못되었습니다: "${id}" (소문자·숫자·하이픈만 사용 가능)`
        };
    }

    // 웹뷰의 ESM 캐시 무효화(import(uri + '?v=' + mtime))에 쓰인다.
    // 읽기에 실패하면 0 대신 현재 시각을 줘서 캐시가 굳는 대신 다시 로드되게 한다.
    private mtimeOf(filePath: string): number {
        try {
            return fs.statSync(filePath).mtimeMs;
        } catch {
            return Date.now();
        }
    }
}
