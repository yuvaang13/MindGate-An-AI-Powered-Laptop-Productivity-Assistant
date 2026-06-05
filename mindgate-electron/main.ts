import { app, BrowserWindow, ipcMain, Tray, screen, Menu, nativeImage, systemPreferences } from 'electron';
import { join } from 'path';
import { ConfigurationService } from './src/services/configurationService';
import { DecisionEngine } from './src/services/decisionEngine';
import { WorkspaceMonitor } from './src/services/workspaceMonitor';
import { WindowManager } from './src/services/windowManager';
import { SystemMonitor } from './src/services/platformWrapper';
import type { ActiveWindowInfo, Configuration } from './src/types';

let configurationService: ConfigurationService;
let decisionEngine: DecisionEngine;
let workspaceMonitor: WorkspaceMonitor;
let windowManager: WindowManager;
let systemMonitor: SystemMonitor;
let tray: Tray | null = null;
let orbWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

let isOllamaConnected: boolean = false;

async function checkAccessibilityPermissions(): Promise<boolean> {
  if (process.platform === 'darwin') {
    const status = systemPreferences.accessibilityPrivilegeStatus();
    return status === 'authorized' || status === 'allowed';
  }
  return true;
}

async function requestAccessibilityPermissions(): Promise<void> {
  if (process.platform === 'darwin') {
    systemPreferences.askForAccessibilityAccess();
  }
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

  createWindows();
  setupIPC();
  setupEventHandlers();
  createTray();
  
  isOllamaConnected = await decisionEngine.checkOllamaConnection();
  if (!isOllamaConnected) {
    tray?.setTitle('⚠️');
    tray?.setToolTip('MindGate - Ollama not connected. Please start Ollama.');
  }
}

function createWindows() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;
  const config = configurationService.getConfiguration();

  orbWindow = new BrowserWindow({
    x: Math.round(bounds.x + config.theme.dimensions.orbXOffset),
    y: Math.round(bounds.y + bounds.height - config.theme.dimensions.orbSize - config.theme.dimensions.orbYOffset - 100),
    width: config.theme.dimensions.orbSize,
    height: config.theme.dimensions.orbSize,
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
    show: false,
    visible: false,
    webPreferences: {
      preload: join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  windowManager.setOrbWindow(orbWindow);

  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    focusable: false,
    show: false,
    visible: false
  });

  overlayWindow.setIgnoreMouseEvents(true);
  windowManager.setOverlayWindow(overlayWindow);

  if (process.env.VITE_DEV_SERVER_URL) {
    orbWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    orbWindow.loadFile(join(__dirname, '../dist/index.html'));
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
    await requestAccessibilityPermissions();
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

  ipcMain.handle('grant-access', (_event, index: number) => {
    const duration = configurationService.getConfiguration().settings.accessDurations[index];
    if (duration) {
      decisionEngine.grantAccess(duration);
    }
    windowManager.hideOrb();
  });

  ipcMain.handle('get-configuration', () => {
    return configurationService.getConfiguration();
  });

  ipcMain.handle('hide-orb', () => {
    windowManager.hideOrb();
  });

  ipcMain.handle('close-distraction', async () => {
    const targetApp = windowManager.getTargetApp();
    if (targetApp) {
      await windowManager.closeDistraction(targetApp);
    }
  });

  ipcMain.handle('show-settings', async () => {
    if (!settingsWindow) {
      settingsWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
          preload: join(__dirname, '../preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      settingsWindow.on('closed', () => {
        settingsWindow = null;
      });
    }
    settingsWindow.show();
  });

  ipcMain.handle('update-settings', (_event, settings: Partial<Configuration['settings']>) => {
    configurationService.updateSettings(settings);
    decisionEngine.updateConfiguration(configurationService.getConfiguration());
    workspaceMonitor.updateConfiguration(configurationService.getConfiguration());
  });

  ipcMain.handle('get-remaining-access-time', () => {
    return decisionEngine.getRemainingTime();
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
      orbWindow?.webContents.send('ollama-status-changed', isOllamaConnected);
    }
  }, 30000);
}

function setupEventHandlers() {
  workspaceMonitor.onDistractionDetected = (activeWindow: ActiveWindowInfo) => {
    decisionEngine.setCurrentApp(activeWindow);
    windowManager.setTargetWindow(activeWindow);
    windowManager.showOrb(activeWindow);
    orbWindow?.webContents.send('show-orb');
  };

  workspaceMonitor.onClearPrompt = () => {
    windowManager.hideOrb();
    orbWindow?.webContents.send('hide-orb');
  };

  decisionEngine.onAccessExpired = () => {
    const storedTargetApp = windowManager.getTargetApp();
    if (storedTargetApp) {
      setTimeout(() => {
        workspaceMonitor.onDistractionDetected?.(storedTargetApp);
      }, 100);
    }
  };

  workspaceMonitor.startMonitoring();
}

function createTray() {
  try {
    const iconName = process.platform === 'win32' ? 'tray-icon-windows.png' : 'tray-icon-mac.png';
    const iconPath = join(__dirname, '../assets', iconName);

    let trayIcon: Electron.NativeImage;
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
    } catch {
      trayIcon = nativeImage.createFromBuffer(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('MindGate Productivity Assistant');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Settings',
        click: () => {
          if (!settingsWindow) {
            settingsWindow = new BrowserWindow({
              width: 600,
              height: 800,
              webPreferences: {
                preload: join(__dirname, '../preload.js'),
                contextIsolation: true,
                nodeIntegration: false
              }
            });
            settingsWindow.on('closed', () => {
              settingsWindow = null;
            });
            if (process.env.VITE_DEV_SERVER_URL) {
              settingsWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
            } else {
              settingsWindow.loadFile(join(__dirname, '../dist/index.html'));
            }
          }
          settingsWindow.show();
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
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  await initialize();
});

app.on('activate', () => {
  if (settingsWindow) {
    settingsWindow.show();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});