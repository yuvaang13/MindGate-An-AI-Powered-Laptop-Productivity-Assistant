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
      if (status.isElectron && status.isPreloadReady) {
        console.log('[Bridge] API is available, preload is ready - returning API');
        return window.mindgateAPI;
      } else if (status.isElectron && status.hasApi && !status.isPreloadReady) {
        console.log('[Bridge] API is available but preload is still starting, waiting...');
      } else if (!status.isElectron) {
        console.log('[Bridge] API is available in browser context, returning');
        return window.mindgateAPI;
      }
    }

    console.error('[Bridge] Polling... hasApi:', status.hasApi, 'isPreloadReady:', status.isPreloadReady, 'window.mindgateAPI type:', typeof window.mindgateAPI, 'hasReadyFlag:', status.hasReadyFlag);

    if (status.hasReadyFlag && !status.hasApi && !warnedAboutReadyWithoutApi) {
      warnedAboutReadyWithoutApi = true;
      console.warn('[Bridge] Preload ran, waiting for mindgateAPI:', status);
    }

    await sleep(intervalMs);
  }

  const finalStatus = getMindgateBridgeStatus();
  console.error('[Bridge] mindgateAPI unavailable after timeout:', finalStatus);
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
  timeoutMs = 8000,
  intervalMs = 150,
): Promise<BridgeReadiness> => {
  const startedAt = Date.now();
  let lastStatus: BridgeStatus | null = null;
  let lastReadiness: AIReadinessStatus | null = null;

  while (Date.now() - startedAt <= timeoutMs) {
    const api = await waitForMindgateAPI(Math.min(800, Math.max(150, timeoutMs - (Date.now() - startedAt))), 50);
    const hasBridgeStatus = Boolean(api?.getBridgeStatus);
    const hasAiReadiness = Boolean(api?.getAiReadinessStatus);

    if (!hasBridgeStatus && !hasAiReadiness) {
      if (Date.now() - startedAt > timeoutMs - 200) {
        console.warn('[Bridge] API became unavailable near timeout');
      }
      await sleep(intervalMs);
      continue;
    }

    if (hasBridgeStatus) {
      try {
        lastStatus = await api!.getBridgeStatus();
      } catch (error) {
        if (Date.now() - startedAt > timeoutMs - 500) {
          console.warn('[Bridge] Final bridge status check failed — timing out:', error);
        } else {
          console.warn('[Bridge] bridge status check failed — retrying:', error);
        }
        if (Date.now() - startedAt >= timeoutMs - intervalMs) {
          const lastApiAvailable = Boolean(window.mindgateAPI);
          return {
            ready: false,
            apiReady: lastApiAvailable,
            bridgeReady: Boolean(lastStatus?.ready),
            aiReady: Boolean(lastReadiness?.ready),
            message: lastApiAvailable
              ? `MindGate bridge did not respond in time (${formatError(error)}). The app is starting — please wait a moment.`
              : 'MindGate bridge API is not available yet. Please ensure the MindGate desktop app is running and loaded.',
            status: lastStatus,
            readiness: lastReadiness,
          };
        }
        await sleep(intervalMs);
        continue;
      }
    }

    if (hasAiReadiness) {
      try {
        lastReadiness = await api!.getAiReadinessStatus();
      } catch (error) {
        if (Date.now() - startedAt > timeoutMs - 500) {
          console.warn('[Bridge] Final AI readiness check failed — timing out:', error);
        } else {
          console.warn('[Bridge] AI readiness check failed — retrying:', error);
        }
        if (Date.now() - startedAt >= timeoutMs - intervalMs) {
          const lastApiAvailable = Boolean(window.mindgateAPI);
          return {
            ready: false,
            apiReady: lastApiAvailable,
            bridgeReady: Boolean(lastStatus?.ready),
            aiReady: Boolean(lastReadiness?.ready),
            message: lastApiAvailable
              ? `MindGate AI status check failed (${formatError(error)}).`
              : 'MindGate bridge API is not available yet. Please ensure the MindGate desktop app is running and loaded.',
            status: lastStatus,
            readiness: lastReadiness,
          };
        }
        await sleep(intervalMs);
        continue;
      }
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