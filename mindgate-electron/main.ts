import { app, BrowserWindow, ipcMain, Tray, screen, Menu, nativeImage, systemPreferences, shell } from 'electron';
import { join } from 'path';
import { appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ConfigurationService } from './src/services/configurationService.js';
import { DecisionEngine } from './src/services/decisionEngine.js';
import { WorkspaceMonitor } from './src/services/workspaceMonitor.js';
import { WindowManager } from './src/services/windowManager.js';
import { SystemMonitor } from './src/services/platformWrapper.js';
import { getPreloadPath, getRendererIndexPath, getTrayIconPath } from './src/utils/appPaths.js';
import type { ActiveWindowInfo, Configuration } from './src/types.js';

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
let isQuitting: boolean = false;

const DEFAULT_FIRST_MESSAGE = 'What do you need access for?';

function getDefaultConfiguration(): Configuration {
  return {
    settings: {
      distractingApps: [],
      restrictedKeywords: [],
      monitoredBrowsers: ['Safari', 'Google Chrome', 'Microsoft Edge', 'Firefox', 'Brave'],
      ollamaURL: 'http://localhost:11434/api/generate',
      ollamaModel: 'gemma3:1b',
      accessDurations: [300, 600, 900],
      accessDurationLabels: ['5 Mins', '10 Mins', '15 Mins'],
      productiveTasks: [],
      productiveApps: [],
      justificationCountdownDuration: 20,
    },
    theme: {
      colors: {
        primary: '#FFFFFF',
        secondary: '#FFFFFFB3',
        accent: '#FFFFFF99',
        background: '#000000',
        surface: '#000000',
        text: '#FFFFFF',
        textSecondary: '#FFFFFFB3',
        error: '#FF453A',
        warning: '#FF9F0A',
      },
      animation: {
        transitionDuration: 0.3,
        overlayFadeDuration: 0.3,
      },
      dimensions: {
        overlayWidth: 280,
        overlayHeight: 280,
        chatCornerRadius: 24,
      },
    },
  };
}

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

  setupIPC();
  await createWindows();
  setupEventHandlers();
  createTray();

  const permGranted = await requestAccessibilityPermissionsIfNeeded();
  if (!permGranted) {
    console.log('Accessibility permission not granted — some features may be limited');
  }

  // Check Ollama in background - don't block window creation
  checkOllamaInBackground();
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
    if (!isQuitting) {
      event.preventDefault();
      overlayWindow?.hide();
    }
  });

  overlayWindow.on('focus', () => {
    dbg('[Main] overlayWindow focused');
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
    if (!decisionEngine) {
      console.error('[Main] check-ollama-connection called before decisionEngine initialized');
      return false;
    }
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
    if (!decisionEngine) {
      return DEFAULT_FIRST_MESSAGE;
    }
    try {
      return await decisionEngine.generateFirstMessage();
    } catch {
      return DEFAULT_FIRST_MESSAGE;
    }
  });

ipcMain.handle('send-chat-message', async (_event, userInput: string) => {
    if (!decisionEngine) {
      return { 
        message: 'Connection not ready. Please try again in a moment.', 
        isApproved: false,
      };
    }
    try {
      return await decisionEngine.sendChatMessage(userInput);
    } catch (error) {
      return {
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isApproved: false,
      };
    }
  });

  ipcMain.handle('evaluate-request', async (_event, userInput: string) => {
    if (!decisionEngine) {
      return {
        isApproved: false,
        message: 'Connection not ready. Please try again.',
      };
    }
    try {
      return await decisionEngine.evaluateRequest(userInput);
    } catch (error) {
      return {
        isApproved: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  });

  ipcMain.handle('reset-chat', async () => {
    if (!decisionEngine) return;
    decisionEngine.resetChat();
  });

  ipcMain.handle('grant-access', (_event, durationSeconds: number) => {
    if (!decisionEngine) return;
    if (durationSeconds && durationSeconds > 0) {
      decisionEngine.grantAccess(durationSeconds);
    }
  });

  ipcMain.handle('get-available-models', async () => {
    if (!decisionEngine) return [];
    return await decisionEngine.getAvailableModels();
  });

  ipcMain.handle('get-configuration', () => {
    if (!configurationService) {
      console.warn('[Main] get-configuration called before configurationService initialized, returning defaults');
      return getDefaultConfiguration();
    }
    return configurationService.getConfiguration();
  });

  ipcMain.handle('hide-overlay', () => {
    if (!windowManager) return;
    windowManager.hideOverlay();
  });

  ipcMain.handle('close-distraction', async () => {
    if (!windowManager) return;
    await windowManager.closeDistraction();
  });

  ipcMain.handle('show-settings', async () => {
    openSettingsWindow();
    return true;
  });

  ipcMain.handle('update-settings', (_event, settings: Partial<Configuration['settings']>) => {
    if (!configurationService || !decisionEngine || !workspaceMonitor || !windowManager) {
      console.error('[Main] update-settings called before services initialized');
      return false;
    }
    configurationService.updateSettings(settings);
    decisionEngine.updateConfiguration(configurationService.getConfiguration());
    workspaceMonitor.updateConfiguration(configurationService.getConfiguration());
    windowManager.updateConfiguration(configurationService.getConfiguration());
    return true;
  });

  ipcMain.handle('get-remaining-access-time', () => {
    if (!decisionEngine) return 0;
    return decisionEngine.getRemainingTime();
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

  // Listen for preload-ready notification and acknowledge it
  ipcMain.on('preload-ready', () => {
    dbg('[Main] preload-ready received');
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('preload-ready-ack');
      dbg('[Main] preload-ready-ack sent');
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

function checkOllamaInBackground(): void {
  void (async () => {
    isOllamaConnected = await decisionEngine.checkOllamaConnection();
    if (!isOllamaConnected) {
      tray?.setTitle('⚠️');
      tray?.setToolTip('MindGate - Ollama not connected. Please start Ollama.');
    }
  })();
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

app.on('before-quit', () => {
  dbg('[Main] before-quit triggered');
  // Ensure child processes are stopped before quit
  workspaceMonitor?.stopMonitoring();
});

app.on('will-quit', () => {
  dbg('[Main] will-quit triggered');
  isQuitting = true;
  if (ollamaStatusInterval) {
    clearInterval(ollamaStatusInterval);
    ollamaStatusInterval = null;
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.destroy();
  }
  tray?.destroy();
  tray = null;
});

app.on('activate', () => {
  // Background app — no dock window
});

app.on('window-all-closed', () => {
  // Keep running in the tray on all platforms
});
