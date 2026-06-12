import React, { useState } from 'react';
import { Configuration } from '../../types';

interface SettingsProps {
  configuration: Configuration | null;
}

export const Settings: React.FC<SettingsProps> = ({ configuration }) => {
  const [settings, setSettings] = useState(() => configuration?.settings ?? {
    distractingApps: [],
    restrictedKeywords: [],
    monitoredBrowsers: [],
    ollamaURL: 'http://localhost:11434/api/generate',
    ollamaModel: 'gemma3:1b',
    accessDurations: [300, 600, 900],
    accessDurationLabels: ['5 Mins', '10 Mins', '15 Mins'],
    productiveTasks: [],
    productiveApps: [],
    justificationCountdownDuration: 15,
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaveMessage(null);
    setSaveError(null);
    try {
      await window.mindgateAPI.updateSettings(settings);
      setSaveMessage('Settings saved successfully.');
    } catch {
      setSaveError('Failed to save settings. Please try again.');
    }
  };

  return (
    <div style={{
      padding: 20,
      background: '#1a1a1a',
      minHeight: '100vh',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <h1 style={{ marginTop: 0, marginBottom: 20 }}>MindGate Settings</h1>

      {saveMessage && (
        <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'rgba(52, 199, 89, 0.2)', color: '#34c759' }}>
          {saveMessage}
        </div>
      )}
      {saveError && (
        <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'rgba(255, 59, 48, 0.2)', color: '#ff3b30' }}>
          {saveError}
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Distracting Apps</h2>
        <textarea
          value={settings.distractingApps.join('\n')}
          onChange={(e) => setSettings({
            ...settings,
            distractingApps: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
          })}
          placeholder="One app per line..."
          style={{
            width: '100%',
            height: 120,
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: 8,
            color: 'white',
            padding: 12,
            fontSize: 14,
            resize: 'none',
          }}
        />
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Restricted Keywords</h2>
        <textarea
          value={settings.restrictedKeywords.join('\n')}
          onChange={(e) => setSettings({
            ...settings,
            restrictedKeywords: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
          })}
          placeholder="One keyword per line..."
          style={{
            width: '100%',
            height: 120,
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: 8,
            color: 'white',
            padding: 12,
            fontSize: 14,
            resize: 'none',
          }}
        />
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Monitored Browsers</h2>
        <textarea
          value={settings.monitoredBrowsers.join('\n')}
          onChange={(e) => setSettings({
            ...settings,
            monitoredBrowsers: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
          })}
          placeholder="One browser per line..."
          style={{
            width: '100%',
            height: 80,
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: 8,
            color: 'white',
            padding: 12,
            fontSize: 14,
            resize: 'none',
          }}
        />
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Ollama Configuration</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Ollama URL</label>
          <input
            type="text"
            value={settings.ollamaURL}
            onChange={(e) => setSettings({ ...settings, ollamaURL: e.target.value })}
            style={{
              width: '100%',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: 8,
              color: 'white',
              padding: 8,
              fontSize: 14,
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Model</label>
          <input
            type="text"
            value={settings.ollamaModel}
            onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
            style={{
              width: '100%',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: 8,
              color: 'white',
              padding: 8,
              fontSize: 14,
            }}
          />
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Access Durations (seconds)</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {settings.accessDurationLabels.map((label, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                value={settings.accessDurations[index] / 60}
                onChange={(e) => {
                  const minutes = parseInt(e.target.value, 10) || 0;
                  const newDurations = [...settings.accessDurations];
                  newDurations[index] = minutes * 60;
                  setSettings({ ...settings, accessDurations: newDurations });
                }}
                style={{
                  width: 60,
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: 8,
                  color: 'white',
                  padding: 8,
                  fontSize: 14,
                }}
              />
              <span>min ({label})</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => void handleSave()}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: '#007aff',
            border: 'none',
            color: 'white',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Save Settings
        </button>

        <button
          onClick={() => window.close()}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: '#444',
            border: 'none',
            color: 'white',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};
