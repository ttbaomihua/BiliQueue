// Shared storage helpers.

const QUEUE_VERSION = 1;
const KEY_PREFIX = "queue_data_";

function getKey(tabId) {
  if (!Number.isInteger(tabId)) {
    throw new Error("tabId must be an integer");
  }
  return `${KEY_PREFIX}${tabId}`;
}

function normalizeQueue(queue, tabId) {
  if (!queue) return null;
  const items = Array.isArray(queue.items) ? queue.items.filter(Boolean) : [];
  let currentIndex = Number.isInteger(queue.currentIndex)
    ? queue.currentIndex
    : items.length > 0
      ? 0
      : -1;

  if (items.length === 0) {
    currentIndex = -1;
  } else if (currentIndex < 0) {
    currentIndex = 0;
  } else if (currentIndex >= items.length) {
    currentIndex = items.length - 1;
  }

  return {
    version: QUEUE_VERSION,
    tabId,
    items,
    currentIndex,
    updatedAt: Number.isFinite(queue.updatedAt) ? queue.updatedAt : Date.now(),
  };
}

export function createQueue(tabId) {
  return {
    version: QUEUE_VERSION,
    tabId,
    items: [],
    currentIndex: -1,
    updatedAt: Date.now(),
  };
}

export async function getQueue(tabId) {
  const key = getKey(tabId);
  const result = await chrome.storage.session.get(key);
  return normalizeQueue(result[key], tabId);
}

export async function setQueue(tabId, queue) {
  const key = getKey(tabId);
  const normalized = normalizeQueue(queue, tabId);
  if (!normalized) {
    await chrome.storage.session.remove(key);
    return null;
  }
  normalized.updatedAt = Date.now();
  await chrome.storage.session.set({ [key]: normalized });
  return normalized;
}

export async function clearQueue(tabId) {
  const key = getKey(tabId);
  await chrome.storage.session.remove(key);
}

export async function updateQueue(tabId, updater) {
  const current = await getQueue(tabId);
  const next = updater(current);
  return setQueue(tabId, next);
}

export function findItemIndex(items, bvid) {
  return items.findIndex((item) => item && item.bvid === bvid);
}

export function moveItem(items, fromIndex, toIndex) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items.slice();
  }
  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function upsertItemAt(queue, item, insertIndex) {
  const next = queue ? { ...queue, items: queue.items.slice() } : null;
  if (!next) return null;
  const currentIdx = findItemIndex(next.items, item.bvid);
  let targetIndex = insertIndex;

  if (!Number.isInteger(targetIndex)) {
    targetIndex = next.items.length;
  } else if (targetIndex < 0) {
    targetIndex = 0;
  } else if (targetIndex > next.items.length) {
    targetIndex = next.items.length;
  }

  if (currentIdx !== -1) {
    next.items.splice(currentIdx, 1);
    if (currentIdx < targetIndex) targetIndex -= 1;
  }

  next.items.splice(targetIndex, 0, item);

  if (next.currentIndex === -1) {
    next.currentIndex = 0;
  } else if (currentIdx !== -1 && currentIdx === next.currentIndex) {
    next.currentIndex = targetIndex;
  } else if (currentIdx !== -1 && currentIdx < next.currentIndex) {
    next.currentIndex -= 1;
  } else if (targetIndex <= next.currentIndex) {
    next.currentIndex += 1;
  }

  return next;
}

export function removeItem(queue, bvid) {
  if (!queue) return null;
  const next = { ...queue, items: queue.items.slice() };
  const index = findItemIndex(next.items, bvid);
  if (index === -1) return next;

  next.items.splice(index, 1);
  if (next.items.length === 0) {
    next.currentIndex = -1;
  } else if (index < next.currentIndex) {
    next.currentIndex -= 1;
  } else if (index === next.currentIndex) {
    next.currentIndex = Math.min(next.currentIndex, next.items.length - 1);
  }

  return next;
}
