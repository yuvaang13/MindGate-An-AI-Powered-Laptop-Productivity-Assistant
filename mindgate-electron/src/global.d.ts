import type { BridgeStatus, ChatResponse, Configuration, OllamaConnectionStatus } from './types.js';

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

export {};
