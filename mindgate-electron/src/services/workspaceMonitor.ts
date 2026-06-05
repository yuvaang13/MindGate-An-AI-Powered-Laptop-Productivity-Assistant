import type { ActiveWindowInfo, Configuration } from '../types';
import type { SystemMonitor } from './platformWrapper';

export class WorkspaceMonitor {
  private monitor: SystemMonitor;
  private configuration: Configuration;
  private lastCheckTime: number = 0;
  private lastWindow: ActiveWindowInfo | null = null;
  private debounceInterval: number = 0.75;
  private promptRepeatInterval: number = 20;
  private lastPromptTime: number = 0;
  private activePromptIdentifier: string | null = null;

  constructor(configuration: Configuration, monitor: SystemMonitor) {
    this.configuration = configuration;
    this.monitor = monitor;
  }

  getCurrentConfiguration(): Configuration {
    return this.configuration;
  }

  updateConfiguration(config: Configuration) {
    this.configuration = config;
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
    const identifier = this.getAppIdentifier(activeWindow);

    if (this.isDistracting(activeWindow)) {
      const timeSinceLastPrompt = now - this.lastPromptTime;
      if (timeSinceLastPrompt > this.promptRepeatInterval || this.lastPromptTime === 0) {
        this.lastPromptTime = now;
        this.activePromptIdentifier = identifier;
        this.onDistractionDetected?.(activeWindow);
        return true;
      }
    } else if (this.activePromptIdentifier === identifier) {
      this.clearActivePrompt();
    }

    return false;
  }

  getAppIdentifier(window: ActiveWindowInfo): string {
    return window.bundleID || window.exeName || window.processName;
  }

  private clearActivePrompt(): void {
    this.activePromptIdentifier = null;
    this.onClearPrompt?.();
  }

  private isDistracting(window: ActiveWindowInfo): boolean {
    const processName = window.processName.toLowerCase();
    const windowTitle = window.windowTitle.toLowerCase();
    const bundleID = window.bundleID?.toLowerCase() || '';
    const exeName = window.exeName?.toLowerCase() || '';

    if (this.configuration.settings.distractingApps.some(app =>
      processName.includes(app.toLowerCase()) || bundleID.includes(app.toLowerCase()) || exeName.includes(app.toLowerCase())
    )) {
      return true;
    }

    if (this.isBrowser(window) && this.hasRestrictedContent(window)) {
      return true;
    }

    return false;
  }

  private isBrowser(window: ActiveWindowInfo): boolean {
    const processName = window.processName.toLowerCase();
    const exeName = window.exeName?.toLowerCase() || '';
    const bundleID = window.bundleID?.toLowerCase() || '';
    
    return this.configuration.settings.monitoredBrowsers.some(browser =>
      processName.includes(browser.toLowerCase()) || exeName.includes(browser.toLowerCase()) || bundleID.includes(browser.toLowerCase())
    );
  }

  private hasRestrictedContent(window: ActiveWindowInfo): boolean {
    const windowTitle = window.windowTitle.toLowerCase();

    return this.configuration.settings.restrictedKeywords.some(kw =>
      windowTitle.includes(kw.toLowerCase())
    );
  }

  onDistractionDetected?: (window: ActiveWindowInfo) => void;
  onClearPrompt?: () => void;

  startMonitoring(intervalMs: number = 1000): void {
    setInterval(() => {
      this.checkWorkspace();
    }, intervalMs);
  }
}