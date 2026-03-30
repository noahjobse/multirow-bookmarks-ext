// Shared pure utility functions — used by bookmarks-bar.js, newtab.js, and tests

const Utils = (() => {
  "use strict";

  const BOOKMARKS_BAR_TITLES = [
    "Bookmarks bar",
    "Bookmarks Bar",
    "Bookmarks Toolbar",
    "Bookmarks",
  ];

  function findBookmarksBarFolder(tree) {
    const root = tree[0];
    if (!root || !root.children) return null;
    return root.children.find((c) => BOOKMARKS_BAR_TITLES.includes(c.title)) || null;
  }

  function isValidUrl(str) {
    return /^https?:\/\/.+/i.test(str);
  }

  function isUrlLike(query) {
    return /^(https?:\/\/|[a-z0-9-]+\.[a-z]{2,})/i.test(query);
  }

  function faviconUrl(pageUrl, extensionId) {
    try {
      new URL(pageUrl);
    } catch {
      return null;
    }
    const base = extensionId
      ? `chrome-extension://${extensionId}/_favicon/?pageUrl=`
      : `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=`;
    return base + encodeURIComponent(pageUrl) + "&size=16";
  }

  function separateLinksAndFolders(items) {
    return {
      links: items.filter((n) => n.url),
      folders: items.filter((n) => n.children),
    };
  }

  function collectAllBookmarks(nodes) {
    const result = [];
    function walk(list) {
      for (const n of list) {
        if (n.url) result.push(n);
        if (n.children) walk(n.children);
      }
    }
    walk(nodes);
    return result;
  }

  function getTopBookmarks(bookmarks, count) {
    return [...bookmarks]
      .sort((a, b) => (b.dateLastUsed || 0) - (a.dateLastUsed || 0))
      .slice(0, count);
  }

  function getBookmarkLabel(bookmark) {
    try {
      return new URL(bookmark.url).hostname.replace(/^www\./, "");
    } catch {
      return bookmark.title || "";
    }
  }

  function calculateDropIndex(targetIndex, insertAfter) {
    return insertAfter ? targetIndex + 1 : targetIndex;
  }

  function formatTime(date) {
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  return {
    BOOKMARKS_BAR_TITLES,
    findBookmarksBarFolder,
    isValidUrl,
    isUrlLike,
    faviconUrl,
    separateLinksAndFolders,
    collectAllBookmarks,
    getTopBookmarks,
    getBookmarkLabel,
    calculateDropIndex,
    formatTime,
  };
})();

if (typeof module !== "undefined") {
  module.exports = Utils;
}
