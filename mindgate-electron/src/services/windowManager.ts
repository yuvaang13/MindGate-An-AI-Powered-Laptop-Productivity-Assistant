import { BrowserWindow, screen } from 'electron';
import type { Configuration, ActiveWindowInfo } from '../types.js';
import type { SystemMonitor } from './platformWrapper.js';
import { getPreloadPath } from '../utils/appPaths.js';

export class WindowManager {
  private overlayWindow: BrowserWindow | null = null;
  private configuration: Configuration;
  private targetApp: ActiveWindowInfo | null = null;
  private systemMonitor: SystemMonitor;

  constructor(configuration: Configuration, systemMonitor: SystemMonitor) {
    this.configuration = configuration;
    this.systemMonitor = systemMonitor;
  }

  setOverlayWindow(window: BrowserWindow) {
    this.overlayWindow = window;
  }

  setTargetWindow(window: ActiveWindowInfo | null) {
    this.targetApp = window;
  }

  getTargetApp(): ActiveWindowInfo | null {
    return this.targetApp;
  }

  private getOverlayPosition(width: number, height: number): { x: number; y: number } {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { bounds } = primaryDisplay;
    const xOffset = this.configuration.theme.dimensions.overlayXOffset;
    const yOffset = this.configuration.theme.dimensions.overlayYOffset;

    if (xOffset !== undefined && yOffset !== undefined) {
      return {
        x: Math.round(bounds.x + xOffset),
        y: Math.round(bounds.y + yOffset),
      };
    }

    return {
      x: Math.round(bounds.x + (bounds.width - width) / 2),
      y: Math.round(bounds.y + (bounds.height - height) / 2),
    };
  }

  createOverlayWindow(): BrowserWindow {
    const width = this.configuration.theme.dimensions.overlayWidth ?? 280;
    const height = this.configuration.theme.dimensions.overlayHeight ?? 280;
    const { x, y } = this.getOverlayPosition(width, height);

    this.overlayWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      transparent: true,
      backgroundColor: '#00000000',
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

  showOverlay() {
    const width = this.configuration.theme.dimensions.overlayWidth ?? 280;
    const height = this.configuration.theme.dimensions.overlayHeight ?? 280;
    const { x, y } = this.getOverlayPosition(width, height);

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.setPosition(x, y);
      this.overlayWindow.setSize(width, height);
      this.overlayWindow.show();
      this.overlayWindow.focus();
      this.overlayWindow.moveTop();
      this.overlayWindow.setAlwaysOnTop(true);
      this.overlayWindow.setVisibleOnAllWorkspaces(false);
      this.overlayWindow.setFullScreenable(false);
      this.focusOverlayInput();
      setTimeout(() => this.focusOverlayInput(), 100);
      setTimeout(() => this.focusOverlayInput(), 250);
    }
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
