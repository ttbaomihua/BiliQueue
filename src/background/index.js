// Background service worker entry.
import {
  clearQueue,
  createQueue,
  getQueue,
  moveItem,
  removeItem,
  setQueue,
  upsertItemAt,
} from "../shared/storage.js";

const MENU_ID = "biliqueue_add_to_queue";

function resolveTabId(message, sender) {
  if (Number.isInteger(message?.tabId)) return message.tabId;
  if (Number.isInteger(sender?.tab?.id)) return sender.tab.id;
  return null;
}

async function withQueue(tabId, updater) {
  const current = (await getQueue(tabId)) ?? createQueue(tabId);
  const next = updater(current);
  return setQueue(tabId, next);
}

function reorderQueue(queue, fromIndex, toIndex) {
  if (!queue) return queue;
  const items = moveItem(queue.items, fromIndex, toIndex);
  let currentIndex = queue.currentIndex;

  if (fromIndex === currentIndex) {
    currentIndex = toIndex;
  } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
    currentIndex -= 1;
  } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
    currentIndex += 1;
  }

  return { ...queue, items, currentIndex };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Add to queue",
      contexts: ["link"],
      documentUrlPatterns: ["https://*.bilibili.com/*"],
      targetUrlPatterns: ["https://*.bilibili.com/*"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!tab?.id || !info.linkUrl) return;
  chrome.tabs.sendMessage(tab.id, {
    type: "CONTEXT_ADD",
    payload: { url: info.linkUrl },
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearQueue(tabId).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = resolveTabId(message, sender);
  if (!tabId) return false;

  const respond = async () => {
    switch (message?.type) {
      case "QUEUE_GET": {
        const queue = await getQueue(tabId);
        sendResponse({ ok: true, queue });
        return;
      }
      case "QUEUE_SET": {
        const queue = await setQueue(tabId, message.queue);
        sendResponse({ ok: true, queue });
        return;
      }
      case "QUEUE_CLEAR": {
        await clearQueue(tabId);
        sendResponse({ ok: true });
        return;
      }
      case "QUEUE_ADD_ITEM": {
        const { item, insertIndex } = message;
        const queue = await withQueue(tabId, (current) =>
          upsertItemAt(current, item, insertIndex)
        );
        sendResponse({ ok: true, queue });
        return;
      }
      case "QUEUE_REMOVE_ITEM": {
        const queue = await withQueue(tabId, (current) =>
          removeItem(current, message.bvid)
        );
        sendResponse({ ok: true, queue });
        return;
      }
      case "QUEUE_REORDER": {
        const { fromIndex, toIndex } = message;
        const queue = await withQueue(tabId, (current) =>
          reorderQueue(current, fromIndex, toIndex)
        );
        sendResponse({ ok: true, queue });
        return;
      }
      case "QUEUE_SET_CURRENT": {
        const { currentIndex } = message;
        const queue = await withQueue(tabId, (current) => ({
          ...current,
          currentIndex,
        }));
        sendResponse({ ok: true, queue });
        return;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  };

  respond().catch((error) => {
    sendResponse({ ok: false, error: error?.message || String(error) });
  });
  return true;
});
