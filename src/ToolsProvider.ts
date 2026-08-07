import * as fs from 'fs';
import * as path from 'path';

export class ToolsProvider {
    // 도구 선택/플러그인 구조 미구현, 표시용 목록만 제공함
    public static listTools(extensionRoot: string): string[] {
        const toolsDir = path.join(extensionRoot, 'tools');

        if (!fs.existsSync(toolsDir)) {
            return [];
        }

        return fs.readdirSync(toolsDir, { withFileTypes: true })
            .filter(entry => entry.isFile())
            .map(entry => entry.name);
    }
}
