import { Configuration } from '../../types';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 2px' }}>
      <div style={{ textAlign: 'center', marginBottom: 2 }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🎯</div>
        <h2 style={{ fontSize: 14, fontWeight: 500, color: '#f5f5f7', margin: 0, marginBottom: 2 }}>
          Time to Refocus
        </h2>
      </div>

      <div style={{ marginBottom: 4 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: '#a1a1a6', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
          💡 Suggestions:
        </p>

        <div style={{
          maxHeight: 100,
          overflowY: 'auto',
          padding: 8,
          borderRadius: 6,
          background: 'rgba(45, 45, 50, 0.5)',
          border: '1px solid var(--glass-border)',
        }}>
          {configuration?.settings?.productiveTasks && configuration.settings.productiveTasks.length > 0 ? (
            configuration.settings.productiveTasks.map((task, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                marginBottom: index < configuration.settings.productiveTasks.length - 1 ? 6 : 0,
                padding: '4px 6px',
                borderRadius: 4,
                background: 'rgba(52, 199, 89, 0.05)',
              }}>
                <span style={{ color: '#34c759', fontSize: 12 }}>▸</span>
                <span style={{ fontSize: 12, color: '#f5f5f7', lineHeight: 1.3, flex: 1 }}>{task}</span>
              </div>
            ))
          ) : (
            <span style={{ fontSize: 12, color: '#a1a1a6' }}>Focus on your priorities.</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleOpenNewTab}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 6,
            background: 'rgba(52, 199, 89, 0.1)',
            border: '1px solid rgba(52, 199, 89, 0.2)',
            color: '#34c759',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          className="glass-btn-secondary"
        >
          🌐 New Tab
        </button>
        <button
          onClick={handleOpenProductiveApp}
          disabled={!configuration?.settings?.productiveApps?.length}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 6,
            background: configuration?.settings?.productiveApps?.length ? 'rgba(52, 199, 89, 0.1)' : 'rgba(120, 120, 128, 0.1)',
            border: configuration?.settings?.productiveApps?.length ? '1px solid rgba(52, 199, 89, 0.2)' : '1px solid rgba(120, 120, 128, 0.2)',
            color: configuration?.settings?.productiveApps?.length ? '#34c759' : '#8e8e93',
            fontSize: 12,
            fontWeight: 500,
            cursor: configuration?.settings?.productiveApps?.length ? 'pointer' : 'default',
          }}
          className="glass-btn-secondary"
        >
          📱 Open App
        </button>
      </div>

      <button
        onClick={onDismiss}
        style={{
          padding: '8px 12px',
          borderRadius: 6,
          background: 'rgba(120, 120, 128, 0.15)',
          border: '1px solid var(--glass-border)',
          color: '#f5f5f7',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
        }}
        className="glass-btn-secondary"
      >
        ↩ Dismiss
      </button>
    </div>
  );
};