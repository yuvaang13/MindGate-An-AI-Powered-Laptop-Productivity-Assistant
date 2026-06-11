import { app, BrowserWindow, ipcMain, Tray, screen, Menu, nativeImage, systemPreferences, shell } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ConfigurationService } from './src/services/configurationService.js';
import { DecisionEngine } from './src/services/decisionEngine.js';
import { WorkspaceMonitor } from './src/services/workspaceMonitor.js';
import { WindowManager } from './src/services/windowManager.js';
import { SystemMonitor } from './src/services/platformWrapper.js';
import type { ActiveWindowInfo, Configuration } from './src/types.js';

for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (err: NodeJS.ErrnoException) => {
    if (err?.code === 'EIO') return;
    console.error('Stream error:', err);
  });
}

function patchConsole() {
  const c = console as unknown as Record<string, (...args: unknown[]) => void>;
  for (const method of ['log', 'error', 'warn', 'info']) {
    const original = c[method];
    c[method] = function (...args: unknown[]) {
      try {
        original.apply(console, args);
      } catch (e: unknown) {
        const err = e as NodeJS.ErrnoException;
        if (err?.code !== 'EIO') {
          throw e;
        }
      }
    };
  }
}
patchConsole();

const __dirname = dirname(fileURLToPath(import.meta.url));

let configurationService: ConfigurationService;
let decisionEngine: DecisionEngine;
let workspaceMonitor: WorkspaceMonitor;
let windowManager: WindowManager;
let systemMonitor: SystemMonitor;
let tray: Tray | null = null;
let overlayWindow: BrowserWindow | null = null;

let isOllamaConnected: boolean = false;
let hasRequestedPermissions: boolean = false;

async function checkAccessibilityPermissions(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;
  return systemPreferences.isTrustedAccessibilityClient(false);
}

async function requestAccessibilityPermissionsIfNeeded(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;
  
  if (hasRequestedPermissions) {
    return systemPreferences.isTrustedAccessibilityClient(false);
  }
  
  try {
    systemPreferences.isTrustedAccessibilityClient(true);
  } catch (e) {
    console.error('Failed to request accessibility permission:', e);
  }
  hasRequestedPermissions = true;
  
  const granted = systemPreferences.isTrustedAccessibilityClient(false);
  if (granted) {
    systemMonitor.setPermissionsGranted();
    tray?.setToolTip('MindGate Productivity Assistant');
  }
  return granted;
}

async function initialize() {
  configurationService = new ConfigurationService();

  systemMonitor = new SystemMonitor();
  await systemMonitor.initialize();

  decisionEngine = new DecisionEngine(configurationService.getConfiguration());
  windowManager = new WindowManager(configurationService.getConfiguration());

  workspaceMonitor = new WorkspaceMonitor(
    configurationService.getConfiguration(),
    systemMonitor
  );
  workspaceMonitor.setDecisionEngine(decisionEngine);

  await createWindows();
  setupIPC();
  setupEventHandlers();
  createTray();

  isOllamaConnected = await decisionEngine.checkOllamaConnection();
  if (!isOllamaConnected) {
    tray?.setTitle('⚠️');
    tray?.setToolTip('MindGate - Ollama not connected. Please start Ollama.');
  }
}

async function createWindows(): Promise<void> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;
  const config = configurationService.getConfiguration();

  overlayWindow = new BrowserWindow({
    x: Math.round(bounds.x + config.theme.dimensions.overlayXOffset),
    y: Math.round(bounds.y + config.theme.dimensions.overlayYOffset),
    width: config.theme.dimensions.overlayWidth,
    height: config.theme.dimensions.overlayHeight,
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
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  windowManager.setOverlayWindow(overlayWindow);

  const loadPromise = new Promise<void>((resolve) => {
    overlayWindow!.webContents.on('did-finish-load', () => {
      console.log('Overlay window finished loading');
      resolve();
    });
  });

  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error('Overlay window load timed out after 15s')), 15000);
  });

  console.log('Loading overlay window with VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL);
  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    overlayWindow.loadFile(join(__dirname, 'dist/index.html'));
  }

  try {
    await Promise.race([loadPromise, timeoutPromise]);
  } catch (e) {
    console.error('[Main] Overlay window load failed:', e);
  }
}

