import { contextBridge, ipcRenderer } from 'electron';
import type { AIReadinessStatus, BridgeStatus, ChatResponse, Configuration, OllamaConnectionStatus } from './src/types.js';

const IPC_TIMEOUT_MS = 10000;

const invokeWithTimeout = <T>(channel: string, ...args: unknown[]): Promise<T> => {
  let timeout: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`[Bridge] IPC timeout for ${channel}`));
    }, IPC_TIMEOUT_MS);
  });

  const invokePromise = ipcRenderer.invoke(channel, ...args).finally(() => {
    clearTimeout(timeout);
  });

  return Promise.race([invokePromise, timeoutPromise]);
};

const mindgateAPI = {
  checkOllamaConnection: () => invokeWithTimeout<boolean>('check-ollama-connection'),
  generateFirstMessage: () => invokeWithTimeout<string>('generate-first-message'),
  sendChatMessage: (userInput: string) => invokeWithTimeout<ChatResponse>('send-chat-message', userInput),
  resetChat: () => invokeWithTimeout<void>('reset-chat'),
  evaluateRequest: (userInput: string) => invokeWithTimeout<{ isApproved: boolean; message: string }>('evaluate-request', userInput),
  getConfiguration: () => invokeWithTimeout<Configuration>('get-configuration'),
  hideOverlay: () => invokeWithTimeout<void>('hide-overlay'),
  closeDistraction: () => invokeWithTimeout<void>('close-distraction'),
  showSettings: () => invokeWithTimeout<boolean>('show-settings'),
  updateSettings: (settings: Partial<Configuration['settings']>) =>
    invokeWithTimeout<boolean>('update-settings', settings),
  getRemainingAccessTime: () => invokeWithTimeout<number>('get-remaining-access-time'),
  checkAccessibilityPermission: () => invokeWithTimeout<boolean>('check-accessibility-permission'),
  requestAccessibilityPermission: () => invokeWithTimeout<boolean>('request-accessibility-permission'),
  grantAccess: (durationSeconds: number) => invokeWithTimeout<void>('grant-access', durationSeconds),
  ping: () => invokeWithTimeout<boolean>('bridge-ping'),
  getBridgeStatus: () => invokeWithTimeout<BridgeStatus>('get-bridge-status'),
  getAiReadinessStatus: () => invokeWithTimeout<AIReadinessStatus>('get-ai-readiness-status'),
  getOllamaConnectionStatus: () => invokeWithTimeout<OllamaConnectionStatus>('get-ollama-connection-status'),
  getAvailableModels: () => invokeWithTimeout<string[]>('get-available-models'),
  launchURL: (url: string) => invokeWithTimeout<void>('launch-url', url),
  launchApp: (appName: string) => invokeWithTimeout<void>('launch-app', appName),
  debugShowOverlay: () => invokeWithTimeout<boolean>('debug-show-overlay'),

  onOllamaStatusChanged: (callback: (connected: boolean) => void) => {
    const handler = (_event: unknown, connected: boolean) => callback(connected);
    ipcRenderer.on('ollama-status-changed', handler);
    return () => {
      ipcRenderer.removeListener('ollama-status-changed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('mindgateAPI', mindgateAPI);

(window as unknown as { __MINDGATE_BRIDGE_READY__: boolean }).__MINDGATE_BRIDGE_READY__ = true;
ipcRenderer.send('preload-ready');

declare global {
  interface Window {
    mindgateAPI: typeof mindgateAPI;
    __MINDGATE_BRIDGE_READY__: boolean;
    __preloadReady?: Promise<void>;
    __focusInput?: () => void;
    __showOverlay?: () => void;
    __hideOverlay?: () => void;
    __resetOverlay?: () => void;
  }
}
