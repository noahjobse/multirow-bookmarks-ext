const Utils = require("./utils");

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
}

function assertEq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
  }
}

function suite(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ─── Tests ──────────────────────────────────────────

suite("isValidUrl", () => {
  assert(Utils.isValidUrl("https://example.com"), "https URL");
  assert(Utils.isValidUrl("http://example.com"), "http URL");
  assert(Utils.isValidUrl("HTTP://EXAMPLE.COM"), "case insensitive");
  assert(!Utils.isValidUrl(""), "empty string");
  assert(!Utils.isValidUrl("ftp://example.com"), "ftp rejected");
  assert(!Utils.isValidUrl("javascript:alert(1)"), "javascript: rejected");
  assert(!Utils.isValidUrl("example.com"), "no protocol rejected");
  assert(!Utils.isValidUrl("https://"), "protocol only rejected");
});

suite("isUrlLike", () => {
  assert(Utils.isUrlLike("https://example.com"), "full URL");
  assert(Utils.isUrlLike("example.com"), "domain-like");
  assert(Utils.isUrlLike("sub.example.co"), "subdomain");
  assert(!Utils.isUrlLike("search query"), "plain text");
  assert(!Utils.isUrlLike(""), "empty string");
});

suite("findBookmarksBarFolder", () => {
  const tree = [{ children: [
    { title: "Bookmarks bar", children: [{ url: "https://a.com" }] },
    { title: "Other bookmarks", children: [] },
  ]}];
  const result = Utils.findBookmarksBarFolder(tree);
  assertEq(result.title, "Bookmarks bar", "finds by standard title");

  const treeAlt = [{ children: [
    { title: "Bookmarks Toolbar", children: [] },
  ]}];
  const resultAlt = Utils.findBookmarksBarFolder(treeAlt);
  assertEq(resultAlt.title, "Bookmarks Toolbar", "finds Firefox-style title");

  const emptyTree = [{ children: [{ title: "Other", children: [] }] }];
  assertEq(Utils.findBookmarksBarFolder(emptyTree), null, "returns null if not found");

  const noChildren = [{}];
  assertEq(Utils.findBookmarksBarFolder(noChildren), null, "handles missing children");
});

suite("separateLinksAndFolders", () => {
  const items = [
    { title: "A", url: "https://a.com" },
    { title: "Folder", children: [{ url: "https://b.com" }] },
    { title: "B", url: "https://b.com" },
  ];
  const { links, folders } = Utils.separateLinksAndFolders(items);
  assertEq(links.length, 2, "finds 2 links");
  assertEq(folders.length, 1, "finds 1 folder");
  assertEq(folders[0].title, "Folder", "folder is correct");
});

suite("collectAllBookmarks", () => {
  const nodes = [
    { title: "A", url: "https://a.com" },
    { title: "Folder", children: [
      { title: "B", url: "https://b.com" },
      { title: "Sub", children: [
        { title: "C", url: "https://c.com" },
      ]},
    ]},
  ];
  const all = Utils.collectAllBookmarks(nodes);
  assertEq(all.length, 3, "finds all 3 bookmarks recursively");
  assertEq(all.map(b => b.title), ["A", "B", "C"], "correct order");
});

suite("getTopBookmarks", () => {
  const bookmarks = [
    { title: "Old", dateLastUsed: 100 },
    { title: "Newest", dateLastUsed: 300 },
    { title: "Middle", dateLastUsed: 200 },
    { title: "Never" },
  ];
  const top2 = Utils.getTopBookmarks(bookmarks, 2);
  assertEq(top2.length, 2, "returns 2");
  assertEq(top2[0].title, "Newest", "most recent first");
  assertEq(top2[1].title, "Middle", "second most recent");

  const top10 = Utils.getTopBookmarks(bookmarks, 10);
  assertEq(top10.length, 4, "returns all if count > available");
});

suite("getBookmarkLabel", () => {
  assertEq(
    Utils.getBookmarkLabel({ url: "https://www.example.com/page", title: "Example" }),
    "example.com",
    "strips www and returns hostname"
  );
  assertEq(
    Utils.getBookmarkLabel({ url: "https://sub.example.co.uk/path", title: "UK" }),
    "sub.example.co.uk",
    "preserves subdomains"
  );
  assertEq(
    Utils.getBookmarkLabel({ url: "not a url", title: "Fallback" }),
    "Fallback",
    "falls back to title for invalid URL"
  );
  assertEq(
    Utils.getBookmarkLabel({ url: "not a url" }),
    "",
    "returns empty string if no title"
  );
});

suite("calculateDropIndex", () => {
  assertEq(Utils.calculateDropIndex(3, true), 4, "insert after");
  assertEq(Utils.calculateDropIndex(3, false), 3, "insert before");
  assertEq(Utils.calculateDropIndex(0, false), 0, "insert at start");
  assertEq(Utils.calculateDropIndex(0, true), 1, "insert after first");
});

suite("formatTime", () => {
  assertEq(Utils.formatTime(new Date(2026, 0, 1, 9, 5)), "9:05", "pads minutes");
  assertEq(Utils.formatTime(new Date(2026, 0, 1, 13, 30)), "13:30", "24h format");
  assertEq(Utils.formatTime(new Date(2026, 0, 1, 0, 0)), "0:00", "midnight");
});

suite("faviconUrl", () => {
  const result = Utils.faviconUrl("https://example.com", "test-ext-id");
  assert(result.includes("test-ext-id"), "includes extension ID");
  assert(result.includes(encodeURIComponent("https://example.com")), "encodes page URL");
  assert(result.includes("size=16"), "requests 16px");

  assertEq(Utils.faviconUrl("not-a-url", "id"), null, "returns null for invalid URL");
});

// ─── Results ────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed!");
}
