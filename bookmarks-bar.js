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

  // Always snap the drop indicator to the nearest item
  bar.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragSrcId) return;

    // Clear all indicators
    bar.querySelectorAll(".mrb-drag-over, .mrb-drag-over-right").forEach((el) => {
      el.classList.remove("mrb-drag-over", "mrb-drag-over-right");
    });

    // Find the nearest wrapper
    const wrappers = [...bar.querySelectorAll(".mrb-drag-wrapper")];
    let closest = null;
    let closestDist = Infinity;
    let closestRight = false;

    for (const w of wrappers) {
      if (w.dataset.bookmarkId === dragSrcId) continue;
      const rect = w.getBoundingClientRect();
      // Only consider items on the same row (cursor Y within item's vertical bounds)
      if (e.clientY < rect.top || e.clientY > rect.bottom) continue;
      const midX = rect.left + rect.width / 2;
      const dist = Math.abs(e.clientX - midX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = w;
        closestRight = e.clientX > midX;
      }
    }

    if (closest) {
      closest.classList.toggle("mrb-drag-over", !closestRight);
      closest.classList.toggle("mrb-drag-over-right", closestRight);
    }
  });

  bar.addEventListener("drop", (e) => {
    e.preventDefault();
    const target = bar.querySelector(".mrb-drag-over, .mrb-drag-over-right");
    if (!target) return;
    const isRight = target.classList.contains("mrb-drag-over-right");
    const targetId = target.dataset.bookmarkId;
    target.classList.remove("mrb-drag-over", "mrb-drag-over-right");
    const srcId = dragSrcId;
    if (srcId && srcId !== targetId) {
      chrome.runtime.sendMessage({
        type: "moveBookmark",
        sourceId: srcId,
        targetId: targetId,
        after: isRight
      });
    }
  });

  function applySettings(settings) {
    if (settings.alignment) {
      bar.style.justifyContent = settings.alignment;
    }
    if (settings.textSize) {
      bar.style.setProperty("--mrb-text-size", settings.textSize + "px");
    }
    if (settings.iconSize) {
      bar.style.setProperty("--mrb-icon-size", settings.iconSize + "px");
    }
    if (settings.boldText !== undefined) {
      bar.style.fontWeight = settings.boldText ? "600" : "normal";
    }
    if (settings.foldersOnSeparateLine !== undefined) {
      bar.dataset.foldersRow = settings.foldersOnSeparateLine ? "true" : "false";
    }
  }

  // Auto dark/light based on OS/browser theme
  function applyTheme() {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    bar.classList.toggle("mrb-light", !isDark);
    const bg = isDark ? "#3b3b3f" : "#f1f3f5";
    bar.style.background = bg;
    bar.style.setProperty("--mrb-bg", bg);
    bar.style.setProperty("--mrb-text", isDark ? "#ffffff" : "#000000");
  }
  applyTheme();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  function applyPushDown(h) {
    document.documentElement.style.setProperty("--mrb-height", `${h}px`);
    document.documentElement.classList.add("mrb-active");
    injectViewportPatch(h);
  }

  // Inject a script into the page's main world to override innerHeight
  // so JS-driven layouts see the compressed viewport size
  let patchScript = null;
  function injectViewportPatch(h) {
    if (patchScript) patchScript.remove();
    patchScript = document.createElement("script");
    patchScript.textContent = `(function(){
      var mrbH = ${h};
      var orig = Object.getOwnPropertyDescriptor(window, 'innerHeight')
        || Object.getOwnPropertyDescriptor(Window.prototype, 'innerHeight');
      if (orig && orig.get) {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          get: function() { return orig.get.call(this) - mrbH; }
        });
      }
      window.dispatchEvent(new Event('resize'));
    })();`;
    document.documentElement.appendChild(patchScript);
  }

  // Counter page zoom so bar stays the same physical size
  const baselineDPR = window.devicePixelRatio;

  function applyZoomCompensation() {
    const zoom = window.devicePixelRatio / baselineDPR;
    bar.style.zoom = (zoom > 0 && isFinite(zoom)) ? (1 / zoom) : 1;
    requestAnimationFrame(() => {
      const h = bar.getBoundingClientRect().height;
      if (h > 0) applyPushDown(h);
    });
  }

  function watchZoom() {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener("change", () => {
      applyZoomCompensation();
      watchZoom();
    }, { once: true });
  }
  watchZoom();
  applyZoomCompensation();

  // Load settings first, then bookmarks
  chrome.storage.sync.get({ alignment: "center", textSize: 13, iconSize: 20, boldText: false, foldersOnSeparateLine: false }, (settings) => {
    applySettings(settings);
    loadBookmarks();
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes) => {
    const updated = {};
    for (const key of Object.keys(changes)) {
      updated[key] = changes[key].newValue;
    }
    if (Object.keys(updated).length) {
      applySettings(updated);
      loadBookmarks();
    }
  });

  // No toggle — bar is always visible

  const extId = chrome.runtime.id;

  function faviconUrl(url) {
    try {
      new URL(url); // validate
      return `chrome-extension://${extId}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`;
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

    // Drop handled by bar-level listener

    return wrapper;
  }

  function createBookmarkEl(node) {
    if (node.url) {
      const a = document.createElement("a");
      a.className = "mrb-item";
      a.href = node.url;
      a.title = node.title || node.url;
      a.draggable = false;
      a.addEventListener("dragstart", (e) => e.preventDefault());

      const fav = faviconUrl(node.url);
      if (fav) {
        const img = document.createElement("img");
        img.className = "mrb-favicon";
        img.src = fav;
        img.alt = "";
        img.loading = "lazy";
        img.draggable = false;
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

      a.addEventListener("contextmenu", (e) => showContextMenu(e, node));

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
      ph.classList.add("mrb-folder-icon");
      ph.style.background = "none";
      trigger.appendChild(ph);

      if (node.title) {
        const label = document.createElement("span");
        label.className = "mrb-label";
        label.textContent = node.title;
        trigger.appendChild(label);
      }

      trigger.addEventListener("contextmenu", (e) => showContextMenu(e, node));
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

      // Position nested dropdowns with fixed positioning
      folder.addEventListener("mouseenter", () => {
        const parentDropdown = folder.closest(".mrb-dropdown");
        if (parentDropdown) {
          const rect = folder.getBoundingClientRect();
          dropdown.style.position = "fixed";
          dropdown.style.left = rect.right + 2 + "px";
          dropdown.style.top = rect.top + "px";
          // Keep on screen
          requestAnimationFrame(() => {
            const dr = dropdown.getBoundingClientRect();
            if (dr.right > window.innerWidth) {
              dropdown.style.left = rect.left - dr.width - 2 + "px";
            }
            if (dr.bottom > window.innerHeight) {
              dropdown.style.top = Math.max(0, window.innerHeight - dr.height) + "px";
            }
          });
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

    if (bar.dataset.foldersRow === "true") {
      // Bookmarks first, then a row break, then folders
      const links = items.filter((n) => n.url);
      const folders = items.filter((n) => n.children);

      links.forEach((node) => {
        const el = createBookmarkEl(node);
        if (el) bar.appendChild(el);
      });

      if (folders.length) {
        const br = document.createElement("div");
        br.className = "mrb-row-break";
        bar.appendChild(br);

        folders.forEach((node) => {
          const el = createBookmarkEl(node);
          if (el) bar.appendChild(el);
        });
      }
    } else {
      items.forEach((node) => {
        const el = createBookmarkEl(node);
        if (el) bar.appendChild(el);
      });
    }

    document.documentElement.appendChild(bar);

    requestAnimationFrame(() => {
      const h = bar.getBoundingClientRect().height;
      applyPushDown(h);
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

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#mrb-bar")) {
      bar.querySelectorAll(".mrb-dropdown.mrb-open").forEach((d) =>
        d.classList.remove("mrb-open")
      );
    }
    // Close context menu on any click
    const menu = document.getElementById("mrb-context-menu");
    if (menu) menu.remove();
  });

  // ─── Context menu ─────────────────────────────────
  function showContextMenu(e, node) {
    e.preventDefault();
    e.stopPropagation();

    // Remove any existing menu
    const old = document.getElementById("mrb-context-menu");
    if (old) old.remove();

    const menu = document.createElement("div");
    menu.id = "mrb-context-menu";
    menu.className = bar.classList.contains("mrb-light") ? "mrb-ctx mrb-ctx-light" : "mrb-ctx";

    const items = [];

    if (node.url) {
      items.push({ label: "Open in new tab", action: () => window.open(node.url, "_blank") });
      items.push({ label: "Open in new window", action: () => window.open(node.url, "_blank", "noopener") });
      items.push({ type: "separator" });
      items.push({ label: "Rename...", action: () => renameBookmark(node) });
      items.push({ label: "Edit URL...", action: () => editBookmarkUrl(node) });
      items.push({ label: "Delete", action: () => chrome.runtime.sendMessage({ type: "deleteBookmark", id: node.id }) });
    } else if (node.children) {
      items.push({ label: "Open all in tabs", action: () => {
        node.children.filter(c => c.url).forEach(c => window.open(c.url, "_blank"));
      }});
      items.push({ type: "separator" });
      items.push({ label: "Rename...", action: () => editFolder(node) });
      items.push({ label: "Delete folder", action: () => chrome.runtime.sendMessage({ type: "deleteBookmark", id: node.id }) });
    }

    items.push({ type: "separator" });
    items.push({ label: "Add bookmark...", action: () => addBookmark(node) });
    items.push({ label: "Add folder...", action: () => addFolder(node) });
    items.push({ type: "separator" });
    items.push({ label: "Bookmark manager", action: () => window.open("chrome://bookmarks", "_blank") });

    items.forEach((item) => {
      if (item.type === "separator") {
        const sep = document.createElement("div");
        sep.className = "mrb-ctx-sep";
        menu.appendChild(sep);
      } else {
        const btn = document.createElement("div");
        btn.className = "mrb-ctx-item";
        btn.textContent = item.label;
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          menu.remove();
          item.action();
        });
        menu.appendChild(btn);
      }
    });

    document.documentElement.appendChild(menu);

    // Position
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 10);
    menu.style.left = x + "px";
    menu.style.top = y + "px";
  }

  function renameBookmark(node) {
    const title = prompt("Bookmark name:", node.title || "");
    if (title === null) return;
    chrome.runtime.sendMessage({ type: "editBookmark", id: node.id, title });
  }

  function editBookmarkUrl(node) {
    const url = prompt("URL:", node.url || "");
    if (url === null) return;
    chrome.runtime.sendMessage({ type: "editBookmark", id: node.id, url });
  }

  function editFolder(node) {
    const title = prompt("Folder name:", node.title || "");
    if (title === null) return;
    chrome.runtime.sendMessage({ type: "editBookmark", id: node.id, title });
  }

  function addBookmark(node) {
    const title = prompt("New bookmark name:");
    if (!title) return;
    const url = prompt("URL:");
    if (!url) return;
    const parentId = node.children ? node.id : node.parentId;
    chrome.runtime.sendMessage({ type: "addBookmark", parentId, title, url });
  }

  function addFolder(node) {
    const title = prompt("New folder name:");
    if (!title) return;
    const parentId = node.children ? node.id : node.parentId;
    chrome.runtime.sendMessage({ type: "addFolder", parentId, title });
  }
})();
