import { spawn } from 'node:child_process';
import process from 'node:process';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (env.npm_lifecycle_event === 'dev:electron') {
  env.VITE_DEV_SERVER_URL = env.VITE_DEV_SERVER_URL ?? 'http://localhost:3000';
}

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const detached = process.platform !== 'win32';
const child = spawn(executable, ['electron', '.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
  detached,
});

let isTerminating = false;
let forceKillTimer = null;

function exitCodeForSignal(signal) {
  if (signal === 'SIGINT') return 130;
  if (signal === 'SIGTERM') return 143;
  return 1;
}

function signalProcessGroup(signal) {
  if (!child.pid) return false;

  try {
    if (detached) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
    return true;
  } catch {
    try {
      child.kill(signal);
      return true;
    } catch {
      return false;
    }
  }
}

function terminateChild(signal) {
  if (isTerminating || child.killed) return;
  isTerminating = true;

  console.error(`[run-electron] Received ${signal}, quitting Electron...`);

  forceKillTimer = setTimeout(() => {
    try {
      if (detached && child.pid) {
        process.kill(-child.pid, 'SIGKILL');
      } else {
        child.kill('SIGKILL');
      }
    } catch {
      return;
    }
  }, 5000);
  forceKillTimer.unref?.();

  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    killer.on('error', () => {
      try {
        child.kill(signal);
      } catch {
        return;
      }
    });
    return;
  }

  signalProcessGroup(signal);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(signal, () => terminateChild(signal));
}

process.on('exit', () => {
  if (!isTerminating && child.pid && !child.killed) {
    signalProcessGroup('SIGTERM');
  }
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (forceKillTimer) {
    clearTimeout(forceKillTimer);
  }
  if (signal) {
    process.exit(exitCodeForSignal(signal));
    return;
  }
  process.exit(code ?? 0);
});
