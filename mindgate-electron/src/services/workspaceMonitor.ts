import { ActiveWindowInfo, Configuration } from '../types';
import { SystemMonitor } from '../platform/index';

export class WorkspaceMonitor {
  private monitor: SystemMonitor;
  private configuration: Configuration;
  private lastCheckTime: number = 0;
  private lastWindow: ActiveWindowInfo | null = null;
  private debounceInterval: number = 0.75;
  private promptRepeatInterval: number = 20;
  private lastPromptTime: number = 0;

  constructor(configuration: Configuration) {
    this.monitor = new SystemMonitor();
    this.configuration = configuration;
  }

  async checkWorkspace(): Promise<boolean> {
    const now = Date.now() / 1000;
    
    if (now - this.lastCheckTime < this.debounceInterval) {
      return false;
    }
    this.lastCheckTime = now;

    const activeWindow = await this.monitor.getActiveWindow();
    if (!activeWindow) {
      return false;
    }

    if (activeWindow.processName === this.lastWindow?.processName &&
        activeWindow.windowTitle === this.lastWindow?.windowTitle) {
      return false;
    }

    this.lastWindow = activeWindow;

    if (this.isDistracting(activeWindow)) {
      const timeSinceLastPrompt = now - this.lastPromptTime;
      if (timeSinceLastPrompt > this.promptRepeatInterval || this.lastPromptTime === 0) {
        this.lastPromptTime = now;
        this.onDistractionDetected?.(activeWindow);
        return true;
      }
    }

    return false;
  }

  private isDistracting(window: ActiveWindowInfo): boolean {
    const processName = window.processName.toLowerCase();
    const windowTitle = window.windowTitle.toLowerCase();

    if (this.configuration.settings.distractingApps.some(app => processName.includes(app.toLowerCase()))) {
      return true;
    }

    if (this.configuration.settings.restrictedKeywords.some(kw => windowTitle.includes(kw.toLowerCase()))) {
      return true;
    }

    return false;
  }

  onDistractionDetected?: (window: ActiveWindowInfo) => void;

  startMonitoring(intervalMs: number = 2000): void {
    setInterval(() => {
      this.checkWorkspace();
    }, intervalMs);
  }
}