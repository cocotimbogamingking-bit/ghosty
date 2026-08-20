// Ads
// settings.js
document.addEventListener("DOMContentLoaded", () => {
  function adChange(selectedValue) {
    if (selectedValue === "default") {
      localStorage.setItem("ads", "on");
    } else if (selectedValue === "popups") {
      localStorage.setItem("ads", "popups");
    } else if (selectedValue === "off") {
      localStorage.setItem("ads", "off");
    }
  }

  const adTypeElement = document.getElementById("adType");

  if (adTypeElement) {
    adTypeElement.addEventListener("change", function () {
      const selectedOption = this.value;
      adChange(selectedOption);
    });

    const storedAd = localStorage.getItem("ads");
    if (storedAd === "on") {
      adTypeElement.value = "default";
    } else if (storedAd === "popups") {
      adTypeElement.value = "popups";
    } else if (storedAd === "off") {
      adTypeElement.value = "off";
    } else {
      adTypeElement.value = "default";
    }
  }
  // Makes the custom icon and name persistent
  const iconElement = document.getElementById("icon");
  const nameElement = document.getElementById("name");
  const customIcon = localStorage.getItem("CustomIcon");
  const customName = localStorage.getItem("CustomName");
  if (iconElement) iconElement.value = customIcon || "";
  if (nameElement) nameElement.value = customName || "";

  const abSwitch = document.getElementById("ab-settings-switch");
  if (abSwitch && localStorage.getItem("ab") === "true") {
    abSwitch.checked = true;
  }
});

// Dyn
document.addEventListener("DOMContentLoaded", () => {
  function pChange(selectedValue) {
    localStorage.setItem("dy", selectedValue === "dy" ? "true" : "false");
    localStorage.setItem("uv", selectedValue === "uv" ? "true" : "false");
    localStorage.setItem("proxyEngine", selectedValue === "uv" ? "uv" : "scramjet");
  }

  const pChangeElement = document.getElementById("pChange");

  if (pChangeElement) {
    pChangeElement.addEventListener("change", function () {
      pChange(this.value);
    });

    if (localStorage.getItem("dy") === "true") {
      pChangeElement.value = "dy";
    } else if (localStorage.getItem("proxyEngine") === "uv") {
      pChangeElement.value = "uv";
    } else {
      pChangeElement.value = "sj";
    }
  }
});

// Key
let eventKey = localStorage.getItem("eventKey") || "`";
let eventKeyRaw = localStorage.getItem("eventKeyRaw") || "`";
let pLink = localStorage.getItem("pLink") || "https://classroom.google.com/";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("eventKeyInput").value = eventKeyRaw;
  document.getElementById("linkInput").value = pLink;

  const selectedOption = localStorage.getItem("selectedOption");
  if (selectedOption) {
    updateHeadSection(selectedOption);
  }
});

const eventKeyInput = document.getElementById("eventKeyInput");
eventKeyInput.addEventListener("input", () => {
  eventKey = eventKeyInput.value.split(",");
});

const linkInput = document.getElementById("linkInput");
linkInput.addEventListener("input", () => {
  pLink = linkInput.value;
});

function saveEventKey() {
  eventKey = eventKeyInput.value.split(",");
  eventKeyRaw = eventKeyInput.value;
  localStorage.setItem("eventKey", JSON.stringify(eventKey));
  localStorage.setItem("pLink", pLink);
  localStorage.setItem("eventKeyRaw", eventKeyRaw);
  // biome-ignore lint: idk
  window.location = window.location;
}
const dropdown = document.getElementById("dropdown");
const options = dropdown.getElementsByTagName("option");

const sortedOptions = Array.from(options).sort((a, b) => a.textContent.localeCompare(b.textContent));

while (dropdown.firstChild) {
  dropdown.removeChild(dropdown.firstChild);
}

for (const option of sortedOptions) {
  dropdown.appendChild(option);
}

function saveIcon() {
  const iconElement = document.getElementById("icon");
  if (!iconElement) return;
  localStorage.setItem("icon", iconElement.value);
}

function saveName() {
  const nameElement = document.getElementById("name");
  if (!nameElement) return;
  localStorage.setItem("name", nameElement.value);
}

function CustomIcon() {
  const iconElement = document.getElementById("icon");
  if (!iconElement) return;
  localStorage.setItem("CustomIcon", iconElement.value);
}

function CustomName() {
  const nameElement = document.getElementById("name");
  if (!nameElement) return;
  localStorage.setItem("CustomName", nameElement.value);
}
function ResetCustomCloak() {
  localStorage.removeItem("CustomName");
  localStorage.removeItem("CustomIcon");
  const iconElement = document.getElementById("icon");
  const nameElement = document.getElementById("name");
  if (iconElement) iconElement.value = "";
  if (nameElement) nameElement.value = "";
}

