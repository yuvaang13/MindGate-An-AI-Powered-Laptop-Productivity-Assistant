export const waitForMindgateAPI = async (
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<Window['mindgateAPI'] | null> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    if (window.mindgateAPI) {
      return window.mindgateAPI;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
};
