// Stealth blackout for the browsing area.
//
// The honest limit first: a web page cannot be black in a screen recording and full
// to the eye at the same instant. There is one framebuffer, and a capturer reads the
// same pixels the monitor shows. Only DRM video escapes that, and a page cannot put
// its content on that protected plane. So the page is black BY DEFAULT and reveals
// only what is directly under your control — a spotlight that tracks your cursor, or a
// hold-to-reveal key. A screenshot taken at any random moment catches mostly black; a
// person watching sees only the small patch you are pointing at; and the moment the tab
// loses focus the whole thing goes solid black.
//
// The overlay lives in the shell, on top of the iframe, and never blocks interaction
// (pointer-events: none), so clicks and typing pass straight through to the page.

(() => {
  const KEY = "ghostyBlackout";     // "off" | "spotlight" | "hold"
  const HOLD_KEY = "ghostyBlackoutHold";
  const RADIUS = 130;               // visible radius around the cursor, px
  const FEATHER = 70;               // soft edge width, px

  const container = document.getElementById("frame-container");
  if (!container) return;

  const overlay = document.createElement("div");
  overlay.id = "ghosty-blackout";
  overlay.setAttribute("aria-hidden", "true");
  container.appendChild(overlay);

  const state = {
    mode: localStorage.getItem(KEY) || "off",
    holdKey: localStorage.getItem(HOLD_KEY) || "Backquote",
    revealing: false,   // hold key currently down
    forced: false,      // tab unfocused / hidden -> solid black
    x: -9999,
    y: -9999,
  };

  function paint() {
    const on = state.mode !== "off";
    overlay.classList.toggle("on", on);

    const button = document.getElementById("stealth-button");
    if (button) {
      button.classList.toggle("active", on);
      const icon = button.querySelector("i");
      if (icon) icon.className = on ? "fa-solid fa-eye-slash" : "fa-regular fa-eye-slash";
      button.title =
        state.mode === "off"
          ? "Stealth screen: off (Ctrl+Shift+H)"
          : state.mode === "spotlight"
            ? "Stealth screen: spotlight (Ctrl+Shift+H)"
            : "Stealth screen: hold ` to reveal (Ctrl+Shift+H)";
    }

    if (!on) return;

    // Unfocused, or hold-mode without the key down: solid black, nothing revealed.
    const solidBlack =
      state.forced || (state.mode === "hold" && !state.revealing);
    // Hold mode with the key down: fully revealed.
    const clear = state.mode === "hold" && state.revealing && !state.forced;

    overlay.classList.toggle("solid", solidBlack);
    overlay.classList.toggle("clear", clear);

    if (state.mode === "spotlight" && !solidBlack) {
      overlay.style.setProperty("--x", state.x + "px");
      overlay.style.setProperty("--y", state.y + "px");
    }
  }

  function moveSpot(clientX, clientY) {
    if (state.mode !== "spotlight" || state.forced) return;
    const rect = container.getBoundingClientRect();
    state.x = clientX - rect.left;
    state.y = clientY - rect.top;
    overlay.style.setProperty("--x", state.x + "px");
    overlay.style.setProperty("--y", state.y + "px");
  }

  // The shell sees the cursor over its own chrome; the iframe sees it over the page.
  document.addEventListener("mousemove", e => moveSpot(e.clientX, e.clientY), { passive: true });

  // Proxied pages are served from our own origin, so the iframe document is reachable
  // and we can follow the cursor while it is over the page itself. Re-attached on every
  // navigation, because each load is a fresh document.
  const tracked = new WeakSet();
  function trackFrame(frame) {
    let win;
    try {
      win = frame.contentWindow;
      if (!win || tracked.has(win)) return;
    } catch {
      return;
    }
    const onMove = e => {
      // Inside the iframe, clientX/Y are already relative to the frame area, which is
      // the container's own box, since the iframe fills it.
      if (state.mode !== "spotlight" || state.forced) return;
      state.x = e.clientX;
      state.y = e.clientY;
      overlay.style.setProperty("--x", state.x + "px");
      overlay.style.setProperty("--y", state.y + "px");
    };
    try {
      win.addEventListener("mousemove", onMove, { passive: true });
      win.addEventListener("keydown", onKeyDown, true);
      win.addEventListener("keyup", onKeyUp, true);
      win.addEventListener("blur", forceOn, true);
      tracked.add(win);
    } catch {}
  }

  function scanFrames() {
    container.querySelectorAll("iframe").forEach(frame => {
      if (!frame.dataset.blackoutHooked) {
        frame.dataset.blackoutHooked = "1";
        frame.addEventListener("load", () => trackFrame(frame));
      }
      trackFrame(frame);
    });
  }
  new MutationObserver(scanFrames).observe(container, { childList: true });
  scanFrames();

  function onKeyDown(e) {
    if (e.code === state.holdKey && state.mode === "hold") {
      state.revealing = true;
      paint();
    }
    // Ctrl+Shift+H cycles off -> spotlight -> hold -> off.
    if (e.ctrlKey && e.shiftKey && (e.code === "KeyH" || e.key === "H")) {
      e.preventDefault();
      cycle();
    }
  }
  function onKeyUp(e) {
    if (e.code === state.holdKey && state.mode === "hold") {
      state.revealing = false;
      paint();
    }
  }
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);

  // Away from the tab, everything goes solid black: covers the "screen is shared and I
  // switch windows" and "someone walks up while I am not looking" cases outright.
  function forceOn() {
    state.forced = true;
    paint();
  }
  function releaseForce() {
    state.forced = false;
    paint();
  }
  window.addEventListener("blur", forceOn);
  window.addEventListener("focus", releaseForce);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) forceOn();
    else releaseForce();
  });

  const ORDER = ["off", "spotlight", "hold"];
  function set(mode) {
    if (!ORDER.includes(mode)) mode = "off";
    state.mode = mode;
    state.revealing = false;
    localStorage.setItem(KEY, mode);
    paint();
    announce();
  }
  function cycle() {
    set(ORDER[(ORDER.indexOf(state.mode) + 1) % ORDER.length]);
  }

  // A small toast so the shortcut has visible feedback.
  let toastTimer = null;
  function announce() {
    let toast = document.getElementById("ghosty-blackout-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ghosty-blackout-toast";
      document.body.appendChild(toast);
    }
    const label = {
      off: "Stealth screen: off",
      spotlight: "Stealth screen: spotlight — only your cursor reveals the page",
      hold: "Stealth screen: hold — press and hold ` to reveal",
    }[state.mode];
    toast.textContent = label;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  window.__ghostyBlackout = {
    mode: () => state.mode,
    set,
    cycle,
    isOn: () => state.mode !== "off",
  };

  overlay.style.setProperty("--r", RADIUS + "px");
  overlay.style.setProperty("--feather", FEATHER + "px");
  paint();
})();
