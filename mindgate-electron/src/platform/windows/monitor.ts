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

  async getActiveBrowserURL(exeName: string): Promise<string | null> {
    if (!exeName) return null;

    try {
      const processName = exeName.toLowerCase().replace(/\.exe$/i, '');
      const script = `
$process = Get-Process -Name "${processName}" -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Sort-Object -Property StartTime -Descending |
  Select-Object -First 1
if (-not $process -or -not $process.MainWindowTitle) { return }
$title = $process.MainWindowTitle
if ($title -match '(https?://[^\\s]+)') {
  Write-Output $Matches[1]
  return
}
if ($title -match '(www\\.[^\\s]+)') {
  Write-Output ("https://" + $Matches[1])
  return
}
if ($title -match ' - (Google Chrome|Microsoft Edge|Brave|Firefox|Opera)$') {
  $site = $title -replace ' - (Google Chrome|Microsoft Edge|Brave|Firefox|Opera)$', ''
  if ($site -match '\\.') { Write-Output ("https://" + $site) }
}
`;
      const url = await runPowerShell(script, 3000);
      return url || null;
    } catch (error) {
      console.error('Failed to get browser URL:', error);
      return null;
    }
  }

}