function redirectToMainDomain() {
  const currentUrl = window.location.href;
  const mainDomainUrl = currentUrl.replace(/\/[^/]*$/, "");
  const target = mainDomainUrl + window.location.pathname;
  if (window !== top) {
    try {
      top.location.href = target;
    } catch {
      try {
        parent.location.href = target;
      } catch {
        window.location.href = target;
      }
    }
  } else window.location.href = mainDomainUrl + window.location.pathname;
}

document.addEventListener("DOMContentLoaded", event => {
  const icon = document.getElementById("tab-favicon");
  const name = document.getElementById("t");
  // "Default" is not one of the options, so it left the select showing an empty row.
  const stored = localStorage.getItem("selectedOption");
  const picker = document.getElementById("dropdown");
  const known = stored && [...picker.options].some(option => option.value === stored);
  const fallback = [...picker.options].some(option => option.value === "Classroom")
    ? "Classroom"
    : picker.options[0].value;
  const selectedValue = known ? stored : fallback;
  picker.value = selectedValue;
  updateHeadSection(selectedValue);
});

function handleDropdownChange(selectElement) {
  const selectedValue = selectElement.value;
  localStorage.removeItem("CustomName");
  localStorage.removeItem("CustomIcon");
  localStorage.setItem("selectedOption", selectedValue);
  updateHeadSection(selectedValue);
  redirectToMainDomain(selectedValue);
}

function updateHeadSection(selectedValue) {
  const icon = document.getElementById("tab-favicon");
  const name = document.getElementById("t");
  const customName = localStorage.getItem("CustomName");
  const customIcon = localStorage.getItem("CustomIcon");

  if (customName && customIcon) {
    name.textContent = customName;
    icon.setAttribute("href", customIcon);
    localStorage.setItem("name", customName);
    localStorage.setItem("icon", customIcon);
  }
}
// Custom Background
document.addEventListener("DOMContentLoaded", () => {
  const saveButton = document.getElementById("save-button");
  const backgroundInput = document.getElementById("background-input");
  const resetButton = document.getElementById("reset-button");

  saveButton.addEventListener("click", () => {
    const imageURL = backgroundInput.value;
    if (imageURL.trim() !== "") {
      localStorage.setItem("backgroundImage", imageURL);
      document.body.style.backgroundImage = `url('${imageURL}')`;
      backgroundInput.value = "";
    } else {
      console.log("No image URL entered.");
    }
  });

  resetButton.addEventListener("click", () => {
    localStorage.removeItem("backgroundImage");
    document.body.style.backgroundImage = "url('default-background.jpg')";
    window.location.reload();
  });
});

// Particles
const switches = document.getElementById("2");

if (window.localStorage.getItem("particles") !== "") {
  if (window.localStorage.getItem("particles") === "true") {
    switches.checked = true;
  } else {
    switches.checked = false;
  }
}

switches.addEventListener("change", event => {
  if (event.currentTarget.checked) {
    window.localStorage.setItem("particles", "true");
  } else {
    window.localStorage.setItem("particles", "false");
  }
});
// AB Cloak
function AB() {
  let inFrame;

  try {
    inFrame = window !== top;
  } catch (e) {
    inFrame = true;
  }

  if (!inFrame && !navigator.userAgent.includes("Firefox")) {
    const popup = open("about:blank", "_blank");
    if (!popup || popup.closed) {
      // alert disabled by user request
    } else {
      const doc = popup.document;
      const iframe = doc.createElement("iframe");
      const style = iframe.style;
      const link = doc.createElement("link");

      const name = localStorage.getItem("name") || "My Drive - Google Drive";
      const icon = localStorage.getItem("icon") || "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png";

      doc.title = name;
      link.rel = "icon";
      link.href = icon;

      iframe.src = location.href;
      style.position = "fixed";
      style.top = style.bottom = style.left = style.right = 0;
      style.border = style.outline = "none";
      style.width = style.height = "100%";

      const pLink = localStorage.getItem(encodeURI("pLink")) || getRandomURL();
      location.replace(pLink);

      const script = doc.createElement("script");
      script.textContent = `
        window.onbeforeunload = function (event) {
          const confirmationMessage = 'Leave Site?';
          (event || window.event).returnValue = confirmationMessage;
          return confirmationMessage;
        };
      `;
      doc.head.appendChild(link);
      doc.body.appendChild(iframe);
      doc.head.appendChild(script);
    }
  }
}

