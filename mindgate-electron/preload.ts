import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { Configuration } from './src/types.js';

contextBridge.exposeInMainWorld('mindgateAPI', {
  checkOllamaConnection: () => ipcRenderer.invoke('check-ollama-connection'),
  generateFirstMessage: () => ipcRenderer.invoke('generate-first-message'),
  sendChatMessage: (userInput: string) => ipcRenderer.invoke('send-chat-message', userInput),
  resetChat: () => ipcRenderer.invoke('reset-chat'),
  evaluateRequest: (userInput: string) => ipcRenderer.invoke('evaluate-request', userInput),
  grantAccess: (durationSeconds: number) => ipcRenderer.invoke('grant-access', durationSeconds),
  getConfiguration: () => ipcRenderer.invoke('get-configuration'),
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
  closeDistraction: () => ipcRenderer.invoke('close-distraction'),
  showSettings: () => ipcRenderer.invoke('show-settings'),
  updateSettings: (settings: Partial<Configuration['settings']>) =>
    ipcRenderer.invoke('update-settings', settings),
  getRemainingAccessTime: () => ipcRenderer.invoke('get-remaining-access-time'),
  checkAccessibilityPermission: () => ipcRenderer.invoke('check-accessibility-permission'),
  requestAccessibilityPermission: () => ipcRenderer.invoke('request-accessibility-permission'),
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  launchURL: (url: string) => ipcRenderer.invoke('launch-url', url),
  launchApp: (appName: string) => ipcRenderer.invoke('launch-app', appName),
  debugShowOverlay: () => ipcRenderer.invoke('debug-show-overlay'),

  onOllamaStatusChanged: (callback: (connected: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, connected: boolean) => callback(connected);
    ipcRenderer.on('ollama-status-changed', handler);
    return () => {
      ipcRenderer.removeListener('ollama-status-changed', handler);
    };
  },
});

// Listen for focus-input signal from main process
ipcRenderer.on('focus-input', () => {
  window.dispatchEvent(new CustomEvent('mindgate-focus-input'));
});

ipcRenderer.send('preload-ready');

declare global {
  interface Window {
    mindgateAPI: {
      checkOllamaConnection: () => Promise<boolean>;
      generateFirstMessage: () => Promise<string>;
      sendChatMessage: (userInput: string) => Promise<{
        message: string;
        isApproved: boolean | null;
        durationMinutes?: number;
      }>;
      resetChat: () => Promise<void>;
      evaluateRequest: (userInput: string) => Promise<{ isApproved: boolean; message: string }>;
      grantAccess: (durationSeconds: number) => Promise<void>;
      getConfiguration: () => Promise<Configuration>;
      hideOverlay: () => Promise<void>;
      closeDistraction: () => Promise<void>;
      showSettings: () => Promise<boolean>;
      updateSettings: (settings: Partial<Configuration['settings']>) => Promise<boolean>;
      getRemainingAccessTime: () => Promise<number>;
      checkAccessibilityPermission: () => Promise<boolean>;
      requestAccessibilityPermission: () => Promise<boolean>;
      launchURL: (url: string) => Promise<void>;
      launchApp: (appName: string) => Promise<void>;
      debugShowOverlay: () => Promise<boolean>;
      getAvailableModels: () => Promise<string[]>;
      onOllamaStatusChanged: (callback: (connected: boolean) => void) => () => void;
    };
    __focusInput?: () => void;
    __showOverlay?: () => void;
    __hideOverlay?: () => void;
    __resetOverlay?: () => void;
  }
}
