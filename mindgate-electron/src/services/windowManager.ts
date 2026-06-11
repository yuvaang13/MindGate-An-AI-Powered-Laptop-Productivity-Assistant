import { BrowserWindow, screen } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Configuration, ActiveWindowInfo } from '../types.js';
import { SystemMonitor } from './platformWrapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class WindowManager {
  private overlayWindow: BrowserWindow | null = null;
  private configuration: Configuration;
  private targetApp: ActiveWindowInfo | null = null;

  constructor(configuration: Configuration) {
    this.configuration = configuration;
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

  createOverlayWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { bounds } = primaryDisplay;
    const xOffset = this.configuration.theme.dimensions.overlayXOffset ?? 24;
    const yOffset = this.configuration.theme.dimensions.overlayYOffset ?? 24;

    this.overlayWindow = new BrowserWindow({
      x: Math.round(bounds.x + xOffset),
      y: Math.round(bounds.y + yOffset),
      width: this.configuration.theme.dimensions.overlayWidth ?? 380,
      height: this.configuration.theme.dimensions.overlayHeight ?? 380,
      transparent: false,
      backgroundColor: '#ffffff',
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
        preload: join(__dirname, '../preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    return this.overlayWindow;
  }

  showOverlay(targetWindow?: ActiveWindowInfo) {
    const window = targetWindow ?? this.targetApp;
    const width = this.configuration.theme.dimensions.overlayWidth ?? 340;
    const height = this.configuration.theme.dimensions.overlayHeight ?? 340;
    const xOffset = this.configuration.theme.dimensions.overlayXOffset ?? 24;
    const yOffset = this.configuration.theme.dimensions.overlayYOffset ?? 24;
    const primaryDisplay = screen.getPrimaryDisplay();
    const viewBounds = primaryDisplay.bounds;

    let x: number, y: number;
    if (window?.frame && window.frame.width > 0) {
      x = Math.round((window.frame.x ?? 0) + xOffset);
      y = Math.round((window.frame.y ?? 0) + yOffset);
      console.log(`[WindowManager] Positioning overlay at distraction window (${x},${y}) size ${width}x${height}`);
    } else {
      x = Math.round(viewBounds.x + (viewBounds.width - width) / 2);
      y = Math.round(viewBounds.y + (viewBounds.height - height) / 2);
      console.log(`[WindowManager] Positioning overlay centered (${x},${y}) size ${width}x${height}`);
    }

    x = Math.max(viewBounds.x, Math.min(x, viewBounds.x + viewBounds.width - width));
    y = Math.max(viewBounds.y, Math.min(y, viewBounds.y + viewBounds.height - height));

    this.overlayWindow?.setPosition(x, y);
    this.overlayWindow?.setSize(width, height);
    this.overlayWindow?.show();
    this.overlayWindow?.focus();
    this.overlayWindow?.moveTop();
    console.log('[WindowManager] Overlay shown, visible:', this.overlayWindow?.isVisible(), 'position:', this.overlayWindow?.getPosition());
  }

  hideOverlay() {
    this.overlayWindow?.hide();
  }

  async closeDistraction(app: ActiveWindowInfo) {
    const monitor = new SystemMonitor();
    await monitor.initialize();

    const isBrowser = this.configuration.settings.monitoredBrowsers.some(browser =>
      app.processName.toLowerCase().includes(browser.toLowerCase())
    );

    if (isBrowser) {
      const identifier = app.bundleID || app.exeName || '';
      await monitor.closeBrowserTab(identifier);
    } else {
      await monitor.hideApplication(app.processName);
    }

    this.hideOverlay();
  }

  grantAccess(duration: number) {
    setTimeout(() => {
      this.hideOverlay();
    }, duration * 1000);
  }

  updateConfiguration(config: Configuration) {
    this.configuration = config;
  }
}