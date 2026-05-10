/// <reference types="chrome" />
import { useEffect, useState, type CSSProperties } from 'react';

type BannerKind = 'success' | 'error' | 'info';

type BannerState = {
  kind: BannerKind;
  text: string;
} | null;

type ValidationErrors = {
  localModel?: string;
  remoteEndpoint?: string;
  remoteModel?: string;
  apiKey?: string;
};

type StorageSnapshot = {
  encryptedApiKey?: unknown;
  isActive?: unknown;
  localModel?: unknown;
  remoteEndpoint?: unknown;
  remoteModel?: unknown;
  useRemote?: unknown;
};

type RuntimeResponse = {
  success?: boolean;
  error?: string | { message?: string };
};

const STORAGE_KEYS = [
  'isActive',
  'useRemote',
  'localModel',
  'remoteEndpoint',
  'remoteModel',
  'encryptedApiKey',
] as const;

const PANEL_WIDTH = 380;
const VERSION = '2.0.0';
const DEFAULT_REMOTE_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function App() {
  const [isReady, setIsReady] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [useRemote, setUseRemote] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState('Checking...');
  const [localModel, setLocalModel] = useState('');
  const [remoteEndpoint, setRemoteEndpoint] = useState('');
  const [remoteModel, setRemoteModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [currentMode, setCurrentMode] = useState('Detecting...');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [banner, setBanner] = useState<BannerState>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  async function checkOllamaStatus() {
    try {
      const response = await fetch('http://localhost:11434/', { method: 'GET' });
      setOllamaStatus(response.ok ? 'Online' : 'Error');
    } catch {
      setOllamaStatus('Offline');
    }
  }

  async function updateContextMode() {
    try {
      const tab = await getActiveTab();
      setCurrentMode(resolveContextMode(tab?.url));
    } catch {
      setCurrentMode('Unsupported Page');
    }
  }

  async function toggleExtension() {
    const nextValue = !isActive;
    setIsActive(nextValue);
    await setStorage({ isActive: nextValue });
  }

  async function saveSettings() {
    const nextErrors = validateConfiguration({
      apiKey,
      hasSavedKey,
      localModel,
      remoteEndpoint,
      remoteModel,
      useRemote,
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setBanner({ kind: 'error', text: firstError(nextErrors) });
      return;
    }

    await setStorage({
      useRemote,
      localModel: localModel.trim(),
      remoteEndpoint: remoteEndpoint.trim(),
      remoteModel: remoteModel.trim(),
    });

    if (apiKey.trim()) {
      const response = await sendRuntimeMessage<RuntimeResponse>({
        action: 'ENCRYPT_AND_SAVE_KEY',
        key: apiKey.trim(),
      });

      if (!response?.success) {
        setBanner({ kind: 'error', text: extractErrorMessage(response?.error, 'Failed to save API key.') });
        return;
      }

      setApiKey('');
      setHasSavedKey(true);
    }

    setBanner({ kind: 'success', text: 'Configuration saved.' });
  }

  async function clearKey() {
    const response = await sendRuntimeMessage<RuntimeResponse>({ action: 'CLEAR_API_KEY' });
    if (!response?.success) {
      setBanner({ kind: 'error', text: extractErrorMessage(response?.error, 'Failed to clear API key.') });
      return;
    }

    setApiKey('');
    setHasSavedKey(false);
    setBanner({ kind: 'success', text: 'Saved API key removed.' });
  }

  function onLocalModelChange(value: string) {
    setLocalModel(value);
    setErrors((current) => ({ ...current, localModel: undefined }));
  }

  function onRemoteEndpointChange(value: string) {
    setRemoteEndpoint(value);
    setErrors((current) => ({ ...current, remoteEndpoint: undefined }));
  }

  function onRemoteModelChange(value: string) {
    setRemoteModel(value);
    setErrors((current) => ({ ...current, remoteModel: undefined }));
  }

  function onApiKeyChange(value: string) {
    setApiKey(value);
    setErrors((current) => ({ ...current, apiKey: undefined }));
  }

  useEffect(() => {
    const loadPopupState = async () => {
      const snapshot = (await getStorage(STORAGE_KEYS)) as StorageSnapshot;

      setIsActive(Boolean(snapshot.isActive));
      setUseRemote(Boolean(snapshot.useRemote));
      setLocalModel(asString(snapshot.localModel));
      setRemoteEndpoint(asString(snapshot.remoteEndpoint));
      setRemoteModel(asString(snapshot.remoteModel));
      setHasSavedKey(Boolean(asString(snapshot.encryptedApiKey)));
      setIsReady(true);
    };

    const refreshRuntimeState = async () => {
      await Promise.all([checkOllamaStatus(), updateContextMode()]);
    };

    void loadPopupState();
    void refreshRuntimeState();

    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.isActive) setIsActive(Boolean(changes.isActive.newValue));
      if (changes.useRemote) setUseRemote(Boolean(changes.useRemote.newValue));
      if (changes.localModel) setLocalModel(asString(changes.localModel.newValue));
      if (changes.remoteEndpoint) setRemoteEndpoint(asString(changes.remoteEndpoint.newValue));
      if (changes.remoteModel) setRemoteModel(asString(changes.remoteModel.newValue));
      if (changes.encryptedApiKey) setHasSavedKey(Boolean(asString(changes.encryptedApiKey.newValue)));
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  if (!isReady) {
    return (
      <div style={shellStyle}>
        <div style={{ color: '#93A4BC', fontSize: 13 }}>Loading SMAC…</div>
      </div>
    );
  }

  const backendLabel = useRemote
    ? 'Remote (API)'
    : `Local (${localModel.trim() || 'Not configured'})`;

  return (
    <div style={shellStyle}>
      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={badgeStyle}>S</div>
            <div>
              <div style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 700 }}>SMAC v{VERSION}</div>
              <div style={{ color: '#93A4BC', fontSize: 12 }}>{backendLabel}</div>
            </div>
          </div>
          <button onClick={() => void toggleExtension()} style={isActive ? activeToggleStyle : pausedToggleStyle}>
            {isActive ? 'Active' : 'Paused'}
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Model Configuration</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setUseRemote(false)} style={!useRemote ? selectedTabStyle : tabStyle}>
            Local
          </button>
          <button onClick={() => setUseRemote(true)} style={useRemote ? selectedTabStyle : tabStyle}>
            Remote
          </button>
        </div>

        {!useRemote ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={statusRowStyle}>
              <span style={{ color: '#CBD5E1', fontSize: 13 }}>Ollama Status</span>
              <span style={{ ...statusPillStyle, color: ollamaStatus === 'Online' ? '#10B981' : '#F97316' }}>
                {ollamaStatus}
              </span>
            </div>
            {ollamaStatus !== 'Online' ? (
              <div style={helperTextStyle}>Run `./start-smac.sh` to start Ollama.</div>
            ) : null}
            <div>
              <input
                type="text"
                value={localModel}
                onChange={(event) => onLocalModelChange(event.target.value)}
                placeholder="e.g. gemma3:4b, llava-phi3:latest"
                style={inputStyle(errors.localModel)}
              />
              {errors.localModel ? <div style={errorTextStyle}>{errors.localModel}</div> : null}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={warningStyle}>
              Remote mode - your post content will be sent to the configured API.
            </div>
            <div>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => onApiKeyChange(event.target.value)}
                placeholder={hasSavedKey ? 'Saved key present. Enter a new one to replace it.' : 'Enter API key'}
                style={inputStyle(errors.apiKey)}
              />
              {errors.apiKey ? <div style={errorTextStyle}>{errors.apiKey}</div> : null}
              {!errors.apiKey && hasSavedKey ? (
                <div style={helperTextStyle}>A key is already saved and encrypted in storage.</div>
              ) : null}
            </div>
            <div>
              <input
                type="text"
                value={remoteEndpoint}
                onChange={(event) => onRemoteEndpointChange(event.target.value)}
                placeholder={DEFAULT_REMOTE_ENDPOINT}
                style={inputStyle(errors.remoteEndpoint)}
              />
              {errors.remoteEndpoint ? <div style={errorTextStyle}>{errors.remoteEndpoint}</div> : null}
            </div>
            <div>
              <input
                type="text"
                value={remoteModel}
                onChange={(event) => onRemoteModelChange(event.target.value)}
                placeholder="e.g. gpt-4o, gemini-1.5-flash"
                style={inputStyle(errors.remoteModel)}
              />
              {errors.remoteModel ? <div style={errorTextStyle}>{errors.remoteModel}</div> : null}
            </div>
            <button onClick={() => void clearKey()} style={clearButtonStyle}>
              Clear Key
            </button>
          </div>
        )}

        <button onClick={() => void saveSettings()} style={saveButtonStyle}>
          Save Configuration
        </button>
        {banner ? <div style={bannerStyle(banner.kind)}>{banner.text}</div> : null}
      </section>

      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Context Mode</div>
        <div style={statusRowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: currentMode === 'Unsupported Page' ? '#64748B' : '#10B981',
                boxShadow: `0 0 10px ${currentMode === 'Unsupported Page' ? '#64748B' : '#10B981'}`,
              }}
            />
            <span style={{ color: '#E2E8F0', fontSize: 13 }}>{currentMode}</span>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <button onClick={() => setHelpOpen((open) => !open)} style={helpToggleStyle}>
          <span>Quick Help</span>
          <span>{helpOpen ? 'Hide' : 'Show'}</span>
        </button>
        {helpOpen ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <div style={helperTextStyle}>Run `./start-smac.sh` before using local mode.</div>
            <div style={helperTextStyle}>
              For Gemini API, use endpoint: `https://generativelanguage.googleapis.com/v1beta`
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function resolveContextMode(url?: string) {
  if (!url) return 'Unsupported Page';

  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const path = parsed.pathname;

    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
      if (path.startsWith('/messaging')) return 'Messages';
      if (path.startsWith('/in/')) return 'Profile Page';
      if (path.startsWith('/feed') || path.startsWith('/posts/') || path.startsWith('/feed/update/')) {
        return 'Post Feed';
      }
      return 'Unsupported Page';
    }

    if (host === 'twitter.com' || host.endsWith('.twitter.com') || host === 'x.com' || host.endsWith('.x.com')) {
      if (path.startsWith('/messages')) return 'Messages';
      if (path.startsWith('/home') || path.startsWith('/explore') || path.startsWith('/search') || path.includes('/status/')) {
        return 'Post Feed';
      }

      const segments = path.split('/').filter(Boolean);
      const reserved = new Set(['explore', 'home', 'messages', 'notifications', 'search', 'settings']);
      if (segments.length === 1 && !reserved.has(segments[0])) return 'Profile Page';
    }
  } catch {
    return 'Unsupported Page';
  }

  return 'Unsupported Page';
}

