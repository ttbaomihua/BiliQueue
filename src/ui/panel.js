// Queue panel UI entry.

const PANEL_ID = "biliqueue-panel";
const STYLE_ID = "biliqueue-style";

const state = {
  minimized: false,
  lastQueue: null,
};

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .bq-panel {
      --bq-bg: #ffffff;
      --bq-accent: #111827;
      --bq-text: #1f2328;
      --bq-muted: #6b7280;
      --bq-border: #e6e8eb;
      --bq-shadow: 0 18px 40px rgba(0, 0, 0, 0.12);
      position: fixed;
      right: 18px;
      bottom: 18px;
      width: 320px;
      max-height: 420px;
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      border: 1px solid var(--bq-border);
      background: var(--bq-bg);
      color: var(--bq-text);
      box-shadow: var(--bq-shadow);
      font-family: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
      z-index: 999999;
      overflow: hidden;
    }
    .bq-panel.is-hidden {
      display: none;
    }
    .bq-panel.is-minimized {
      width: 56px;
      height: 56px;
      border-radius: 999px;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .bq-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 16px;
      background: #ffffff;
    }
    .bq-header-left {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bq-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 16px 12px;
      color: var(--bq-text);
    }
    .bq-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--bq-text);
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
    }
    .bq-action svg {
      width: 22px;
      height: 22px;
      display: block;
    }
    .bq-action-clear {
      margin-left: auto;
      color: var(--bq-text);
      background: #e6e7e9;
      padding: 6px 14px;
      border-radius: 999px;
    }
    .bq-action-clear:hover {
      background: #dfe1e4;
    }
    .bq-title {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.1px;
    }
    .bq-count {
      font-size: 13px;
      color: var(--bq-muted);
    }
    .bq-minimize {
      background: transparent;
      border: none;
      color: var(--bq-muted);
      font-size: 20px;
      line-height: 20px;
      border-radius: 8px;
      padding: 2px 6px;
      cursor: pointer;
    }
    .bq-body {
      overflow: auto;
      padding: 0 0 6px;
    }
    .bq-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 12px 14px;
    }
    .bq-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: #f6f7f8;
      cursor: grab;
      transition: border 0.2s ease, background 0.2s ease;
    }
    .bq-item.is-current {
      border-color: #ead9c6;
      background: #f4ebe4;
    }
    .bq-cover {
      position: relative;
      width: 96px;
      height: 54px;
      border-radius: 8px;
      overflow: hidden;
      background: #e5e7eb;
      flex-shrink: 0;
    }
    .bq-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .bq-duration {
      position: absolute;
      right: 4px;
      bottom: 4px;
      background: rgba(0, 0, 0, 0.72);
      color: #ffffff;
      font-size: 11px;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .bq-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }
    .bq-item-title {
      font-size: 14px;
      line-height: 1.3;
      color: var(--bq-text);
      font-weight: 600;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .bq-item-meta {
      font-size: 12px;
      color: var(--bq-muted);
    }
    .bq-item-meta.is-empty {
      display: none;
    }
    .bq-remove {
      background: transparent;
      border: none;
      color: var(--bq-muted);
      font-size: 12px;
      padding: 4px 6px;
      border-radius: 8px;
      cursor: pointer;
      align-self: flex-start;
    }
    .bq-remove:hover {
      color: var(--bq-text);
      background: rgba(0, 0, 0, 0.05);
    }
    .bq-minimized {
      display: none;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      color: var(--bq-text);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .bq-panel.is-minimized .bq-header,
    .bq-panel.is-minimized .bq-body {
      display: none;
    }
    .bq-panel.is-minimized .bq-minimized {
      display: flex;
    }
    .bq-empty {
      font-size: 12px;
      color: var(--bq-muted);
      padding: 12px 16px;
    }
  `;
  document.head.appendChild(style);
}

function createPanel() {
  let panel = document.getElementById(PANEL_ID);
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.className = "bq-panel is-hidden";

  const header = document.createElement("div");
  header.className = "bq-header";

  const headerLeft = document.createElement("div");
  headerLeft.className = "bq-header-left";

  const title = document.createElement("div");
  title.className = "bq-title";
  title.textContent = "Queue";

  const count = document.createElement("div");
  count.className = "bq-count";
  count.textContent = "0 / 0";

  const minimize = document.createElement("button");
  minimize.className = "bq-minimize";
  minimize.type = "button";
  minimize.textContent = "x";
  minimize.setAttribute("aria-label", "Minimize queue");
  minimize.addEventListener("click", () => {
    state.minimized = !state.minimized;
    panel.classList.toggle("is-minimized", state.minimized);
  });

  headerLeft.appendChild(title);
  headerLeft.appendChild(count);

  header.appendChild(headerLeft);
  header.appendChild(minimize);

  const actions = document.createElement("div");
  actions.className = "bq-actions";

  const save = document.createElement("button");
  save.className = "bq-action";
  save.type = "button";
  save.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h10a2 2 0 0 1 2 2v16l-7-4-7 4V5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
    <span>Save</span>
  `;

  const clear = document.createElement("button");
  clear.className = "bq-action bq-action-clear";
  clear.type = "button";
  clear.textContent = "Clear";
  clear.addEventListener("click", () => {
    if (window.BiliQueue?.setQueue) {
      window.BiliQueue.setQueue(null);
      return;
    }
  });

  actions.appendChild(save);
  actions.appendChild(clear);

  const body = document.createElement("div");
  body.className = "bq-body";

  const list = document.createElement("div");
  list.className = "bq-list";
  list.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });
  list.addEventListener("drop", (event) => {
    event.preventDefault();
    const fromIndex = Number(event.dataTransfer.getData("text/plain"));
    const toIndex = state.lastQueue?.items?.length
      ? state.lastQueue.items.length - 1
      : 0;
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
    if (fromIndex === toIndex) return;
    if (window.BiliQueue?.reorderQueue) {
      window.BiliQueue.reorderQueue(fromIndex, toIndex);
    }
  });
  body.appendChild(list);

  const minimized = document.createElement("div");
  minimized.className = "bq-minimized";
  minimized.addEventListener("click", () => {
    state.minimized = false;
    panel.classList.remove("is-minimized");
  });

  panel.appendChild(header);
  panel.appendChild(actions);
  panel.appendChild(body);
  panel.appendChild(minimized);

  document.body.appendChild(panel);
  return panel;
}

