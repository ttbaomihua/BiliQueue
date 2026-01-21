# BiliQueue Testing Checklist

Version: V1.0
Date: 2024-05-24

## 1. Queue Creation & UI
- Add via hover "+" button: panel appears and item added.
- Add via context menu: item added and toast appears.
- Queue persists on same tab reload.
- Panel hides when queue is empty.
- Minimize/restore works and shows remaining count.

## 2. Queue Operations
- Add duplicate item: item moves to target position (no duplicate).
- Remove item: it disappears immediately with no confirmation.
- Remove current item: playback advances to next item if available.
- Drag reorder: order updates and current highlight stays correct.

## 3. Silent Insert
- With active queue, click another video card to open.
- Verify the clicked video is inserted at `currentIndex + 1`.
- Verify playback continues with original queue after the inserted item.

## 4. Playback Control
- On video end, next queue item plays automatically.
- If queue is empty, Bilibili default behavior resumes.

## 5. Multi-Part Videos
- For multi-part video without queue next item, next part plays.
- If queue has next item, it overrides multi-part continuation.

## 6. Error Handling
- Simulate load failure (network offline or block request):
  - After ~3s, auto-advance to next queue item.
  - No modal/error dialog blocks the flow.

## 7. UI/UX
- Toast shows for 1s at top center.
- Panel styling matches dark theme and is readable.
- Hover "+" button appears only on hover.

## 8. Tab Lifecycle
- Queue is isolated per tab.
- Closing the tab clears session queue.

## 9. Regression
- No confirmation dialogs appear at any step.
- No noticeable lag while scrolling long feeds.
