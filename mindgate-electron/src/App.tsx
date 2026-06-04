import React, { useEffect, useState } from 'react';
import { Configuration } from './types';
import { Orb } from './components/orb/Orb';
import { ChatInterface } from './components/chat/ChatInterface';
import { WindowManager } from './services/windowManager';

const App: React.FC = () => {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [isOrbExpanded, setIsOrbExpanded] = useState(false);
  const [windowManager] = useState(() => new WindowManager({} as Configuration));

  useEffect(() => {
    window.mindgateAPI.getConfiguration().then(setConfiguration);
  }, []);

  useEffect(() => {
    window.mindgateAPI.onShowOrb(() => {
      setIsOrbExpanded(true);
    });

    window.mindgateAPI.onHideOrb(() => {
      setIsOrbExpanded(false);
    });
  }, []);

  const handleExpand = () => {
    setIsOrbExpanded(true);
  };

  const handleClose = () => {
    setIsOrbExpanded(false);
    window.mindgateAPI.hideOrb();
  };

  const handleSubmit = async (userInput: string) => {
    const result = await window.mindgateAPI.evaluateRequest(userInput);
    if (result.isApproved) {
      window.mindgateAPI.grantAccess(300);
      setIsOrbExpanded(false);
    }
  };

  if (!configuration) {
    return <div>Loading...</div>;
  }

  return isOrbExpanded ? (
    <ChatInterface
      configuration={configuration}
      onSubmit={handleSubmit}
      onClose={handleClose}
    />
  ) : (
    <Orb configuration={configuration} onExpand={handleExpand} />
  );
};

export default App;