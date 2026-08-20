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
  if (splash) {
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
        const name = window.__ghosty.engine() === "uv" ? "UltraViolet" : "Scramjet";
        setStatus("online", name + " online");
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

  // Ctrl+K / "/" focus the bar, the way every other search surface behaves.
  document.addEventListener("keydown", event => {
    const typing = document.activeElement === input;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      input && input.focus();
    } else if (event.key === "/" && !typing && input) {
      event.preventDefault();
      input.focus();
    }
  });

  window.__ghostyRenderRecent = renderRecent;
})();
