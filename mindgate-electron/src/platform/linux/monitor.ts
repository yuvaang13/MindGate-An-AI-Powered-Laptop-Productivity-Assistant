import { exec } from 'child_process';
import { promisify } from 'util';
import { ActiveWindowInfo } from '../../types.js';

const execAsync = promisify(exec);

export class LinuxMonitor {
  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    try {
      const { stdout } = await execAsync('xdotool getwindowfocus getwindowname 2>/dev/null || echo ""', {
        timeout: 5000,
      });

      const windowTitle = stdout.trim() || '';
      const processName = await this.getWindowProcess();
      const geometry = await this.getWindowGeometry();

      const info: ActiveWindowInfo = {
        processName,
        windowTitle,
        frame: geometry,
      };

      const browserURL = await this.getActiveBrowserURL(processName);
      if (browserURL) {
        info.browserURL = browserURL;
      }

      return info;
    } catch (error) {
      console.error('Failed to get active window on Linux:', error);
      return null;
    }
  }

  async closeBrowserTab(): Promise<boolean> {
    try {
      await execAsync('xdotool key ctrl+w', { timeout: 2000 });
      return true;
    } catch (error) {
      console.error('Failed to close browser tab on Linux:', error);
      return false;
    }
  }

  async hideApplication(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('xdotool getwindowfocus getactivewindow', { timeout: 2000 });
      const winId = stdout.trim();
      if (winId) {
        await execAsync(`xdotool windowminimize ${winId}`, { timeout: 2000 });
      }
      return true;
    } catch (error) {
      console.error('Failed to hide application on Linux:', error);
      return false;
    }
  }

  private async getWindowProcess(): Promise<string> {
    try {
      const { stdout } = await execAsync('xdotool getwindowfocus getwindowpid 2>/dev/null', { timeout: 2000 });
      const pid = stdout.trim();
      if (pid) {
        const { stdout: procName } = await execAsync(`ps -p ${pid} -o comm= 2>/dev/null || echo ""`, {
          timeout: 2000,
        });
        return procName.trim() || 'unknown';
      }
    } catch (e) {
      console.error('Failed to get window process:', e);
    }
    return 'unknown';
  }

  private async getWindowGeometry(): Promise<{ x: number; y: number; width: number; height: number }> {
    try {
      const { stdout } = await execAsync('xdotool getwindowfocus getwindowgeometry --shell 2>/dev/null', {
        timeout: 2000,
      });
      const geometry = { x: 0, y: 0, width: 0, height: 0 };

      for (const line of stdout.split('\n')) {
        if (line.startsWith('X=')) geometry.x = parseInt(line.split('=')[1], 10);
        if (line.startsWith('Y=')) geometry.y = parseInt(line.split('=')[1], 10);
        if (line.startsWith('WIDTH=')) geometry.width = parseInt(line.split('=')[1], 10);
        if (line.startsWith('HEIGHT=')) geometry.height = parseInt(line.split('=')[1], 10);
      }

      return geometry;
    } catch (e) {
      console.error('Failed to get window geometry:', e);
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  async getActiveBrowserURL(_identifier: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('xdotool getwindowfocus getwindowname 2>/dev/null', { timeout: 2000 });
      const title = stdout.trim();
      const urlMatch = title.match(/(https?:\/\/[^\s]+)/i) || title.match(/(www\.[^\s]+)/i);
      if (!urlMatch) return null;
      return urlMatch[1].startsWith('http') ? urlMatch[1] : `https://${urlMatch[1]}`;
    } catch {
      return null;
    }
  }

}
