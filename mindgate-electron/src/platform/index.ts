import type { ActiveWindowInfo } from '../types.js';

export interface PlatformMonitor {
  getActiveWindow(): Promise<ActiveWindowInfo | null>;
  getActiveBrowserURL?(identifier: string): Promise<string | null>;
  closeBrowserTab?(): Promise<boolean>;
  hideApplication?(): Promise<boolean>;
}