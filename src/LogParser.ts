import * as fs from 'fs';

interface RawLog {
    name           : string;
    data           : any;
    event          : string;          // "init" | "updated" | "deleted"
    domain         : string;          // "LOCAL" | "GLOBAL" | "ENCLOSING" | "UNKNOWN"
    line           : number | null;
    func           : string | null;   // 이벤트가 발생한 함수, 모듈 최상위는 "<module>"
    call_id        : number | null;   // 함수 호출 1건 고유 ID (연속적이지 않음 — 불투명 ID로 취급)
    parent_call_id : number | null;   // 부모 프레임의 call_id, 최상위면 null
    call_depth     : number | null;   // 호출 스택 깊이, 1부터
}

export class LogParser {
    private logFilePath: string;

    private static readonly DOMAIN_LABELS: { [key: string]: string } = {
        LOCAL     : 'Local',
        GLOBAL    : 'Global',
        ENCLOSING : 'Enclosing',
    };

    constructor(logFilePath: string) {
        this.logFilePath = logFilePath;
    }

    public parseLogFile(): RawLog[] {
        if (!fs.existsSync(this.logFilePath)) {
            console.error(`파일을 찾을 수 없어요: ${this.logFilePath}`);
            return [];
        }
        const fileContent = fs.readFileSync(this.logFilePath, 'utf-8');
        const lines = fileContent.trim().split('\n');
        return lines.map(line => {
            const log = JSON.parse(line);
            // 구버전 로그(4개 속성 없음) 호환: undefined → null 정규화
            log.line           = log.line           ?? null;
            log.func           = log.func           ?? null;
            log.call_id        = log.call_id        ?? null;
            log.parent_call_id = log.parent_call_id ?? null;
            log.call_depth     = log.call_depth     ?? null;
            return log as RawLog;
        });
    }

    /**
     * 변수 식별 키 (LEGB 기준)
     * - LOCAL: 변수가 자기 프레임에서만 변경됨 → 호출(재귀 포함)마다 별개 인스턴스
     *          → name@call_id 로 분리
     * - ENCLOSING/GLOBAL: 변수는 바깥 스코프 소유인데 call_id는 "변경이 일어난
     *          안쪽 프레임"을 가리킴 → call_id로 키잉하면 하나의 변수가 쪼개짐
     *          → 이름만으로 키잉해서 단일 타임라인 유지
     * ※ ENCLOSING 한계: 바깥 함수가 여러 번 호출되면 각 인스턴스의 클로저 변수가
     *    이름 기준으로 합쳐짐. 정확히 나누려면 로그에 소유 프레임의 call_id
     *    (owner_call_id)가 필요 — 백엔드 확장 후보.
     */
    private getVarKey(log: RawLog): string {
        if (log.domain !== 'LOCAL' || log.call_id === null) {
            return log.name;
        }
        return `${log.name}@${log.call_id}`;
    }

    /**
     * 사이드바 그룹 키: 스코프 단위 (Global / Local / Enclosing)
     * ※ func/call_id 는 varData 메타에 남아 있으므로,
     *   추후 함수별(func1, func2 …) 그룹핑으로 확장 시 이 함수만 바꾸면 됨
     */
    private getGroupKey(log: RawLog): string {
        return LogParser.DOMAIN_LABELS[log.domain] ?? 'Local';
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
