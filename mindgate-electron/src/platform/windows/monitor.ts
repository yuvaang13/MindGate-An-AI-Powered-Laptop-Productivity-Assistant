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
using System.Text;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
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
$sb = New-Object Text.StringBuilder(256)
[Win32]::GetWindowText($hwnd, $sb, 256)
if ($process) {
  "$($process.ProcessName)|$($sb.ToString())|$($rect.Left)|$($rect.Top)|$($rect.Right-$rect.Left)|$($rect.Bottom-$rect.Top)|$($process.MainModule.ModuleName)"
}
`;
      const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`, { timeout: 5000 });

      if (!stdout?.trim()) {
        return null;
      }

      const parts = stdout.trim().split('|');
      const [processName, windowTitle, x, y, width, height, exeName] = parts;

      return {
        processName: processName || 'unknown',
        windowTitle: windowTitle || '',
        exeName: exeName || '',
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

  async getActiveBrowserURL(exeName: string): Promise<string | null> {
    if (!exeName) return null;

    try {
      const normalizedExe = exeName.toLowerCase();
      const processName = normalizedExe.replace('.exe', '').replace('.EXE', '');

      const script = `
$processes = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
if ($processes) {
  $activeProc = $processes | Sort-Object -Property StartTime -Descending | Select-Object -First 1
  if ($activeProc -and $activeProc.MainWindowTitle) {
    $title = $activeProc.MainWindowTitle
    if ($title -match "^(https?://)") {
      Write-Output $title
    } else {
      $urlMatch = $title -match "^[^-]+?(https?://)?(.*)"
      if ($urlMatch) {
        Write-Output $Matches[2]
      } else {
        Write-Output $title
      }
    }
  }
}
`;

      const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 3000 });
      const url = stdout.trim();
      return url || null;
    } catch (error) {
      console.error('Failed to get browser URL:', error);
      return null;
    }
  }

  async closeBrowserTab(exeName: string): Promise<boolean> {
    if (!exeName) return false;

    try {
      const processName = exeName.toLowerCase().replace('.exe', '').replace('.EXE', '');
      const script = `
$processes = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($processes) {
  $processes.CloseMainWindow() | Out-Null
}
`;
      await execAsync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 3000 });
      return true;
    } catch (error) {
      console.error('Failed to close browser tab:', error);
      return false;
    }
  }

  async hideApplication(processName: string): Promise<boolean> {
    try {
      const script = `
$process = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($process) {
  $process.CloseMainWindow() | Out-Null
}
`;
      await execAsync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 3000 });
      return true;
    } catch (error) {
      console.error('Failed to hide application:', error);
      return false;
    }
  }
}