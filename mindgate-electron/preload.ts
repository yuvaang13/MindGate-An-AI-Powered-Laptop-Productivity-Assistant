import { contextBridge, ipcRenderer } from 'electron';
import type { Configuration } from './src/types.js';

console.log('[Preload] Module scope — registering IPC listeners');

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
  updateSettings: (settings: Partial<Configuration['settings']>) => ipcRenderer.invoke('update-settings', settings),
  getRemainingAccessTime: () => ipcRenderer.invoke('get-remaining-access-time'),
  checkAccessibilityPermission: () => ipcRenderer.invoke('check-accessibility-permission'),
  requestAccessibilityPermission: () => ipcRenderer.invoke('request-accessibility-permission'),
      launchURL: (url: string) => ipcRenderer.invoke('launch-url', url),
      launchApp: (appName: string) => ipcRenderer.invoke('launch-app', appName),
      debugShowOverlay: () => ipcRenderer.invoke('debug-show-overlay'),
      getAvailableModels: () => ipcRenderer.invoke('get-available-models'),

  onOllamaStatusChanged: (callback: (connected: boolean) => void) => {
    ipcRenderer.on('ollama-status-changed', (_event, connected) => callback(connected));
  }
});

declare global {
  interface Window {
    mindgateAPI: {
      checkOllamaConnection: () => Promise<boolean>;
      generateFirstMessage: () => Promise<string>;
      sendChatMessage: (userInput: string) => Promise<{ message: string; isApproved: boolean | null; durationMinutes?: number }>;
      resetChat: () => void;
      evaluateRequest: (userInput: string) => Promise<{ isApproved: boolean; message: string }>;
      grantAccess: (durationSeconds: number) => Promise<void>;
      getConfiguration: () => Promise<Configuration>;
      hideOverlay: () => void;
      closeDistraction: () => void;
      showSettings: () => void;
      updateSettings: (settings: Partial<Configuration['settings']>) => void;
      getRemainingAccessTime: () => Promise<number>;
      checkAccessibilityPermission: () => Promise<boolean>;
      requestAccessibilityPermission: () => Promise<boolean>;
      launchURL: (url: string) => void;
      launchApp: (appName: string) => void;
      debugShowOverlay: () => Promise<boolean>;
      getAvailableModels: () => Promise<string[]>;
      onOllamaStatusChanged: (callback: (connected: boolean) => void) => void;
    };
  }
}