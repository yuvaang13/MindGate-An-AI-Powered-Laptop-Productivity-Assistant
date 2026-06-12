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
  // Use PNG for tray icon - SVG may not work reliably on all platforms
  if (process.platform === 'darwin') {
    return join(getAppRoot(), 'assets', 'tray-icon-mac.png');
  }
  return join(getAppRoot(), 'assets', 'tray-icon.svg');
}

/** Resolve __dirname equivalent for ESM modules in the main process. */
export function getModuleDir(metaUrl: string): string {
  return dirname(fileURLToPath(metaUrl));
}
