// Service worker — reads bookmarks and injects them into pages

// Respond to content script requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (msg.type === "getBookmarks") {
    chrome.bookmarks.getTree().then((tree) => {
      sendResponse(tree);
    }).catch(() => sendResponse([]));
    return true;
  }

  if (msg.type === "settingsChanged") {
    notifyTabs();
    return;
  }

  if (msg.type === "moveBookmark") {
    chrome.bookmarks.get(String(msg.targetId)).then(([target]) => {
      const idx = msg.after ? target.index + 1 : target.index;
      return chrome.bookmarks.move(String(msg.sourceId), {
        parentId: String(target.parentId),
        index: Number(idx)
      });
    }).catch(() => {});
  }

  if (msg.type === "deleteBookmark") {
    chrome.bookmarks.getChildren(msg.id).then((children) => {
      return chrome.bookmarks.removeTree(msg.id);
    }).catch(() => {
      return chrome.bookmarks.remove(msg.id).catch(() => {});
    });
  }

  if (msg.type === "editBookmark") {
    const changes = {};
    if (msg.title !== undefined) changes.title = msg.title;
    if (msg.url !== undefined) changes.url = msg.url;
    chrome.bookmarks.update(msg.id, changes).catch(() => {});
  }

  if (msg.type === "addBookmark") {
    chrome.bookmarks.create({ parentId: msg.parentId, title: msg.title, url: msg.url }).catch(() => {});
  }

  if (msg.type === "addFolder") {
    chrome.bookmarks.create({ parentId: msg.parentId, title: msg.title }).catch(() => {});
  }

  if (msg.type === "openBookmarkManager") {
    chrome.tabs.create({ url: "chrome://bookmarks" });
  }
});

// Inject content script into tabs where it can't auto-inject (new tab, etc.)
async function injectIntoTab(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["bookmarks-bar.css"]
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["bookmarks-bar.js"]
    });
  } catch {
    // Tab might not support injection (chrome://, brave://)
  }
}

// When a tab is updated, try to inject
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Only inject on pages where content_scripts can't auto-run
    if (tab.url.startsWith("chrome://newtab") || tab.url.startsWith("brave://newtab") || tab.url === "about:blank") {
      injectIntoTab(tabId);
    }
  }
});

// Notify content scripts when bookmarks change
function notifyTabs() {
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "bookmarksChanged" }).catch(() => {});
      }
    }
  });
}

chrome.bookmarks.onCreated.addListener(notifyTabs);
chrome.bookmarks.onRemoved.addListener(notifyTabs);
chrome.bookmarks.onChanged.addListener(notifyTabs);
chrome.bookmarks.onMoved.addListener(notifyTabs);