function setupIPC() {
  ipcMain.handle('check-ollama-connection', async () => {
    const connected = await decisionEngine.checkOllamaConnection();
    if (connected) {
      tray?.setTitle('');
      tray?.setToolTip('MindGate Productivity Assistant');
    } else {
      tray?.setTitle('⚠️');
      tray?.setToolTip('MindGate - Ollama not connected');
    }
    return connected;
  });

  ipcMain.handle('check-accessibility-permission', async () => {
    return await checkAccessibilityPermissions();
  });

  ipcMain.handle('request-accessibility-permission', async () => {
    return await requestAccessibilityPermissionsIfNeeded();
  });

  ipcMain.handle('generate-first-message', async () => {
    const connected = await decisionEngine.checkOllamaConnection();
    if (!connected) {
      return 'MindGate AI is not connected. Please start Ollama.';
    }
    return await decisionEngine.generateFirstMessage();
  });

  ipcMain.handle('send-chat-message', async (_event, userInput: string) => {
    const connected = await decisionEngine.checkOllamaConnection();
    if (!connected) {
      return { message: 'Ollama service unavailable. Access denied.', isApproved: false };
    }
    return await decisionEngine.sendChatMessage(userInput);
  });

  ipcMain.handle('reset-chat', async () => {
    decisionEngine.resetChat();
  });

  ipcMain.handle('evaluate-request', async (_event, userInput: string) => {
    const connected = await decisionEngine.checkOllamaConnection();
    if (!connected) {
      return {
        isApproved: false,
        message: 'Ollama service unavailable. Please start Ollama to use MindGate.'
      };
    }
    return await decisionEngine.evaluateRequest(userInput);
  });

  ipcMain.handle('grant-access', (_event, durationSeconds: number) => {
    if (durationSeconds && durationSeconds > 0) {
      decisionEngine.grantAccess(durationSeconds);
    }
  });

  ipcMain.handle('get-configuration', () => {
    return configurationService.getConfiguration();
  });

  ipcMain.handle('hide-overlay', () => {
    windowManager.hideOverlay();
  });

  ipcMain.handle('close-distraction', async () => {
    const targetApp = windowManager.getTargetApp();
    if (targetApp) {
      await windowManager.closeDistraction(targetApp);
    }
  });

  ipcMain.handle('show-settings', async () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const settingsWindow = new BrowserWindow({
      x: Math.round(primaryDisplay.bounds.x + primaryDisplay.bounds.width - 640),
      y: Math.round(primaryDisplay.bounds.y + 20),
      width: 640,
      height: 800,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    if (process.env.VITE_DEV_SERVER_URL) {
      settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?settings=true`);
    } else {
      settingsWindow.loadFile(join(__dirname, 'dist/index.html'), { hash: 'settings=true' });
    }
    settingsWindow.show();
    return true;
  });

  ipcMain.handle('update-settings', (_event, settings: Partial<Configuration['settings']>) => {
    configurationService.updateSettings(settings);
    decisionEngine.updateConfiguration(configurationService.getConfiguration());
    workspaceMonitor.updateConfiguration(configurationService.getConfiguration());
    windowManager.updateConfiguration(configurationService.getConfiguration());
  });

  ipcMain.handle('get-remaining-access-time', () => {
    return decisionEngine.getRemainingTime();
  });

  ipcMain.handle('debug-show-overlay', async () => {
    console.log('[Main] Debug: manually showing overlay');
    windowManager.showOverlay();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const [x, y] = overlayWindow.getPosition();
      const [w, h] = overlayWindow.getSize();
      console.log(`[Main] Debug: overlay at (${x},${y}) size ${w}x${h}, visible: ${overlayWindow.isVisible()}`);
      overlayWindow.webContents.send('show-overlay');
    }
    return true;
  });

  ipcMain.handle('launch-url', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
    } catch (err) {
      console.error('Failed to open URL:', err);
    }
  });

  ipcMain.handle('launch-app', async (_event, appName: string) => {
    try {
      const appPath = join('/Applications', `${appName}.app`);
      await shell.openPath(appPath);
    } catch (err) {
      console.error('Failed to launch app:', err);
      try {
        await shell.openExternal('https://www.google.com');
      } catch {}
    }
  });

  setInterval(async () => {
    const connected = await decisionEngine.checkOllamaConnection();
    if (connected !== isOllamaConnected) {
      isOllamaConnected = connected;
      if (isOllamaConnected) {
        tray?.setTitle('');
        tray?.setToolTip('MindGate Productivity Assistant');
      } else {
        tray?.setTitle('⚠️');
        tray?.setToolTip('MindGate - Ollama not connected');
      }
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('ollama-status-changed', isOllamaConnected);
      }
    }
  }, 30000);
}

function setupEventHandlers() {
  workspaceMonitor.onDistractionDetected = async (activeWindow: ActiveWindowInfo) => {
    try {
      console.log('Distraction detected:', activeWindow.processName, activeWindow.windowTitle);
      decisionEngine.setCurrentApp(activeWindow);
      windowManager.setTargetWindow(activeWindow);
      
      if (!hasRequestedPermissions) {
        const hasPermission = await requestAccessibilityPermissionsIfNeeded();
        hasRequestedPermissions = true;
        if (!hasPermission) {
          console.log('Accessibility permission not granted — proceeding without AX API');
        }
      }
      
      console.log('[Main] Calling showOverlay — overlayWindow exists:', !!overlayWindow);
      windowManager.showOverlay(activeWindow);
      console.log('[Main] Sending show-overlay to renderer');
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('show-overlay');
      }
    } catch (e) {
      console.error('[Main] Error in onDistractionDetected:', e);
    }
  };

  workspaceMonitor.onClearPrompt = () => {
    console.log('Clear prompt triggered');
    windowManager.hideOverlay();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('hide-overlay');
    }
  };

  decisionEngine.onAccessExpired = () => {
    console.log('Access expired');
    const storedTargetApp = windowManager.getTargetApp();
    if (storedTargetApp) {
      setTimeout(() => {
        workspaceMonitor.onDistractionDetected?.(storedTargetApp);
      }, 100);
    }
  };

  workspaceMonitor.startEventDrivenMonitoring();
}

function createTrayIcon(): Electron.NativeImage {
  const iconPath = join(mkdtempSync(join(tmpdir(), 'mindgate-icon-')), 'icon.svg');
  writeFileSync(iconPath, `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <circle cx="11" cy="9" r="6.5" fill="none" stroke="#000" stroke-width="1.1"/>
  <path d="M7 8 Q9.5 6 11 8 Q12.5 6 15 8" fill="none" stroke="#000" stroke-width="0.7"/>
  <path d="M7 9.5 Q9.5 7.5 11 9.5 Q12.5 7.5 15 9.5" fill="none" stroke="#000" stroke-width="0.7"/>
  <path d="M6.5 15 Q11 17 15.5 15" fill="none" stroke="#000" stroke-width="0.7"/>
</svg>`);
  const img = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') {
    img.setTemplateImage(true);
  }
  return img;
}

function createTray() {
  try {
    const trayIcon = createTrayIcon();

    tray = new Tray(trayIcon);
    tray.setToolTip('MindGate Productivity Assistant');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Settings',
        click: () => {
          const primaryDisplay = screen.getPrimaryDisplay();
          const settingsWin = new BrowserWindow({
            x: Math.round(primaryDisplay.bounds.x + primaryDisplay.bounds.width - 640),
            y: Math.round(primaryDisplay.bounds.y + 20),
            width: 640,
            height: 800,
            webPreferences: {
              preload: join(__dirname, 'preload.js'),
              contextIsolation: true,
              nodeIntegration: false
            }
          });
          if (process.env.VITE_DEV_SERVER_URL) {
            settingsWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}?settings=true`);
          } else {
            settingsWin.loadFile(join(__dirname, 'dist/index.html'), { hash: 'settings=true' });
          }
          settingsWin.show();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit MindGate',
        click: () => app.quit()
      }
    ]);

    tray.setContextMenu(contextMenu);
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
  await initialize();
});

app.on('will-quit', () => {
  console.log('[Main] Cleaning up — stopping workspace observer');
  workspaceMonitor?.stopMonitoring();
});

app.on('activate', () => {
  // No-op: app runs in background
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});