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
    <div style={{ width: '320px', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>SMAC Extension</h1>

      <div style={{ margin: '20px 0' }}>
        <button
          onClick={toggleExtension}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
            backgroundColor: isActive ? '#ff4d4f' : '#33cc33',  // Red for STOP, Green for START
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          {isActive ? 'STOP EXTENSION' : 'START EXTENSION'}
        </button>
      </div>

      <p>Status: <strong>{isActive ? 'Active (Simulation Mode)' : 'Inactive'}</strong></p>

      <div style={{ marginTop: '15px', padding: '10px', background: '#f0f0f0', borderRadius: '5px', fontSize: '12px' }}>
        {isActive ? 'Monitoring social media posts...' : 'Extension is paused.'}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={exportLogs} disabled={logs.length === 0} style={{ padding: '8px', cursor: 'pointer' }}>Export Logs ({logs.length})</button>
        <button onClick={clearLogs} disabled={logs.length === 0} style={{ padding: '8px', cursor: 'pointer' }}>Clear Logs</button>
      </div>
      <p style={{ fontSize: '10px', color: '#999', marginTop: '10px' }}>
        Ollama: localhost:11434
      </p>
    </div>
  )
}


export default App
