// Command palette. Ctrl+K anywhere in the app: games, apps, history, bookmarks,
// commands and any URL, all from one box. Loads after engine.js so window.__ghosty
// is available, and works both on the standalone pages and inside the tab shell.
(() => {
  const HISTORY_KEY = "ghostyHistory";
  const MARKS_KEY = "ghostyBookmarks";
  const MAX_ROWS = 9;

  const inTabShell = location.pathname === "/d";

  // ── storage ─────────────────────────────────────────────────────────────────
  function readList(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(raw) ? raw.filter(e => e && e.url) : [];
    } catch {
      return [];
    }
  }

  function writeList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
  }

  const store = {
    history: () => readList(HISTORY_KEY),
    marks: () => readList(MARKS_KEY),

    visit(url, title) {
      if (!url || !/^https?:/.test(url)) return;
      const list = readList(HISTORY_KEY).filter(e => e.url !== url);
      list.unshift({ url, title: title || url, ts: Date.now() });
      writeList(HISTORY_KEY, list.slice(0, 300));
    },

    isMarked(url) {
      return readList(MARKS_KEY).some(e => e.url === url);
    },

    toggleMark(url, title) {
      if (!url || !/^https?:/.test(url)) return false;
      const list = readList(MARKS_KEY);
      const found = list.findIndex(e => e.url === url);
      if (found >= 0) {
        list.splice(found, 1);
        writeList(MARKS_KEY, list);
        return false;
      }
      list.unshift({ url, title: title || url, ts: Date.now() });
      writeList(MARKS_KEY, list.slice(0, 200));
      return true;
    },
  };

  // ── opening things ──────────────────────────────────────────────────────────
  // A catalogue link is either a same-origin bundled game ("/e/1/…") or a real site.
  // Both end up in the tab shell, which is the only surface with a live connection.
  function open(link) {
    const proxied = /^https?:/.test(link) ? window.__ghosty.url(link) : link;
    if (inTabShell) {
      const frame = document.querySelector("#frame-container iframe.active");
      if (frame) {
        frame.src = window.location.origin + proxied;
        return;
      }
    }
    sessionStorage.setItem("GoUrl", proxied);
    window.location.href = "/d";
  }

  function openQuery(text) {
    const value = text.trim();
    if (!value) return;
    const looksUrl = /^https?:\/\//.test(value) || (/\./.test(value) && !/\s/.test(value));
    const engine = localStorage.getItem("engine") || "https://search.brave.com/search?q=";
    open(looksUrl ? (/^https?:\/\//.test(value) ? value : "https://" + value) : engine + encodeURIComponent(value));
  }

  // ── catalogue ───────────────────────────────────────────────────────────────
  let catalogue = null;
  let catalogueLoading = null;

  function loadCatalogue() {
    if (catalogue) return Promise.resolve(catalogue);
    if (catalogueLoading) return catalogueLoading;
    catalogueLoading = Promise.all([
      fetch("/assets/json/g.min.json").then(r => r.json()).catch(() => []),
      fetch("/assets/json/a.min.json").then(r => r.json()).catch(() => []),
    ]).then(([games, apps]) => {
      const norm = (list, kind) =>
        list
          .filter(entry => entry && entry.name && entry.link)
          .map(entry => ({ kind, name: String(entry.name), link: String(entry.link), image: entry.image || "" }));
      catalogue = [...norm(games, "game"), ...norm(apps, "app")];
      return catalogue;
    });
    return catalogueLoading;
  }

  // ── commands ────────────────────────────────────────────────────────────────
  function commands() {
    const blocking = window.__ghosty ? window.__ghosty.blocking() : true;
    const engine = window.__ghosty ? window.__ghosty.engine() : "scramjet";
    return [
      { kind: "cmd", name: "Home", icon: "fa-house", run: () => (location.href = "/") },
      { kind: "cmd", name: "Games", icon: "fa-gamepad", run: () => (location.href = "/a") },
      { kind: "cmd", name: "Apps", icon: "fa-rocket", run: () => (location.href = "/b") },
      { kind: "cmd", name: "Settings", icon: "fa-gear", run: () => (location.href = "/c") },
      { kind: "cmd", name: "New tab", icon: "fa-plus", run: () => {
        if (inTabShell) document.getElementById("add-tab")?.click();
        else location.href = "/d";
      } },
      {
        kind: "cmd",
        name: (blocking ? "Turn off" : "Turn on") + " ad and tracker blocking",
        icon: "fa-shield-halved",
        run: () => window.__ghosty.blocking(!blocking),
      },
      {
        kind: "cmd",
        name: "Switch engine to " + (engine === "uv" ? "Scramjet" : "UltraViolet"),
        icon: "fa-microchip",
        run: () => {
          window.__ghosty.setEngine(engine === "uv" ? "scramjet" : "uv");
          location.reload();
        },
      },
      {
        kind: "cmd",
        name: "Clear browsing history",
        icon: "fa-broom",
        run: () => {
          writeList(HISTORY_KEY, []);
          localStorage.removeItem("ghostyRecent");
        },
      },
      {
        kind: "cmd",
        name: "Panic — leave now",
        icon: "fa-triangle-exclamation",
        run: () => {
          location.replace(localStorage.getItem("pLink") || "https://classroom.google.com/");
        },
      },
    ];
  }

  // ── matching ────────────────────────────────────────────────────────────────
  // Subsequence match with a bonus for hits at the start of a word, so "bic" ranks
  // "Bad Ice Cream" above a title that merely contains those letters scattered.
  function score(text, query) {
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();
    if (!needle) return 1;
    if (haystack === needle) return 1000;
    if (haystack.startsWith(needle)) return 800 - haystack.length;
    if (haystack.includes(needle)) return 600 - haystack.length;

    // The first character has to land on a word start. Without that rule "chess" pulls
    // in "Super Mario 64" through scattered letters, which is technically a match and
    // useless to read.
    let at = -1;
    for (let i = 0; i < haystack.length; i++) {
      if (haystack[i] !== needle[0]) continue;
      if (i === 0 || /[\s\-_.:/]/.test(haystack[i - 1])) {
        at = i;
        break;
      }
    }
    if (at < 0) return 0;

    let points = 20;
    let streak = 0;
    let cursorAt = at;
    for (let n = 1; n < needle.length; n++) {
      const found = haystack.indexOf(needle[n], cursorAt + 1);
      if (found < 0) return 0;
      const wordStart = /[\s\-_.:/]/.test(haystack[found - 1]);
      points += wordStart ? 12 : 3;
      streak = found === cursorAt + 1 ? streak + 1 : 0;
      points += streak * 4;
      cursorAt = found;
    }
    // A query whose letters are spread over the whole title is a weak match, so the
    // span it covers is charged against it.
    return points - (cursorAt - at) * 1.5 - haystack.length * 0.1;
  }

  function search(query) {
    const rows = [];
    const pool = [
      ...commands(),
      ...(catalogue || []),
      ...store.marks().map(e => ({ kind: "mark", name: e.title, link: e.url })),
      ...store.history().slice(0, 120).map(e => ({ kind: "history", name: e.title, link: e.url })),
    ];

    if (!query) {
      const recent = store.history().slice(0, 4).map(e => ({ kind: "history", name: e.title, link: e.url }));
      const marks = store.marks().slice(0, 3).map(e => ({ kind: "mark", name: e.title, link: e.url }));
      return [...marks, ...recent, ...commands().slice(0, MAX_ROWS - marks.length - recent.length)];
    }

    const seen = new Set();
    for (const item of pool) {
      const key = item.kind + "|" + (item.link || item.name);
      if (seen.has(key)) continue;
      const points = Math.max(score(item.name, query), item.link ? score(item.link, query) * 0.55 : 0);
      if (points > 0) {
        seen.add(key);
        rows.push({ item, points });
      }
    }
    rows.sort((a, b) => b.points - a.points);
    // Anything far below the best hit is padding, not a result.
    const floor = rows.length ? rows[0].points * 0.28 : 0;
    return rows.filter(r => r.points >= floor).slice(0, MAX_ROWS).map(r => r.item);
  }

  // ── interface ───────────────────────────────────────────────────────────────
  const LABEL = { cmd: "Command", game: "Game", app: "App", history: "History", mark: "Bookmark", open: "Open" };
  const ICON = { game: "fa-gamepad", app: "fa-rocket", history: "fa-clock-rotate-left", mark: "fa-star", open: "fa-arrow-right" };

  let root = null;
  let field = null;
  let listEl = null;
  let rows = [];
  let cursor = 0;

  function build() {
    root = document.createElement("div");
    root.className = "gp-backdrop";
    root.innerHTML =
      '<div class="gp-panel" role="dialog" aria-label="Command palette">' +
      '<div class="gp-field"><i class="fa-solid fa-bolt"></i>' +
      '<input id="gp-input" type="text" autocomplete="off" spellcheck="false" placeholder="Search games, apps, history — or type a URL">' +
      '<kbd>Esc</kbd></div>' +
      '<div class="gp-list" id="gp-list"></div>' +
      '<div class="gp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span>' +
      '<span class="gp-foot-right">Ghosty</span></div>' +
      "</div>";
    document.body.appendChild(root);
    field = root.querySelector("#gp-input");
    listEl = root.querySelector("#gp-list");

    root.addEventListener("mousedown", event => {
      if (event.target === root) close();
    });
    field.addEventListener("input", () => render(field.value));
    field.addEventListener("keydown", onKey);
  }

  function render(query) {
    const found = search(query.trim());
    rows = query.trim() ? [...found, { kind: "open", name: query.trim() }] : found;
    cursor = 0;
    listEl.innerHTML = "";
    for (let i = 0; i < rows.length; i++) {
      const item = rows[i];
      const row = document.createElement("div");
      row.className = "gp-row" + (i === 0 ? " active" : "");
      row.dataset.index = String(i);

      const icon = document.createElement("i");
      icon.className = "fa-solid " + (item.icon || ICON[item.kind] || "fa-circle");
      row.appendChild(icon);

      const label = document.createElement("span");
      label.className = "gp-name";
      label.textContent = item.kind === "open" ? "Open “" + item.name + "”" : item.name;
      row.appendChild(label);

      if (item.link && /^https?:/.test(item.link)) {
        const host = document.createElement("span");
        host.className = "gp-host";
        try {
          host.textContent = new URL(item.link).hostname.replace(/^www\./, "");
        } catch {
          host.textContent = "";
        }
        row.appendChild(host);
      }

      const tag = document.createElement("span");
      tag.className = "gp-tag";
      tag.textContent = LABEL[item.kind] || "";
      row.appendChild(tag);

      row.addEventListener("mouseenter", () => {
        cursor = i;
        highlight();
      });
      row.addEventListener("mousedown", event => {
        event.preventDefault();
        run(item);
      });
      listEl.appendChild(row);
    }
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "gp-empty";
      empty.textContent = "Nothing found";
      listEl.appendChild(empty);
    }
  }

  function highlight() {
    [...listEl.children].forEach((el, i) => el.classList.toggle("active", i === cursor));
    const active = listEl.children[cursor];
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  function run(item) {
    close();
    if (item.kind === "cmd") item.run();
    else if (item.kind === "open") openQuery(item.name);
    else if (item.link) open(item.link);
  }

  function onKey(event) {
    if (event.key === "ArrowDown" || (event.key === "n" && event.ctrlKey)) {
      event.preventDefault();
      cursor = (cursor + 1) % Math.max(rows.length, 1);
      highlight();
    } else if (event.key === "ArrowUp" || (event.key === "p" && event.ctrlKey)) {
      event.preventDefault();
      cursor = (cursor - 1 + rows.length) % Math.max(rows.length, 1);
      highlight();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (rows[cursor]) run(rows[cursor]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function openPalette() {
    if (!root) build();
    loadCatalogue().then(() => {
      if (root.classList.contains("show")) render(field.value);
    });
    root.classList.add("show");
    field.value = "";
    render("");
    setTimeout(() => field.focus(), 20);
  }

  function close() {
    if (root) root.classList.remove("show");
  }

  function toggle() {
    if (root && root.classList.contains("show")) close();
    else openPalette();
  }

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      toggle();
    }
  });

  window.__ghostyPalette = { open: openPalette, close, toggle, store };
})();
