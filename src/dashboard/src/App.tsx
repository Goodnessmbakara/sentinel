import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';
import { ChatInterface } from './components/ChatInterface';
import ScanResults from './components/ScanResults';
import LogViewer from './components/LogViewer';

const API_URL = 'http://localhost:3001';

interface Status {
  status: string;
  timestamp: number;
  agentRunning?: boolean;
  agentReady?: boolean;
}

function App() {
  const [status, setStatus] = useState<string>('UNKNOWN');
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);
  const [mode, setMode] = useState<'GUARDIAN' | 'HUNTER'>('GUARDIAN');
  const [logs, setLogs] = useState<string[]>([]);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await axios.get<Status>(`${API_URL}/health`);
        const body = res.data;
        setLastHeartbeat(body.timestamp || Date.now());

        if (body.agentRunning) {
          if (body.agentReady) setStatus('RUNNING');
          else setStatus('INITIALIZING');
        } else {
          setStatus('ONLINE');
        }
      } catch (e) {
        setStatus('OFFLINE');
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    try {
      // Send empty body - API will use environment variables
      await axios.post(`${API_URL}/start`, {});
      addLog("Agent Started");

      // Immediately trigger a one-shot scan so the UI shows any trade decisions
      try {
        const scanRes = await axios.post(`${API_URL}/scan`, {});
        const results = scanRes.data.results || [];
        setScanResults(results);
        if (results.length === 0) addLog('Scan completed: no tokens scanned');
        for (const r of results) {
          const summary = r.summary || (r.decision ? `${r.decision.action} ${r.decision.amount}` : `error ${r.error}`);
          addLog(`Scan:${r.token} -> ${summary}`);
        }
      } catch (scanErr: any) {
        addLog(`Scan error: ${scanErr.response?.data?.error || scanErr.message}`);
      }

      // Also fetch recent logs for debugging
      try {
        const logsRes = await axios.get(`${API_URL}/logs/recent?limit=200`);
        setRecentLogs(logsRes.data.logs || []);
      } catch (logsErr: any) {
        addLog(`Logs fetch error: ${logsErr.response?.data?.error || logsErr.message}`);
      }
    } catch (e: any) {
      addLog(`Error starting: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleStop = async () => {
    try {
      await axios.post(`${API_URL}/stop`);
      addLog("Agent Stopped");
    } catch (e: any) {
      addLog(`Error stopping: ${e.message}`);
    }
  };

  const handleModeChange = async (newMode: 'GUARDIAN' | 'HUNTER') => {
    try {
      await axios.post(`${API_URL}/config/risk`, { mode: newMode });
      setMode(newMode);
      addLog(`Switched to ${newMode} mode`);
    } catch (e: any) {
      addLog(`Error switching mode: ${e.message}`);
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 4)]);
  };

  return (
    <div className="dashboard-container">
      <header className="glass-card">
        <h1>SENTINEL AI</h1>
        <div style={{ textAlign: 'center' }}>
          <span className={`status-indicator ${status === 'ONLINE' ? 'status-running' : 'status-stopped'}`}>
            {status}
          </span>
          <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Last Heartbeat: {new Date(lastHeartbeat).toLocaleTimeString()}</p>
        </div>
      </header>

      <main className="glass-card">
        <h2>Control Center</h2>
        
        <div className="controls">
          <button className="btn-primary" onClick={handleStart}>
            Initialize Agent
          </button>
          <button className="btn-danger" onClick={handleStop}>
            Emergency Stop
          </button>
          
          <div style={{ flexGrow: 1 }}></div>

          <div className="risk-toggle">
            <div 
              className={`risk-option ${mode === 'GUARDIAN' ? 'active' : ''}`}
              onClick={() => handleModeChange('GUARDIAN')}
            >
              GUARDIAN
            </div>
            <div 
              className={`risk-option ${mode === 'HUNTER' ? 'active' : ''}`}
              onClick={() => handleModeChange('HUNTER')}
            >
              HUNTER
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn-secondary" onClick={async () => {
            try {
              const res = await axios.get(`${API_URL}/logs/recent?limit=200`);
              setRecentLogs(res.data.logs || []);
              addLog('Fetched recent logs');
            } catch (err: any) {
              addLog(`Failed to fetch logs: ${err.message}`);
            }
          }}>Fetch Recent Logs</button>
        </div>

        <div className="metric-grid">
          <div className="metric-item">
            <div className="metric-value">CRC 25</div>
            <div className="metric-label">Network ID</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">v1.0.0</div>
            <div className="metric-label">Agent Version</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">Gemini</div>
            <div className="metric-label">AI Model</div>
          </div>
        </div>
      </main>
      
      <ChatInterface />
      <ScanResults results={scanResults} />
      
      <section className="glass-card">
        <h2>Activity Log</h2>
        <div style={{ fontFamily: 'monospace', opacity: 0.8 }}>
          {logs.length === 0 ? <p>No recent activity.</p> : logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '0.5rem' }}>{log}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;

