# BiliQueue Design Document

Version: V1.0
Date: 2024-05-24

## 1. Overview
BiliQueue is a single-tab, zero-friction queue system for Bilibili. It injects minimal UI to collect videos into a per-tab session queue and takes over post-play navigation to ensure continuous queue playback without confirmation dialogs.

Goals:
- Create a per-tab queue with zero persistence and automatic cleanup.
- Add videos silently via hover button, context menu, or implicit insert on direct navigation.
- Seamless playback takeover on video end while respecting multi-part videos.
- Minimalist UI consistent with Bilibili design language.

Non-goals:
- Cross-tab or cross-window sharing.
- Sync across devices.
- Long-term storage or history.

## 2. Architecture

### 2.1 Components
- Background service worker
  - Manages per-tab session queue in `chrome.storage.session`.
  - Handles context menu action and tab lifecycle.
  - Mediates messages between content script and storage.
- Content script
  - Injects hover "+" buttons on video cards.
  - Creates and manages the queue panel UI.
  - Observes URL changes and triggers silent insert.
  - Hooks video playback events and controls navigation.
- Optional injected page script (if needed for player APIs)
  - Wraps player APIs if direct access is required.

### 2.2 Data Storage
- `chrome.storage.session` key pattern: `queue_data_${tabId}`.
- Session data is isolated per tab and cleared when the tab closes.

Data model:
```json
{
  "version": 1,
  "tabId": 123,
  "items": [
    {
      "bvid": "BV1xx411c7mD",
      "cid": "12345678",
      "title": "Video Title",
      "url": "https://www.bilibili.com/video/BV1...",
      "cover": "https://i0.hdslb.com/...jpg",
      "duration": 1234
    }
  ],
  "currentIndex": 0,
  "updatedAt": 1710000000000
}
```

Rules:
- No duplicates. If adding an existing item, move it to target position.
- `currentIndex` always points to the currently playing item if it exists.

## 3. UI/UX Design

### 3.1 Queue Panel
- Default hidden. Appears when first item is added.
- Location: bottom-right.
- Style: Bilibili-like glass/mica effect, dark mode compatible.
- Features:
  - List of queued items.
  - Current item highlighted and centered.
  - Drag-and-drop reordering.
  - Remove button per item (no confirmation).
  - Minimize button to a small dot with remaining count.

### 3.2 Toast
- Single micro toast: "Added to queue".
- Position: top-center.
- Duration: 1s.
- Appears only on successful add.

### 3.3 Hover Add Button
- Appears near native "Watch later" icon on video cards.
- Shows only on hover to avoid clutter.
- Clicking adds to queue silently and shows toast.

### 3.4 Context Menu
- Right-click on video link or card.
- "Add to queue" action adds item to queue silently.

## 4. Playback and Routing Logic

### 4.1 Silent Insert on Direct Navigation
Condition: Queue exists in this tab and user navigates to a video page not in the queue.
Action:
- Insert the new video at `currentIndex + 1`.
- Do not disrupt the current queue order.
- When this video finishes, continue with original queue sequence.

### 4.2 Video End Handling
- On `ended` event:
  - If queue has a next item, navigate to its URL and update `currentIndex`.
  - If no next item, allow Bilibili default behavior.

### 4.3 Multi-Part Videos
- When on a multi-part video (P1, P2, ...):
  - Default behavior: allow Bilibili to continue to next part.
  - Exception: If queue has a next item, jump to that item instead of next part.

### 4.4 Error Handling
- If video fails to load:
  - After 3 seconds, advance to the next queue item.
  - No modal or blocking errors.

## 5. DOM Integration Strategy

### 5.1 Injection Targets
- Use MutationObserver on main feed containers.
- Identify video cards via known Bilibili classes and anchor tags.
- Attach hover button inside card container near watch-later icon.

### 5.2 URL Change Detection
- Monitor `history.pushState`, `popstate`, and `location.href` changes.
- Debounce and detect transitions to `/video/` pages.
- On new video page, read `bvid` from URL and apply silent insert logic.

### 5.3 Player Hook
- Use DOM query to find video element.
- Attach `ended` event handler.
- Re-attach on URL changes or player re-mounts.

## 6. Queue Operations

### 6.1 Add Item
Input: `bvid`, `url`, `title`, `cover`, `cid` (if available)
Behavior:
- If item exists, move to target position.
- If new, insert at target position.
- If no queue, create queue and show panel.

### 6.2 Remove Item
- Remove immediately.
- If removing current item, advance to next item if available.
- If queue becomes empty, hide panel.

### 6.3 Reorder
- Drag-and-drop updates `items` and `currentIndex` accordingly.
- Changes take effect immediately.

## 7. Messaging and Permissions

Permissions:
- `storage`: session storage access.
- `contextMenus`: right-click menu.
- `tabs`: identify tabId for storage key.
- `scripting`: inject content scripts if needed.

Message channels:
- `content -> background`: add/remove/reorder/update currentIndex.
- `background -> content`: queue updates, UI refresh.

## 8. Edge Cases
- Duplicate add: move instead of duplicate.
- Navigation away from video page: UI remains and queue persists in tab.
- Tab refresh: content script rehydrates queue from session.
- Page structure changes: use resilient selectors and fallbacks.

## 9. Implementation Steps
1. Build storage layer in background.
2. Implement content script queue panel and toast.
3. Implement hover add button injection + context menu.
4. Implement URL monitoring and silent insert.
5. Implement player ended interception and navigation.
6. Add error handling and multi-part handling.

## 10. Testing Plan
- Add/remove/reorder in feed and video page.
- Direct click to video with existing queue (silent insert).
- Video end with queue next.
- Multi-part video with queue next.
- Failed load advancing.
- Tab close cleanup.
- Dark mode and responsive panel.
