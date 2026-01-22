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
let isRehydratingIndex = false;
let pendingRemovalBvid = null;
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
  maybeAdvanceAfterRemoval(queue);
  syncCurrentIndexWithPage(queue).catch((error) => {
    console.warn("[BiliQueue] rehydrate index failed", error);
  });
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
  pendingRemovalBvid = bvid || null;
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
  const match = url.match(/\/video\/(BV[\w]+)/i);
  return match ? match[1] : null;
}

function findTitleForUrl(url) {
  const anchor = document.querySelector(`a[href="${url}"]`);
  if (anchor) {
    const title = findAnchorTitle(anchor);
    if (title) return title;
  }
  return cleanTitle(document.title) || "Untitled";
}

async function handleContextAdd(payload) {
  const bvid = extractBvid(payload?.url || "");
  if (!bvid) return;
  const item = {
    bvid,
    url: payload.url,
    title: findTitleForUrl(payload.url),
    cover: null,
    author: null,
    cid: null,
    duration: null,
    durationText: null,
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
    .bq-add-wrap {}
    .${ADD_BTN_CLASS} {
      --bq-add-size: 32px;
      --bq-add-gap: 8px;
      position: absolute;
      top: calc(8px + var(--bq-add-size) + var(--bq-add-gap));
      right: 8px;
      width: var(--bq-add-size);
      height: var(--bq-add-size);
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      background: rgba(16, 20, 24, 0.72);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28);
      color: #e9f0f6;
      font-size: 0;
      line-height: 0;
      text-align: center;
      cursor: pointer;
      padding: 0;
      display: grid;
      place-items: center;
      pointer-events: auto;
      opacity: 0;
      transform: scale(0.92);
      transition: opacity 0.2s ease, transform 0.2s ease;
      z-index: 20;
    }
    .${ADD_BTN_CLASS}::before {
      content: "";
      width: 16px;
      height: 16px;
      background: no-repeat center / contain;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M2.5 4h7.2' stroke='%23e9f0f6' stroke-width='1.6' stroke-linecap='round'/><path d='M2.5 8h7.2' stroke='%23e9f0f6' stroke-width='1.6' stroke-linecap='round'/><path d='M2.5 12h7.2' stroke='%23e9f0f6' stroke-width='1.6' stroke-linecap='round'/><path d='M11.2 5.3l2.8 2.7-2.8 2.7z' fill='%23e9f0f6'/></svg>");
    }
    .bq-add-wrap:hover .${ADD_BTN_CLASS},
    .bq-add-card:hover .${ADD_BTN_CLASS},
    .${ADD_BTN_CLASS}:hover,
    .${ADD_BTN_CLASS}:focus-visible {
      opacity: 1;
      transform: scale(1);
    }
  `;
  document.head.appendChild(style);
}

function findAnchorTitle(anchor) {
  const container = getAnchorContainer(anchor);
  const containerTitle = cleanTitle(
    findTextBySelectors(container, [
      ".bili-video-card__info--tit",
      ".bili-video-card__info--title",
      ".bili-video-card__title",
      ".video-card__info--title",
      ".video-card__title",
      ".video-title",
      ".title",
      ".bili-video-card__info--tit a",
      ".bili-video-card__info--title a",
      ".bili-video-card__title a",
      ".video-card__title a",
    ])
  );
  if (containerTitle) return containerTitle;

  const attrTitle = cleanTitle(anchor.getAttribute("title"));
  if (attrTitle) return attrTitle;

  const ariaTitle = cleanTitle(anchor.getAttribute("aria-label"));
  if (ariaTitle) return ariaTitle;

  const text = cleanTitle(anchor.textContent);
  if (text) return text;

  return cleanTitle(document.title) || "Untitled";
}

function findAnchorCover(anchor) {
  const img = anchor.querySelector("img");
  if (!img) return null;
  return img.getAttribute("data-src") || img.getAttribute("src");
}

function getAnchorHref(anchor) {
  if (!anchor) return "";
  const raw =
    anchor.getAttribute("href") ||
    anchor.getAttribute("data-href") ||
    anchor.getAttribute("data-url") ||
    anchor.dataset?.href ||
    anchor.dataset?.url ||
    "";
  if (!raw) return anchor.href || "";
  if (raw.startsWith("//")) return `${location.protocol}${raw}`;
  try {
    return new URL(raw, location.origin).toString();
  } catch {
    return raw;
  }
}

function normalizeText(value) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function cleanTitle(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const lower = text.toLowerCase();
  if (
    text.includes("稍后再看") ||
    text.includes("正在缓冲") ||
    lower.includes("watch later") ||
    lower.includes("buffering")
  ) {
    return "";
  }
  return text;
}

function getAnchorContainer(anchor) {
  const outer = anchor.closest(".bili-video-card, .video-card, .feed-card");
  if (outer) return outer;
  const middle = anchor.closest(
    ".bili-video-card__wrap, .bili-video-card__cover, .bili-video-card__image, .cover"
  );
  if (middle) return middle;
  return anchor;
}

function getCardContainer(anchor) {
  return (
    anchor.closest(
      ".bili-video-card__wrap, .bili-video-card, .video-card, .feed-card"
    ) || getAnchorContainer(anchor)
  );
}

function applyAddWrap(container) {
  container.classList.add("bq-add-wrap");
  if (container.dataset.bqWrapApplied) return;
  container.dataset.bqWrapApplied = "true";
  const style = window.getComputedStyle(container);
  if (style.position === "static") {
    container.style.position = "relative";
  }
}

function findTextBySelectors(container, selectors) {
  for (const selector of selectors) {
    const el = container.querySelector(selector);
    const text = normalizeText(el?.textContent);
    if (text) return text;
  }
  return "";
}

function findAuthorForAnchor(anchor) {
  const container = getAnchorContainer(anchor);
  const author = findTextBySelectors(container, [
    ".bili-video-card__info--author",
    ".bili-video-card__info--owner",
    ".bili-video-card__info--up",
    ".up-name",
    ".up-name__text",
    ".author",
    ".owner",
    ".up-name__text a",
    ".bili-video-card__info--author a",
    ".bili-video-card__info--owner a",
    ".bili-video-card__info--up a",
  ]);
  return author;
}

function findDurationForAnchor(anchor) {
  const container = getAnchorContainer(anchor);
  const duration = findTextBySelectors(container, [
    ".bili-video-card__stats__duration",
    ".bili-video-card__stats--duration",
    ".bili-video-card__stats .duration",
    ".bili-video-card__duration",
    ".duration",
    ".video-card__duration",
    ".video-duration",
    ".video-time",
  ]);
  if (duration) return duration;
  return normalizeText(anchor.getAttribute("data-duration"));
}

function buildItemFromAnchor(anchor) {
  const url = getAnchorHref(anchor);
  const bvid = extractBvid(url);
  if (!bvid) return null;
  return {
    bvid,
    url,
    title: findAnchorTitle(anchor),
    cover: findAnchorCover(anchor),
    author: findAuthorForAnchor(anchor),
    cid: null,
    duration: null,
    durationText: findDurationForAnchor(anchor),
  };
}

function findNativeOverlayButton(container) {
  const candidates = Array.from(
    container.querySelectorAll("button, a, div, span")
  );
  let best = null;
  let bestScore = Infinity;

  candidates.forEach((candidate) => {
    if (candidate.classList?.contains(ADD_BTN_CLASS)) return;
    const label =
      candidate.getAttribute("title") ||
      candidate.getAttribute("aria-label") ||
      candidate.getAttribute("data-tooltip-text") ||
      candidate.getAttribute("data-title") ||
      "";
    const isWatchLater = /稍后再看|watch later/i.test(label);
    const style = window.getComputedStyle(candidate);
    if (style.position !== "absolute") return;
    const top = Number.parseFloat(style.top);
    const right = Number.parseFloat(style.right);
    if (!Number.isFinite(top) || !Number.isFinite(right)) return;
    if (top < -4 || right < -4 || top > 24 || right > 24) return;
    const rect = candidate.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (rect.width < 18 || rect.height < 18) return;
    if (rect.width > 64 || rect.height > 64) return;
    const score =
      Math.abs(top) + Math.abs(right) + rect.width * 0.1 - (isWatchLater ? 80 : 0);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
}

function positionAddButton(container, button, nativeButtonOverride) {
  const nativeButton =
    nativeButtonOverride || findNativeOverlayButton(container);
  if (!nativeButton) return;
  const containerRect = container.getBoundingClientRect();
  const nativeRect = nativeButton.getBoundingClientRect();
  if (!containerRect.width || !nativeRect.width) return;

  const offsetTop = nativeRect.top - containerRect.top;
  const offsetRight = containerRect.right - nativeRect.right;
  if (!Number.isFinite(offsetTop) || !Number.isFinite(offsetRight)) return;

  const size = Math.round(nativeRect.height);
  if (Number.isFinite(size) && size > 0) {
    button.style.setProperty("--bq-add-size", `${size}px`);
  }

  const gap = 8;
  const maxTop = Math.max(0, containerRect.height - size - 4);
  const desiredTop = offsetTop + size + gap;
  const clampedTop = Math.min(Math.max(0, desiredTop), maxTop);
  button.style.top = `${clampedTop}px`;
  button.style.right = `${Math.max(0, offsetRight)}px`;
}

function resolveAddButtonContainer(anchor) {
  const base = getAnchorContainer(anchor);
  const nativeButton = findNativeOverlayButton(base);
  if (nativeButton) {
    const offsetParent = nativeButton.offsetParent;
    if (offsetParent instanceof HTMLElement && base.contains(offsetParent)) {
      return { container: offsetParent, nativeButton };
    }
    if (
      nativeButton.parentElement instanceof HTMLElement &&
      base.contains(nativeButton.parentElement)
    ) {
      return { container: nativeButton.parentElement, nativeButton };
    }
  }
  return { container: base, nativeButton };
}

function ensureAddButton(anchor) {
  const url = getAnchorHref(anchor);
  const bvid = extractBvid(url);
  if (!bvid) return;
  if (anchor.dataset.bqProcessed && anchor.dataset.bqBvid === bvid) return;
  anchor.dataset.bqProcessed = "true";
  anchor.dataset.bqBvid = bvid;

  const { container, nativeButton } = resolveAddButtonContainer(anchor);
  const card = getCardContainer(anchor);

  if (!container) return;
  applyAddWrap(container);
  if (card) card.classList.add("bq-add-card");
  const existingButton = container.querySelector(`.${ADD_BTN_CLASS}`);
  if (existingButton) {
    requestAnimationFrame(() => {
      positionAddButton(container, existingButton, nativeButton);
    });
    return;
  }

  const button = document.createElement("button");
  button.className = ADD_BTN_CLASS;
  button.type = "button";
  button.setAttribute("aria-label", "Add to queue");
  button.setAttribute("title", "Add to queue");
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
  requestAnimationFrame(() => {
    positionAddButton(container, button, nativeButton);
  });
}

function scanForVideoAnchors(root = document) {
  const anchors = root.querySelectorAll(
    'a[href*="/video/"], a[data-href*="/video/"], a[data-url*="/video/"]'
  );
  anchors.forEach((anchor) => ensureAddButton(anchor));
}

function initHoverAddButton() {
  ensureAddButtonStyles();
  scanForVideoAnchors();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes") {
        const target = mutation.target;
        if (target instanceof HTMLElement && target.tagName === "A") {
          ensureAddButton(target);
        }
        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName === "A") {
          ensureAddButton(node);
          return;
        }
        scanForVideoAnchors(node);
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href", "data-href", "data-url"],
  });
}

function getQueueIndexForBvid(queue, bvid) {
  if (!queue || !Array.isArray(queue.items)) return -1;
  return queue.items.findIndex((item) => item && item.bvid === bvid);
}

function maybeAdvanceAfterRemoval(queue) {
  if (!pendingRemovalBvid) return;
  const removedBvid = pendingRemovalBvid;
  pendingRemovalBvid = null;

  if (!isVideoPage(location.href)) return;
  const currentBvid = getCurrentVideoBvid();
  if (!currentBvid || currentBvid !== removedBvid) return;
  if (!queue || !Array.isArray(queue.items) || queue.items.length === 0) return;
  if (getQueueIndexForBvid(queue, removedBvid) !== -1) return;

  const nextItem = queue.items[queue.currentIndex];
  if (nextItem?.url && nextItem.url !== location.href) {
    location.href = nextItem.url;
  }
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
  return "/\/video\/BV[\\w]+/i".test(url);
}

function getCurrentVideoBvid() {
  return extractBvid(location.href);
}

async function syncCurrentIndexWithPage(queue) {
  if (isRehydratingIndex) return;
  if (!queue || !Array.isArray(queue.items) || queue.items.length === 0) return;
  if (!isVideoPage(location.href)) return;

  const bvid = getCurrentVideoBvid();
  if (!bvid) return;

  const index = getQueueIndexForBvid(queue, bvid);
  if (index === -1) return;
  if (index === queue.currentIndex) return;

  isRehydratingIndex = true;
  try {
    await setCurrentIndex(index);
  } finally {
    isRehydratingIndex = false;
  }
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
    author: null,
    cid: null,
    duration: null,
    durationText: null,
  };

  const insertIndex =
    Number.isInteger(queue.currentIndex) && queue.currentIndex >= 0
      ? queue.currentIndex + 1
      : queue.items.length;
  const response = await addQueueItem(item, insertIndex);
  if (response?.ok) showToast("Added to queue");
  await syncCurrentIndexWithPage(currentQueue);
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
