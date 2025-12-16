import React from 'react';

interface LogEntry {
  ts: string;
  level: string;
  msg: string;
  meta?: any;
}

interface Props {
  logs: LogEntry[];
}

export default function LogViewer({ logs }: Props) {
  return (
    <section className="glass-card">
      <h2>Recent Logs</h2>
      {logs.length === 0 ? (
        <p>No logs fetched yet.</p>
      ) : (
        <div style={{ maxHeight: 320, overflow: 'auto', fontFamily: 'monospace' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Time</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Level</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Message</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Meta</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: 8 }}>{new Date(l.ts).toLocaleString()}</td>
                  <td style={{ padding: 8 }}>{l.level}</td>
                  <td style={{ padding: 8 }}>{l.msg}</td>
                  <td style={{ padding: 8 }}>
                    {l.meta ? (
                      <details>
                        <summary style={{ cursor: 'pointer' }}>view</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(l.meta, null, 2)}</pre>
                      </details>
                    ) : (
                      <span style={{ opacity: 0.6 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
