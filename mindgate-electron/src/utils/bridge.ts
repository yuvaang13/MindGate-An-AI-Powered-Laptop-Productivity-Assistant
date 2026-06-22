import type { AIReadinessStatus, BridgeStatus } from '../types.js';

export interface MindgateBridgeStatus {
  hasApi: boolean;
  hasReadyFlag: boolean;
  isElectron: boolean;
  isPreloadReady: boolean;
}

export interface BridgeReadiness {
  ready: boolean;
  apiReady: boolean;
  bridgeReady: boolean;
  aiReady: boolean;
  message: string;
  status: BridgeStatus | null;
  readiness: AIReadinessStatus | null;
}

type MindgateAPI = Window['mindgateAPI'] & {
  getAiReadinessStatus: () => Promise<AIReadinessStatus>;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const buildBridgeMessage = (
  status: BridgeStatus | null,
  readiness: AIReadinessStatus | null,
  fallback: string,
): string => {
  if (status && !status.ready) {
    const missing: string[] = [];
    if (!status.configuration) missing.push('configuration');
    if (!status.decisionEngine) missing.push('decision engine');
    if (!status.windowManager) missing.push('window manager');
    if (!status.workspaceMonitor) missing.push('workspace monitor');

    if (missing.length > 0) {
      return `MindGate bridge is starting (${missing.join(', ')} not ready).`;
    }
  }

  if (readiness && !readiness.ready) {
    return readiness.message;
  }

  return fallback;
};

export const getMindgateBridgeStatus = (): MindgateBridgeStatus => {
  const userAgent = window.navigator?.userAgent ?? '';

  return {
    hasApi: Boolean(window.mindgateAPI),
    hasReadyFlag: window.__MINDGATE_BRIDGE_READY__ === true,
    isElectron: userAgent.toLowerCase().includes('electron'),
    isPreloadReady: window.__preloadReady !== undefined,
  };
};

export const waitForMindgateAPI = async (
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<Window['mindgateAPI'] | null> => {
  const startedAt = Date.now();
  let warnedAboutReadyWithoutApi = false;

  while (Date.now() - startedAt <= timeoutMs) {
    const status = getMindgateBridgeStatus();

    if (status.hasApi) {
      // Only consider ready if in Electron and preload is actually ready
      if (status.isElectron && status.isPreloadReady) {
        console.log('[Bridge] API is available, preload is ready - returning API');
        return window.mindgateAPI;
      } else if (status.isElectron && status.hasApi && !status.isPreloadReady) {
        console.log('[Bridge] API is available but preload is still starting, waiting...');
      } else if (!status.isElectron) {
        // In browser context, having the API is sufficient
        console.log('[Bridge] API is available in browser context, returning');
        return window.mindgateAPI;
      }
    }

    if (status.hasReadyFlag && !status.hasApi && !warnedAboutReadyWithoutApi) {
      warnedAboutReadyWithoutApi = true;
      console.warn('[Bridge] Preload ran, waiting for mindgateAPI:', status);
    }

    await sleep(intervalMs);
  }

  console.warn('[Bridge] mindgateAPI unavailable after timeout:', getMindgateBridgeStatus());
  return null;
};

export const waitForBridgeStatus = async (
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<BridgeStatus | null> => {
  const api = await waitForMindgateAPI(timeoutMs, intervalMs);
  if (!api?.getBridgeStatus) return null;

  try {
    return await api.getBridgeStatus();
  } catch (error) {
    console.warn('[Bridge] bridge status check failed:', error);
    return null;
  }
};

export const waitForBridgeReady = async (
  timeoutMs = 15000,
  intervalMs = 250,
): Promise<BridgeReadiness> => {
  const startedAt = Date.now();
  let lastStatus: BridgeStatus | null = null;
  let lastReadiness: AIReadinessStatus | null = null;

  while (Date.now() - startedAt <= timeoutMs) {
    const api = await waitForMindgateAPI(Math.min(1000, Math.max(100, timeoutMs - (Date.now() - startedAt))), 100);
    if (!api?.getBridgeStatus || !api.getAiReadinessStatus) {
      await sleep(intervalMs);
      continue;
    }

    try {
      lastStatus = await api.getBridgeStatus();
      lastReadiness = await api.getAiReadinessStatus();
    } catch (error) {
      return {
        ready: false,
        apiReady: true,
        bridgeReady: Boolean(lastStatus?.ready),
        aiReady: Boolean(lastReadiness?.ready),
        message: `MindGate bridge status check failed: ${formatError(error)}`,
        status: lastStatus,
        readiness: lastReadiness,
      };
    }

    if (lastStatus?.ready) {
      return {
        ready: true,
        apiReady: true,
        bridgeReady: true,
        aiReady: Boolean(lastReadiness?.ready),
        message: buildBridgeMessage(lastStatus, lastReadiness, 'MindGate bridge is ready.'),
        status: lastStatus,
        readiness: lastReadiness,
      };
    }

    await sleep(intervalMs);
  }

  const message = buildBridgeMessage(
    lastStatus,
    lastReadiness,
    'MindGate bridge did not become ready in time.',
  );

  return {
    ready: false,
    apiReady: Boolean(window.mindgateAPI),
    bridgeReady: Boolean(lastStatus?.ready),
    aiReady: Boolean(lastReadiness?.ready),
    message,
    status: lastStatus,
    readiness: lastReadiness,
  };
};

export const waitForAiReadiness = async (
  timeoutMs = 5000,
  intervalMs = 250,
): Promise<AIReadinessStatus | null> => {
  const startedAt = Date.now();
  let lastStatus: AIReadinessStatus | null = null;
  const api = await waitForMindgateAPI(Math.min(timeoutMs, 5000), intervalMs) as MindgateAPI | null;

  if (!api?.getAiReadinessStatus) {
    console.warn('[Bridge] AI readiness API unavailable after timeout:', getMindgateBridgeStatus());
    return null;
  }

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      lastStatus = await api.getAiReadinessStatus();
      if (lastStatus?.ready) {
        return lastStatus;
      }
    } catch (error) {
      console.warn('[Bridge] AI readiness status check failed:', error);
    }

    await sleep(intervalMs);
  }

  console.warn('[Bridge] AI readiness timed out:', lastStatus);
  return lastStatus;
};
