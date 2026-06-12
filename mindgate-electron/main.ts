import { app, BrowserWindow, ipcMain, Tray, screen, Menu, nativeImage, systemPreferences, shell } from 'electron';
import { join } from 'path';
import { appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { ConfigurationService } from './src/services/configurationService.js';
import { DecisionEngine } from './src/services/decisionEngine.js';
import { WorkspaceMonitor } from './src/services/workspaceMonitor.js';
import { WindowManager } from './src/services/windowManager.js';
import { SystemMonitor } from './src/services/platformWrapper.js';
import { getPreloadPath, getRendererIndexPath, getTrayIconPath } from './src/utils/appPaths.js';
import type { ActiveWindowInfo, Configuration } from './src/types.js';

const execAsync = promisify(exec);

const logPath = join(tmpdir(), 'mindgate-debug.log');
try { writeFileSync(logPath, ''); } catch { /* ignore */ }
function dbg(...args: unknown[]) {
  const msg = `[${new Date().toISOString()}] ${args.map((a) => String(a)).join(' ')}\n`;
  try { appendFileSync(logPath, msg); } catch { /* ignore */ }
  console.log(...args);
}
dbg('MindGate starting, logPath:', logPath);

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

let configurationService: ConfigurationService;
let decisionEngine: DecisionEngine;
let workspaceMonitor: WorkspaceMonitor;
let windowManager: WindowManager;
let systemMonitor: SystemMonitor;
let tray: Tray | null = null;
let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let ollamaStatusInterval: NodeJS.Timeout | null = null;

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

function getOverlayPosition(config: Configuration): { x: number; y: number } {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;
  const width = config.theme.dimensions.overlayWidth;
  const height = config.theme.dimensions.overlayHeight;
  const xOffset = config.theme.dimensions.overlayXOffset;
  const yOffset = config.theme.dimensions.overlayYOffset;

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

async function initialize() {
  dbg('initialize() started');
  configurationService = new ConfigurationService();

  systemMonitor = new SystemMonitor();
  await systemMonitor.initialize();

  decisionEngine = new DecisionEngine(configurationService.getConfiguration());
  windowManager = new WindowManager(configurationService.getConfiguration(), systemMonitor);

  workspaceMonitor = new WorkspaceMonitor(
    configurationService.getConfiguration(),
    systemMonitor
  );
  workspaceMonitor.setDecisionEngine(decisionEngine);

  await createWindows();
  setupIPC();
  setupEventHandlers();
  createTray();

  const permGranted = await requestAccessibilityPermissionsIfNeeded();
  if (!permGranted) {
    console.log('Accessibility permission not granted — some features may be limited');
  }

  isOllamaConnected = await decisionEngine.checkOllamaConnection();
  if (!isOllamaConnected) {
    tray?.setTitle('⚠️');
    tray?.setToolTip('MindGate - Ollama not connected. Please start Ollama.');
  }
}

async function createWindows(): Promise<void> {
  const config = configurationService.getConfiguration();
  const { x, y } = getOverlayPosition(config);

  overlayWindow = new BrowserWindow({
    x,
    y,
    width: config.theme.dimensions.overlayWidth,
    height: config.theme.dimensions.overlayHeight,
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
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  overlayWindow.on('close', (event) => {
    event.preventDefault();
    overlayWindow?.hide();
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

  dbg('Loading overlay window, VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL);
  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    overlayWindow.loadFile(getRendererIndexPath());
  }

  try {
    await Promise.race([loadPromise, timeoutPromise]);
  } catch (e) {
    console.error('[Main] Overlay window load failed:', e);
  }
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  settingsWindow = new BrowserWindow({
    parent: overlayWindow ?? undefined,
    modal: !!overlayWindow,
    x: Math.round(primaryDisplay.bounds.x + primaryDisplay.bounds.width - 640),
    y: Math.round(primaryDisplay.bounds.y + 20),
    width: 640,
    height: 800,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?settings=true`);
  } else {
    settingsWindow.loadFile(getRendererIndexPath(), { query: { settings: 'true' } });
  }
  settingsWindow.show();
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
        message: 'Ollama service unavailable. Please start Ollama to use MindGate.',
      };
    }
    return await decisionEngine.evaluateRequest(userInput);
  });

  ipcMain.handle('grant-access', (_event, durationSeconds: number) => {
    if (durationSeconds && durationSeconds > 0) {
      decisionEngine.grantAccess(durationSeconds);
    }
  });

  ipcMain.handle('get-available-models', async () => {
    return await decisionEngine.getAvailableModels();
  });

  ipcMain.handle('get-configuration', () => {
    return configurationService.getConfiguration();
  });

  ipcMain.handle('hide-overlay', () => {
    windowManager.hideOverlay();
  });

  ipcMain.handle('close-distraction', async () => {
    await windowManager.closeDistraction(windowManager.getTargetApp());
  });

  ipcMain.handle('show-settings', async () => {
    openSettingsWindow();
    return true;
  });

  ipcMain.handle('update-settings', (_event, settings: Partial<Configuration['settings']>) => {
    configurationService.updateSettings(settings);
    decisionEngine.updateConfiguration(configurationService.getConfiguration());
    workspaceMonitor.updateConfiguration(configurationService.getConfiguration());
    windowManager.updateConfiguration(configurationService.getConfiguration());
    return true;
  });

  ipcMain.handle('get-remaining-access-time', () => {
    return decisionEngine.getRemainingTime();
  });

  ipcMain.handle('debug-show-overlay', async () => {
    windowManager.showOverlay();
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
      if (process.platform === 'darwin') {
        await shell.openPath(join('/Applications', `${appName}.app`));
      } else if (process.platform === 'win32') {
        await execAsync(`start "" "${appName.replace(/"/g, '')}"`, { shell: 'cmd.exe' });
      } else {
        const safeName = appName.replace(/"/g, '');
        await execAsync(`xdg-open "${safeName}" 2>/dev/null || gtk-launch ${safeName.toLowerCase()} 2>/dev/null || ${safeName}`);
      }
    } catch (err) {
      console.error('Failed to launch app:', err);
    }
  });

  ollamaStatusInterval = setInterval(async () => {
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
      dbg('Distraction detected:', activeWindow.processName, activeWindow.windowTitle);
      decisionEngine.setCurrentApp(activeWindow);
      windowManager.setTargetWindow(activeWindow);
      windowManager.showOverlay();
    } catch (e) {
      console.error('[Main] Error in onDistractionDetected:', e);
    }
  };

  workspaceMonitor.onClearPrompt = () => {
    windowManager.hideOverlay();
  };

  decisionEngine.onAccessExpired = () => {
    void workspaceMonitor.triggerCheckForCurrentWindow();
  };

  workspaceMonitor.startEventDrivenMonitoring();
}

function createTray() {
  try {
    const trayIcon = nativeImage.createFromPath(getTrayIconPath());
    if (trayIcon.isEmpty()) {
      throw new Error('Tray icon missing at ' + getTrayIconPath());
    }
    if (process.platform === 'darwin') {
      trayIcon.setTemplateImage(true);
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('MindGate Productivity Assistant');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Settings',
        click: () => openSettingsWindow(),
      },
      { type: 'separator' },
      {
        label: 'Quit MindGate',
        click: () => app.quit(),
      },
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
  if (ollamaStatusInterval) {
    clearInterval(ollamaStatusInterval);
    ollamaStatusInterval = null;
  }
  workspaceMonitor?.stopMonitoring();
});

app.on('activate', () => {
  // Background app — no dock window
});

app.on('window-all-closed', () => {
  // Keep running in the tray on all platforms
});
