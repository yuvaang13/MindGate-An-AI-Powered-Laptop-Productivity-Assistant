import './index.css';
import { useEffect, useState, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Settings } from './components/settings/Settings';
import type { Configuration } from './types';

const urlParams = new URLSearchParams(window.location.search);
const isSettingsWindow = urlParams.get('settings') === 'true';

const RootComponent = () => {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(isSettingsWindow);

  useEffect(() => {
    if (isSettingsWindow) {
      const load = () => {
        if (window.mindgateAPI) {
          window.mindgateAPI.getConfiguration().then(setConfiguration).finally(() => setLoading(false));
        } else {
          setTimeout(load, 100);
        }
      };
      setTimeout(load, 100);
    }
  }, []);

  if (isSettingsWindow) {
    if (loading || !configuration) return null;
    return <Settings configuration={configuration} />;
  }
  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>
);