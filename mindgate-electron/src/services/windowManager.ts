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

    const waitForReady = () => {
      return new Promise<void>((resolve) => {
        const check = () => {
          if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            const contents = this.overlayWindow.webContents;
            if (contents.isLoadingMainFrame()) {
              setTimeout(check, 50);
              return;
            }
            resolve();
          } else {
            resolve();
          }
        };
        setTimeout(check, 100);
      });
    };

    this.overlayWindow?.setPosition(x, y);
    this.overlayWindow?.setSize(width, height);

    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.show();
      this.overlayWindow.focus();
      this.overlayWindow.moveTop();
      this.overlayWindow.setAlwaysOnTop(true);
      this.overlayWindow.setVisibleOnAllWorkspaces(false);
      this.overlayWindow.setFullScreenable(false);

      waitForReady().then(() => {
        this.overlayWindow?.webContents
          .executeJavaScript('window.__showOverlay?.()', true)
          .catch((err) => console.warn('[WindowManager] __showOverlay call failed:', err));
      });
    }
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
