// Queue panel UI entry.

const PANEL_ID = "biliqueue-panel";
const STYLE_ID = "biliqueue-style";

const state = {
  minimized: false,
  lastQueue: null,
};

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .bq-panel {
      --bq-bg: linear-gradient(135deg, rgba(18, 22, 28, 0.86), rgba(36, 44, 52, 0.86));
      --bq-accent: #5fd0ff;
      --bq-text: #e9f0f6;
      --bq-muted: rgba(233, 240, 246, 0.66);
      --bq-border: rgba(255, 255, 255, 0.12);
      --bq-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
      position: fixed;
      right: 18px;
      bottom: 18px;
      width: 300px;
      max-height: 360px;
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      border: 1px solid var(--bq-border);
      background: var(--bq-bg);
      backdrop-filter: blur(18px);
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
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid var(--bq-border);
      background: linear-gradient(120deg, rgba(95, 208, 255, 0.16), rgba(18, 22, 28, 0.1));
    }
    .bq-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }
    .bq-minimize {
      background: transparent;
      border: 1px solid var(--bq-border);
      color: var(--bq-text);
      font-size: 12px;
      border-radius: 10px;
      padding: 4px 8px;
      cursor: pointer;
    }
    .bq-body {
      overflow: auto;
      padding: 8px 0;
    }
    .bq-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 0 10px 10px;
    }
    .bq-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: rgba(10, 14, 18, 0.45);
      cursor: grab;
      transition: border 0.2s ease, transform 0.2s ease;
    }
    .bq-item.is-current {
      border-color: rgba(95, 208, 255, 0.8);
      box-shadow: inset 0 0 0 1px rgba(95, 208, 255, 0.35);
      transform: translateX(-2px);
    }
    .bq-item-title {
      font-size: 12px;
      line-height: 1.3;
      color: var(--bq-text);
      flex: 1;
    }
    .bq-remove {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--bq-border);
      color: var(--bq-muted);
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 10px;
      cursor: pointer;
    }
    .bq-minimized {
      display: none;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 30% 30%, rgba(95, 208, 255, 0.45), rgba(12, 16, 20, 0.6));
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
      padding: 12px 14px;
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

  const title = document.createElement("div");
  title.className = "bq-title";
  title.textContent = "Queue";

  const minimize = document.createElement("button");
  minimize.className = "bq-minimize";
  minimize.type = "button";
  minimize.textContent = "Min";
  minimize.addEventListener("click", () => {
    state.minimized = !state.minimized;
    panel.classList.toggle("is-minimized", state.minimized);
  });

  header.appendChild(title);
  header.appendChild(minimize);

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

  if (!queue || !queue.items || queue.items.length === 0) {
    panel.classList.add("is-hidden");
    return;
  }

  panel.classList.remove("is-hidden");
  minimized.textContent = String(queue.items.length);

  list.innerHTML = "";
  queue.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "bq-item";
    if (index === queue.currentIndex) row.classList.add("is-current");
    row.draggable = true;
    row.dataset.index = String(index);

    const title = document.createElement("div");
    title.className = "bq-item-title";
    title.textContent = item.title || item.bvid || "Untitled";

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

    row.appendChild(title);
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
