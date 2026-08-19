import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { outbound, route, CommandTypes, OsciloScopeMessage } from '../ApiTable';
import { webviewResourceRoots } from '../WebviewSupport';
import { ToolRegistry } from './ToolRegistry';
import {
    ValidationReport,
    VALIDATION_TIMEOUT_MS,
    VALIDATOR_MODULE
} from './types';

// 유효성 검사를 돌리는 전용 임시 패널.
//
// 검사 12항목의 로직은 웹뷰의 ToolValidator.js가 구현한다. 확장이 맡는 것은
// 패널 수명과 타임아웃뿐이다 — 도구가 무한 루프에 빠져도 패널을 dispose하면
// 그 안에서 돌던 코드가 함께 사라지므로, 여기서 회수할 수 있다 (설계문서 §7.4).
export class ValidationPanel {

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly registry: ToolRegistry,
        private readonly output: vscode.OutputChannel
    ) {}

    public async run(toolId: string): Promise<ValidationReport> {
        const tool = this.registry.find(toolId);
        if (!tool) {
            return this.failure(toolId, '로드', `도구를 찾을 수 없습니다. (${toolId})`);
        }
        if (tool.error) {
            return this.failure(toolId, '로드', tool.error);
        }

        const validatorPath = path.join(this.extensionUri.fsPath, ...VALIDATOR_MODULE);
        if (!fs.existsSync(validatorPath)) {
            return this.failure(toolId, '로드', `검사기를 찾을 수 없습니다. (${VALIDATOR_MODULE.join('/')})`);
        }

        const panel = vscode.window.createWebviewPanel(
            'osciloScopeValidation',
            'OsciloScope — 도구 검사',
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
            {
                enableScripts: true,
                localResourceRoots: webviewResourceRoots(this.extensionUri)
            }
        );

        try {
            const report = await this.awaitReport(panel, toolId, tool.fileUri, validatorPath);
            this.report(report);
            return report;
        } finally {
            panel.dispose();
        }
    }

    private awaitReport(
        panel: vscode.WebviewPanel,
        toolId: string,
        toolFileUri: vscode.Uri,
        validatorPath: string
    ): Promise<ValidationReport> {
        return new Promise<ValidationReport>(resolve => {
            let settled = false;
            const finish = (report: ValidationReport) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(report);
            };

            const timer = setTimeout(() => {
                // 결과를 먼저 확정한다. dispose()가 onDidDispose를 동기로 부르므로
                // 순서를 뒤집으면 "패널이 닫혔다"가 타임아웃 리포트를 덮어쓴다.
                finish(this.timeout(toolId));
                // 패널을 dispose하면 무한 루프에 빠진 도구도 함께 회수된다.
                panel.dispose();
            }, VALIDATION_TIMEOUT_MS);

            // 검사 패널로 보내는 발신은 이 테이블을 거친다 (BE-API Table).
            const api = outbound(message => panel.webview.postMessage(message));

            panel.webview.onDidReceiveMessage((message: OsciloScopeMessage) => route(message, {
                // 검사기가 리스너를 걸기 전에 보내면 유실되므로 UI_READY를 기다린다.
                [CommandTypes.UI_READY]: () => api.runValidation({
                    toolId,
                    toolUri: panel.webview.asWebviewUri(toolFileUri).toString()
                }),
                [CommandTypes.VALIDATION_RESULT]: payload => finish(payload)
            }));

            // 사용자가 검사 패널을 직접 닫는 경우도 결과 없이 끝난다.
            panel.onDidDispose(() => finish(this.aborted(toolId)));

            panel.webview.html = this.shell(panel.webview, validatorPath);
        });
    }

    // 검사기를 불러오는 최소 껍데기. 인라인 스크립트는 nonce로만 허용하고,
    // 도구 파일과 검사기 모듈은 cspSource로 허용한다.
    private shell(webview: vscode.Webview, validatorPath: string): string {
        const nonce        = this.nonce();
        const validatorUri = webview.asWebviewUri(vscode.Uri.file(validatorPath));
        // 검사 패널도 FE-API Table을 거쳐 확장과 통신한다 (커맨드 문자열을 인라인에 두지 않는다).
        const apiTableUri  = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'osciloscope', 'js', 'ApiTable.js')
        );

        return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'nonce-${nonce}' ${webview.cspSource};
  style-src ${webview.cspSource} 'unsafe-inline';
  img-src ${webview.cspSource} data:;
  font-src ${webview.cspSource};
  connect-src 'none';">
<title>OsciloScope — 도구 검사</title>
</head>
<body>
<p>도구를 검사하는 중입니다…</p>
<script type="module" nonce="${nonce}">
import { runValidation } from '${validatorUri}';
import { createApiTable, CommandTypes } from '${apiTableUri}';

const api = createApiTable(acquireVsCodeApi());

api.route({
    [CommandTypes.RUN_VALIDATION]: async (payload) => {
        let report;
        try {
            report = await runValidation(payload);
        } catch (err) {
            report = {
                toolId: payload.toolId,
                ok: false,
                checks: [{ name: '로드', status: 'fail', message: String(err && err.message || err) }]
            };
        }
        api.validationResult(report);
    }
});

api.uiReady();
</script>
</body>
</html>`;
    }

    private nonce(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    // 상세 리포트는 출력 채널로 보낸다. 사이드바에는 아이콘만 뜬다 (설계문서 §7.5).
    private report(report: ValidationReport): void {
        this.output.appendLine(`[검사] ${report.toolId} — ${report.ok ? '통과' : '실패'}`);
        for (const check of report.checks) {
            const where = check.fixture ? ` / ${check.fixture}` : '';
            this.output.appendLine(`  [${check.status}] ${check.name}${where}: ${check.message}`);
        }
    }

    private failure(toolId: string, name: string, message: string): ValidationReport {
        return { toolId, ok: false, checks: [{ name, status: 'fail', message }] };
    }

    private timeout(toolId: string): ValidationReport {
        return this.failure(
            toolId,
            '실행 시간',
            `${VALIDATION_TIMEOUT_MS / 1000}초 안에 끝나지 않아 강제 종료했습니다. 무한 루프가 있는지 확인하세요.`
        );
    }

    private aborted(toolId: string): ValidationReport {
        return this.failure(toolId, '검사', '검사 패널이 닫혀 결과를 받지 못했습니다.');
    }
}
