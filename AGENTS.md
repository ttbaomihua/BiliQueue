# Repository Guidelines

## Project Structure & Module Organization
- `manifest.json` defines the MV3 extension entrypoints and permissions.
- `src/background/` holds the service worker entry (`index.js`) and storage/messaging logic.
- `src/content/` is the content script entry (`index.js`) that injects UI and hooks playback.
- `src/ui/` owns the queue panel rendering logic (`panel.js`).
- `src/shared/` contains shared helpers (`storage.js`).
- `docs/` stores design, testing, PRD, and release checklist references.

## Build, Test, and Development Commands
No build system is configured. Load the extension directly:
- Chrome: `chrome://extensions` -> enable Developer mode -> “Load unpacked” -> select repo root.
Packaging: zip `manifest.json` and `src/` (omit dev-only files) when preparing a release.

## Coding Style & Naming Conventions
- Language: vanilla JavaScript (ES2020+).
- Indentation: 2 spaces; use semicolons.
- Naming: `camelCase` for functions/vars, `UPPER_SNAKE_CASE` for constants (e.g., message types).
- Keep DOM selectors resilient; prefer small helpers in `src/shared/` when reused.

## Testing Guidelines
Automated tests are not set up. Use the manual checklist in `docs/testing.md`.
Naming: new test notes or checklists should follow the existing “BiliQueue … Checklist” format.
When touching playback or queue logic, re-run the full checklist before release.

## Commit & Pull Request Guidelines
- Commit style in history follows `feat:<number>.<short description>` (e.g., `feat:7.hover + button`).
- Keep commits focused; avoid mixing UI and background logic in a single change if possible.
- PRs should include:
  - A short problem/solution summary.
  - Screenshots or short clips for UI changes (panel, toast, hover button).
  - Manual test results referencing `docs/testing.md`.

## Security & Configuration Notes
- Keep `host_permissions` scoped to `https://*.bilibili.com/*`.
- Queue data is per-tab and stored in `chrome.storage.session`; do not persist across tabs.
