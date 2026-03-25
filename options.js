const bgColor = document.getElementById("bgColor");
const bgHex = document.getElementById("bgHex");
const rowsInput = document.getElementById("rows");
const savedMsg = document.getElementById("savedMsg");
const presets = document.querySelectorAll(".preset");

function showSaved() {
  savedMsg.classList.add("show");
  setTimeout(() => savedMsg.classList.remove("show"), 1500);
}

function save(settings) {
  chrome.storage.sync.set(settings, () => {
    showSaved();
    // Notify all tabs to re-render with new settings
    chrome.runtime.sendMessage({ type: "settingsChanged" });
  });
}

function updatePresetActive(color) {
  presets.forEach((p) => {
    p.classList.toggle("active", p.dataset.color === color);
  });
}

// Load saved settings
chrome.storage.sync.get({ bgColor: "#3b3b3f", rows: 2 }, (settings) => {
  bgColor.value = settings.bgColor;
  bgHex.value = settings.bgColor;
  rowsInput.value = settings.rows;
  updatePresetActive(settings.bgColor);
});

bgColor.addEventListener("input", () => {
  bgHex.value = bgColor.value;
  updatePresetActive(bgColor.value);
  save({ bgColor: bgColor.value });
});

bgHex.addEventListener("change", () => {
  let val = bgHex.value.trim();
  if (!val.startsWith("#")) val = "#" + val;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    bgColor.value = val;
    bgHex.value = val;
    updatePresetActive(val);
    save({ bgColor: val });
  }
});

presets.forEach((p) => {
  p.addEventListener("click", () => {
    const color = p.dataset.color;
    bgColor.value = color;
    bgHex.value = color;
    updatePresetActive(color);
    save({ bgColor: color });
  });
});

rowsInput.addEventListener("change", () => {
  const val = Math.max(1, Math.min(5, parseInt(rowsInput.value) || 2));
  rowsInput.value = val;
  save({ rows: val });
});
