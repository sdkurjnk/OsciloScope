import * as fs from 'fs';

interface RawLog {
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

export class LogParser {
    private logFilePath: string;

    private static readonly DOMAIN_LABELS: { [key: string]: string } = {
        LOCAL  : 'Local',
        GLOBAL : 'Global',
    };

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

    // var_id(소유 프레임 call_id)로 변수 정체성을 키잉한다.
    // 수정 프레임(call_id)이 달라도 소유 프레임이 같으면 같은 변수로 묶인다.
    // 폴백: var_id가 없는 구버전 로그는 이름만으로 키잉.
    private getVarKey(log: RawLog): string {
        if (log.var_id === null) {
            return log.name;
        }
        return `${log.name}@${log.var_id}`;
    }

    // 사이드바 그룹: GLOBAL → Global, LOCAL → Local
    private getGroupKey(log: RawLog): string {
        return log.domain === 'GLOBAL' ? 'Global' : 'Local';
    }

    public transformData(rawLogs: RawLog[]): Object {
        const result: { [group: string]: any[] } = {};
        const varMap: { [key: string]: any } = {};
        const stepCounter: { [key: string]: number } = {};

        for (const log of rawLogs) {
            const key = this.getVarKey(log);

            if (!varMap[key]) {
                // 변수 단위 메타는 첫 등장 시 한 번만 저장 (history 행마다 반복 X)
                varMap[key] = {
                    varKey       : key,
                    varName      : log.name,
                    type         : typeof log.data,
                    scope        : LogParser.DOMAIN_LABELS[log.domain] ?? 'Unknown',
                    func         : log.func,
                    callId       : log.call_id,
                    parentCallId : log.parent_call_id,
                    callDepth    : log.call_depth,
                    group        : this.getGroupKey(log),
                    history      : []
                };
                stepCounter[key] = 0;
            }

            stepCounter[key]++;

            const value = log.event === 'deleted' ? null : log.data;

            // 스텝 단위 속성만 행마다 기록
            varMap[key].history.push({
                step  : stepCounter[key],
                line  : log.line,
                value : value,
                event : log.event
            });
        }

        for (const varData of Object.values(varMap)) {
            const group = varData.group;
            if (!result[group]) {
                result[group] = [];
            }
            result[group].push(varData);
        }

        return result;
    }
}
