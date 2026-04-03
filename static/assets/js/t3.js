// tabs.js — Improved Tab System
window.addEventListener("load", () => {
  navigator.serviceWorker.register("../sw.js?v=2025-04-15", { scope: "/a/" });
  const form = document.getElementById("fv");
  const input = document.getElementById("input");
  if (form && input) {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const formValue = input.value.trim();
      if (!formValue) return;
      const engine = localStorage.getItem("engine") || "https://search.brave.com/search?q=";
      const url = isUrl(formValue) ? prependHttps(formValue) : `${engine}${formValue}`;
      processUrl(url);
    });
  }
  function processUrl(url) {
    sessionStorage.setItem("GoUrl", __uv$config.encodeUrl(url));
    const iframeContainer = document.getElementById("frame-container");
    const activeIframe = iframeContainer.querySelector("iframe.active");
    if (activeIframe) {
      activeIframe.src = `/a/${__uv$config.encodeUrl(url)}`;
      activeIframe.dataset.tabUrl = url;
      input.value = url;
    }
  }
  function isUrl(val = "") {
    if (/^http(s?):\/\//.test(val) || (val.includes(".") && val.substr(0, 1) !== " ")) {
      return true;
    }
    return false;
  }
  function prependHttps(url) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`;
    }
    return url;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const addTabButton = document.getElementById("add-tab");
  const tabList = document.getElementById("tab-list");
  const iframeContainer = document.getElementById("frame-container");
  let tabCounter = 0;

  addTabButton.addEventListener("click", () => {
    createNewTab();
  });

  function createNewTab(urlOverride) {
    tabCounter++;
    const newTab = document.createElement("li");
    const tabTitle = document.createElement("span");
    const newIframe = document.createElement("iframe");

    newIframe.sandbox = "allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-modals allow-orientation-lock allow-presentation allow-storage-access-by-user-activation";

    tabTitle.textContent = "New Tab";
    tabTitle.className = "t";
    newTab.dataset.tabId = tabCounter;

    newTab.addEventListener("click", switchTab);
    newTab.setAttribute("draggable", true);

    const closeButton = document.createElement("button");
    closeButton.classList.add("close-tab");
    closeButton.innerHTML = "&#10005;";
    closeButton.addEventListener("click", closeTab);

    newTab.appendChild(tabTitle);
    newTab.appendChild(closeButton);
    tabList.appendChild(newTab);

    // Deactivate all existing tabs
    deactivateAllTabs();

    // Activate new tab
    newTab.classList.add("active");
    newIframe.dataset.tabId = tabCounter;
    newIframe.classList.add("active");

    // Listen for iframe load to update tab title & URL bar
    newIframe.addEventListener("load", () => {
      try {
        const title = newIframe.contentDocument?.title;
        if (title && title.length > 1) {
          tabTitle.textContent = title;
        } else {
          tabTitle.textContent = "Tab";
        }
      } catch {
        tabTitle.textContent = "Tab";
      }

      // Intercept window.open to create new tabs
      try {
        newIframe.contentWindow.open = url => {
          sessionStorage.setItem("URL", `/a/${__uv$config.encodeUrl(url)}`);
          createNewTab();
          return null;
        };
      } catch { }

      // Update URL bar for active tab
      updateUrlBar();
    });

    // Determine what URL to load
    let targetSrc = "/";

    if (urlOverride) {
      targetSrc = urlOverride;
    } else {
      const goUrl = sessionStorage.getItem("GoUrl");
      const url = sessionStorage.getItem("URL");

      if (url) {
        targetSrc = window.location.origin + url;
        sessionStorage.removeItem("URL");
      } else if (goUrl) {
        if (goUrl.includes("/e/")) {
          targetSrc = window.location.origin + goUrl;
        } else {
          targetSrc = `${window.location.origin}/a/${goUrl}`;
        }
        // Only use GoUrl for the first tab
        if (tabCounter > 1) {
          targetSrc = "/";
        }
      }
    }

    newIframe.src = targetSrc;
    iframeContainer.appendChild(newIframe);

    // Scroll tab into view
    setTimeout(() => {
      newTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "end" });
    }, 50);

    updateUrlBar();
    updateTabCount();
  }

  function deactivateAllTabs() {
    tabList.querySelectorAll("li").forEach(tab => tab.classList.remove("active"));
    iframeContainer.querySelectorAll("iframe").forEach(iframe => iframe.classList.remove("active"));
  }

  function closeTab(event) {
    event.stopPropagation();
    const tabElement = event.target.closest("li");
    const tabId = tabElement.dataset.tabId;
    const isActive = tabElement.classList.contains("active");
    const iframeToRemove = iframeContainer.querySelector(`[data-tab-id='${tabId}']`);

    // Find adjacent tab before removing
    let tabToActivate = null;
    if (isActive) {
      // Prefer the tab to the right, then left
      tabToActivate = tabElement.nextElementSibling || tabElement.previousElementSibling;
    }

    // Remove elements
    tabElement.remove();
    if (iframeToRemove) {
      iframeToRemove.src = "about:blank"; // Free memory
      iframeToRemove.remove();
    }

    // Activate adjacent tab if the closed one was active
    if (isActive && tabToActivate) {
      const nextId = tabToActivate.dataset.tabId;
      tabToActivate.classList.add("active");
      const nextIframe = iframeContainer.querySelector(`[data-tab-id='${nextId}']`);
      if (nextIframe) nextIframe.classList.add("active");
      updateUrlBar();
    }

    // If no tabs left, create a fresh one
    const remainingTabs = tabList.querySelectorAll("li");
    if (remainingTabs.length === 0) {
      document.getElementById("input").value = "";
      createNewTab("/");
    }

    updateTabCount();
  }

  function switchTab(event) {
    const tabElement = event.target.closest("li");
    if (!tabElement || tabElement.classList.contains("active")) return;
    const tabId = tabElement.dataset.tabId;

    deactivateAllTabs();

    tabElement.classList.add("active");
    const selectedIframe = iframeContainer.querySelector(`[data-tab-id='${tabId}']`);
    if (selectedIframe) {
      selectedIframe.classList.add("active");
    }

    updateUrlBar();
  }

  // Drag and drop tab reordering
  let dragTab = null;

  tabList.addEventListener("dragstart", event => {
    dragTab = event.target.closest("li");
    if (dragTab) {
      dragTab.style.opacity = "0.5";
      event.dataTransfer.effectAllowed = "move";
    }
  });

  tabList.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const targetTab = event.target.closest("li");
    if (targetTab && targetTab !== dragTab && dragTab) {
      const targetRect = targetTab.getBoundingClientRect();
      const midX = targetRect.left + targetRect.width / 2;
      if (event.clientX < midX) {
        tabList.insertBefore(dragTab, targetTab);
      } else {
        tabList.insertBefore(dragTab, targetTab.nextSibling);
      }
    }
  });

  tabList.addEventListener("dragend", () => {
    if (dragTab) {
      dragTab.style.opacity = "1";
      dragTab = null;
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", event => {
    // Ctrl+T = New Tab
    if ((event.ctrlKey || event.metaKey) && event.key === "t") {
      event.preventDefault();
      createNewTab("/");
    }
    // Ctrl+W = Close active tab
    if ((event.ctrlKey || event.metaKey) && event.key === "w") {
      event.preventDefault();
      const activeTab = tabList.querySelector("li.active");
      if (activeTab) {
        const closeBtn = activeTab.querySelector(".close-tab");
        if (closeBtn) closeBtn.click();
      }
    }
    // Ctrl+Tab = Next tab
    if (event.ctrlKey && event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      cycleTab(1);
    }
    // Ctrl+Shift+Tab = Previous tab
    if (event.ctrlKey && event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      cycleTab(-1);
    }
    // Alt+Left = Back
    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      goBack();
    }
    // Alt+Right = Forward
    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      goForward();
    }
    // F5 = Reload
    if (event.key === "F5") {
      event.preventDefault();
      reload();
    }
  });

  function cycleTab(direction) {
    const tabs = Array.from(tabList.querySelectorAll("li"));
    if (tabs.length < 2) return;
    const activeIndex = tabs.findIndex(t => t.classList.contains("active"));
    let nextIndex = (activeIndex + direction + tabs.length) % tabs.length;
    tabs[activeIndex].classList.remove("active");
    tabs[nextIndex].classList.add("active");

    const allIframes = iframeContainer.querySelectorAll("iframe");
    allIframes.forEach(f => f.classList.remove("active"));
    const nextIframe = iframeContainer.querySelector(`[data-tab-id='${tabs[nextIndex].dataset.tabId}']`);
    if (nextIframe) nextIframe.classList.add("active");

    updateUrlBar();
  }

  function updateTabCount() {
    const count = tabList.querySelectorAll("li").length;
    // Update bottom bar if it exists
    const bb = document.querySelector(".bb-left");
    if (bb) {
      bb.innerHTML = `${count} tab${count !== 1 ? 's' : ''}`;
    }
  }

  // Create initial tab
  createNewTab();
});

// URL Bar update
function updateUrlBar() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  const input = document.getElementById("input");
  if (!activeIframe || !input) return;

  try {
    if (activeIframe.contentWindow && activeIframe.contentWindow.document.readyState === "complete") {
      const website = activeIframe.contentWindow.document.location.href;
      if (website.includes("/a/q/")) {
        const websitePath = website.replace(window.location.origin, "").replace("/a/q/", "");
        input.value = decodeXor(websitePath);
      } else if (website.includes("/a/")) {
        const websitePath = website.replace(window.location.origin, "").replace("/a/", "");
        input.value = decodeXor(websitePath);
      } else {
        const websitePath = website.replace(window.location.origin, "");
        input.value = websitePath === "/" ? "" : websitePath;
      }
    }
  } catch {
    // Cross-origin - can't read URL
  }
}

// Reload
function reload() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (activeIframe) {
    activeIframe.src = activeIframe.src;
  }
}

// Popout
function popout() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (!activeIframe) return;

  const newWindow = window.open("about:blank", "_blank");
  if (newWindow) {
    const name = localStorage.getItem("name") || "My Drive - Google Drive";
    const icon = localStorage.getItem("icon") || "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png";
    newWindow.document.title = name;
    const link = newWindow.document.createElement("link");
    link.rel = "icon";
    link.href = encodeURI(icon);
    newWindow.document.head.appendChild(link);

    const newIframe = newWindow.document.createElement("iframe");
    const style = newIframe.style;
    style.position = "fixed";
    style.top = style.bottom = style.left = style.right = "0";
    style.border = style.outline = "none";
    style.width = style.height = "100%";
    newIframe.src = activeIframe.src;
    newWindow.document.body.appendChild(newIframe);
  }
}

// Eruda toggle
function eToggle() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (!activeIframe) return;

  try {
    const erudaWindow = activeIframe.contentWindow;
    if (!erudaWindow) return;

    if (erudaWindow.eruda) {
      if (erudaWindow.eruda._isInit) {
        erudaWindow.eruda.destroy();
      }
    } else {
      const erudaDocument = activeIframe.contentDocument;
      if (!erudaDocument) return;
      const script = erudaDocument.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/eruda";
      script.onload = () => {
        if (erudaWindow.eruda) {
          erudaWindow.eruda.init();
          erudaWindow.eruda.show();
        }
      };
      erudaDocument.head.appendChild(script);
    }
  } catch { }
}

// Fullscreen
function FS() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (!activeIframe) return;

  try {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      activeIframe.requestFullscreen();
    }
  } catch { }
}

const fullscreenButton = document.getElementById("fullscreen-button");
if (fullscreenButton) fullscreenButton.addEventListener("click", FS);

// Home
function Home() {
  window.location.href = "./";
}
const homeButton = document.getElementById("home-page");
if (homeButton) homeButton.addEventListener("click", Home);

// Back — FIXED: was using undefined 'iframe' variable
function goBack() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (activeIframe) {
    try {
      activeIframe.contentWindow.history.back();
      setTimeout(updateUrlBar, 500);
    } catch { }
  }
}

// Forward — FIXED: was using undefined 'iframe' variable
function goForward() {
  const activeIframe = document.querySelector("#frame-container iframe.active");
  if (activeIframe) {
    try {
      activeIframe.contentWindow.history.forward();
      setTimeout(updateUrlBar, 500);
    } catch { }
  }
}

// Toggle tabs sidebar
document.addEventListener("DOMContentLoaded", () => {
  const tb = document.getElementById("tabs-button");
  const nb = document.getElementById("right-side-nav");
  if (tb && nb) {
    tb.addEventListener("click", () => {
      if (nb.style.display === "none") {
        nb.style.display = "flex";
        tb.style.color = "var(--primary)";
      } else {
        nb.style.display = "none";
        tb.style.color = "var(--text-secondary)";
      }
    });
  }
});

// Keyboard lock for Chrome
if (navigator.userAgent.includes("Chrome") && navigator.keyboard) {
  try {
    navigator.keyboard.lock(["Escape"]);
  } catch { }
}

// XOR decode for URL bar
function decodeXor(input) {
  if (!input) return input;
  const [str, ...search] = input.split("?");
  return (
    decodeURIComponent(str)
      .split("")
      .map((char, ind) => (ind % 2 ? String.fromCharCode(char.charCodeAt(Number.NaN) ^ 2) : char))
      .join("") + (search.length ? `?${search.join("?")}` : "")
  );
}
