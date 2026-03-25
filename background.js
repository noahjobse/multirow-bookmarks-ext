// Service worker — reads bookmarks and injects them into pages

// Respond to content script requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getBookmarks") {
    chrome.bookmarks.getTree().then((tree) => {
      sendResponse(tree);
    });
    return true;
  }

  if (msg.type === "moveBookmark") {
    // Get the target's current position, then move source to that index
    chrome.bookmarks.get(msg.targetId).then(([target]) => {
      const idx = msg.after ? target.index + 1 : target.index;
      chrome.bookmarks.move(msg.sourceId, {
        parentId: target.parentId,
        index: idx
      });
    });
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
