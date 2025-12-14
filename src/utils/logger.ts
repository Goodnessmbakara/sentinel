type Meta = Record<string, unknown>;

function format(level: string, message: string, meta?: Meta) {
    const out: any = {
        ts: new Date().toISOString(),
        level,
        msg: message,
    };
    if (meta && Object.keys(meta).length) out.meta = meta;
    return JSON.stringify(out);
}

export const logger = {
    info: (msg: string, meta?: Meta) => console.log(format('info', msg, meta)),
    warn: (msg: string, meta?: Meta) => console.warn(format('warn', msg, meta)),
    error: (msg: string, meta?: Meta) => console.error(format('error', msg, meta)),
    debug: (msg: string, meta?: Meta) => {
        if (process.env.DEBUG) console.debug(format('debug', msg, meta));
    }
};

export default logger;
