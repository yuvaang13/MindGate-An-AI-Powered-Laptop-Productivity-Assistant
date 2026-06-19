import { Configuration } from '../../types.js';
import '../../styles/glassmorphism.css';

interface TakeoverViewProps {
  configuration: Configuration | null;
  onDismiss: () => void;
}

export const TakeoverView = ({ configuration, onDismiss }: TakeoverViewProps) => {
  const handleOpenNewTab = () => {
    window.mindgateAPI?.launchURL?.('https://www.google.com');
    onDismiss();
  };

  const handleOpenProductiveApp = () => {
    const productiveApps = configuration?.settings?.productiveApps;
    if (productiveApps && productiveApps.length > 0) {
      const randomApp = productiveApps[Math.floor(Math.random() * productiveApps.length)];
      window.mindgateAPI?.launchApp?.(randomApp);
      onDismiss();
    }
  };

  return (
    <div className="takeover-view">
      <div className="takeover-heading">
        <h2>Time to Refocus</h2>
        <p>Choose a gentle next step.</p>
      </div>

      <div className="takeover-section">
        <p className="takeover-label">Suggestions</p>
        <div className="takeover-suggestions">
          {configuration?.settings?.productiveTasks && configuration.settings.productiveTasks.length > 0 ? (
            configuration.settings.productiveTasks.map((task, index) => (
              <div key={index} className="takeover-suggestion">
                <span aria-hidden="true">•</span>
                <span>{task}</span>
              </div>
            ))
          ) : (
            <span className="takeover-empty">Focus on your priorities.</span>
          )}
        </div>
      </div>

      <div className="takeover-actions">
        <button
          onClick={handleOpenNewTab}
          className="glass-btn-secondary"
        >
          New Tab
        </button>
        <button
          onClick={handleOpenProductiveApp}
          disabled={!configuration?.settings?.productiveApps?.length}
          className="glass-btn-secondary"
        >
          Open App
        </button>
      </div>

      <button
        onClick={onDismiss}
        className="glass-btn-secondary ghost"
      >
        Dismiss
      </button>
    </div>
  );
};
