import { contextBridge, ipcRenderer } from 'electron';
import { Configuration } from './src/types';

contextBridge.exposeInMainWorld('mindgateAPI', {
  checkOllamaConnection: () => ipcRenderer.invoke('check-ollama-connection'),
  evaluateRequest: (userInput: string) => ipcRenderer.invoke('evaluate-request', userInput),
  grantAccess: (duration: number) => ipcRenderer.invoke('grant-access', duration),
  getConfiguration: () => ipcRenderer.invoke('get-configuration'),
  hideOrb: () => ipcRenderer.invoke('hide-orb'),
  
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
  }
});

declare global {
  interface Window {
    mindgateAPI: {
      checkOllamaConnection: () => Promise<boolean>;
      evaluateRequest: (userInput: string) => Promise<{ isApproved: boolean; message: string }>;
      grantAccess: (duration: number) => void;
      getConfiguration: () => Promise<Configuration>;
      hideOrb: () => void;
      onShowOrb: (callback: () => void) => void;
      onHideOrb: (callback: () => void) => void;
      onShowOverlay: (callback: () => void) => void;
      onHideOverlay: (callback: () => void) => void;
    };
  }
}