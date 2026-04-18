# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
npm start            # run in development (launches Electron)
npm run build        # build for all platforms
npm run build:mac    # macOS ARM .dmg → dist/
npm run build:linux  # Linux x86_64 + ARM64 .AppImage → dist/
npm run build:win    # Windows x86_64 NSIS installer → dist/
```

There are no tests or linter configured in this project.

## Architecture

This is a minimal Electron app with three layers:

**Main process** ([main.js](main.js)) — Node.js/Electron host. Owns all file I/O and ID3 operations via `node-id3`. Exposes functionality to the renderer exclusively through named `ipcMain.handle` channels: `open-files-dialog`, `open-art-dialog`, `resolve-paths`, `read-tags`, `write-tags`. Also handles macOS `open-file` events and the Windows/Linux single-instance lock, both of which push resolved paths to the renderer via `webContents.send('files-opened', paths)`.

**Preload** ([preload.js](preload.js)) — thin context bridge. Wraps every IPC call into `window.minid3.*` methods so the renderer has no direct access to Node APIs. `contextIsolation: true`, `nodeIntegration: false`.

**Renderer** ([src/renderer.js](src/renderer.js)) — vanilla JS, no framework. All UI state lives in a single `state` object:
- `state.files` — array of `{ filePath, baseName, tags, checked }` for every open file
- `state.dirtyFields` — `Set` of `data-field` keys the user has typed into since the last apply/reset
- `state.artDirty`, `state.newArtFilePath`, `state.newArtDataUrl` — separate dirty tracking for album art (art is passed as a file path to the main process for reading, not as a data URL)

Key renderer flows:
- **Loading files**: `addFiles(paths)` → `resolvePaths` (expands folders) → `readTags` → push into `state.files` → re-render list and fields.
- **Dirty tracking**: `state.updating` flag suppresses input listeners during programmatic field population (`updateTagFields`). Only fields in `state.dirtyFields` are included in the `write-tags` payload.
- **Apply**: sends only the dirty fields + optional `artFilePath` to `write-tags`, then re-reads tags from disk to refresh in-memory state.
- **Multi-file display**: `updateTagFields` compares values across all checked files; shows the common value or sets `placeholder="(Multiple values)"` with an empty `value`.

Album art is stored in-memory as a base64 data URL (for display) but the *file path* is what gets passed to the main process for writing, so the main process reads the raw bytes itself.

## IPC contract

| Channel | Direction | Args | Returns |
|---|---|---|---|
| `open-files-dialog` | renderer→main | — | `string[]` file paths |
| `open-art-dialog` | renderer→main | — | `{ filePath, dataUrl }` or `null` |
| `resolve-paths` | renderer→main | `string[]` paths | `string[]` resolved .mp3 paths (folders expanded) |
| `read-tags` | renderer→main | `string[]` filePaths | `TagResult[]` |
| `write-tags` | renderer→main | `string[]` filePaths, `updates` object | `{ success, errors[] }` |
| `files-opened` | main→renderer | `string[]` paths | — (event) |

## Build assets

Custom app icons go in `build/` (`icon.icns`, `icon.ico`, `icon.png` 512×512). The `assets/` directory holds the source icon referenced in `package.json` build config. Built output lands in `dist/`.
