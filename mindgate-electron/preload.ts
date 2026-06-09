import { contextBridge, ipcRenderer } from 'electron';
import type { Configuration } from './src/types.js';

let showOverlayCb: (() => void) | null = null;
let hideOverlayCb: (() => void) | null = null;
let pendingShow = false;
let pendingHide = false;

console.log('[Preload] Module scope — registering IPC listeners');

ipcRenderer.on('show-overlay', () => {
  console.log('[Preload] show-overlay received, cb exists:', !!showOverlayCb, 'pending:', pendingShow);
  if (showOverlayCb) {
    showOverlayCb();
  } else {
    pendingShow = true;
    console.log('[Preload] show-overlay buffered (pendingShow=true)');
  }
});

ipcRenderer.on('hide-overlay', () => {
  console.log('[Preload] hide-overlay received, cb exists:', !!hideOverlayCb, 'pending:', pendingHide);
  if (hideOverlayCb) {
    hideOverlayCb();
  } else {
    pendingHide = true;
    console.log('[Preload] hide-overlay buffered (pendingHide=true)');
  }
});

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

  onShowOverlay: (callback: () => void) => {
    console.log('[Preload] onShowOverlay called, pending:', pendingShow);
    showOverlayCb = callback;
    if (pendingShow) {
      pendingShow = false;
      console.log('[Preload] Firing buffered show-overlay');
      callback();
    }
  },

  onHideOverlay: (callback: () => void) => {
    hideOverlayCb = callback;
    if (pendingHide) {
      pendingHide = false;
      callback();
    }
  },

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
      onShowOverlay: (callback: () => void) => void;
      onHideOverlay: (callback: () => void) => void;
      onOllamaStatusChanged: (callback: (connected: boolean) => void) => void;
    };
  }
}