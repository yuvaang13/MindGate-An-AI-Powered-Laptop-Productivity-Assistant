import { exec } from 'child_process';
import { promisify } from 'util';
import { ActiveWindowInfo } from '../../types';

const execAsync = promisify(exec);

export class MacMonitor {
  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
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
`;
      const { stdout } = await execAsync(`osascript -e '${script}'`, { timeout: 5000 });
      
      const lines = stdout.trim().split('\n');
      const processName = lines[0] || 'unknown';
      const windowTitle = lines[1] || '';

      return {
        processName,
        windowTitle,
        frame: { x: 0, y: 0, width: 0, height: 0 }
      };
    } catch (error) {
      console.error('Failed to get active window on macOS:', error);
      return null;
    }
  }
}