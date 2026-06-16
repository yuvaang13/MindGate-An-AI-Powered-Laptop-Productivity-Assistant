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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 4px' }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#000', margin: 0, marginBottom: 4 }}>
          Time to Refocus
        </h2>
        <p style={{ fontSize: 13, color: '#666', margin: 0 }}>Your work is waiting for you</p>
      </div>

      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#333', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: 16 }}>📋</span> Productive Suggestions:
        </p>

        <div style={{
          maxHeight: 150,
          overflowY: 'auto',
          padding: 12,
          borderRadius: 8,
          background: 'rgba(240, 243, 255, 0.5)',
          border: '1px solid rgba(200, 215, 255, 0.5)',
        }}>
          {configuration?.settings?.productiveTasks && configuration.settings.productiveTasks.length > 0 ? (
            configuration.settings.productiveTasks.map((task, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginBottom: index < configuration.settings.productiveTasks.length - 1 ? 8 : 0,
                padding: '6px 8px',
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.3)',
              }}>
                <span style={{ color: '#007aff', fontSize: 14 }}>▸</span>
                <span style={{ fontSize: 13, color: '#333', lineHeight: 1.4, flex: 1 }}>{task}</span>
              </div>
            ))
          ) : (
            <span style={{ fontSize: 13, color: '#666' }}>Review your priorities and get back to focused work.</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleOpenNewTab}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 8,
            background: 'rgba(0, 122, 255, 0.1)',
            border: '1px solid rgba(0, 122, 255, 0.2)',
            color: '#007aff',
            fontSize: 13,
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
            padding: '10px 0',
            borderRadius: 8,
            background: configuration?.settings?.productiveApps?.length ? 'rgba(0, 122, 255, 0.1)' : 'rgba(120, 120, 128, 0.1)',
            border: configuration?.settings?.productiveApps?.length ? '1px solid rgba(0, 122, 255, 0.2)' : '1px solid rgba(120, 120, 128, 0.2)',
            color: configuration?.settings?.productiveApps?.length ? '#007aff' : '#8e8e93',
            fontSize: 13,
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
          padding: '10px 16px',
          borderRadius: 8,
          background: 'rgba(120, 120, 128, 0.15)',
          border: '1px solid rgba(60, 60, 67, 0.15)',
          color: '#1c1c1e',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
        }}
        className="glass-btn-secondary"
      >
        ↩ Dismiss & Return to Work
      </button>
    </div>
  );
};