# BiliQueue Release Checklist

Version: V1.0
Date: 2024-05-24

## 1. Permissions & Manifest
- `storage`, `contextMenus`, `tabs`, `scripting` declared.
- `host_permissions` limited to `https://*.bilibili.com/*`.
- MV3 service worker loads without errors.

## 2. Core Behaviors
- Zero confirmation dialogs anywhere.
- Queue creation on first add.
- Queue isolated per tab via `chrome.storage.session`.
- Silent insert on direct navigation when queue exists.
- Playback advances on end.

## 3. UX Verification
- Hover add button appears near cover.
- Toast appears 1s on add.
- Panel shows current item and supports drag reorder.
- Minimize to dot with remaining count.

## 4. Edge Handling
- Duplicate add moves item instead of duplicating.
- Removing current item advances to next.
- Load failure auto-advances after 3 seconds.
- Multi-part override when queue has next item.

## 5. Performance & Stability
- No heavy DOM polling.
- MutationObserver does not degrade scroll performance.
- No memory leaks from duplicate listeners.

## 6. Packaging
- Clean build output only.
- ZIP contains manifest, scripts, and assets.
- No source maps or dev files if not intended.

## 7. Manual Sanity Pass
- Full smoke run of `docs/testing.md`.
- Check console for errors on Bilibili home and video pages.
