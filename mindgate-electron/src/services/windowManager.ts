import { BrowserWindow, screen } from 'electron';
import { Configuration, ActiveWindowInfo } from '../types';

export class WindowManager {
  private orbWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private mainWindow: BrowserWindow | null = null;
  private configuration: Configuration;
  private isOrbExpanded = false;
  private targetWindow: ActiveWindowInfo | null = null;

  constructor(configuration: Configuration) {
    this.configuration = configuration;
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  setTargetWindow(window: ActiveWindowInfo | null) {
    this.targetWindow = window;
  }

  createOrbWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y } = this.getOrbPosition(primaryDisplay);

    this.orbWindow = new BrowserWindow({
      x,
      y,
      width: this.configuration.theme.dimensions.orbSize,
      height: this.configuration.theme.dimensions.orbSize,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      hasShadow: false,
      focusable: true,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        transparent: true
      }
    });

    return this.orbWindow;
  }

  createOverlayWindow(frame: { x: number; y: number; width: number; height: number }): BrowserWindow {
    this.overlayWindow = new BrowserWindow({
      x: Math.round(frame.x),
      y: Math.round(frame.y),
      width: Math.round(frame.width),
      height: Math.round(frame.height),
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      hasShadow: false,
      focusable: false
    });

    this.overlayWindow.setIgnoreMouseEvents(true);
    return this.overlayWindow;
  }

  private getOrbPosition(display: Electron.Display): { x: number; y: number } {
    const { visibleArea } = display;
    const offset = this.configuration.theme.dimensions.orbDistractionOffset;
    
    return {
      x: visibleArea.x + this.configuration.theme.dimensions.orbXOffset + offset,
      y: visibleArea.y + visibleArea.height - this.configuration.theme.dimensions.orbSize - this.configuration.theme.dimensions.orbYOffset - 100
    };
  }

  async showOrb(targetWindow?: ActiveWindowInfo) {
    this.targetWindow = targetWindow ?? null;
    this.isOrbExpanded = true;
    
    if (!this.orbWindow) {
      this.createOrbWindow();
    }
    
    if (this.targetWindow && this.targetWindow.frame.width > 0) {
      const frame = this.targetWindow.frame;
      this.orbWindow?.setPosition(
        Math.round(frame.x + frame.width - this.configuration.theme.dimensions.orbExpandedWidth - this.configuration.theme.dimensions.orbXOffset),
        Math.round(frame.y + this.configuration.theme.dimensions.orbYOffset)
      );
    }

    this.orbWindow?.setSize(
      this.configuration.theme.dimensions.orbExpandedWidth,
      this.configuration.theme.dimensions.orbExpandedHeight
    );
    this.orbWindow?.show();
    this.orbWindow?.focus();
  }

  hideOrb() {
    this.isOrbExpanded = false;
    if (this.orbWindow) {
      this.orbWindow.setSize(
        this.configuration.theme.dimensions.orbSize,
        this.configuration.theme.dimensions.orbSize
      );
      this.orbWindow.hide();
    }
  }

  showOverlay(targetWindow?: ActiveWindowInfo) {
    const window = targetWindow ?? this.targetWindow;
    if (!window || !window.frame) {
      return;
    }

    const frame = window.frame;
    if (!frame.width || !frame.height) {
      return;
    }

    if (!this.overlayWindow) {
      this.createOverlayWindow(frame);
    } else {
      this.overlayWindow.setPosition(Math.round(frame.x), Math.round(frame.y));
      this.overlayWindow.setSize(Math.round(frame.width), Math.round(frame.height));
    }
    this.overlayWindow?.show();
  }

  hideOverlay() {
    this.overlayWindow?.hide();
  }

  grantAccess(duration: number) {
    setTimeout(() => {
      this.hideOrb();
    }, duration * 1000);
  }
}