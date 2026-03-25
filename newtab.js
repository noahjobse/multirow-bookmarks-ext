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
  }

  function applyTheme() {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    bar.classList.toggle("mrb-light", !isDark);
    bar.style.background = isDark ? "#3b3b3f" : "#f1f3f5";
    bar.style.setProperty("--mrb-text", isDark ? "#cfd1d6" : "#444");
  }
  applyTheme();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  chrome.storage.sync.get({ alignment: "center", textSize: 13, iconSize: 20, boldText: false }, (settings) => {
    applySettings(settings);
  });

  chrome.storage.onChanged.addListener((changes) => {
    const updated = {};
    if (changes.bgColor) updated.bgColor = changes.bgColor.newValue;
    if (changes.textColor) updated.textColor = changes.textColor.newValue;
    if (changes.alignment) updated.alignment = changes.alignment.newValue;
    if (changes.itemSize) updated.itemSize = changes.itemSize.newValue;
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

    wrapper.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (wrapper.dataset.bookmarkId !== dragSrcId) {
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
        chrome.bookmarks.get(targetId).then(([target]) => {
          const idx = isRight ? target.index + 1 : target.index;
          chrome.bookmarks.move(dragSrcId, {
            parentId: target.parentId,
            index: idx
          });
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
      a.draggable = false;

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
      ph.classList.add("mrb-folder-icon");
      ph.style.background = "none";
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

  function renderBar(bookmarks) {
    clearChildren(bar);

    const root = bookmarks[0];
    const bookmarksBar = root.children?.find(
      (c) => c.title === "Bookmarks bar" || c.title === "Bookmarks Bar" || c.title === "Bookmarks Toolbar" || c.title === "Bookmarks"
    );

    if (!bookmarksBar || !bookmarksBar.children) return;

    bookmarksBar.children.forEach((node) => {
      const el = createBookmarkEl(node);
      if (el) bar.appendChild(el);
    });

    document.body.insertBefore(bar, document.body.firstChild);

    requestAnimationFrame(() => {
      const h = bar.offsetHeight;
      document.documentElement.style.setProperty("--mrb-height", `${h}px`);
      document.documentElement.classList.add("mrb-active");
    });
  }

  // ─── Init ──────────────────────────────────────────
  chrome.bookmarks.getTree().then((tree) => {
    renderBar(tree);
    renderQuickLinks(tree);
  }).catch((err) => {
    console.error("[MRB-newtab]", err);
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
})();
