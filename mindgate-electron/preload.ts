import { contextBridge, ipcRenderer } from 'electron';
import type { Configuration } from './src/types.js';

// Expose API immediately on window object
contextBridge.exposeInMainWorld('mindgateAPI', {
  checkOllamaConnection: () => ipcRenderer.invoke('check-ollama-connection'),
  sendChatMessage: (userInput: string) => ipcRenderer.invoke('send-chat-message', userInput),
  getConfiguration: () => ipcRenderer.invoke('get-configuration'),
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
  closeDistraction: () => ipcRenderer.invoke('close-distraction'),
  showSettings: () => ipcRenderer.invoke('show-settings'),
  updateSettings: (settings: Partial<Configuration['settings']>) =>
    ipcRenderer.invoke('update-settings', settings),
  getRemainingAccessTime: () => ipcRenderer.invoke('get-remaining-access-time'),
  checkAccessibilityPermission: () => ipcRenderer.invoke('check-accessibility-permission'),
  requestAccessibilityPermission: () => ipcRenderer.invoke('request-accessibility-permission'),
  grantAccess: (durationSeconds: number) => ipcRenderer.invoke('grant-access', durationSeconds),
  ping: () => ipcRenderer.invoke('bridge-ping'),

  onOllamaStatusChanged: (callback: (connected: boolean) => void) => {
    const handler = (_event: unknown, connected: boolean) => callback(connected);
    ipcRenderer.on('ollama-status-changed', handler);
    return () => {
      ipcRenderer.removeListener('ollama-status-changed', handler);
    };
  },
});

// Set bridge ready flag - this is synchronous
(window as unknown as { __MINDGATE_BRIDGE_READY__: boolean }).__MINDGATE_BRIDGE_READY__ = true;
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
      ping: () => Promise<boolean>;
      onOllamaStatusChanged: (callback: (connected: boolean) => void) => () => void;
    };
    __MINDGATE_BRIDGE_READY__: boolean;
    __preloadReady?: Promise<void>;
    __focusInput?: () => void;
    __showOverlay?: () => void;
    __hideOverlay?: () => void;
    __resetOverlay?: () => void;
  }
}