function validateConfiguration(input: {
  apiKey: string;
  hasSavedKey: boolean;
  localModel: string;
  remoteEndpoint: string;
  remoteModel: string;
  useRemote: boolean;
}): ValidationErrors {
  const nextErrors: ValidationErrors = {};

  if (!input.useRemote) {
    if (!input.localModel.trim()) nextErrors.localModel = 'Please enter a model name.';
    return nextErrors;
  }

  if (!input.remoteEndpoint.trim()) {
    nextErrors.remoteEndpoint = 'Please enter an endpoint.';
  } else if (!input.remoteEndpoint.trim().startsWith('https://')) {
    nextErrors.remoteEndpoint = 'Endpoint must use HTTPS';
  }

  if (!input.remoteModel.trim()) nextErrors.remoteModel = 'Please enter a model name.';
  if (!input.hasSavedKey && !input.apiKey.trim()) nextErrors.apiKey = 'Please enter an API key.';

  return nextErrors;
}

function firstError(errors: ValidationErrors) {
  return errors.localModel || errors.remoteEndpoint || errors.remoteModel || errors.apiKey || 'Please review your settings.';
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function getStorage(keys: readonly string[]) {
  return new Promise<Record<string, unknown>>((resolve) => {
    chrome.storage.local.get([...keys], (result) => resolve(result as Record<string, unknown>));
  });
}

function setStorage(items: Record<string, unknown>) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

function sendRuntimeMessage<T>(message: Record<string, unknown>) {
  return new Promise<T>((resolve) => {
    chrome.runtime.sendMessage(message, (response: T) => resolve(response));
  });
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function extractErrorMessage(error: RuntimeResponse['error'], fallback: string) {
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

const shellStyle: CSSProperties = {
  width: PANEL_WIDTH,
  background: '#0F172A',
  color: '#E2E8F0',
  fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
  display: 'grid',
  gap: 14,
  padding: 16,
  boxSizing: 'border-box',
};

const sectionStyle: CSSProperties = {
  background: '#111C30',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  borderRadius: 16,
  padding: 14,
};

const sectionLabelStyle: CSSProperties = {
  color: '#F8FAFC',
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
};

const badgeStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: 'linear-gradient(135deg, #0EA5E9 0%, #14B8A6 100%)',
  color: '#F8FAFC',
  display: 'grid',
  placeItems: 'center',
  fontWeight: 700,
  fontSize: 18,
  boxShadow: '0 12px 24px rgba(20, 184, 166, 0.28)',
};

const activeToggleStyle: CSSProperties = {
  background: '#0F766E',
  color: '#ECFEFF',
  border: 'none',
  borderRadius: 999,
  padding: '9px 14px',
  cursor: 'pointer',
  fontWeight: 700,
};

const pausedToggleStyle: CSSProperties = {
  background: '#334155',
  color: '#E2E8F0',
  border: 'none',
  borderRadius: 999,
  padding: '9px 14px',
  cursor: 'pointer',
  fontWeight: 700,
};

const tabStyle: CSSProperties = {
  background: '#16233A',
  color: '#CBD5E1',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: 12,
  padding: '10px 12px',
  cursor: 'pointer',
  fontWeight: 600,
};

const selectedTabStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #0EA5E9 0%, #14B8A6 100%)',
  color: '#F8FAFC',
  border: 'none',
  borderRadius: 12,
  padding: '10px 12px',
  cursor: 'pointer',
  fontWeight: 700,
};

const statusRowStyle: CSSProperties = {
  background: '#0B1424',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: 12,
  padding: '10px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const statusPillStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
};

const warningStyle: CSSProperties = {
  background: 'rgba(245, 158, 11, 0.12)',
  border: '1px solid rgba(245, 158, 11, 0.24)',
  color: '#FDE68A',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 12,
  lineHeight: 1.45,
};

const saveButtonStyle: CSSProperties = {
  width: '100%',
  marginTop: 14,
  background: 'linear-gradient(135deg, #0EA5E9 0%, #14B8A6 100%)',
  color: '#F8FAFC',
  border: 'none',
  borderRadius: 12,
  padding: '11px 14px',
  cursor: 'pointer',
  fontWeight: 700,
};

const clearButtonStyle: CSSProperties = {
  background: 'transparent',
  color: '#FCA5A5',
  border: '1px solid rgba(239, 68, 68, 0.45)',
  borderRadius: 12,
  padding: '10px 12px',
  cursor: 'pointer',
  fontWeight: 600,
};

const helpToggleStyle: CSSProperties = {
  width: '100%',
  background: 'transparent',
  color: '#E2E8F0',
  border: 'none',
  padding: 0,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  fontWeight: 700,
};

const helperTextStyle: CSSProperties = {
  color: '#93A4BC',
  fontSize: 12,
  lineHeight: 1.45,
};

const errorTextStyle: CSSProperties = {
  color: '#FCA5A5',
  fontSize: 12,
  marginTop: 6,
};

function inputStyle(hasError?: string): CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    background: '#091120',
    color: '#F8FAFC',
    border: `1px solid ${hasError ? 'rgba(239, 68, 68, 0.55)' : 'rgba(148, 163, 184, 0.18)'}`,
    borderRadius: 12,
    padding: '11px 12px',
    outline: 'none',
    fontSize: 13,
  };
}

function bannerStyle(kind: BannerKind): CSSProperties {
  const palette: Record<BannerKind, { background: string; border: string; color: string }> = {
    success: {
      background: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.24)',
      color: '#A7F3D0',
    },
    error: {
      background: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.24)',
      color: '#FECACA',
    },
    info: {
      background: 'rgba(14, 165, 233, 0.12)',
      border: 'rgba(14, 165, 233, 0.24)',
      color: '#BAE6FD',
    },
  };

  return {
    marginTop: 12,
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 12,
    border: `1px solid ${palette[kind].border}`,
    background: palette[kind].background,
    color: palette[kind].color,
  };
}

export default App;
