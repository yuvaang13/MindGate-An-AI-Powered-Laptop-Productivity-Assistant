import { contextBridge, ipcRenderer } from 'electron';
import type { BridgeStatus, ChatResponse, Configuration, OllamaConnectionStatus } from './src/types.js';

contextBridge.exposeInMainWorld('mindgateAPI', {
  checkOllamaConnection: () => ipcRenderer.invoke('check-ollama-connection'),
  generateFirstMessage: () => ipcRenderer.invoke('generate-first-message'),
  sendChatMessage: (userInput: string) => ipcRenderer.invoke('send-chat-message', userInput),
  resetChat: () => ipcRenderer.invoke('reset-chat'),
  evaluateRequest: (userInput: string) => ipcRenderer.invoke('evaluate-request', userInput),
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
  getBridgeStatus: () => ipcRenderer.invoke('get-bridge-status'),
  getOllamaConnectionStatus: () => ipcRenderer.invoke('get-ollama-connection-status'),
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),
  launchURL: (url: string) => ipcRenderer.invoke('launch-url', url),
  launchApp: (appName: string) => ipcRenderer.invoke('launch-app', appName),
  debugShowOverlay: () => ipcRenderer.invoke('debug-show-overlay'),

  onOllamaStatusChanged: (callback: (connected: boolean) => void) => {
    const handler = (_event: unknown, connected: boolean) => callback(connected);
    ipcRenderer.on('ollama-status-changed', handler);
    return () => {
      ipcRenderer.removeListener('ollama-status-changed', handler);
    };
  },
});

(window as unknown as { __MINDGATE_BRIDGE_READY__: boolean }).__MINDGATE_BRIDGE_READY__ = true;
ipcRenderer.send('preload-ready');

declare global {
  interface Window {
    mindgateAPI: {
      checkOllamaConnection: () => Promise<boolean>;
      generateFirstMessage: () => Promise<string>;
      sendChatMessage: (userInput: string) => Promise<ChatResponse>;
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
      getBridgeStatus: () => Promise<BridgeStatus>;
      getOllamaConnectionStatus: () => Promise<OllamaConnectionStatus>;
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
