// Content script entry.

const MESSAGE_TYPES = {
  QUEUE_GET: "QUEUE_GET",
  QUEUE_SET: "QUEUE_SET",
  QUEUE_CLEAR: "QUEUE_CLEAR",
  QUEUE_ADD_ITEM: "QUEUE_ADD_ITEM",
  QUEUE_REMOVE_ITEM: "QUEUE_REMOVE_ITEM",
  QUEUE_REORDER: "QUEUE_REORDER",
  QUEUE_SET_CURRENT: "QUEUE_SET_CURRENT",
};

let currentQueue = null;
const queueListeners = new Set();

function notifyQueueListeners(queue) {
  queueListeners.forEach((listener) => {
    try {
      listener(queue);
    } catch (error) {
      // Listener errors should not break queue flow.
      console.error("[BiliQueue] queue listener error", error);
    }
  });
}

function setQueueState(queue) {
  currentQueue = queue;
  notifyQueueListeners(queue);
}

function onQueueChange(listener) {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}

function sendQueueMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

async function getQueue() {
  const response = await sendQueueMessage({ type: MESSAGE_TYPES.QUEUE_GET });
  if (response?.ok) setQueueState(response.queue ?? null);
  return response;
}

async function addQueueItem(item, insertIndex) {
  const response = await sendQueueMessage({
    type: MESSAGE_TYPES.QUEUE_ADD_ITEM,
    item,
    insertIndex,
  });
  if (response?.ok) setQueueState(response.queue ?? null);
  return response;
}

function extractBvid(url) {
  const match = url.match(/\\/video\\/(BV[\\w]+)/i);
  return match ? match[1] : null;
}

function findTitleForUrl(url) {
  const anchor = document.querySelector(`a[href="${url}"]`);
  if (anchor?.textContent?.trim()) return anchor.textContent.trim();
  return document.title?.trim() || "Untitled";
}

async function handleContextAdd(payload) {
  const bvid = extractBvid(payload?.url || "");
  if (!bvid) return;
  const item = {
    bvid,
    url: payload.url,
    title: findTitleForUrl(payload.url),
    cover: null,
    cid: null,
    duration: null,
  };
  await addQueueItem(item);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) return false;
  if (message.type === "CONTEXT_ADD") {
    handleContextAdd(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: error?.message || String(error) })
      );
    return true;
  }
  if (message.type === "QUEUE_SYNC") {
    setQueueState(message.queue ?? null);
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

// Initialize queue state for the current tab.
getQueue().catch((error) => {
  console.warn("[BiliQueue] failed to load queue", error);
});

// Expose hooks for later UI wiring.
window.BiliQueue = {
  onQueueChange,
  getQueue,
  addQueueItem,
};
