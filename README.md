# MinId3

A minimal, cross-platform ID3 tag editor for MP3 files, built with Electron.

## Features

- Edit common ID3 tags: Title, Artist, Album, Year, Track, Genre, Comment, Album Art
- Bulk-edit a set of MP3 files simultaneously — shows "(Multiple values)" when files differ, and applies your edits to all selected files at once
- Drag & drop: files, multiple files, or a folder onto the app window (or the app icon on macOS)
- Warns before discarding unapplied changes

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later (includes npm)

## Install dependencies

```bash
npm install
```

## Run in development

```bash
npm start
```

## Build distributables

Build for all platforms (requires the appropriate host OS or cross-compilation tooling — see note below):

```bash
npm run build
```

Or build for a single platform:

```bash
npm run build:mac    # macOS ARM .dmg
npm run build:linux  # Linux x86_64 + ARM64 .AppImage
npm run build:win    # Windows x86_64 .exe installer
```

Built files are placed in the `dist/` directory.

### Platform build notes

| Target | Recommended build host |
|--------|------------------------|
| macOS (ARM) | macOS (Apple Silicon or Intel with Rosetta) |
| Linux x86_64 | Linux x86_64, or macOS/Windows with Docker installed |
| Linux ARM64 | Linux ARM64, or with Docker on another host |
| Windows x86_64 | Windows, or macOS/Linux (Wine required for NSIS installer) |

`electron-builder` can cross-compile Linux targets using Docker automatically when Docker is running on a non-Linux host. For Windows builds on non-Windows hosts, install [Wine](https://www.winehq.org/).

### App icons

To use a custom app icon, add the following files to a `build/` directory before building:

- `build/icon.icns` — macOS
- `build/icon.ico` — Windows
- `build/icon.png` (512×512 px) — Linux

If no icon files are present, `electron-builder` uses a default Electron icon.

## Project structure

```
MinId3/
├── main.js          # Electron main process (window, IPC handlers, file I/O)
├── preload.js       # Context bridge — exposes safe APIs to the renderer
├── src/
│   ├── index.html   # App shell
│   ├── styles.css   # Styles
│   └── renderer.js  # UI logic (state, drag/drop, field rendering)
├── package.json
└── dist/            # Built distributables (generated)
```

## Supported ID3 tags

| Field | ID3 frame |
|-------|-----------|
| Title | TIT2 |
| Artist | TPE1 |
| Album | TALB |
| Year | TYER |
| Track | TRCK |
| Genre | TCON |
| Comment | COMM |
| Album Art | APIC (Front Cover) |
