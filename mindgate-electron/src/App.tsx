import React, { useEffect, useState, ErrorInfo } from 'react';
import { Configuration } from './types';
import './styles/glassmorphism.css';
import { LiquidGlassOverlay } from './components/overlay/Overlay';

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
          position: 'fixed', top: 0, left: 0, width: '340px', height: '340px',
          background: 'rgba(255,255,255,0.9)', borderRadius: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1c1c1e', fontSize: '14px', padding: '20px', textAlign: 'center',
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
    justificationCountdownDuration: 60,
  },
  theme: {
    colors: { primary: '#FFF', secondary: '#FFFFFFB3', accent: '#FFFFFF99', background: '#000', surface: '#000', text: '#FFF', textSecondary: '#FFFFFFB3', error: '#FF453A', warning: '#FF9F0A' },
    animation: { transitionDuration: 0.3, overlayFadeDuration: 0.3 },
    dimensions: { overlayWidth: 340, overlayHeight: 340, chatCornerRadius: 24, overlayXOffset: 24, overlayYOffset: 24 },
  },
};

const App: React.FC = () => {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [isOllamaConnected, setIsOllamaConnected] = useState(true);

  useEffect(() => {
    console.log('[App] Mounted — requesting configuration');
    window.mindgateAPI.getConfiguration().then(cfg => {
      console.log('[App] Configuration loaded');
      setConfiguration(cfg);
    }).catch(e => {
      console.error('[App] getConfiguration failed:', e);
    });
  }, []);

  useEffect(() => {
    console.log('[App] Registering IPC listeners');
    try {
      window.mindgateAPI.onShowOverlay(() => {
        console.log('[App] show-overlay callback fired');
        setIsOverlayVisible(true);
      });

      window.mindgateAPI.onHideOverlay(() => {
        console.log('[App] hide-overlay callback fired');
        setIsOverlayVisible(false);
      });

      window.mindgateAPI.onOllamaStatusChanged((connected) => {
        console.log('[App] Ollama status changed:', connected);
        setIsOllamaConnected(connected);
      });
    } catch (e) {
      console.error('[App] Failed to register listeners:', e);
    }
  }, []);

  const handleClose = () => {
    setIsOverlayVisible(false);
    window.mindgateAPI.hideOverlay();
  };

  const cfg = configuration ?? defaultConfig;

  return (
    <ErrorBoundary>
      {!isOllamaConnected && (
        <div style={{
          position: 'fixed',
          top: '12px',
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
        visible={isOverlayVisible}
        configuration={cfg}
        onClose={handleClose}
      />
    </ErrorBoundary>
  );
};

export default App;