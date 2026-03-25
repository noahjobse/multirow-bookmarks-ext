(() => {
  "use strict";

  if (
    window.location.protocol === "chrome-extension:" ||
    window.location.protocol === "chrome:" ||
    window.location.protocol === "brave:" ||
    window.location.protocol === "about:" ||
    document.contentType === "application/pdf"
  ) return;

  if (document.getElementById("mrb-bar")) return;

  let ROWS = 2;
  let dragSrcId = null;

  const bar = document.createElement("div");
  bar.id = "mrb-bar";

  function applySettings(settings) {
    if (settings.bgColor) {
      bar.style.background = settings.bgColor;
      // Auto-detect light vs dark for text color
      const r = parseInt(settings.bgColor.slice(1, 3), 16);
      const g = parseInt(settings.bgColor.slice(3, 5), 16);
      const b = parseInt(settings.bgColor.slice(5, 7), 16);
      const lum = (r * 299 + g * 587 + b * 114) / 1000;
      bar.classList.toggle("mrb-light", lum > 150);
    }
    if (settings.rows) ROWS = settings.rows;
  }

  // Load settings
  chrome.storage.sync.get({ bgColor: "#3b3b3f", rows: 2 }, (settings) => {
    applySettings(settings);
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes) => {
    const updated = {};
    if (changes.bgColor) updated.bgColor = changes.bgColor.newValue;
    if (changes.rows) updated.rows = changes.rows.newValue;
    if (Object.keys(updated).length) {
      applySettings(updated);
      loadBookmarks(); // re-render with new row count
    }
  });

  // No toggle — bar is always visible

  function faviconUrl(url) {
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
    } catch {
      return null;
    }
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function getDraggableWrapper(el, nodeId) {
    const wrapper = document.createElement("div");
    wrapper.className = "mrb-drag-wrapper";
    wrapper.draggable = true;
    wrapper.dataset.bookmarkId = nodeId;
    wrapper.appendChild(el);

    wrapper.addEventListener("dragstart", (e) => {
      dragSrcId = nodeId;
      wrapper.classList.add("mrb-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", nodeId);
    });

    wrapper.addEventListener("dragend", () => {
      wrapper.classList.remove("mrb-dragging");
      bar.querySelectorAll(".mrb-drag-over").forEach((el) => el.classList.remove("mrb-drag-over"));
      dragSrcId = null;
    });

    wrapper.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (wrapper.dataset.bookmarkId !== dragSrcId) {
        // Detect which half of the element the cursor is over
        const rect = wrapper.getBoundingClientRect();
        const isRight = e.clientX > rect.left + rect.width / 2;
        wrapper.classList.toggle("mrb-drag-over", !isRight);
        wrapper.classList.toggle("mrb-drag-over-right", isRight);
      }
    });

    wrapper.addEventListener("dragleave", () => {
      wrapper.classList.remove("mrb-drag-over", "mrb-drag-over-right");
    });

    wrapper.addEventListener("drop", (e) => {
      e.preventDefault();
      const isRight = wrapper.classList.contains("mrb-drag-over-right");
      wrapper.classList.remove("mrb-drag-over", "mrb-drag-over-right");
      const targetId = wrapper.dataset.bookmarkId;
      if (dragSrcId && dragSrcId !== targetId) {
        chrome.runtime.sendMessage({
          type: "moveBookmark",
          sourceId: dragSrcId,
          targetId: targetId,
          after: isRight
        });
      }
    });

    return wrapper;
  }

  function createBookmarkEl(node) {
    if (node.url) {
      const a = document.createElement("a");
      a.className = "mrb-item";
      a.href = node.url;
      a.title = node.title || node.url;
      a.draggable = false; // wrapper handles drag

      const fav = faviconUrl(node.url);
      if (fav) {
        const img = document.createElement("img");
        img.className = "mrb-favicon";
        img.src = fav;
        img.alt = "";
        img.loading = "lazy";
        img.onerror = () => {
          const ph = document.createElement("span");
          ph.className = "mrb-favicon-placeholder";
          ph.textContent = (node.title || "?")[0].toUpperCase();
          img.replaceWith(ph);
        };
        a.appendChild(img);
      } else {
        const ph = document.createElement("span");
        ph.className = "mrb-favicon-placeholder";
        ph.textContent = (node.title || "?")[0].toUpperCase();
        a.appendChild(ph);
      }

      if (node.title) {
        const label = document.createElement("span");
        label.className = "mrb-label";
        label.textContent = node.title;
        a.appendChild(label);
      }

      a.addEventListener("auxclick", (e) => {
        if (e.button === 1) {
          e.preventDefault();
          window.open(node.url, "_blank");
        }
      });

      return getDraggableWrapper(a, node.id);
    }

    if (node.children) {
      const folder = document.createElement("div");
      folder.className = "mrb-folder";

      const trigger = document.createElement("div");
      trigger.className = "mrb-item";
      trigger.title = node.title || "Folder";

      const ph = document.createElement("span");
      ph.className = "mrb-favicon-placeholder";
      ph.textContent = "📁";
      ph.style.background = "none";
      ph.style.fontSize = "13px";
      trigger.appendChild(ph);

      if (node.title) {
        const label = document.createElement("span");
        label.className = "mrb-label";
        label.textContent = node.title;
        trigger.appendChild(label);
      }

      folder.appendChild(trigger);

      const dropdown = document.createElement("div");
      dropdown.className = "mrb-dropdown";

      node.children.forEach((child) => {
        if (!child.url && !child.children) {
          const sep = document.createElement("div");
          sep.className = "mrb-separator";
          dropdown.appendChild(sep);
        } else {
          const el = createBookmarkEl(child);
          if (el) dropdown.appendChild(el);
        }
      });

      folder.appendChild(dropdown);
      return getDraggableWrapper(folder, node.id);
    }

    return null;
  }

  function render(bookmarks) {
    clearChildren(bar);

    const root = bookmarks[0];
    const bookmarksBar = root.children?.find(
      (c) => c.title === "Bookmarks bar" || c.title === "Bookmarks Bar" || c.title === "Bookmarks Toolbar" || c.title === "Bookmarks"
    );

    if (!bookmarksBar || !bookmarksBar.children) return;

    const items = bookmarksBar.children;
    const half = Math.ceil(items.length / ROWS);

    items.forEach((node, i) => {
      if (i === half) {
        const br = document.createElement("div");
        br.className = "mrb-row-break";
        bar.appendChild(br);
      }

      const el = createBookmarkEl(node);
      if (el) bar.appendChild(el);
    });

    document.documentElement.appendChild(bar);

    requestAnimationFrame(() => {
      const h = bar.offsetHeight;
      document.documentElement.style.setProperty("--mrb-height", `${h}px`);
      document.documentElement.classList.add("mrb-active");
    });
  }

  function loadBookmarks() {
    chrome.runtime.sendMessage({ type: "getBookmarks" }, (tree) => {
      if (chrome.runtime.lastError) {
        console.warn("[MRB]", chrome.runtime.lastError.message);
        return;
      }
      if (tree) render(tree);
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "bookmarksChanged") {
      loadBookmarks();
    }
  });

  loadBookmarks();

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#mrb-bar")) {
      bar.querySelectorAll(".mrb-dropdown.mrb-open").forEach((d) =>
        d.classList.remove("mrb-open")
      );
    }
  });
})();
