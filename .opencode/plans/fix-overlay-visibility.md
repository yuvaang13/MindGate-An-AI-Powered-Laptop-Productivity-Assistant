# Fix Overlay Visibility Plan

## Problem
Overlay shows in logs (`[WindowManager] Overlay shown, visible: true`) but is invisible on screen. Likely a `transparent: true` rendering bug on Electron 42/macOS.

## Changes Needed

### 1. Remove `transparent: true`, add `backgroundColor: '#ffffff'`
Three locations (both `.ts` and compiled `.js`):
- `main.ts:111` / `main.js:93` — in `createWindows()` BrowserWindow
- `windowManager.ts:41` / `windowManager.js:32` — in `createOverlayWindow()` BrowserWindow

Replace `transparent: true` with:
```ts
transparent: false,
backgroundColor: '#ffffff',
```

### 2. Clamp overlay position to screen bounds
File: `windowManager.ts` / `windowManager.js` — inside `showOverlay()`
After computing target x/y but before `setPosition()`, add:
```ts
const primaryDisplay = screen.getPrimaryDisplay();
const viewBounds = primaryDisplay.bounds;
x = Math.max(viewBounds.x, Math.min(x, viewBounds.x + viewBounds.width - width));
y = Math.max(viewBounds.y, Math.min(y, viewBounds.y + viewBounds.height - height));
```

### 3. Add `moveTop()` after `focus()`
File: `windowManager.ts:84` / `windowManager.js:66`
```ts
this.overlayWindow?.moveTop();
```

### 4. Add persistent visible element to body
File: `src/index.css`
```css
body::before {
  content: 'MindGate';
  display: block;
  color: #ff0000;
  font-size: 20px;
  font-weight: bold;
  text-align: center;
  padding: 10px;
}
```

### 5. Update CSS to opaque background
File: `src/styles/glassmorphism.css`
```css
.glass-panel {
  background: #ffffff;
  border: 1.5px solid rgba(60, 60, 67, 0.25);
  ...
}
```

### 6. Build, Commit, Push
```sh
npm run build
git add -A
git commit -m "Fix overlay visibility: opaque window, position clamp, moveTop"
git push
```
