type CounterMap = { [k: string]: number };
type TimingMap = { [k: string]: { count: number; totalMs: number } };

class Metrics {
    private counters: CounterMap = {};
    private timings: TimingMap = {};

    inc(name: string, n = 1) {
        this.counters[name] = (this.counters[name] || 0) + n;
    }

    timing(name: string, ms: number) {
        const cur = this.timings[name] || { count: 0, totalMs: 0 };
        cur.count += 1;
        cur.totalMs += ms;
        this.timings[name] = cur;
    }

    snapshot() {
        return {
            counters: { ...this.counters },
            timings: { ...this.timings }
        };
    }

    reset() {
        this.counters = {};
        this.timings = {};
    }
}

export const metrics = new Metrics();

export default metrics;
