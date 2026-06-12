import type { ActiveWindowInfo } from '../types.js';

export interface PlatformMonitor {
  getActiveWindow(): Promise<ActiveWindowInfo | null>;
  getActiveBrowserURL?(identifier: string): Promise<string | null>;
  closeBrowserTab?(): Promise<boolean>;
  hideApplication?(): Promise<boolean>;
  setPermissionsGranted?(): void;
}

export class SystemMonitor {
  private platformMonitor: PlatformMonitor | null = null;

  async initialize() {
    if (process.platform === 'win32') {
      const { WindowsMonitor } = await import('../platform/windows/monitor.js');
      this.platformMonitor = new WindowsMonitor();
    } else if (process.platform === 'darwin') {
      const { MacMonitor } = await import('../platform/mac/monitor.js');
      this.platformMonitor = new MacMonitor();
    } else {
      const { LinuxMonitor } = await import('../platform/linux/monitor.js');
      this.platformMonitor = new LinuxMonitor();
    }
  }

  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    if (!this.platformMonitor) {
      await this.initialize();
    }
    return this.platformMonitor?.getActiveWindow() ?? null;
  }

  async getActiveBrowserURL(identifier: string): Promise<string | null> {
    if (!this.platformMonitor) {
      await this.initialize();
    }
    return this.platformMonitor?.getActiveBrowserURL?.(identifier) ?? null;
  }

  async closeBrowserTab(): Promise<boolean> {
    if (!this.platformMonitor) {
      await this.initialize();
    }
    return this.platformMonitor?.closeBrowserTab?.() ?? false;
  }

  async hideApplication(): Promise<boolean> {
    if (!this.platformMonitor) {
      await this.initialize();
    }
    return this.platformMonitor?.hideApplication?.() ?? false;
  }

  setPermissionsGranted(): void {
    this.platformMonitor?.setPermissionsGranted?.();
  }
}