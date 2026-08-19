import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ToolRegistry } from './ToolRegistry';
import {
    ToolCreatedPayload,
    TOOL_FILE_SUFFIX,
    TOOL_ID_PATTERN,
    TOOL_TYPES_FILE,
    TOOL_TYPES_STAMP,
    TOOL_TYPES_VERSION,
    USER_TOOLS_DIR
} from './types';

const SKELETON_FILE = 'tool-skeleton.js';
const TOOL_ID_TOKEN = /\{\{TOOL_ID\}\}/g;

// 도구 스켈레톤 생성, 타입 정의 배치, 번들 도구 복사.
// 파일을 만들기만 할 뿐 도구 코드를 실행하지는 않는다.
export class ToolTemplate {

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly registry: ToolRegistry,
        private readonly output: vscode.OutputChannel
    ) {}

    // '분석 도구 만들기' — 설계문서 §6.1
    public async createTool(): Promise<ToolCreatedPayload | undefined> {
        const folder = await this.pickFolder();
        if (!folder) {
            return undefined;
        }

        const toolsDir = this.registry.userToolsDir(folder);
        const toolId   = await this.promptToolId('만들 도구의 ID', '', toolsDir);
        if (!toolId) {
            return undefined;
        }

        const filePath = path.join(toolsDir, `${toolId}${TOOL_FILE_SUFFIX}`);
        this.prepareToolsDir(folder, toolsDir);
        fs.writeFileSync(filePath, this.skeletonFor(toolId), 'utf-8');

        await this.openInEditor(filePath);
        return { toolId, filePath };
    }

    // '복사해서 수정' — 번들 도구를 워크스페이스로 가져와 고쳐 쓰는 통로 (설계문서 §5.7).
    // 사용자 도구가 같은 id의 번들 도구를 재정의하는 규칙(§5.1)이 여기서 실제로 쓰인다.
    public async copyTool(sourceToolId: string): Promise<ToolCreatedPayload | undefined> {
        const source = this.registry.find(sourceToolId);
        if (!source) {
            vscode.window.showErrorMessage(`OsciloScope: 도구를 찾을 수 없습니다. (${sourceToolId})`);
            return undefined;
        }

        const folder = await this.pickFolder();
        if (!folder) {
            return undefined;
        }

        const toolsDir = this.registry.userToolsDir(folder);
        const toolId   = await this.promptToolId('새 도구의 ID', sourceToolId, toolsDir);
        if (!toolId) {
            return undefined;
        }

        const filePath = path.join(toolsDir, `${toolId}${TOOL_FILE_SUFFIX}`);
        this.prepareToolsDir(folder, toolsDir);

        const body = fs.readFileSync(source.fileUri.fsPath, 'utf-8');
        fs.writeFileSync(filePath, this.replaceMetaId(body, toolId), 'utf-8');

        await this.openInEditor(filePath);
        return { toolId, filePath };
    }

    public async openTool(toolId: string): Promise<void> {
        const tool = this.registry.find(toolId);
        if (!tool) {
            vscode.window.showErrorMessage(`OsciloScope: 도구를 찾을 수 없습니다. (${toolId})`);
            return;
        }
        await this.openInEditor(tool.fileUri.fsPath);
    }

    // 워크스페이스가 없으면 사용자 도구를 둘 곳이 없다. 루트가 여럿이면 어디에 만들지 물어본다.
    private async pickFolder(): Promise<vscode.WorkspaceFolder | undefined> {
        const folders = this.registry.workspaceFolders();

        if (folders.length === 0) {
            vscode.window.showWarningMessage(
                'OsciloScope: 도구를 만들려면 먼저 폴더를 열어야 합니다.'
            );
            return undefined;
        }
        if (folders.length === 1) {
            return folders[0];
        }

        const picked = await vscode.window.showQuickPick(
            folders.map(folder => ({ label: folder.name, description: folder.uri.fsPath, folder })),
            { title: '도구를 만들 워크스페이스 폴더', placeHolder: '폴더를 선택하세요' }
        );
        return picked?.folder;
    }

    // 형식 검증은 InputBox에서 즉시 안내하고, 덮어쓰기는 별도로 확인받는다 (설계문서 §6.1).
    private async promptToolId(
        title: string,
        value: string,
        toolsDir: string
    ): Promise<string | undefined> {
        const toolId = await vscode.window.showInputBox({
            title,
            value,
            prompt: '소문자·숫자·하이픈만 쓸 수 있습니다. 파일명과 meta.id에 그대로 쓰입니다.',
            validateInput: input => {
                const trimmed = input.trim();
                if (!trimmed) {
                    return '도구 ID를 입력하세요.';
                }
                if (!TOOL_ID_PATTERN.test(trimmed)) {
                    return '소문자·숫자·하이픈만 쓸 수 있고, 첫 글자는 소문자나 숫자여야 합니다.';
                }
                return undefined;
            }
        });

        if (!toolId) {
            return undefined;
        }

        const trimmed  = toolId.trim();
        const filePath = path.join(toolsDir, `${trimmed}${TOOL_FILE_SUFFIX}`);
        if (fs.existsSync(filePath)) {
            const answer = await vscode.window.showWarningMessage(
                `${trimmed}${TOOL_FILE_SUFFIX} 파일이 이미 있습니다. 덮어쓸까요?`,
                { modal: true },
                '덮어쓰기'
            );
            if (answer !== '덮어쓰기') {
                return undefined;
            }
        }

        return trimmed;
    }

    private prepareToolsDir(folder: vscode.WorkspaceFolder, toolsDir: string): void {
        fs.mkdirSync(toolsDir, { recursive: true });
        this.ensureTypeDefs(toolsDir);
        this.ensureGitignore(path.join(folder.uri.fsPath, USER_TOOLS_DIR[0]));
    }

    // 타입 정의를 배치한다. "있으면 건드리지 않는" 방식은 확장을 업데이트해 인터페이스가
    // 바뀌어도 옛 정의가 남아 실제와 어긋나므로, 첫 줄 버전 스탬프를 비교해 덮어쓴다 (§5.8).
    // 사용자가 수정할 파일이 아니라 덮어쓰기의 부작용이 없다.
    private ensureTypeDefs(toolsDir: string): void {
        const target = path.join(toolsDir, TOOL_TYPES_FILE);
        const source = path.join(this.extensionUri.fsPath, 'assets', 'templates', TOOL_TYPES_FILE);

        const installed = this.stampOf(target);
        if (installed === TOOL_TYPES_VERSION) {
            return;
        }

        fs.copyFileSync(source, target);
        if (installed) {
            this.output.appendLine(
                `[ToolTemplate] 타입 정의를 ${installed} → ${TOOL_TYPES_VERSION}로 갱신했습니다: ${target}`
            );
        }
    }

    private stampOf(filePath: string): string | undefined {
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        const firstLine = fs.readFileSync(filePath, 'utf-8').split('\n', 1)[0];
        return TOOL_TYPES_STAMP.exec(firstLine)?.[1];
    }

    // .osciloscope/는 커밋 대상이지만 타입 정의는 확장이 재생성하는 산출물이라 제외한다.
    // 커밋하면 팀원 간 확장 버전 차이로 충돌한다 (설계문서 §5.8).
    private ensureGitignore(osciloDir: string): void {
        const filePath = path.join(osciloDir, '.gitignore');
        const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';

        if (existing.split(/\r?\n/).some(line => line.trim() === TOOL_TYPES_FILE)) {
            return;
        }

        const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
        fs.appendFileSync(filePath, `${prefix}${TOOL_TYPES_FILE}\n`, 'utf-8');
    }

    private skeletonFor(toolId: string): string {
        const source = path.join(this.extensionUri.fsPath, 'assets', 'templates', SKELETON_FILE);
        return fs.readFileSync(source, 'utf-8').replace(TOOL_ID_TOKEN, toolId);
    }

    // 복사본이 원본과 같은 id를 쓰면 재정의로 취급되어 헷갈린다. meta.id만 새 값으로 바꾼다.
    // meta 객체 범위(meta: { ... }) 안의 id만 잡는다. 예전엔 파일의 첫 `id:`를 바꿔서
    // analyze 코드 등 meta 밖의 무관한 id를 건드릴 위험이 있었다.
    private replaceMetaId(body: string, toolId: string): string {
        return body.replace(
            /(\bmeta\s*:\s*\{[^}]*?\bid\s*:\s*)(['"`])[^'"`]*\2/,
            `$1$2${toolId}$2`
        );
    }

    private async openInEditor(filePath: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(document);
    }
}
