import * as fs from 'fs';

// 도구(analyze)의 입력 타입이자 UPDATE_ALL_DATA payload의 일부라 외부에 공개한다.
export interface RawLog {
    name           : string;
    data           : any;
    event          : string;          // "init" | "updated" | "deleted"
    domain         : string;          // "GLOBAL" | "LOCAL" (소유 프레임 기준)
    line           : number | null;
    func           : string | null;   // 이벤트가 발생한 함수, 모듈 최상위는 "<module>"
    call_id        : number | null;   // 이벤트가 발생한 프레임의 고유 ID (불투명 ID로 취급)
    parent_call_id : number | null;   // 부모 프레임의 call_id, 최상위면 null
    call_depth     : number | null;   // 호출 스택 깊이, 1부터
    var_id         : number | null;   // 변수가 정의된 소유 프레임의 call_id (정체성 키)
}

// 로그 파일을 RawLog[]로 읽기만 한다.
// 가공(변수별 묶기·그룹핑·이력 구성)은 웹뷰에서 도구의 analyze()가 담당한다.
export class LogParser {
    private logFilePath: string;

    constructor(logFilePath: string) {
        this.logFilePath = logFilePath;
    }

    public parseLogFile(): RawLog[] {
        const fileContent = fs.readFileSync(this.logFilePath, 'utf-8');
        const lines = fileContent.trim().split('\n');
        return lines.map(line => {
            const log = JSON.parse(line);
            // 구버전 로그 호환: undefined → null 정규화
            log.line           = log.line           ?? null;
            log.func           = log.func           ?? null;
            log.call_id        = log.call_id        ?? null;
            log.parent_call_id = log.parent_call_id ?? null;
            log.call_depth     = log.call_depth     ?? null;
            log.var_id         = log.var_id         ?? null;
            return log as RawLog;
        });
    }
}
