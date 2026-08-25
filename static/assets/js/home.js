// Home page behaviour: splash timing, live engine status, search suggestions and the
// recent-sites row. Loads after engine.js, so window.__ghosty is already there.
(() => {
  const splash = document.getElementById("splash-screen");
  const pill = document.getElementById("status-pill");
  const pillText = document.getElementById("status-text");
  const input = document.getElementById("input");
  const form = document.getElementById("fv");

  // ── splash ──────────────────────────────────────────────────────────────────
  // It used to sit there for a flat three seconds whatever the engine was doing.
  // Now it leaves as soon as the proxy is usable, with a floor so it never blinks
  // and a ceiling so a dead transport cannot trap the page behind it.
  // Arriving from another Ghosty page, the ghost wipe is already playing over
  // the top of this. Two loading screens back to back is one too many, so the
  // splash only survives a cold load.
  if (splash && document.documentElement.classList.contains("gh-in")) {
    splash.remove();
  } else if (splash) {
    const shownAt = Date.now();
    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      const wait = Math.max(0, 650 - (Date.now() - shownAt));
      setTimeout(() => {
        splash.classList.add("fade-out");
        setTimeout(() => splash.remove(), 700);
      }, wait);
    };
    const ready = window.__ghosty ? window.__ghosty.ready : Promise.resolve();
    Promise.resolve(ready).then(dismiss, dismiss);
    setTimeout(dismiss, 3500);
  }

  // ── status pill ─────────────────────────────────────────────────────────────
  // It always read "System Online" even with the transport down. Now it reports
  // what the engine is actually doing.
  function setStatus(state, label) {
    if (!pill || !pillText) return;
    pill.dataset.state = state;
    pillText.textContent = label;
  }

  if (pill && window.__ghosty) {
    setStatus("waiting", "Connecting...");
    let settled = false;
    window.__ghosty.ready.then(
      () => {
        settled = true;
        // Which engine is carrying the traffic is a detail of the plumbing. The pill
        // is there to say the proxy is up, and it says it the same way every time.
        setStatus("online", "Ghosty Engine online");
      },
      () => {
        settled = true;
        setStatus("down", "Engine offline");
      },
    );
    setTimeout(() => {
      if (!settled) setStatus("down", "Slow connection");
    }, 12000);
  }

  // ── recent sites ────────────────────────────────────────────────────────────
  const RECENT_KEY = "ghostyRecent";

  function readRecent() {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter(entry => entry && entry.url).slice(0, 6) : [];
    } catch {
      return [];
    }
  }

  function renderRecent() {
    const row = document.getElementById("recent-row");
    if (!row) return;
    const items = readRecent();
    if (!items.length) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    row.innerHTML = "";
    const title = document.createElement("span");
    title.className = "recent-label";
    title.textContent = "Recent";
    row.appendChild(title);
    for (const item of items) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "recent-chip";
      const icon = document.createElement("img");
      // Favicons come from the target host, so they go through the proxy like
      // everything else; a broken one just leaves the label on its own.
      icon.src = window.__ghosty.url("https://icons.duckduckgo.com/ip3/" + item.host + ".ico");
      icon.alt = "";
      icon.loading = "lazy";
      icon.onerror = () => icon.remove();
      chip.appendChild(icon);
      chip.appendChild(document.createTextNode(item.host));
      chip.addEventListener("click", () => window.go(item.url));
      row.appendChild(chip);
    }
  }

  renderRecent();

  // ── stats strip ─────────────────────────────────────────────────────────────
  // Real numbers only: the catalogue is counted from the catalogue, and the blocked
  // total comes from the worker that does the blocking.
  const gamesCell = document.getElementById("stat-games");
  const blockedCell = document.getElementById("stat-blocked");

  function countUp(el, target) {
    const start = performance.now();
    const span = 700;
    const step = now => {
      const t = Math.min(1, (now - start) / span);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const gamesSub = document.getElementById("sub-games");

  if (gamesCell) {
    fetch("/assets/json/g.min.json")
      .then(res => res.json())
      .then(list => {
        const total = Array.isArray(list) ? list.length : 0;
        countUp(gamesCell, total);
        if (gamesSub && total) gamesSub.textContent = total + " to play";
      })
      .catch(() => {
        gamesCell.textContent = "—";
      });
  }

  if (blockedCell) {
    window.addEventListener("ghosty:blocked", event => {
      blockedCell.textContent = String(event.detail);
    });
    setTimeout(() => {
      if (window.__ghosty) blockedCell.textContent = String(window.__ghosty.blocked());
    }, 800);
  }

  // ── search suggestions ──────────────────────────────────────────────────────
  const box = document.getElementById("suggestions");
  let entries = [];
  let cursor = -1;
  let timer = null;
  let seq = 0;

  function closeBox() {
    if (!box) return;
    box.hidden = true;
    box.innerHTML = "";
    entries = [];
    cursor = -1;
  }

  function highlight() {
    if (!box) return;
    [...box.children].forEach((el, i) => el.classList.toggle("active", i === cursor));
  }

  function draw(list) {
    if (!box) return;
    entries = list;
    cursor = -1;
    box.innerHTML = "";
    if (!list.length) {
      box.hidden = true;
      return;
    }
    for (const entry of list) {
      const row = document.createElement("div");
      row.className = "suggestion";
      const icon = document.createElement("i");
      icon.className = entry.isUrl ? "fa-solid fa-arrow-right" : "fa-solid fa-magnifying-glass";
      row.appendChild(icon);
      const text = document.createElement("span");
      text.textContent = entry.text;
      row.appendChild(text);
      row.addEventListener("mousedown", event => {
        event.preventDefault();
        input.value = entry.text;
        closeBox();
        form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit"));
      });
      box.appendChild(row);
    }
    box.hidden = false;
  }

  function looksLikeUrl(value) {
    return /^https?:\/\//.test(value) || (/\./.test(value) && !/\s/.test(value));
  }

  // The completions come straight off bare-mux rather than through the proxy path:
  // this is raw JSON, and running it past the rewriter only adds latency.
  async function lookup(query) {
    if (typeof BareMux === "undefined") return [];
    // The transport is what carries this request, so asking before it is up just
    // burns the first keystrokes on a rejected fetch.
    if (window.__ghosty) await window.__ghosty.ready;
    const client = new BareMux.BareClient();
    const res = await client.fetch(
      "https://duckduckgo.com/ac/?type=list&q=" + encodeURIComponent(query),
    );
    const data = await res.json();
    const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
    return list.slice(0, 6).map(text => ({ text: String(text), isUrl: false }));
  }

  if (input && box) {
    input.addEventListener("input", () => {
      const query = input.value.trim();
      clearTimeout(timer);
      if (query.length < 2) {
        closeBox();
        return;
      }
      const head = looksLikeUrl(query) ? [{ text: query, isUrl: true }] : [];
      draw(head);
      timer = setTimeout(async () => {
        const mine = ++seq;
        try {
          const found = await lookup(query);
          if (mine !== seq || input.value.trim() !== query) return;
          draw([...head, ...found.filter(entry => entry.text !== query)]);
        } catch {
          // Offline or the transport is not up yet; the typed text still works.
        }
      }, 180);
    });

    input.addEventListener("keydown", event => {
      if (box.hidden || !entries.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        cursor += event.key === "ArrowDown" ? 1 : -1;
        if (cursor < 0) cursor = entries.length - 1;
        if (cursor >= entries.length) cursor = 0;
        input.value = entries[cursor].text;
        highlight();
      } else if (event.key === "Enter" && cursor >= 0) {
        input.value = entries[cursor].text;
        closeBox();
      } else if (event.key === "Escape") {
        closeBox();
      }
    });

    input.addEventListener("blur", () => setTimeout(closeBox, 120));
    form.addEventListener("submit", closeBox);
  }

  // "/" focuses the bar. Ctrl+K belongs to the command palette, which is the same
  // shortcut on every page — the search bar keeping it here would be the odd one out.
  document.addEventListener("keydown", event => {
    if (event.key !== "/" || !input) return;
    const active = document.activeElement;
    if (active === input || (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
    event.preventDefault();
    input.focus();
  });

  window.__ghostyRenderRecent = renderRecent;
})();
