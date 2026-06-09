import { exec } from 'child_process';
import { promisify } from 'util';
import { ActiveWindowInfo } from '../../types.js';

const execAsync = promisify(exec);

export class MacMonitor {
  private hasPermission: boolean = true;

  setPermissionsGranted(): void {
    this.hasPermission = true;
  }

  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    if (!this.hasPermission) {
      return null;
    }

    try {
      const script = `
tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
end tell
tell application frontApp
  if (count of windows) > 0 then
    set windowTitle to name of front window
  else
    set windowTitle to ""
  end if
end tell
tell application "System Events"
  set frontAppPath to (path to frontmost application)
  set appBundleID to bundle identifier of (info for frontAppPath)
end tell
`;
      const { stdout } = await execAsync(`osascript -e '${script}'`, { timeout: 5000 });

      const lines = stdout.trim().split('\n');
      const processName = lines[0] || 'unknown';
      const windowTitle = lines[1] || '';
      const bundleID = lines[2] || '';

      const frameScript = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set frontWindow to value of attribute "AXFrame" of front window of frontApp
end tell
`;
      let frame = { x: 0, y: 0, width: 0, height: 0 };
      try {
        const frameResult = await execAsync(`osascript -e '${frameScript}'`, { timeout: 5000 });
        const frameParts = frameResult.stdout.trim().split(',').map(p => parseFloat(p.trim()));
        if (frameParts.length >= 4) {
          const mainScreenHeight = await this.getMainScreenHeight();
          frame = {
            x: frameParts[0] || 0,
            y: mainScreenHeight - (frameParts[1] || 0) - (frameParts[3] || 0),
            width: frameParts[2] || 0,
            height: frameParts[3] || 0
          };
        }
      } catch {
        // Frame is optional — proceed without it
      }

      const browserURL = bundleID ? (await this.getActiveBrowserURL(bundleID)) ?? undefined : undefined;

      return {
        processName,
        windowTitle,
        bundleID,
        browserURL,
        frame
      };
    } catch (error) {
      const msg = String(error);
      if (msg.includes('-1743')) {
        this.hasPermission = false;
        console.log('Accessibility permission denied — AppleScript calls disabled. Grant permission via the in-app banner.');
      } else {
        console.error('Failed to get active window:', msg.slice(0, 200));
      }
      return null;
    }
  }

  async getActiveBrowserURL(bundleID: string): Promise<string | null> {
    if (!bundleID) return null;

    try {
      let script: string;

      if (bundleID.includes('safari')) {
        script = `tell application id "${bundleID}"
  if (count of windows) is 0 then return ""
  return URL of current tab of front window
end tell`;
      } else if (bundleID.includes('chrome') || bundleID.includes('brave') || bundleID.includes('edge')) {
        script = `tell application id "${bundleID}"
  if (count of windows) is 0 then return ""
  return URL of active tab of front window
end tell`;
      } else if (bundleID.includes('firefox')) {
        script = `tell application id "${bundleID}"
  if (count of windows) is 0 then return ""
  set windowTitle to name of front window
  return windowTitle
end tell`;
      } else {
        return null;
      }

      console.log(`[MacMonitor] Fetching URL for bundle: ${bundleID}`);
      const { stdout } = await execAsync(`osascript -e '${script}'`, { timeout: 3000 });
      const result = stdout.trim();
      console.log(`[MacMonitor] URL fetch result: "${result}"`);
      
      return result || null;
    } catch (error) {
      console.error('[MacMonitor] Failed to get browser URL:', error);
      return null;
    }
  }

  async closeBrowserTab(bundleID: string): Promise<boolean> {
    if (!bundleID) return false;

    try {
      let script: string;

      if (bundleID.includes('chrome') || bundleID.includes('brave') || bundleID.includes('edge')) {
        script = `tell application id "${bundleID}" to close active tab of front window`;
      } else if (bundleID.includes('safari')) {
        script = `tell application id "${bundleID}" to close current tab of front window`;
      } else if (bundleID.includes('firefox')) {
        script = `tell application id "${bundleID}" to close front window`;
      } else {
        return false;
      }

      await execAsync(`osascript -e '${script}'`, { timeout: 3000 });
      return true;
    } catch (error) {
      console.error('Failed to close browser tab:', error);
      return false;
    }
  }

  async hideApplication(processName: string): Promise<boolean> {
    try {
      const script = `tell application "${processName}" to hide`;
      await execAsync(`osascript -e '${script}'`, { timeout: 3000 });
      return true;
    } catch (error) {
      console.error('Failed to hide application:', error);
      return false;
    }
  }

  private async getMainScreenHeight(): Promise<number> {
    const { stdout } = await execAsync('system_profiler SPDisplaysDataType | grep "Resolution" | head -1 | awk \'{print $2}\'', { timeout: 2000 });
    const match = stdout.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 1080;
  }
}