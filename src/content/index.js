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
let currentVideoBvid = null;
let currentVideoEl = null;
let errorAdvanceTimer = null;
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

async function removeQueueItem(bvid) {
  const response = await sendQueueMessage({
    type: MESSAGE_TYPES.QUEUE_REMOVE_ITEM,
    bvid,
  });
  if (response?.ok) setQueueState(response.queue ?? null);
  return response;
}

async function reorderQueue(fromIndex, toIndex) {
  const response = await sendQueueMessage({
    type: MESSAGE_TYPES.QUEUE_REORDER,
    fromIndex,
    toIndex,
  });
  if (response?.ok) setQueueState(response.queue ?? null);
  return response;
}

async function setCurrentIndex(currentIndex) {
  const response = await sendQueueMessage({
    type: MESSAGE_TYPES.QUEUE_SET_CURRENT,
    currentIndex,
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
  showToast("Added to queue");
}

const TOAST_ID = "biliqueue-toast";
const TOAST_STYLE_ID = "biliqueue-toast-style";
const ADD_BTN_STYLE_ID = "biliqueue-add-style";
const ADD_BTN_CLASS = "bq-add-btn";

function ensureToastStyles() {
  if (document.getElementById(TOAST_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    .bq-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 22, 28, 0.92);
      color: #e9f0f6;
      font-family: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
      font-size: 12px;
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.25);
      z-index: 999999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .bq-toast.is-visible {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  `;
  document.head.appendChild(style);
}

function showToast(message) {
  ensureToastStyles();
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "bq-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1000);
}

function ensureAddButtonStyles() {
  if (document.getElementById(ADD_BTN_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ADD_BTN_STYLE_ID;
  style.textContent = `
    .bq-add-wrap {
      position: relative;
    }
    .${ADD_BTN_CLASS} {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: rgba(18, 22, 28, 0.8);
      color: #e9f0f6;
      font-size: 16px;
      line-height: 24px;
      text-align: center;
      cursor: pointer;
      opacity: 0;
      transform: scale(0.92);
      transition: opacity 0.2s ease, transform 0.2s ease;
      z-index: 2;
    }
    .bq-add-wrap:hover .${ADD_BTN_CLASS} {
      opacity: 1;
      transform: scale(1);
    }
  `;
  document.head.appendChild(style);
}

function findAnchorTitle(anchor) {
  if (anchor.getAttribute("title")) return anchor.getAttribute("title").trim();
  if (anchor.getAttribute("aria-label"))
    return anchor.getAttribute("aria-label").trim();
  const text = anchor.textContent?.trim();
  return text || document.title?.trim() || "Untitled";
}

function findAnchorCover(anchor) {
  const img = anchor.querySelector("img");
  if (!img) return null;
  return img.getAttribute("data-src") || img.getAttribute("src");
}

function buildItemFromAnchor(anchor) {
  const url = anchor.href;
  const bvid = extractBvid(url);
  if (!bvid) return null;
  return {
    bvid,
    url,
    title: findAnchorTitle(anchor),
    cover: findAnchorCover(anchor),
    cid: null,
    duration: null,
  };
}

function ensureAddButton(anchor) {
  if (anchor.dataset.bqProcessed) return;
  anchor.dataset.bqProcessed = "true";

  const container =
    anchor.closest(
      ".bili-video-card, .bili-video-card__wrap, .bili-video-card__image, .bili-video-card__cover, .video-card, .feed-card, .cover"
    ) || anchor;

  if (!container) return;
  container.classList.add("bq-add-wrap");
  if (container.querySelector(`.${ADD_BTN_CLASS}`)) return;

  const button = document.createElement("button");
  button.className = ADD_BTN_CLASS;
  button.type = "button";
  button.textContent = "+";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const item = buildItemFromAnchor(anchor);
    if (!item) return;
    addQueueItem(item).then((response) => {
      if (response?.ok) showToast("Added to queue");
    });
  });

  container.appendChild(button);
}

function scanForVideoAnchors(root = document) {
  const anchors = root.querySelectorAll('a[href*="/video/BV"]');
  anchors.forEach((anchor) => ensureAddButton(anchor));
}

function initHoverAddButton() {
  ensureAddButtonStyles();
  scanForVideoAnchors();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName === "A") {
          if (node.getAttribute("href")?.includes("/video/BV")) {
            ensureAddButton(node);
          }
          return;
        }
        scanForVideoAnchors(node);
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function getQueueIndexForBvid(queue, bvid) {
  if (!queue || !Array.isArray(queue.items)) return -1;
  return queue.items.findIndex((item) => item && item.bvid === bvid);
}

function getMultiPartInfo() {
  const container =
    document.querySelector("#multi_page") ||
    document.querySelector(".multi-page") ||
    document.querySelector(".video-paging-panel") ||
    document.querySelector(".video-episode-card__list");
  if (!container) return { isMultiPart: false, hasNextPart: false };

  const items = Array.from(
    container.querySelectorAll("li, .part-item, .video-episode-card")
  ).filter((node) => node instanceof HTMLElement);
  if (items.length <= 1) {
    return { isMultiPart: false, hasNextPart: false };
  }

  const activeIndex = items.findIndex(
    (item) =>
      item.classList.contains("on") ||
      item.classList.contains("active") ||
      item.getAttribute("aria-current") === "true"
  );
  const resolvedIndex = activeIndex === -1 ? 0 : activeIndex;
  return {
    isMultiPart: true,
    hasNextPart: resolvedIndex < items.length - 1,
  };
}

async function handleVideoEnded() {
  const queue = currentQueue;
  if (!queue || !Array.isArray(queue.items) || queue.items.length === 0) return;

  const currentBvid = getCurrentVideoBvid();
  let index = Number.isInteger(queue.currentIndex) ? queue.currentIndex : -1;
  if (currentBvid) {
    const matchIndex = getQueueIndexForBvid(queue, currentBvid);
    if (matchIndex !== -1) index = matchIndex;
  }

  const nextIndex = index + 1;
  if (nextIndex < 0 || nextIndex >= queue.items.length) {
    const { isMultiPart, hasNextPart } = getMultiPartInfo();
    if (isMultiPart && hasNextPart) {
      return;
    }
    return;
  }

  const nextItem = queue.items[nextIndex];
  if (!nextItem?.url) return;

  await setCurrentIndex(nextIndex);
  location.href = nextItem.url;
}

function scheduleErrorAdvance() {
  clearTimeout(errorAdvanceTimer);
  errorAdvanceTimer = setTimeout(() => {
    handleVideoEnded().catch((error) => {
      console.warn("[BiliQueue] error advance failed", error);
    });
  }, 3000);
}

function attachVideoListener(video) {
  if (!video || video === currentVideoEl) return;
  if (currentVideoEl) {
    currentVideoEl.removeEventListener("ended", handleVideoEnded);
    currentVideoEl.removeEventListener("error", scheduleErrorAdvance);
    currentVideoEl.removeEventListener("stalled", scheduleErrorAdvance);
  }
  currentVideoEl = video;
  currentVideoEl.addEventListener("ended", () => {
    handleVideoEnded().catch((error) => {
      console.warn("[BiliQueue] video ended handling failed", error);
    });
  });
  currentVideoEl.addEventListener("error", scheduleErrorAdvance);
  currentVideoEl.addEventListener("stalled", scheduleErrorAdvance);
}

function findVideoElement() {
  return document.querySelector("video");
}

function initPlayerHook() {
  const tryAttach = () => {
    const video = findVideoElement();
    if (video) attachVideoListener(video);
  };

  tryAttach();

  const observer = new MutationObserver(() => {
    tryAttach();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function isVideoPage(url) {
  return /\\/video\\/BV[\\w]+/i.test(url);
}

function getCurrentVideoBvid() {
  return extractBvid(location.href);
}

async function handleVideoPageChange() {
  const bvid = getCurrentVideoBvid();
  if (!bvid || bvid === currentVideoBvid) return;
  currentVideoBvid = bvid;

  const queue = currentQueue;
  if (!queue || !Array.isArray(queue.items) || queue.items.length === 0) return;

  const exists = queue.items.some((item) => item && item.bvid === bvid);
  if (exists) return;

  const item = {
    bvid,
    url: location.href,
    title: document.title?.trim() || "Untitled",
    cover: null,
    cid: null,
    duration: null,
  };

  const insertIndex =
    Number.isInteger(queue.currentIndex) && queue.currentIndex >= 0
      ? queue.currentIndex + 1
      : queue.items.length;
  const response = await addQueueItem(item, insertIndex);
  if (response?.ok) showToast("Added to queue");
}

function patchHistory() {
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;

  history.pushState = function pushStateWrapper() {
    const result = originalPush.apply(this, arguments);
    window.dispatchEvent(new Event("bq:navigation"));
    return result;
  };

  history.replaceState = function replaceStateWrapper() {
    const result = originalReplace.apply(this, arguments);
    window.dispatchEvent(new Event("bq:navigation"));
    return result;
  };
}

function initUrlMonitor() {
  patchHistory();
  window.addEventListener("popstate", () => {
    handleVideoPageChange().catch((error) => {
      console.warn("[BiliQueue] URL change failed", error);
    });
    initPlayerHook();
  });
  window.addEventListener("bq:navigation", () => {
    handleVideoPageChange().catch((error) => {
      console.warn("[BiliQueue] URL change failed", error);
    });
    initPlayerHook();
  });
  if (isVideoPage(location.href)) {
    handleVideoPageChange().catch((error) => {
      console.warn("[BiliQueue] URL change failed", error);
    });
    initPlayerHook();
  }
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
  removeQueueItem,
  reorderQueue,
  setCurrentIndex,
  showToast,
};

initHoverAddButton();
initUrlMonitor();
