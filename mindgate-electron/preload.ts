import { contextBridge, ipcRenderer } from 'electron';
import type { Configuration } from './src/types';

contextBridge.exposeInMainWorld('mindgateAPI', {
  checkOllamaConnection: () => ipcRenderer.invoke('check-ollama-connection'),
  evaluateRequest: (userInput: string) => ipcRenderer.invoke('evaluate-request', userInput),
  grantAccess: (index: number) => ipcRenderer.invoke('grant-access', index),
  getConfiguration: () => ipcRenderer.invoke('get-configuration'),
  hideOrb: () => ipcRenderer.invoke('hide-orb'),
  closeDistraction: () => ipcRenderer.invoke('close-distraction'),
  showSettings: () => ipcRenderer.invoke('show-settings'),
  updateSettings: (settings: Partial<Configuration['settings']>) => ipcRenderer.invoke('update-settings', settings),
  getRemainingAccessTime: () => ipcRenderer.invoke('get-remaining-access-time'),
  checkAccessibilityPermission: () => ipcRenderer.invoke('check-accessibility-permission'),
  requestAccessibilityPermission: () => ipcRenderer.invoke('request-accessibility-permission'),

  onShowOrb: (callback: () => void) => {
    ipcRenderer.on('show-orb', callback);
  },

  onHideOrb: (callback: () => void) => {
    ipcRenderer.on('hide-orb', callback);
  },

  onShowOverlay: (callback: () => void) => {
    ipcRenderer.on('show-overlay', callback);
  },

  onHideOverlay: (callback: () => void) => {
    ipcRenderer.on('hide-overlay', callback);
  },

  onOllamaStatusChanged: (callback: (connected: boolean) => void) => {
    ipcRenderer.on('ollama-status-changed', (_event, connected) => callback(connected));
  }
});

declare global {
  interface Window {
    mindgateAPI: {
      checkOllamaConnection: () => Promise<boolean>;
      evaluateRequest: (userInput: string) => Promise<{ isApproved: boolean; message: string }>;
      grantAccess: (index: number) => void;
      getConfiguration: () => Promise<Configuration>;
      hideOrb: () => void;
      closeDistraction: () => void;
      showSettings: () => void;
      updateSettings: (settings: Partial<Configuration['settings']>) => void;
      getRemainingAccessTime: () => Promise<number>;
      checkAccessibilityPermission: () => Promise<boolean>;
      requestAccessibilityPermission: () => Promise<void>;
      onShowOrb: (callback: () => void) => void;
      onHideOrb: (callback: () => void) => void;
      onShowOverlay: (callback: () => void) => void;
      onHideOverlay: (callback: () => void) => void;
      onOllamaStatusChanged: (callback: (connected: boolean) => void) => void;
    };
  }
}