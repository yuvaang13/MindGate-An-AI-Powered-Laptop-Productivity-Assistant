import { BrowserWindow, screen } from 'electron';
import type { Configuration, ActiveWindowInfo } from '../types.js';
import type { SystemMonitor } from './platformWrapper.js';
import { getPreloadPath } from '../utils/appPaths.js';

export class WindowManager {
  private overlayWindow: BrowserWindow | null = null;
  private overlayReadyPromise: Promise<void> = Promise.resolve();
  private resolveOverlayReady: () => void = () => {};
  private overlayRendererReady = false;
  private configuration: Configuration;
  private targetApp: ActiveWindowInfo | null = null;
  private systemMonitor: SystemMonitor;

  constructor(configuration: Configuration, systemMonitor: SystemMonitor) {
    this.configuration = configuration;
    this.systemMonitor = systemMonitor;
  }

  setOverlayWindow(window: BrowserWindow) {
    this.overlayWindow = window;
    this.overlayRendererReady = false;
    this.overlayReadyPromise = new Promise((resolve) => {
      this.resolveOverlayReady = resolve;
    });
  }

  markOverlayRendererReady(): void {
    if (!this.overlayRendererReady) {
      this.overlayRendererReady = true;
      this.resolveOverlayReady();
    }
  }

  isOverlayReady(): boolean {
    return Boolean(this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayRendererReady);
  }

  isOverlayVisible(): boolean {
    return Boolean(this.overlayWindow && !this.overlayWindow.isDestroyed() && this.overlayWindow.isVisible());
  }

  setTargetWindow(window: ActiveWindowInfo | null) {
    this.targetApp = window;
  }

  getTargetApp(): ActiveWindowInfo | null {
    return this.targetApp;
  }

  createOverlayWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { bounds } = primaryDisplay;
    const width = this.configuration.theme.dimensions.overlayWidth ?? 330;
    const height = this.configuration.theme.dimensions.overlayHeight ?? 380;

    this.overlayWindow = new BrowserWindow({
      x: Math.round(bounds.x + 12),
      y: Math.round(bounds.y + 12),
      width,
      height,
      transparent: false,
      backgroundColor: '#19191e',
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      hasShadow: true,
      focusable: true,
      acceptFirstMouse: true,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        preload: getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    return this.overlayWindow;
  }

  showOverlay(): boolean {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      return false;
    }

    void this.overlayReadyPromise.then(() => this.finishShowOverlay());
    return true;
  }

  private finishShowOverlay(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;

    this.overlayWindow.show();
    this.overlayWindow.setVisibleOnAllWorkspaces(true);
    this.overlayWindow.focus();
    this.overlayWindow.moveTop();
    if (process.platform === 'darwin') {
      this.overlayWindow.setAlwaysOnTop(true, 'floating');
    }

    setTimeout(() => {
      if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
      if (!this.overlayWindow.isVisible()) {
        this.overlayWindow.show();
        this.overlayWindow.moveTop();
      }
      this.focusOverlayInput();
    }, 50);
  }

  private focusOverlayInput(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return;
    this.overlayWindow.webContents
      .executeJavaScript('document.querySelector("textarea")?.focus()')
      .catch(() => {});
  }

  hideOverlay() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.webContents
        .executeJavaScript('window.__hideOverlay?.()', true)
        .catch(() => {});
    }
    this.overlayWindow?.hide();
  }

  async closeDistraction(): Promise<void> {
    await this.systemMonitor.closeBrowserTab();
    await this.systemMonitor.hideApplication();
    this.hideOverlay();
  }

  updateConfiguration(config: Configuration) {
    this.configuration = config;
  }
}
