import * as vscode from 'vscode';
import { BUILTIN_TOOLS_DIR } from './tool/types';

const CSP_SOURCE_TOKEN = /\{\{cspSource\}\}/g;

// 사이드바와 메인 패널이 같은 규칙을 써야 하는 것들을 모아 둔다.
// 한쪽만 고치면 도구가 한 웹뷰에서만 로드되거나, 한쪽에만 CSP가 걸리는 상황이 생긴다.

// 도구 파일을 웹뷰가 읽을 수 있게 리소스 허용 범위를 넓힌다 (설계문서 §5.3).
// 번들 도구는 확장 설치 경로에, 사용자 도구는 워크스페이스에 있다.
export function webviewResourceRoots(extensionUri: vscode.Uri): vscode.Uri[] {
    return [
        vscode.Uri.joinPath(extensionUri, 'osciloscope'),
        vscode.Uri.joinPath(extensionUri, BUILTIN_TOOLS_DIR),
        ...(vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri)
    ];
}

// HTML의 {{cspSource}} 자리를 해당 웹뷰의 cspSource로 채운다.
//
// script-src를 cspSource로 묶으면 우리 스크립트와 도구 파일은 로드되지만 인라인 스크립트는
// 차단된다. 로그 값에 섞인 <script>나 onerror=가 실행되지 않는다 (설계문서 §3.4, §5.3).
export function injectCspSource(html: string, webview: vscode.Webview): string {
    if (!CSP_SOURCE_TOKEN.test(html)) {
        // 사용자 코드를 로드하는 웹뷰에 CSP가 없으면 인라인 스크립트가 그대로 실행된다.
        console.warn('[WebviewSupport] HTML에 {{cspSource}} 자리표시자가 없습니다. CSP 메타 태그를 확인하세요.');
        return html;
    }
    // test()가 lastIndex를 옮겨 놓으므로 되돌린 뒤 치환한다 (전역 정규식 공유 주의).
    CSP_SOURCE_TOKEN.lastIndex = 0;
    return html.replace(CSP_SOURCE_TOKEN, webview.cspSource);
}
