import { app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/** Project root (mindgate-electron/) in dev and packaged builds. */
export function getAppRoot(): string {
  return app.getAppPath();
}

export function getPreloadPath(): string {
  return join(getAppRoot(), 'dist-electron', 'preload.js');
}

export function getRendererIndexPath(): string {
  return join(getAppRoot(), 'dist', 'index.html');
}

export function getTrayIconPath(): string {
  return join(getAppRoot(), 'assets', process.platform === 'darwin' ? 'tray-icon-mac-22.png' : 'tray-icon-mac.png');
}

/** Resolve __dirname equivalent for ESM modules in the main process. */
export function getModuleDir(metaUrl: string): string {
  return dirname(fileURLToPath(metaUrl));
}
