import { spawn } from 'child_process';
import { ActiveWindowInfo } from '../../types.js';

function runPowerShell(script: string, timeout = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const child = spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('PowerShell timed out'));
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
        reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
      }
    });
  });
}

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
      const stdout = await runPowerShell(psScript);
      if (!stdout) return null;

      const parts = stdout.trim().split('|');
      const [processName, windowTitle, x, y, width, height, exeName] = parts;

      const info: ActiveWindowInfo = {
        processName: processName || 'unknown',
        windowTitle: windowTitle || '',
        exeName: exeName || '',
        frame: {
          x: parseInt(x, 10) || 0,
          y: parseInt(y, 10) || 0,
          width: parseInt(width, 10) || 0,
          height: parseInt(height, 10) || 0,
        },
      };

      const browserURL = await this.getActiveBrowserURL(info.exeName || info.processName);
      if (browserURL) {
        info.browserURL = browserURL;
      }

      return info;
    } catch (error) {
      console.error('Failed to get active window on Windows:', error);
      return null;
    }
  }

  async getActiveBrowserURL(_identifier: string): Promise<string | null> {
    try {
      const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^{F3}")
`;
      await runPowerShell(script, 3000);
      return null;
    } catch (error) {
      console.error('Failed to get browser URL:', error);
      return null;
    }
  }

  async closeBrowserTab(): Promise<boolean> {
    try {
      await runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^w")
`, 3000);
      return true;
    } catch (error) {
      console.error('Failed to close browser tab:', error);
      return false;
    }
  }

  async hideApplication(): Promise<boolean> {
    try {
      await runPowerShell(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
[Win32]::ShowWindow($hwnd, 6) | Out-Null
`, 3000);
      return true;
    } catch (error) {
      console.error('Failed to hide application:', error);
      return false;
    }
  }
}