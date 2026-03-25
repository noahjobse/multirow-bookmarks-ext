# Multi-Row Bookmarks Bar

A Chrome/Brave extension that replaces the native bookmarks bar with a responsive, multi-row version. No more hidden bookmarks behind a chevron.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Multi-row layout** — bookmarks wrap naturally based on window width
- **Drag to reorder** — drag bookmarks to rearrange, changes persist
- **Theme-aware** — auto switches between dark and light mode with your OS
- **Custom new tab** — clean new tab page with clock, search bar, and quick links
- **Nested folders** — folder dropdowns with proper nested subfolder support
- **Settings** — alignment, text size, icon size, bold text, folders on separate row

## Install

1. Download or clone this repo
2. Go to `chrome://extensions` (or `brave://extensions`)
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select this folder
5. Hide the native bookmarks bar with `Ctrl+Shift+B`

## Settings

Right-click the extension icon → **Options**, or go to the extension's details page and click **Extension options**.

| Setting | Options |
|---------|---------|
| Alignment | Left, Center, Right, Spread |
| Text size | 8–24px slider |
| Icon size | 10–36px slider |
| Bold text | On/Off |
| Folders on separate row | On/Off |

Colors automatically follow your system dark/light theme.

## Browser Support

- **Brave** (primary, tested)
- **Chrome**
- **Edge**
- Any Chromium-based browser

> **Note:** Brave uses "Bookmarks" as the bookmarks bar folder name instead of Chrome's "Bookmarks bar" — this extension handles both.

## How It Works

- **Content script** (`bookmarks-bar.js`) injects the bar on all `http/https` pages
- **Background service worker** (`background.js`) provides bookmarks data via messaging
- **New tab page** (`newtab.html`) has direct API access as an extension page
- Favicons are fetched via Chrome's `_favicon` API for consistent, high-quality icons

## License

MIT
