import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const bridgePath = resolve('dist-electron/src/utils/bridge.js');
assert.ok(existsSync(bridgePath), 'Run npm run build before npm run test:smoke');

globalThis.window = {
  navigator: { userAgent: 'Electron Smoke Test' },
  __MINDGATE_BRIDGE_READY__: false,
  mindgateAPI: null,
};

const { waitForBridgeReady, waitForMindgateAPI } = await import(`file://${bridgePath}`);

const readiness = {
  ready: false,
  bridgeReady: true,
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

globalThis.window.mindgateAPI = {
  getBridgeStatus: async () => ({
    ready: true,
    configuration: true,
    decisionEngine: true,
    windowManager: true,
    workspaceMonitor: true,
    aiReady: readiness.ready,
    ai: readiness,
    overlay: {
      exists: true,
      destroyed: false,
      visible: false,
      rendererLoaded: true,
      preloadReady: true,
    },
    checkedAt: new Date().toISOString(),
    uptimeSeconds: 0,
    ipcRegistered: true,
    services: {
      configuration: true,
      decisionEngine: true,
      windowManager: true,
      workspaceMonitor: true,
      overlay: {
        exists: true,
        destroyed: false,
        visible: false,
        rendererLoaded: true,
        preloadReady: true,
      },
    },
  }),
  getAiReadinessStatus: async () => {
    readiness.ready = true;
    readiness.ollamaReachable = true;
    readiness.modelReady = true;
    readiness.warmupReady = false;
    readiness.message = 'MindGate AI is ready.';
    readiness.elapsedMs = Date.now() - readiness.startedAt;
    return readiness;
  },
};

const api = await waitForMindgateAPI(1000);
assert.equal(api, globalThis.window.mindgateAPI);

const bridgeReady = await waitForBridgeReady(2000, 50);
assert.equal(bridgeReady.ready, true);
assert.equal(bridgeReady.bridgeReady, true);
assert.equal(bridgeReady.aiReady, true);
assert.match(bridgeReady.message, /ready/i);

console.log('Bridge smoke test passed');