// ── ad blocking, rescued hosts ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("block-switch");
  const count = document.getElementById("block-count");
  if (toggle) {
    const sync = () => {
      toggle.checked = window.__ghosty ? window.__ghosty.blocking() : true;
    };
    setTimeout(sync, 400);
    toggle.addEventListener("change", () => {
      if (window.__ghosty) window.__ghosty.blocking(toggle.checked);
    });
  }
  if (count) {
    // The worker owns the tally; asking it beats keeping a second copy in sync. The
    // split matters: one number is requests that never left, the other is responses
    // that were edited, and calling both "blocked" would overstate what happened.
    const detail = document.getElementById("block-detail");
    const paint = () => {
      const stats = window.__ghosty ? window.__ghosty.blockStats() : { requests: 0, players: 0 };
      count.textContent = String(stats.requests + stats.players);
      if (detail) {
        detail.textContent =
          stats.requests + " requests stopped · " + stats.players + " YouTube responses cleaned";
      }
    };
    window.addEventListener("ghosty:blocked", paint);
    setTimeout(paint, 600);
  }
  renderRescued();
});

function renderRescued() {
  const list = document.getElementById("rescued-list");
  if (!list) return;
  const hosts = window.__ghosty ? window.__ghosty.rescued() : [];
  list.innerHTML = "";
  if (!hosts.length) {
    const empty = document.createElement("span");
    empty.className = "pill-empty";
    empty.textContent = "Nothing has needed the fallback yet.";
    list.appendChild(empty);
    return;
  }
  for (const host of hosts) {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "pill";
    pill.title = "Remove " + host;
    pill.innerHTML = host + ' <i class="fa-solid fa-xmark"></i>';
    pill.addEventListener("click", () => {
      window.__ghosty.unpin(host);
      renderRescued();
    });
    list.appendChild(pill);
  }
}

function clearRescued() {
  for (const host of window.__ghosty ? window.__ghosty.rescued() : []) window.__ghosty.unpin(host);
  renderRescued();
}

function toggleAB() {
  const abSwitch = document.getElementById("ab-settings-switch");
  localStorage.setItem("ab", abSwitch && abSwitch.checked ? "true" : "false");
}
// Search Engine
function EngineChange(dropdown) {
  const selectedEngine = dropdown.value;

  const engineUrls = {
    Brave: "https://search.brave.com/search?q=",
    Google: "https://www.google.com/search?q=",
    Bing: "https://www.bing.com/search?q=",
    Startpage: "https://www.startpage.com/search?q=",
    DuckDuckGo: "https://duckduckgo.com/?q=",
  };

  const engineUrl = engineUrls[selectedEngine];
  if (!engineUrl) return;

  localStorage.setItem("engine", engineUrl);
  localStorage.setItem("enginename", selectedEngine);

  dropdown.value = selectedEngine;
}

function SaveEngine() {
  const customEngine = document.getElementById("engine-form").value;
  if (customEngine.trim() !== "") {
    localStorage.setItem("engine", customEngine);
    localStorage.setItem("enginename", "Custom");
  } else {
    alert("Please enter a custom search engine value.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const selectedEngineName = localStorage.getItem("enginename");
  const dropdown = document.getElementById("engine");
  if (selectedEngineName) {
    dropdown.value = selectedEngineName;
  }
});

function getRandomURL() {
  const randomURLS = [
    "https://kahoot.it",
    "https://classroom.google.com",
    "https://drive.google.com",
    "https://google.com",
    "https://docs.google.com",
    "https://slides.google.com",
    "https://www.nasa.gov",
    "https://blooket.com",
    "https://clever.com",
    "https://edpuzzle.com",
    "https://khanacademy.org",
    "https://wikipedia.org",
    "https://dictionary.com",
  ];
  return randomURLS[randRange(0, randomURLS.length)];
}

function randRange(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function exportSaveData() {
  function getCookies() {
    const cookies = document.cookie.split("; ");
    const cookieObj = {};
    cookies.forEach(cookie => {
      const [name, value] = cookie.split("=");
      cookieObj[name] = value;
    });
    return cookieObj;
  }
  function getLocalStorage() {
    const localStorageObj = {};
    for (const key in localStorage) {
      if (Object.hasOwn(localStorage, key)) {
        localStorageObj[key] = localStorage.getItem(key);
      }
    }
    return localStorageObj;
  }
  const data = {
    cookies: getCookies(),
    localStorage: getLocalStorage(),
  };
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "save_data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importSaveData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.cookies) {
          Object.entries(data.cookies).forEach(([key, value]) => {
            document.cookie = `${key}=${value}; path=/`;
          });
        }
        if (data.localStorage) {
          Object.entries(data.localStorage).forEach(([key, value]) => {
            localStorage.setItem(key, value);
          });
        }
        alert("Your save data has been imported. Please test it out.");
        alert("If you find any issues then report it in GitHub or the Interstellar Discord.");
      } catch (error) {
        console.error("Error parsing JSON file:", error);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
