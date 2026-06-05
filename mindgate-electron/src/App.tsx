import React, { useEffect, useState } from 'react';
import { Configuration, DecisionResult } from './types';
import { Orb } from './components/orb/Orb';
import { ChatInterface } from './components/chat/ChatInterface';
import { Overlay } from './components/overlay/Overlay';
import { WindowManager } from './services/windowManager';

const App: React.FC = () => {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [isOrbExpanded, setIsOrbExpanded] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [isOllamaConnected, setIsOllamaConnected] = useState(true);
  const [hasAccessibilityAccess, setHasAccessibilityAccess] = useState(true);
  const [isMac, setIsMac] = useState(false);
  const [windowManager] = useState(() => new WindowManager({} as Configuration));

  useEffect(() => {
    window.mindgateAPI.getConfiguration().then(setConfiguration);
    window.mindgateAPI.checkAccessibilityPermission().then(setHasAccessibilityAccess);
    setIsMac(process.platform === 'darwin');
  }, []);

  useEffect(() => {
    window.mindgateAPI.onShowOrb(() => {
      setIsOrbExpanded(true);
    });

    window.mindgateAPI.onHideOrb(() => {
      setIsOrbExpanded(false);
    });

    window.mindgateAPI.onShowOverlay(() => {
      setIsOverlayVisible(true);
    });

    window.mindgateAPI.onHideOverlay(() => {
      setIsOverlayVisible(false);
    });

    window.mindgateAPI.onOllamaStatusChanged((connected) => {
      setIsOllamaConnected(connected);
    });
  }, []);

  useEffect(() => {
    if (configuration) {
      windowManager.updateConfiguration(configuration);
    }
  }, [configuration]);

  const handleExpand = () => {
    setIsOrbExpanded(true);
  };

  const handleClose = () => {
    setIsOrbExpanded(false);
    window.mindgateAPI.hideOrb();
  };

  const handleSubmit = async (userInput: string): Promise<DecisionResult | void> => {
    const result = await window.mindgateAPI.evaluateRequest(userInput);
    if (!result.isApproved) {
      window.mindgateAPI.closeDistraction();
    }
    return result;
  };

  if (!configuration) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {!hasAccessibilityAccess && isMac && (
        <div style={{
          position: 'fixed',
          top: 10,
          right: 10,
          background: '#FF9F0A',
          color: 'white',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 12,
          zIndex: 99999,
          cursor: 'pointer'
        }} onClick={() => window.mindgateAPI.requestAccessibilityPermission()}>
          Accessibility Permission Needed - Click to Grant
        </div>
      )}
      {!isOllamaConnected && (
        <div style={{
          position: 'fixed',
          top: hasAccessibilityAccess ? 10 : 40,
          right: 10,
          background: '#FF453A',
          color: 'white',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 12,
          zIndex: 99999
        }}>
          Ollama Disconnected
        </div>
      )}
      {isOrbExpanded ? (
        <ChatInterface
          configuration={configuration}
          onSubmit={handleSubmit}
          onClose={handleClose}
        />
      ) : (
        <Orb configuration={configuration} onExpand={handleExpand} />
      )}
      <Overlay visible={isOverlayVisible} />
    </>
  );
};

export default App;