import type { Configuration } from './types';

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
    __showOverlay?: () => void;
    __hideOverlay?: () => void;
    __resetOverlay?: () => void;
  }
}

export {};
