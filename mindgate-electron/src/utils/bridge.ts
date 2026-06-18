export interface MindgateBridgeStatus {
  hasApi: boolean;
  hasReadyFlag: boolean;
  isElectron: boolean;
}

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

  while (Date.now() - startedAt <= timeoutMs) {
    const status = getMindgateBridgeStatus();

    if (window.mindgateAPI) {
      return window.mindgateAPI;
    }

    if (status.hasReadyFlag && !status.hasApi) {
      console.warn('[Bridge] Preload ran but mindgateAPI is unavailable:', status);
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.warn('[Bridge] mindgateAPI unavailable:', getMindgateBridgeStatus());
  return null;
};
