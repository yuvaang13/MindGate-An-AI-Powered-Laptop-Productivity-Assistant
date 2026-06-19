import type { AIReadinessStatus, BridgeStatus } from '../types.js';

export interface MindgateBridgeStatus {
  hasApi: boolean;
  hasReadyFlag: boolean;
  isElectron: boolean;
}

type MindgateAPI = Window['mindgateAPI'] & {
  getAiReadinessStatus: () => Promise<AIReadinessStatus>;
};

export const getMindgateBridgeStatus = (): MindgateBridgeStatus => {
  const userAgent = window.navigator?.userAgent ?? '';

  return {
    hasApi: Boolean(window.mindgateAPI),
    hasReadyFlag: window.__MINDGATE_BRIDGE_READY__ === true,
    isElectron: userAgent.toLowerCase().includes('electron'),
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

    if (window.mindgateAPI) {
      return window.mindgateAPI;
    }

    if (status.hasReadyFlag && !status.hasApi && !warnedAboutReadyWithoutApi) {
      warnedAboutReadyWithoutApi = true;
      console.warn('[Bridge] Preload ran, waiting for mindgateAPI:', status);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
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

export const waitForAiReadiness = async (
  timeoutMs = 30000,
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

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.warn('[Bridge] AI readiness timed out:', lastStatus);
  return lastStatus;
};
