type Meta = Record<string, unknown>;

export interface LogEntry {
    ts: string;
    level: string;
    msg: string;
    meta?: Meta;
}

const MAX_LOGS = 500;
const recentLogs: LogEntry[] = [];

function format(level: string, message: string, meta?: Meta) {
    const out: any = {
        ts: new Date().toISOString(),
        level,
        msg: message,
    };
    if (meta && Object.keys(meta).length) out.meta = meta;
    return JSON.stringify(out);
}

function pushLog(entry: LogEntry) {
    recentLogs.unshift(entry);
    if (recentLogs.length > MAX_LOGS) recentLogs.pop();
}

export const logger = {
    info: (msg: string, meta?: Meta) => {
        const entry = { ts: new Date().toISOString(), level: 'info', msg, meta } as LogEntry;
        pushLog(entry);
        console.log(format('info', msg, meta));
    },
    warn: (msg: string, meta?: Meta) => {
        const entry = { ts: new Date().toISOString(), level: 'warn', msg, meta } as LogEntry;
        pushLog(entry);
        console.warn(format('warn', msg, meta));
    },
    error: (msg: string, meta?: Meta) => {
        const entry = { ts: new Date().toISOString(), level: 'error', msg, meta } as LogEntry;
        pushLog(entry);
        console.error(format('error', msg, meta));
    },
    debug: (msg: string, meta?: Meta) => {
        const entry = { ts: new Date().toISOString(), level: 'debug', msg, meta } as LogEntry;
        if (process.env.DEBUG) {
            pushLog(entry);
            console.debug(format('debug', msg, meta));
        }
    }
};

export function getRecentLogs(limit = 100): LogEntry[] {
    return recentLogs.slice(0, limit);
}

export default logger;
