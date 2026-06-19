import React, { useState } from 'react';
import { Configuration } from '../../types.js';
import '../../styles/glassmorphism.css';

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

  const handleDurationChange = (index: number, value: string) => {
    const minutes = parseInt(value, 10) || 0;
    const validDurations = [5, 10, 15];
    const clampedMinutes = validDurations.includes(minutes) ? minutes : 10;
    const newDurations = [...settings.accessDurations];
    newDurations[index] = clampedMinutes * 60;
    setSettings({ ...settings, accessDurations: newDurations });
  };

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
    <div className="settings-shell">
      <header className="settings-header">
        <div>
          <h1>MindGate Settings</h1>
          <p>Keep your focus rules simple and easy to maintain.</p>
        </div>
      </header>

      {saveMessage && (
        <div className="settings-message success">
          {saveMessage}
        </div>
      )}
      {saveError && (
        <div className="settings-message error">
          {saveError}
        </div>
      )}

      <section className="settings-section">
        <h2>Distracting Apps</h2>
        <textarea
          value={settings.distractingApps.join('\n')}
          onChange={(e) => setSettings({
            ...settings,
            distractingApps: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
          })}
          placeholder="One app per line..."
          className="settings-input textarea"
        />
      </section>

      <section className="settings-section">
        <h2>Restricted Keywords</h2>
        <textarea
          value={settings.restrictedKeywords.join('\n')}
          onChange={(e) => setSettings({
            ...settings,
            restrictedKeywords: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
          })}
          placeholder="One keyword per line..."
          className="settings-input textarea"
        />
      </section>

      <section className="settings-section">
        <h2>Ollama Configuration</h2>

        <div className="settings-field">
          <label htmlFor="ollama-url">Ollama URL</label>
          <input
            id="ollama-url"
            type="text"
            value={settings.ollamaURL}
            onChange={(e) => setSettings({ ...settings, ollamaURL: e.target.value })}
            className="settings-input"
          />
        </div>

        <div className="settings-field">
          <label htmlFor="ollama-model">Model</label>
          <input
            id="ollama-model"
            type="text"
            value={settings.ollamaModel}
            onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
            className="settings-input"
          />
        </div>
      </section>

      <section className="settings-section">
        <h2>Access Durations</h2>
        <div className="duration-grid">
          {settings.accessDurationLabels.map((label, index) => (
            <div key={index} className="duration-row">
              <input
                type="number"
                value={settings.accessDurations[index] / 60}
                onChange={(e) => handleDurationChange(index, e.target.value)}
                min={5}
                max={15}
                className="settings-input duration-input"
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="settings-actions">
        <button
          onClick={() => void handleSave()}
          className="glass-btn"
        >
          Save Settings
        </button>

        <button
          onClick={() => window.close()}
          className="glass-btn-secondary ghost"
        >
          Close
        </button>
      </div>
    </div>
  );
};
