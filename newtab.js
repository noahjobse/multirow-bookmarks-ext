(() => {
  "use strict";

  // ─── Clock ───────────────────────────────────────────
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");

  function updateClock() {
    const now = new Date();
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    clockEl.textContent = `${h}:${m}`;

    const options = { weekday: "long", month: "long", day: "numeric" };
    dateEl.textContent = now.toLocaleDateString(undefined, options);
  }

  updateClock();
  setInterval(updateClock, 10000);

  // ─── Search ──────────────────────────────────────────
  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("search").value.trim();
    if (!q) return;

    // If it looks like a URL, navigate directly
    if (/^(https?:\/\/|[a-z0-9-]+\.[a-z]{2,})/i.test(q)) {
      const url = q.startsWith("http") ? q : "https://" + q;
      window.location.href = url;
    } else {
      window.location.href = `https://search.brave.com/search?q=${encodeURIComponent(q)}`;
    }
  });

  // ─── Quick Links (top 8 most recent bookmarks) ──────
  const quickLinksEl = document.getElementById("quick-links");

  function faviconUrl(url) {
    try {
      new URL(url); // validate
      return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`;
    } catch {
      return null;
    }
  }

  function renderQuickLinks(bookmarks) {
    const root = bookmarks[0];
    const bookmarksBar = root.children?.find(
      (c) => c.title === "Bookmarks bar" || c.title === "Bookmarks Bar" || c.title === "Bookmarks Toolbar" || c.title === "Bookmarks"
    );
    if (!bookmarksBar || !bookmarksBar.children) return;

    // Get top 8 bookmarks (not folders) sorted by most recently used
    const urls = [];
    function collect(nodes) {
      for (const n of nodes) {
        if (n.url) urls.push(n);
        if (n.children) collect(n.children);
      }
    }
    collect(bookmarksBar.children);

    urls.sort((a, b) => (b.dateLastUsed || 0) - (a.dateLastUsed || 0));
    const top = urls.slice(0, 8);

    top.forEach((bm) => {
      const a = document.createElement("a");
      a.className = "quick-link";
      a.href = bm.url;
      a.title = bm.title || bm.url;

      const iconWrap = document.createElement("div");
      iconWrap.className = "quick-link-icon";

      const fav = faviconUrl(bm.url);
      if (fav) {
        const img = document.createElement("img");
        img.src = fav;
        img.alt = "";
        img.onerror = () => {
          img.remove();
          iconWrap.textContent = (bm.title || "?")[0].toUpperCase();
          iconWrap.style.color = "#888";
          iconWrap.style.fontSize = "18px";
          iconWrap.style.fontWeight = "500";
        };
        iconWrap.appendChild(img);
      }

      const label = document.createElement("span");
      label.className = "quick-link-label";
      try {
        label.textContent = bm.title || new URL(bm.url).hostname.replace("www.", "");
      } catch {
        label.textContent = bm.title || "Bookmark";
      }

      a.appendChild(iconWrap);
      a.appendChild(label);
      quickLinksEl.appendChild(a);
    });
  }

  // ─── Bookmarks Bar ──────────────────────────────────
  let dragSrcId = null;

  const bar = document.createElement("div");
  bar.id = "mrb-bar";

  // Always snap drop indicator to nearest item
  bar.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragSrcId) return;

    bar.querySelectorAll(".mrb-drag-over, .mrb-drag-over-right").forEach((el) => {
      el.classList.remove("mrb-drag-over", "mrb-drag-over-right");
    });

    const wrappers = [...bar.querySelectorAll(".mrb-drag-wrapper")];
    let closest = null;
    let closestDist = Infinity;
    let closestRight = false;

    for (const w of wrappers) {
      if (w.dataset.bookmarkId === dragSrcId) continue;
      const rect = w.getBoundingClientRect();
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
      chrome.bookmarks.get(targetId).then(([tgt]) => {
        const idx = isRight ? tgt.index + 1 : tgt.index;
        return chrome.bookmarks.move(srcId, {
          parentId: tgt.parentId,
          index: idx
        });
      }).catch((err) => {
        console.error("[MRB] Move failed:", err.message);
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

  // Settings loaded before bookmarks render — see Init section below
  chrome.storage.onChanged.addListener((changes) => {
    const updated = {};
    for (const key of Object.keys(changes)) {
      updated[key] = changes[key].newValue;
    }
    if (Object.keys(updated).length) {
      applySettings(updated);
      chrome.bookmarks.getTree().then(renderBar).catch(() => {});
    }
  });

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
      bar.querySelectorAll(".mrb-drag-over, .mrb-drag-over-right").forEach((el) => {
        el.classList.remove("mrb-drag-over", "mrb-drag-over-right");
      });
      dragSrcId = null;
    });

    // Drag/drop handled by bar-level listeners

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

      folder.addEventListener("mouseenter", () => {
        const parentDropdown = folder.closest(".mrb-dropdown");
        if (parentDropdown) {
          const rect = folder.getBoundingClientRect();
          dropdown.style.position = "fixed";
          dropdown.style.left = rect.right + 2 + "px";
          dropdown.style.top = rect.top + "px";
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

  function renderBar(bookmarks) {
    clearChildren(bar);

    const root = bookmarks[0];
    const bookmarksBar = root.children?.find(
      (c) => c.title === "Bookmarks bar" || c.title === "Bookmarks Bar" || c.title === "Bookmarks Toolbar" || c.title === "Bookmarks"
    );

    if (!bookmarksBar || !bookmarksBar.children) return;

    const items = bookmarksBar.children;

    if (bar.dataset.foldersRow === "true") {
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

  // ─── Init — load settings first, then render ───────
  chrome.storage.sync.get({ alignment: "center", textSize: 13, iconSize: 20, boldText: false, foldersOnSeparateLine: false }, (settings) => {
    applySettings(settings);
    chrome.bookmarks.getTree().then((tree) => {
      renderBar(tree);
      renderQuickLinks(tree);
    }).catch((err) => {
      console.error("[MRB-newtab]", err);
    });
  });

  const reload = () => chrome.bookmarks.getTree().then((tree) => {
    renderBar(tree);
    clearChildren(quickLinksEl);
    renderQuickLinks(tree);
  }).catch(() => {});

  chrome.bookmarks.onCreated.addListener(reload);
  chrome.bookmarks.onRemoved.addListener(reload);
  chrome.bookmarks.onChanged.addListener(reload);
  chrome.bookmarks.onMoved.addListener(reload);

  // ─── Context menu ─────────────────────────────────
  document.addEventListener("click", () => {
    const menu = document.getElementById("mrb-context-menu");
    if (menu) menu.remove();
  });

  function showContextMenu(e, node) {
    e.preventDefault();
    e.stopPropagation();

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
      items.push({ label: "Delete", action: () => chrome.bookmarks.remove(node.id) });
    } else if (node.children) {
      items.push({ label: "Open all in tabs", action: () => {
        node.children.filter(c => c.url).forEach(c => window.open(c.url, "_blank"));
      }});
      items.push({ type: "separator" });
      items.push({ label: "Rename...", action: () => editFolder(node) });
      items.push({ label: "Delete folder", action: () => chrome.bookmarks.removeTree(node.id) });
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

    document.body.appendChild(menu);
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 10);
    menu.style.left = x + "px";
    menu.style.top = y + "px";
  }

  function renameBookmark(node) {
    const title = prompt("Bookmark name:", node.title || "");
    if (title === null) return;
    chrome.bookmarks.update(node.id, { title });
  }

  function editBookmarkUrl(node) {
    const url = prompt("URL:", node.url || "");
    if (url === null) return;
    chrome.bookmarks.update(node.id, { url });
  }

  function editFolder(node) {
    const title = prompt("Folder name:", node.title || "");
    if (title === null) return;
    chrome.bookmarks.update(node.id, { title });
  }

  function addBookmark(node) {
    const title = prompt("New bookmark name:");
    if (!title) return;
    const url = prompt("URL:");
    if (!url) return;
    const parentId = node.children ? node.id : node.parentId;
    chrome.bookmarks.create({ parentId, title, url });
  }

  function addFolder(node) {
    const title = prompt("New folder name:");
    if (!title) return;
    const parentId = node.children ? node.id : node.parentId;
    chrome.bookmarks.create({ parentId, title });
  }
})();
