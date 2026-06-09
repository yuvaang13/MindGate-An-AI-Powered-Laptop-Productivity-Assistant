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
      console.log('[MacMonitor] No permission — returning null');
      return null;
    }

    // Each piece is fetched independently so a failure in one doesn't
    // break the whole detection.

    // ── 1. Frontmost app name ──
    let processName = 'unknown';
    try {
      const appScript = `tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
  return frontApp
end tell`;
      const { stdout } = await execAsync(`osascript -e '${appScript}'`, { timeout: 5000 });
      processName = stdout.trim() || 'unknown';
    } catch {
      // App name is essential — if this fails, we can't detect anything
      console.error('[MacMonitor] Failed to get frontmost app name');
      return null;
    }

    // ── 2. Window title (via Accessibility API — AXTitle) ──
    let windowTitle = '';
    try {
      const titleScript = `tell application "System Events"
  set frontApp to first application process whose frontmost is true
  try
    set frontWindow to value of attribute "AXTitle" of front window of frontApp
    return frontWindow
  on error
    return ""
  end try
end tell`;
      const { stdout } = await execAsync(`osascript -e '${titleScript}'`, { timeout: 5000 });
      windowTitle = stdout.trim() || '';
    } catch {
      // Title is optional
    }

    // ── 3. Bundle ID ──
    let bundleID = '';
    try {
      const bundleScript = `tell application "System Events"
  try
    set frontAppPath to path to frontmost application as text
    set appInfo to info for frontAppPath
    return bundle identifier of appInfo
  on error
    return ""
  end try
end tell`;
      const { stdout } = await execAsync(`osascript -e '${bundleScript}'`, { timeout: 5000 });
      bundleID = stdout.trim() || '';
    } catch {
      // Bundle ID is optional
    }

    // ── 4. Window frame (optional) ──
    let frame = { x: 0, y: 0, width: 0, height: 0 };
    try {
      const frameScript = `tell application "System Events"
  set frontApp to first application process whose frontmost is true
  try
    set frontWindow to value of attribute "AXFrame" of front window of frontApp
    return frontWindow
  on error
    return "0,0,0,0"
  end try
end tell`;
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
      // Frame is optional
    }

    // ── 5. Browser URL ──
    const browserURL = bundleID ? (await this.getActiveBrowserURL(bundleID)) ?? undefined : undefined;

    console.log(`[MacMonitor] Window: "${processName}" | Title: "${windowTitle}" | BundleID: "${bundleID}" | URL: "${browserURL || ''}"`);

    return {
      processName,
      windowTitle,
      bundleID,
      browserURL,
      frame
    };
  }

  async getActiveBrowserURL(bundleID: string): Promise<string | null> {
    if (!bundleID) return null;

    try {
      const bid = bundleID.toLowerCase();
      let script: string;

      if (bid.includes('safari')) {
        script = `tell application id "${bundleID}"
  try
    if (count of windows) is 0 then return ""
    set tabURL to URL of current tab of front window
    return tabURL
  on error errMsg
    log "Safari URL error: " & errMsg
    return ""
  end try
end tell`;
      } else if (bid.includes('chrome') || bid.includes('brave') || bid.includes('edge')) {
        script = `tell application id "${bundleID}"
  try
    if (count of windows) is 0 then return ""
    set frontTab to active tab of front window
    return URL of frontTab
  on error errMsg
    log "Chrome URL error: " & errMsg
    return ""
  end try
end tell`;
      } else if (bid.includes('firefox')) {
        script = `tell application id "${bundleID}"
  try
    if (count of windows) is 0 then return ""
    set windowTitle to name of front window
    return windowTitle
  on error errMsg
    log "Firefox URL error: " & errMsg
    return ""
  end try
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
      const bid = bundleID.toLowerCase();
      let script: string;

      if (bid.includes('chrome') || bid.includes('brave') || bid.includes('edge')) {
        script = `tell application id "${bundleID}" to close active tab of front window`;
      } else if (bid.includes('safari')) {
        script = `tell application id "${bundleID}" to close current tab of front window`;
      } else if (bid.includes('firefox')) {
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
