import { ActiveWindowInfo } from '../types';

export interface PlatformMonitor {
  getActiveWindow(): Promise<ActiveWindowInfo | null>;
}

export class SystemMonitor implements PlatformMonitor {
  private monitor: PlatformMonitor | null = null;

  async initialize() {
    if (process.platform === 'win32') {
      const { WindowsMonitor } = await import('./windows/monitor');
      this.monitor = new WindowsMonitor();
    } else if (process.platform === 'darwin') {
      const { MacMonitor } = await import('./mac/monitor');
      this.monitor = new MacMonitor();
    } else {
      const { LinuxMonitor } = await import('./linux/monitor');
      this.monitor = new LinuxMonitor();
    }
  }

  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    if (!this.monitor) {
      await this.initialize();
    }
    return this.monitor?.getActiveWindow() ?? null;
  }
}