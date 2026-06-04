import { exec } from 'child_process';
import { promisify } from 'util';
import { ActiveWindowInfo } from '../../types';

const execAsync = promisify(exec);

export class LinuxMonitor {
  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    try {
      const { stdout } = await execAsync('xdotool getwindowfocus getwindowname 2>/dev/null || echo ""', { timeout: 5000 });

      return {
        processName: 'unknown',
        windowTitle: stdout.trim() || '',
        frame: { x: 0, y: 0, width: 0, height: 0 }
      };
    } catch (error) {
      console.error('Failed to get active window on Linux:', error);
      return null;
    }
  }
}