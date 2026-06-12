import React, { useEffect, useState, useRef, ErrorInfo } from 'react';
import { Configuration } from './types';
import './styles/glassmorphism.css';
import { LiquidGlassOverlay, OverlayHandle } from './components/overlay/Overlay';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[App] ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(255,255,255,0.92)', borderRadius: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1c1c1e', fontSize: '16px', padding: '24px', textAlign: 'center',
          zIndex: 2147483647,
        }}>
          MindGate encountered an error. Restart the app.
        </div>
      );
    }
    return this.props.children;
  }
}

const defaultConfig: Configuration = {
  settings: {
    distractingApps: [],
    restrictedKeywords: [],
    monitoredBrowsers: ['Safari', 'Google Chrome', 'Microsoft Edge', 'Firefox', 'Brave'],
    ollamaURL: 'http://localhost:11434/api/generate',
    ollamaModel: 'gemma3:1b',
    accessDurations: [300, 600, 900],
    accessDurationLabels: ['5 Mins', '10 Mins', '15 Mins'],
    productiveTasks: [],
    productiveApps: [],
    justificationCountdownDuration: 20,
  },
  theme: {
    colors: { primary: '#FFF', secondary: '#FFFFFFB3', accent: '#FFFFFF99', background: '#000', surface: '#000', text: '#FFF', textSecondary: '#FFFFFFB3', error: '#FF453A', warning: '#FF9F0A' },
    animation: { transitionDuration: 0.3, overlayFadeDuration: 0.3 },
    dimensions: { overlayWidth: 280, overlayHeight: 280, chatCornerRadius: 24 },
  },
};

const permissionMessages = [
  'MindGate needs Accessibility access to detect your active window and help you stay focused.',
  'Please grant permission in System Settings > Privacy & Security > Accessibility.',
  'After granting, restart MindGate for full functionality.',
];

const App: React.FC = () => {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [isOllamaConnected, setIsOllamaConnected] = useState(true);
  const [hasPermission, setHasPermission] = useState(true);
  const overlayRef = useRef<OverlayHandle>(null);

  useEffect(() => {
    if (window.mindgateAPI) {
      window.mindgateAPI.getConfiguration().then(setConfiguration).catch((e: unknown) => {
        console.error('[App] getConfiguration failed:', e);
      });
      window.mindgateAPI.checkAccessibilityPermission().then(setHasPermission);
    } else {
      console.warn('[App] mindgateAPI not available yet');
      const check = () => {
        if (window.mindgateAPI) {
          window.mindgateAPI.getConfiguration().then(setConfiguration).catch(() => {});
          window.mindgateAPI.checkAccessibilityPermission().then(setHasPermission);
        } else {
          setTimeout(check, 100);
        }
      };
      setTimeout(check, 100);
    }
  }, []);

  const pendingShowRef = useRef(false);

  useEffect(() => {
    window.__showOverlay = () => {
      if (overlayRef.current) {
        void overlayRef.current.resetChat();
      } else {
        pendingShowRef.current = true;
      }
    };

    window.__hideOverlay = () => {
      // Window visibility is controlled by the main process.
    };

    window.__resetOverlay = () => {
      void overlayRef.current?.resetChat();
    };

    const unsubscribe = window.mindgateAPI.onOllamaStatusChanged(setIsOllamaConnected);

    return () => {
      delete window.__showOverlay;
      delete window.__hideOverlay;
      delete window.__resetOverlay;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (pendingShowRef.current && overlayRef.current) {
      pendingShowRef.current = false;
      void overlayRef.current.resetChat();
    }
  });

  const handleClose = () => {
    void window.mindgateAPI.hideOverlay();
  };

  const cfg = configuration ?? defaultConfig;

  return (
    <ErrorBoundary>
      {!hasPermission && (
        <div style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          background: 'rgba(255, 69, 58, 0.9)',
          color: 'white',
          padding: '8px 14px',
          borderRadius: '10px',
          fontSize: '12px',
          zIndex: 2147483647,
          maxWidth: '240px',
          lineHeight: 1.4,
        }}>
          {permissionMessages.map((msg, i) => <div key={i}>{msg}</div>)}
        </div>
      )}
      {!isOllamaConnected && (
        <div style={{
          position: 'fixed',
          top: hasPermission ? '12px' : '96px',
          right: '12px',
          background: 'rgba(255, 69, 58, 0.9)',
          color: 'white',
          padding: '8px 14px',
          borderRadius: '10px',
          fontSize: '13px',
          zIndex: 2147483647,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}>
          Ollama Disconnected
        </div>
      )}
      <LiquidGlassOverlay
        ref={overlayRef}
        configuration={cfg}
        onClose={handleClose}
      />
    </ErrorBoundary>
  );
};

export default App;
