# BiliQueue Development Plan

Version: V1.0
Date: 2024-05-24

## 1. Project Setup
- Confirm manifest version (MV3) and required permissions.
- Define directory structure:
  - `src/background/`
  - `src/content/`
  - `src/ui/`
  - `src/shared/`
- Set up build/dev workflow if applicable (optional).

## 2. Data Model and Storage
- Define queue data model and TypeScript types (if using TS).
- Implement storage helpers in background:
  - `getQueue(tabId)`
  - `setQueue(tabId, queue)`
  - `updateQueue(tabId, updaterFn)`
  - `clearQueue(tabId)`
- Enforce rules:
  - No duplicates (move instead of duplicate).
  - Update `currentIndex` consistently.

## 3. Background Service Worker
- Initialize `chrome.runtime.onInstalled` to register context menu.
- Context menu handler:
  - Parse link URL and metadata if available.
  - Send message to content script or update storage directly.
- Tab lifecycle:
  - On tab removed, clear `queue_data_${tabId}`.

## 4. Messaging Layer
- Define message types:
  - `QUEUE_ADD`
  - `QUEUE_REMOVE`
  - `QUEUE_REORDER`
  - `QUEUE_SET_CURRENT`
  - `QUEUE_GET`
  - `QUEUE_SYNC`
- Implement background message router.
- Implement content script message handlers.

## 5. Content Script: Queue Panel UI
- Build panel DOM container and styles (glass/mica, dark mode).
- Render list items with:
  - Title
  - Cover thumbnail
  - Remove button
  - Current highlight
- Implement minimize/restore toggle.
- Implement list drag-and-drop:
  - Use HTML5 DnD or library-free solution.
  - Update storage on drop.

## 6. Content Script: Toast
- Create toast container.
- Show "Added to queue" for 1s on successful add.
- Ensure no blocking UI overlays.

## 7. Content Script: Hover Add Button
- Add MutationObserver for feed and listing containers.
- Detect video cards and anchors.
- Inject "+" button near "watch later" icon.
- On click:
  - Extract bvid, title, cover, url.
  - Send add message and show toast.

## 8. Content Script: URL Monitoring
- Hook `history.pushState` and `popstate`.
- Detect transitions to `/video/` pages.
- Extract `bvid` from URL.
- If queue exists and video not in queue:
  - Insert at `currentIndex + 1` (silent insert).

## 9. Content Script: Player Hook
- Find video element on video page.
- Attach `ended` event listener.
- On end:
  - If queue has next item, navigate to next URL and update `currentIndex`.
  - If queue empty, allow default behavior.
- Re-attach on URL change or DOM re-mount.

## 10. Multi-Part Video Handling
- Detect multi-part state if available (playlist elements or player info).
- If next queue item exists, override multi-part continuation.
- Otherwise allow Bilibili default next-part behavior.

## 11. Error Handling
- On video load failure:
  - Wait 3 seconds then advance to next queue item.
  - No blocking modal or error dialog.

## 12. UI State Rehydration
- On content script start:
  - Fetch queue from session storage.
  - If exists, render panel and set highlight.

## 13. Edge Cases
- Duplicate add: move to target position.
- Removing current item advances queue if possible.
- Queue empty hides panel and clears UI.
- Rapid navigation and DOM changes.

## 14. Testing Plan
- Add via hover button in feed.
- Add via context menu.
- Direct navigation silent insert.
- Drag reorder reflects playback order.
- Video end advances correctly.
- Multi-part with queue next overrides part continuation.
- Failed load auto-advances.
- Tab close cleans session queue.
- Dark mode styling check.

## 15. Release Checklist
- Permissions validated.
- No confirmation dialogs anywhere.
- All UI strings minimal and clear.
- Performance check on long feed scroll.
