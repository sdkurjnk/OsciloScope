import * as vscode from 'vscode';
import { PLUGINS_DIR } from './tool/plugin';

const CSP_SOURCE_TOKEN = /\{\{cspSource\}\}/g;

// 웹뷰 3개(사이드바·메인 패널·검사 패널)가 같은 규칙을 써야 하는 것들을 모아 둔다.
// 한쪽만 고치면 도구가 한 웹뷰에서만 로드되거나, 한쪽에만 CSP가 걸리는 상황이 생긴다.

// 웹뷰가 읽을 수 있는 리소스 범위 (PLUGIN_REGISTRY_PLAN.md §3, 3단계).
// - <확장>/osciloscope         : 우리 웹뷰 자원 (HTML·JS·CSS·tool-host)
// - <globalStorageUri>/plugins : 설치된 플러그인 (기본 도구도 시드로 여기에 설치된다)
//
// 계획서는 globalStorageUri 전체를 추가하라고 되어 있지만 plugins/ 하위로 좁혔다.
// 웹뷰가 읽을 일이 없는 installed.json 등 저장소의 다른 파일까지 노출할 이유가 없기 때문이다.
// 워크스페이스 폴더와 <확장>/tools는 도구 로드 경로가 전역 저장소로 단일화되면서 뺐다.
export function webviewResourceRoots(extensionUri: vscode.Uri, globalStorageUri: vscode.Uri): vscode.Uri[] {
    return [
        vscode.Uri.joinPath(extensionUri, 'osciloscope'),
        vscode.Uri.joinPath(globalStorageUri, PLUGINS_DIR)
    ];
}

// HTML의 {{cspSource}} 자리를 해당 웹뷰의 cspSource로 채운다.
//
// script-src를 cspSource로 묶으면 우리 스크립트와 플러그인 진입 파일(asWebviewUri)은 로드되지만
// 인라인 스크립트는 차단된다. 로그 값에 섞인 <script>나 onerror=가 실행되지 않는다 (설계문서 §3.4, §5.3).
// localResourceRoots에 전역 저장소를 추가해도 cspSource 하나로 함께 허용되므로 CSP는 따로 고칠 것이 없다.
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
