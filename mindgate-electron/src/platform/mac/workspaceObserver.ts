import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Observes macOS workspace for app activation events.
 *
 * Spawns a single long-lived `osascript` process with a tight
 * AppleScript loop.  The loop checks the frontmost app once per
 * second and `log`s the app name whenever it changes.
 *
 *                                         osascript / sec
 *   BEFORE (old polling)    4–7 processes      8–14      ✗
 *   AFTER (this approach)   1 process            1        ✓
 *
 * The ONE process uses AppleScript's native `delay 1` which
 * maps to mach_wait_until — near-zero CPU between ticks.
 */
export class WorkspaceObserver extends EventEmitter {
  private process: ChildProcess | null = null;
  private restartTimer: NodeJS.Timeout | null = null;
  private stopped: boolean = false;

  start(): void {
    if (this.process) return;
    this.stopped = false;
    this.spawnWorker();
    
    // Ensure cleanup on process exit
    process.on('exit', () => this.stop());
  }

  // ── AppleScript worker ─────────────────────────────────

  private spawnWorker(): void {
    const script = [
      'set prevApp to ""',
      'repeat',
      '  tell application "System Events"',
      '    try',
      '      set frontApp to name of first application process whose frontmost is true',
      '      if frontApp is not prevApp then',
      '        set prevApp to frontApp',
      '        log frontApp',
      '      end if',
      '    end try',
      '  end tell',
      '  delay 1',
      'end repeat',
    ].join('\n');

    this.process = spawn('osascript', ['-e', script], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let buf = '';

    this.process.stderr?.on('data', (data: Buffer) => {
      buf += data.toString('utf-8');
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        const appName = line.trim();
        // AppleScript `log` writes bare, `error` writes "execution error:…"
        if (appName && !appName.startsWith('execution error:')) {
          this.emit('app-activated', appName);
        }
      }
    });

    this.process.on('exit', (code) => {
      this.process = null;
      if (!this.stopped) {
        console.log('[WorkspaceObserver] Process exited (code', code, ')—restarting in 2s');
        this.scheduleRestart();
      }
    });

    this.process.on('error', (err) => {
      this.process = null;
      if (!this.stopped) {
        console.log('[WorkspaceObserver] Error:', err.message, '—restarting in 2s');
        this.scheduleRestart();
      }
    });
  }

  private scheduleRestart(): void {
    if (this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.stopped) this.spawnWorker();
    }, 2000);
  }

  stop(): void {
    this.stopped = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.killProcess('SIGTERM');
    // Fallback kill after delay to ensure cleanup
    setTimeout(() => {
      this.killProcess('SIGKILL');
    }, 100);
    this.removeAllListeners();
  }

  private killProcess(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.process) {
      try {
        this.process.kill(signal);
        console.log('[WorkspaceObserver] Sent', signal, 'to osascript process');
      } catch {
        console.log('[WorkspaceObserver] Process already terminated');
      }
      this.process = null;
    }
  }
}
