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
import type { ActiveWindowInfo, BridgeStatus, Configuration, OllamaConnectionStatus } from './src/types.js';

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
let overlayRendererLoaded = false;
let overlayPreloadReady = false;
let ipcRegistered = false;
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
        primary: '#7ee7c9',
        secondary: '#a8b0bd',
        accent: '#7ee7c9',
        background: '#111318',
        surface: '#1b202b',
        text: '#f4f1ea',
        textSecondary: '#a8b0bd',
        error: '#ff6b5f',
        warning: '#ffd166',
      },
      animation: {
        transitionDuration: 0.25,
        overlayFadeDuration: 0.25,
      },
      dimensions: {
        overlayWidth: 330,
        overlayHeight: 380,
        chatCornerRadius: 24,
      },
    },
  };
}

function getOverlayStatus(): BridgeStatus['overlay'] {
  const exists = Boolean(overlayWindow && !overlayWindow.isDestroyed());
  return {
    exists,
    destroyed: Boolean(overlayWindow?.isDestroyed()),
    visible: exists ? overlayWindow!.isVisible() : false,
    rendererLoaded: overlayRendererLoaded,
    preloadReady: overlayPreloadReady,
  };
}

function getBridgeStatus(): BridgeStatus {
  const services = {
    configuration: Boolean(configurationService),
    decisionEngine: Boolean(decisionEngine),
    windowManager: Boolean(windowManager),
    workspaceMonitor: Boolean(workspaceMonitor),
    overlay: getOverlayStatus(),
  };
  const bridgeReady = services.configuration && services.decisionEngine && services.windowManager && services.workspaceMonitor;
  const ai = decisionEngine?.getAIReadinessStatus(bridgeReady) ?? {
    ready: false,
    bridgeReady,
    ollamaReachable: false,
    modelReady: false,
    warmupReady: false,
    message: 'MindGate AI is starting.',
    elapsedMs: 0,
    startedAt: Date.now(),
    origin: 'http://localhost:11434',
    configuredModel: 'gemma3:1b',
    activeModel: 'gemma3:1b',
  };

  return {
    ready: bridgeReady,
    configuration: services.configuration,
    decisionEngine: services.decisionEngine,
    windowManager: services.windowManager,
    workspaceMonitor: services.workspaceMonitor,
    aiReady: ai.ready,
    ai,
    overlay: services.overlay,
    checkedAt: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    ipcRegistered,
    services,
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

async function initialize() {
  dbg('initialize() started');
  configurationService = new ConfigurationService();

  systemMonitor = new SystemMonitor();
  await systemMonitor.initialize();

  decisionEngine = new DecisionEngine(configurationService.getConfiguration());
  void decisionEngine.initializeForLaunch(5000).catch((error) => {
    console.error('[Main] AI launch readiness failed:', error);
  });

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
  if (!configurationService || !windowManager) {
    console.error('[Main] createWindows called before services initialized');
    return;
  }

  const config = configurationService.getConfiguration();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
  }

  overlayRendererLoaded = false;
  overlayPreloadReady = false;

  const newOverlayWindow = new BrowserWindow({
    x: Math.round(bounds.x + 12),
    y: Math.round(bounds.y + 12),
    width: config.theme.dimensions.overlayWidth,
    height: config.theme.dimensions.overlayHeight,
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
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  overlayWindow = newOverlayWindow;

  overlayWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      overlayWindow?.hide();
    }
  });

  overlayWindow.on('closed', () => {
    overlayRendererLoaded = false;
    overlayPreloadReady = false;
  });

  overlayWindow.on('focus', () => {
    dbg('[Main] overlayWindow focused');
  });

  windowManager.setOverlayWindow(overlayWindow);

  const loadPromise = new Promise<void>((resolve) => {
    overlayWindow!.webContents.once('did-finish-load', () => {
      overlayRendererLoaded = true;
      windowManager.markOverlayRendererReady();
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
  if (ipcRegistered) return;
  ipcRegistered = true;

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
        message: 'MindGate is still starting. Please try again in a moment.',
        isApproved: null,
      };
    }
    try {
      return await decisionEngine.sendChatMessage(userInput);
    } catch (error) {
      return {
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isApproved: null,
      };
    }
  });

  ipcMain.handle('evaluate-request', async (_event, userInput: string) => {
    if (!decisionEngine) {
      return {
        isApproved: null,
        message: 'Connection not ready. Please try again.',
      };
    }
    try {
      return await decisionEngine.evaluateRequest(userInput);
    } catch (error) {
      return {
        isApproved: null,
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

  ipcMain.handle('bridge-ping', () => getBridgeStatus().ready);

  ipcMain.handle('get-bridge-status', () => getBridgeStatus());

  ipcMain.handle('get-ai-readiness-status', () => getBridgeStatus().ai);

  ipcMain.handle('get-ollama-connection-status', async (): Promise<OllamaConnectionStatus> => {
    if (!decisionEngine) {
      return {
        connected: false,
        message: 'MindGate is still starting. Please try again in a moment.',
        origin: 'http://localhost:11434',
        configuredModel: 'gemma3:1b',
        activeModel: 'gemma3:1b',
        modelAvailable: false,
        availableModels: [],
      };
    }
    return decisionEngine.getOllamaConnectionStatus();
  });

  ipcMain.handle('hide-overlay', () => {
    if (!windowManager) return;
    windowManager.hideOverlay();
  });

  ipcMain.handle('debug-show-overlay', () => {
    if (!windowManager) return false;
    return windowManager.showOverlay();
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

  ipcMain.on('preload-ready', () => {
    overlayPreloadReady = true;
    dbg('[Main] preload-ready received');
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('preload-ready-ack');
      dbg('[Main] preload-ready-ack sent');
    }
  });

  if (ollamaStatusInterval) {
    clearInterval(ollamaStatusInterval);
    ollamaStatusInterval = null;
  }

  ollamaStatusInterval = setInterval(async () => {
    if (!decisionEngine) return;
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
  if (!decisionEngine) return;

  void (async () => {
    isOllamaConnected = await decisionEngine.checkOllamaConnection();
    if (!isOllamaConnected) {
      tray?.setTitle('⚠️');
      tray?.setToolTip('MindGate - Ollama not connected. Please start Ollama.');
    }
  })();
}

function setupEventHandlers() {
  if (!workspaceMonitor || !decisionEngine || !windowManager) {
    console.error('[Main] setupEventHandlers called before services initialized');
    return;
  }

  workspaceMonitor.onDistractionDetected = async (activeWindow: ActiveWindowInfo) => {
    try {
      dbg('Distraction detected:', activeWindow.processName, activeWindow.windowTitle);
      decisionEngine.setCurrentApp(activeWindow);
      windowManager.setTargetWindow(activeWindow);
      const shown = windowManager.showOverlay();
      if (!shown) {
        dbg('[Main] Failed to show overlay for distraction:', activeWindow.processName, activeWindow.windowTitle);
        workspaceMonitor.forceRetryPrompt();
      }
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
        label: 'Show Overlay',
        click: () => windowManager.showOverlay(),
      },
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

function requestQuit(signal?: NodeJS.Signals): void {
  if (isQuitting) return;

  if (signal) {
    dbg(`[Main] Received ${signal}, quitting app`);
  }

  isQuitting = true;

  if (app.isReady()) {
    app.quit();
  } else {
    app.once('ready', () => app.quit());
  }
}

for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
  process.on(signal, () => requestQuit(signal));
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