function renderQueue(queue) {
  state.lastQueue = queue;
  const panel = createPanel();
  const list = panel.querySelector(".bq-list");
  const minimized = panel.querySelector(".bq-minimized");
  const count = panel.querySelector(".bq-count");

  if (!queue || !queue.items || queue.items.length === 0) {
    panel.classList.add("is-hidden");
    if (count) count.textContent = "0 / 0";
    if (minimized) minimized.textContent = "0";
    return;
  }

  panel.classList.remove("is-hidden");
  const total = queue.items.length;
  const currentIndex = Number.isInteger(queue.currentIndex)
    ? queue.currentIndex
    : -1;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  if (count) count.textContent = `${displayIndex} / ${total}`;
  if (minimized) minimized.textContent = String(total);

  list.innerHTML = "";
  queue.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "bq-item";
    if (index === queue.currentIndex) row.classList.add("is-current");
    row.draggable = true;
    row.dataset.index = String(index);

    const cover = document.createElement("div");
    cover.className = "bq-cover";
    if (item.cover) {
      const img = document.createElement("img");
      img.src = item.cover;
      img.alt = item.title || "Cover";
      cover.appendChild(img);
    }

    const durationText = item.durationText || formatDuration(item.duration);
    if (durationText) {
      const duration = document.createElement("div");
      duration.className = "bq-duration";
      duration.textContent = durationText;
      cover.appendChild(duration);
    }

    const info = document.createElement("div");
    info.className = "bq-info";

    const title = document.createElement("div");
    title.className = "bq-item-title";
    title.textContent = item.title || item.bvid || "Untitled";

    const meta = document.createElement("div");
    meta.className = "bq-item-meta";
    const metaText = item.author || item.channel || "";
    meta.textContent = metaText;
    if (!metaText) meta.classList.add("is-empty");

    info.appendChild(title);
    info.appendChild(meta);

    const remove = document.createElement("button");
    remove.className = "bq-remove";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      if (item.bvid && window.BiliQueue?.removeQueueItem) {
        window.BiliQueue.removeQueueItem(item.bvid);
      }
    });

    row.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    });

    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    row.addEventListener("drop", (event) => {
      event.preventDefault();
      const fromIndex = Number(event.dataTransfer.getData("text/plain"));
      const toIndex = Number(row.dataset.index);
      if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
      if (fromIndex === toIndex) return;
      if (window.BiliQueue?.reorderQueue) {
        window.BiliQueue.reorderQueue(fromIndex, toIndex);
      }
    });

    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      if (!item.url) return;
      if (window.BiliQueue?.setCurrentIndex) {
        window.BiliQueue.setCurrentIndex(index);
      }
      if (item.url !== location.href) {
        location.href = item.url;
      }
    });

    row.appendChild(cover);
    row.appendChild(info);
    row.appendChild(remove);
    list.appendChild(row);
  });
}

function initPanel() {
  ensureStyles();
  createPanel();

  if (window.BiliQueue?.onQueueChange) {
    window.BiliQueue.onQueueChange(renderQueue);
    if (window.BiliQueue.getQueue) {
      window.BiliQueue.getQueue();
    }
    return;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (window.BiliQueue?.onQueueChange) {
      clearInterval(timer);
      window.BiliQueue.onQueueChange(renderQueue);
      if (window.BiliQueue.getQueue) {
        window.BiliQueue.getQueue();
      }
    }
    if (attempts > 20) {
      clearInterval(timer);
    }
  }, 250);
}

initPanel();
