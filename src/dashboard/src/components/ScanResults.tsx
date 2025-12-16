import React from 'react';

interface ScanResult {
  token: string;
  summary?: string;
  decision?: any;
  error?: string;
}

interface Props {
  results: ScanResult[];
}

export default function ScanResults({ results }: Props) {
  return (
    <section className="glass-card">
      <h2>Scan Results</h2>
      {results.length === 0 ? (
        <p>No recent scans.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="scan-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px' }}>Token</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Action</th>
                <th style={{ textAlign: 'right', padding: '8px' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Reason</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Summary</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const d = r.decision;
                const action = d?.action ?? (r.error ? 'ERROR' : '—');
                const amount = d?.amount ?? '—';
                const reason = d?.reasoning ?? '—';
                const summary = r.summary ?? '';
                return (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '8px', fontFamily: 'monospace' }}>{r.token}</td>
                    <td style={{ padding: '8px' }}>{action}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{amount}</td>
                    <td style={{ padding: '8px' }}>{reason}</td>
                    <td style={{ padding: '8px', opacity: 0.9 }}>{summary}</td>
                    <td style={{ padding: '8px' }}>
                      {r.error || r.errorStack ? (
                        <details>
                          <summary style={{ cursor: 'pointer', color: '#ff7b7b' }}>{r.error ? 'Error' : 'Details'}</summary>
                          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 6 }}>{r.errorStack || r.error}</pre>
                        </details>
                      ) : (
                        <span style={{ opacity: 0.6 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
