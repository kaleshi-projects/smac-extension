/// <reference types="chrome" />
import { useEffect, useState } from 'react'

function App() {
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    // Load initial state
    chrome.storage.local.get(['isActive', 'smacLogs'], (result) => {
      setIsActive(!!result.isActive);
      if (result.smacLogs) setLogs(result.smacLogs as any[]);
    });

    // Listen for storage changes to update UI if changed elsewhere
    const listener = (changes: any) => {
      if (changes.isActive) setIsActive(changes.isActive.newValue);
      if (changes.smacLogs) setLogs(changes.smacLogs.newValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const toggleExtension = () => {
    const newState = !isActive;
    setIsActive(newState);
    chrome.storage.local.set({ isActive: newState });
  };

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smac-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    chrome.storage.local.set({ smacLogs: [] });
    setLogs([]);
  }

  return (
    <div style={{ width: '360px', padding: '24px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          </div>
          <div>
            <h1>SMAC</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>AI Social Companion</span>
          </div>
        </div>
        <div
          className={`status-dot ${isActive ? 'active' : 'inactive'}`}
          style={{
            background: isActive ? 'var(--success)' : 'var(--text-secondary)',
            boxShadow: isActive ? '0 0 12px var(--success)' : 'none'
          }}
        />
      </header>

      <main>
        <div className="card" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isActive
              ? 'Extension is active and monitoring posts.'
              : 'Extension is paused.'}
          </p>

          <button
            onClick={toggleExtension}
            className={isActive ? 'btn-secondary' : 'btn-primary'}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isActive ? 'Pause Extension' : 'Activate SMAC'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={exportLogs}
            disabled={logs.length === 0}
            className="btn-secondary"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px' }}
          >
            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>{logs.length}</span>
            <span>Export Logs</span>
          </button>

          <button
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="btn-secondary"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            <span>Clear History</span>
          </button>
        </div>
      </main>

      <footer style={{ marginTop: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
          Powered by Ollama (Llama 3.2 locally)
        </p>
      </footer>
    </div>
  )
}

export default App
