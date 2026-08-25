// Page transition. Clicking through the app plays a short ghost wipe instead of
// blanking to white and repainting. The arriving half is armed by a one-line
// script in each document head, which reads the flag this file sets.
(() => {
  const LEAVE_MS = 380;
  const FLAG = "gh:in";

  // The reduced-motion block in global.css collapses every animation to 0.01ms,
  // which would leave the veil slamming opaque for a third of a second with no
  // movement to explain it. Better to have no transition at all.
  const still =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let leaving = false;

  function drawVeil() {
    const veil = document.createElement("div");
    veil.className = "gh-veil";
    const mark = document.createElement("div");
    mark.className = "gh-mark";
    veil.appendChild(mark);
    document.body.appendChild(veil);
  }

  function nav(url) {
    if (still) {
      window.location.href = url;
      return;
    }
    if (leaving) return;
    leaving = true;
    try {
      sessionStorage.setItem(FLAG, "1");
    } catch {
      // Private mode or a blocked storage partition: the departure still plays,
      // the arrival just does not.
    }
    drawVeil();
    setTimeout(() => {
      window.location.href = url;
    }, LEAVE_MS);
  }

  window.ghostNav = nav;

  // Capture phase, so a link that also carries an onclick still gets the wipe.
  document.addEventListener(
    "click",
    event => {
      if (still || leaving) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target.closest && event.target.closest("a[href]");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const raw = anchor.getAttribute("href");
      if (!raw || raw[0] === "#" || /^[a-z]+:/i.test(raw) && !/^https?:/i.test(raw)) return;

      let url;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;

      // Everything under these prefixes is proxied content, not an app page:
      // "/a/" is the Scramjet mount, which is one slash away from "/a", games.
      if (/^\/(a\/|uv\/|scram|wisp|e\/)/.test(url.pathname)) return;

      event.preventDefault();
      nav(url.href);
    },
    true,
  );

  // Coming back through history restores the page with the veil still painted
  // over it, so it has to be cleared by hand.
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    leaving = false;
    document.documentElement.classList.remove("gh-in");
    for (const veil of document.querySelectorAll(".gh-veil")) veil.remove();
  });
})();
