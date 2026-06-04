import { exec } from 'child_process';
import { promisify } from 'util';
import { ActiveWindowInfo } from '../../types';

const execAsync = promisify(exec);

export class WindowsMonitor {
  async getActiveWindow(): Promise<ActiveWindowInfo | null> {
    try {
      const psScript = `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
public struct RECT {
  public int Left, Top, Right, Bottom;
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$rect = New-Object RECT
[Win32]::GetWindowRect($hwnd, [ref]$rect)
$processId = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($process) {
  "$($process.ProcessName)|$($process.MainWindowTitle)|$($rect.Left)|$($rect.Top)|$($rect.Right-$rect.Left)|$($rect.Bottom-$rect.Top)"
}
`;
      const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`, { timeout: 5000 });
      
      if (!stdout?.trim()) {
        return null;
      }

      const [processName, windowTitle, x, y, width, height] = stdout.trim().split('|');
      
      return {
        processName: processName || 'unknown',
        windowTitle: windowTitle || '',
        frame: {
          x: parseInt(x, 10) || 0,
          y: parseInt(y, 10) || 0,
          width: parseInt(width, 10) || 0,
          height: parseInt(height, 10) || 0
        }
      };
    } catch (error) {
      console.error('Failed to get active window on Windows:', error);
      return null;
    }
  }
}