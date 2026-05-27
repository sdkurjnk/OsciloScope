import * as fs from 'fs';

interface RawLog {
    name  : string;
    data  : any;
    event : string;
}

export class LogParser {
    private logFilePath: string;

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
        return lines.map(line => JSON.parse(line));
    }

    public transformData(rawLogs: RawLog[]): Object {
    const result: { [scope: string]: any[] } = {};
    const varMap: { [name: string]: any } = {};
    const stepCounter: { [name: string]: number } = {};

    for (const log of rawLogs) {
        if (!varMap[log.name]) {
            varMap[log.name] = {
                varName: log.name,
                type: typeof log.data,
                scope: 'Global',
                history: []
            };
            stepCounter[log.name] = 0;
        }

        stepCounter[log.name]++;

        const value = log.event === 'deleted' ? null : log.data;

        varMap[log.name].history.push({
            step  : stepCounter[log.name],
            line  : null,
            value : value
        });
    }

    for (const varData of Object.values(varMap)) {
        const scope = varData.scope;
        if (!result[scope]) {
            result[scope] = [];
        }
        result[scope].push(varData);
    }

    return result;
}
}