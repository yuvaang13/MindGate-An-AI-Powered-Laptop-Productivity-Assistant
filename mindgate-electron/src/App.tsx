import React, { useEffect, useState } from 'react';
import { Configuration } from './types';
import './styles/glassmorphism.css';
import { LiquidGlassOverlay } from './components/overlay/Overlay';

const App: React.FC = () => {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [isOllamaConnected, setIsOllamaConnected] = useState(true);

  useEffect(() => {
    console.log('[App] Mounted — requesting configuration');
    try {
      window.mindgateAPI.getConfiguration().then(cfg => {
        console.log('[App] Configuration loaded');
        setConfiguration(cfg);
      });
    } catch (e) {
      console.error('[App] getConfiguration failed:', e);
    }
  }, []);

  useEffect(() => {
    console.log('[App] Registering IPC listeners');
    try {
      window.mindgateAPI.onShowOverlay(() => {
        console.log('[App] show-overlay callback fired — setting overlay visible');
        setIsOverlayVisible(true);
      });

      window.mindgateAPI.onHideOverlay(() => {
        console.log('[App] hide-overlay callback fired — hiding overlay');
        setIsOverlayVisible(false);
      });

      window.mindgateAPI.onOllamaStatusChanged((connected) => {
        console.log('[App] Ollama status changed:', connected);
        setIsOllamaConnected(connected);
      });

      console.log('[App] IPC listeners registered');
    } catch (e) {
      console.error('[App] Failed to register listeners:', e);
    }
  }, []);

  const handleClose = () => {
    console.log('[App] handleClose');
    setIsOverlayVisible(false);
    window.mindgateAPI.hideOverlay();
  };

  console.log('[App] Render — config:', !!configuration, 'overlay:', isOverlayVisible);
  if (!configuration) {
    return null;
  }

  return (
    <>
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
          WebkitBackdropFilter: 'blur(10px)'
        }}>
          Ollama Disconnected
        </div>
      )}
      <LiquidGlassOverlay
        visible={isOverlayVisible}
        configuration={configuration}
        onClose={handleClose}
      />
    </>
  );
};

export default App;