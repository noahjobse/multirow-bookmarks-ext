const textSizeSlider = document.getElementById("textSize");
const textSizeVal = document.getElementById("textSizeVal");
const iconSizeSlider = document.getElementById("iconSize");
const iconSizeVal = document.getElementById("iconSizeVal");
const boldText = document.getElementById("boldText");
const savedMsg = document.getElementById("savedMsg");
const alignBtns = document.querySelectorAll("#alignment .btn");

function showSaved() {
  savedMsg.classList.add("show");
  setTimeout(() => savedMsg.classList.remove("show"), 1500);
}

function save(settings) {
  chrome.storage.sync.set(settings, () => {
    showSaved();
    chrome.runtime.sendMessage({ type: "settingsChanged" });
  });
}

const defaults = { alignment: "center", textSize: 13, iconSize: 20, boldText: false };
chrome.storage.sync.get(defaults, (settings) => {
  textSizeSlider.value = settings.textSize;
  textSizeVal.textContent = settings.textSize + "px";
  iconSizeSlider.value = settings.iconSize;
  iconSizeVal.textContent = settings.iconSize + "px";
  alignBtns.forEach((b) => b.classList.toggle("active", b.dataset.value === settings.alignment));
  boldText.checked = settings.boldText;
});

// Alignment
alignBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    alignBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    save({ alignment: btn.dataset.value });
  });
});

// Text size
textSizeSlider.addEventListener("input", () => {
  textSizeVal.textContent = textSizeSlider.value + "px";
  save({ textSize: parseInt(textSizeSlider.value) });
});

// Icon size
iconSizeSlider.addEventListener("input", () => {
  iconSizeVal.textContent = iconSizeSlider.value + "px";
  save({ iconSize: parseInt(iconSizeSlider.value) });
});

// Bold text
boldText.addEventListener("change", () => {
  save({ boldText: boldText.checked });
});
