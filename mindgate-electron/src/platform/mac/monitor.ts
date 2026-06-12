import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { ActiveWindowInfo } from '../../types.js';

const execAsync = promisify(exec);

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function runAppleScript(script: string, timeout = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('AppleScript timed out'));
    }, timeout);

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `AppleScript exited with code ${code}`));
      }
    });
  });
}

export class MacMonitor {
  private hasPermission: boolean = true;
  private cachedScreenHeight: number | null = null;

  setPermissionsGranted(): void {
    this.hasPermission = true;
  }

  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    if (!this.hasPermission) {
      return null;
    }

    let processName = 'unknown';
    try {
      const appScript = `tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
  return frontApp
end tell`;
      processName = (await runAppleScript(appScript)) || 'unknown';
    } catch {
      console.error('[MacMonitor] Failed to get frontmost app name');
      return null;
    }

    let windowTitle = '';
    try {
      const safeApp = escapeAppleScriptString(processName);
      const titleScript = `tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
end tell
try
  tell application "${safeApp}"
    if (count of windows) > 0 then
      set windowTitle to name of front window
      return windowTitle
    end if
  end tell
end try
return ""`;
      windowTitle = (await runAppleScript(titleScript)) || '';
    } catch {
      try {
        const axScript = `tell application "System Events"
  set frontApp to first application process whose frontmost is true
  try
    set frontWindow to value of attribute "AXTitle" of front window of frontApp
    return frontWindow
  on error
    return ""
  end try
end tell`;
        windowTitle = (await runAppleScript(axScript)) || '';
      } catch {
        // Title is optional
      }
    }

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
      bundleID = (await runAppleScript(bundleScript)) || '';
    } catch {
      // Bundle ID is optional
    }

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
      const frameResult = await runAppleScript(frameScript);
      const frameParts = frameResult.split(',').map((p) => parseFloat(p.trim()));
      if (frameParts.length >= 4) {
        const mainScreenHeight = await this.getMainScreenHeight();
        frame = {
          x: frameParts[0] || 0,
          y: mainScreenHeight - (frameParts[1] || 0) - (frameParts[3] || 0),
          width: frameParts[2] || 0,
          height: frameParts[3] || 0,
        };
      }
    } catch {
      // Frame is optional
    }

    let browserURL: string | undefined;
    if (bundleID) {
      browserURL = (await this.getActiveBrowserURL(bundleID)) ?? undefined;
    }
    if (!browserURL && processName !== 'unknown') {
      browserURL = (await this.getActiveBrowserURL(processName)) ?? undefined;
    }

    return {
      processName,
      windowTitle,
      bundleID,
      browserURL,
      frame,
    };
  }

  async getActiveBrowserURL(_identifier: string): Promise<string | null> {
    try {
      const script = `tell application "System Events"
  set frontApp to first application process whose frontmost is true
  try
    set docURL to value of attribute "AXDocument" of window 1 of frontApp
    return docURL
  on error
    return ""
  end try
end tell`;
      const result = await runAppleScript(script, 3000);
      return result || null;
    } catch (error) {
      console.error('[MacMonitor] Failed to get browser URL:', error);
      return null;
    }
  }

  async closeBrowserTab(): Promise<boolean> {
    try {
      await runAppleScript('tell application "System Events" to keystroke "w" using command down', 2000);
      return true;
    } catch (error) {
      console.error('[MacMonitor] Failed to close browser tab:', error);
      return false;
    }
  }

  async hideApplication(): Promise<boolean> {
    try {
      const script = `tell application "System Events"
  try
    set visible of (first application process whose frontmost is true) to false
  end try
end tell`;
      await runAppleScript(script, 2000);
      return true;
    } catch (error) {
      console.error('[MacMonitor] Failed to hide application:', error);
      return false;
    }
  }

  private async getMainScreenHeight(): Promise<number> {
    if (this.cachedScreenHeight !== null) {
      return this.cachedScreenHeight;
    }

    try {
      const { stdout } = await execAsync(
        'system_profiler SPDisplaysDataType | grep "Resolution" | head -1 | awk \'{print $2}\'',
        { timeout: 2000 }
      );
      const match = stdout.match(/(\d+)/);
      this.cachedScreenHeight = match ? parseInt(match[1], 10) : 1080;
    } catch {
      this.cachedScreenHeight = 1080;
    }

    return this.cachedScreenHeight;
  }
}
