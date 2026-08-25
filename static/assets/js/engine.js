// Ghosty proxy engines. Scramjet is the default; Ultraviolet stays as a per-site fallback.
// Load order on every page: /baremux/index.js, /scram/scramjet.all.js, UV bundle+config, then this.
(() => {
  const SCRAM_PREFIX = "/a/";
  const UV_PREFIX = "/uv/";
  const SW_URL = "/sw.js?v=sj15";
  // Epoxy with an HTTP/1.1 rescue behind it; see transport.mjs for why.
  const TRANSPORT = "/assets/js/transport.mjs?v=h1g3";

  const wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";

  const missing = [];
  if (typeof BareMux === "undefined") missing.push("/baremux/index.js");
  if (typeof self.$scramjetLoadController === "undefined") missing.push("/scram/scramjet.all.js");
  if (missing.length) {
    console.error("[engine] missing script(s):", missing.join(", "));
    return;
  }

  const conn = new BareMux.BareMuxConnection("/baremux/worker.js");
  window.__bareMuxConn = conn;

  // bare-mux answers the worker's port requests through a serviceWorker message listener
  // added with addEventListener, and that queue stays parked until startMessages() runs.
  // Without this every proxied request waits out bare-mux's retry loop first.
  if ("serviceWorker" in navigator) navigator.serviceWorker.startMessages();
  const transportReady = conn.setTransport(TRANSPORT, [{ wisp: wispUrl }]).catch(err => {
    console.error("[engine] setTransport failed:", err);
    throw err;
  });

  const { ScramjetController } = self.$scramjetLoadController();

  const scramjet = new ScramjetController({
    prefix: SCRAM_PREFIX,
    files: {
      wasm: "/scram/scramjet.wasm.wasm",
      all: "/scram/scramjet.all.js",
      sync: "/scram/scramjet.sync.js",
    },
    // syncxhr needs SharedArrayBuffer, which needs cross-origin isolation; enabling it
    // would break the same-origin game assets under /e/, so it stays off.
    flags: {
      serviceworkers: false,
      syncxhr: false,
      strictRewrites: true,
      rewriterLogs: false,
      captureErrors: true,
      allowInvalidJs: true,
      allowFailedIntercepts: true,
    },
    // Stringified into IndexedDB and rebuilt inside the service worker, so these must
    // stay self-contained: no references to anything outside their own body.
    codec: {
      encode: str => {
        if (!str) return str;
        return encodeURIComponent(
          str
            .toString()
            .split("")
            .map((char, i) => (i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
            .join(""),
        );
      },
      decode: str => {
        if (!str) return str;
        return decodeURIComponent(str)
          .split("")
          .map((char, i) => (i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
          .join("");
      },
    },
  });
  window.__scramjet = scramjet;

  const configReady = scramjet.init().catch(err => {
    console.error("[engine] scramjet init failed:", err);
  });

  const swReady =
    "serviceWorker" in navigator
      ? navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(err => {
          console.error("[engine] service worker registration failed:", err);
        })
      : Promise.resolve();

  function uvAvailable() {
    return typeof self.__uv$config !== "undefined" && typeof self.__uv$config.encodeUrl === "function";
  }

  function current() {
    return localStorage.getItem("proxyEngine") === "uv" && uvAvailable() ? "uv" : "scramjet";
  }

  // Hosts the service worker had to rescue with Ultraviolet. Remembering them means the
  // next visit goes straight to the engine that works instead of failing over again.
  function pinnedHosts() {
    try {
      const raw = JSON.parse(localStorage.getItem("ghostyUvHosts") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function pinHost(host) {
    const hosts = pinnedHosts();
    if (hosts.includes(host)) return;
    hosts.push(host);
    localStorage.setItem("ghostyUvHosts", JSON.stringify(hosts.slice(-60)));
  }

  function engineFor(href) {
    if (current() === "uv") return "uv";
    if (!uvAvailable()) return "scramjet";
    try {
      return pinnedHosts().includes(new URL(href).hostname) ? "uv" : "scramjet";
    } catch {
      return "scramjet";
    }
  }

  // The worker reports what it blocked and what it had to rescue; pages listen so the
  // counter in the interface is the worker's real tally, not a guess.
  const blockState = { count: 0, requests: 0, players: 0 };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", event => {
      const data = event.data;
      if (!data || !data.ghosty) return;
      if (data.ghosty === "blocked") {
        blockState.count = data.count;
        blockState.requests = data.requests || 0;
        blockState.players = data.players || 0;
        window.dispatchEvent(new CustomEvent("ghosty:blocked", { detail: data.count }));
      } else if (data.ghosty === "failover" && data.host) {
        pinHost(data.host);
        window.dispatchEvent(new CustomEvent("ghosty:failover", { detail: data.host }));
      }
    });
  }

  function pushConfig() {
    const worker = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!worker) return;
    worker.postMessage({
      ghosty: "config",
      blocking: localStorage.getItem("adBlock") !== "off",
    });
  }

  swReady.then(() => setTimeout(pushConfig, 300));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", pushConfig);
  }

  const ghosty = {
    ready: Promise.all([transportReady, configReady, swReady]),
    engine: current,

    // Full same-origin path for a target URL, ready to drop into location.href or iframe.src.
    url(target) {
      const href = String(target);
      if (engineFor(href) === "uv") return UV_PREFIX + self.__uv$config.encodeUrl(href);
      return scramjet.encodeUrl(href);
    },

    // Inverse of url(): takes a proxied href or path, returns the real URL, or "" if it is not one.
    real(proxied) {
      let path;
      try {
        path = new URL(String(proxied), location.origin).pathname;
      } catch {
        return "";
      }
      try {
        if (path.startsWith(SCRAM_PREFIX)) {
          return scramjet.decodeUrl(location.origin + path);
        }
        if (path.startsWith(UV_PREFIX) && uvAvailable()) {
          return self.__uv$config.decodeUrl(path.slice(UV_PREFIX.length));
        }
      } catch {
        return "";
      }
      return "";
    },

    isProxied(proxied) {
      let path;
      try {
        path = new URL(String(proxied), location.origin).pathname;
      } catch {
        return false;
      }
      return path.startsWith(SCRAM_PREFIX) || path.startsWith(UV_PREFIX);
    },

    setEngine(name) {
      localStorage.setItem("proxyEngine", name === "uv" ? "uv" : "scramjet");
    },

    // Ad and tracker blocking, reported by the worker that actually does it.
    blocked() {
      return blockState.count;
    },

    // requests: never left the browser. players: YouTube responses with their ad
    // fields cut out. Two different things, kept apart on purpose.
    blockStats() {
      return { requests: blockState.requests, players: blockState.players };
    },

    blocking(enabled) {
      if (typeof enabled === "boolean") {
        localStorage.setItem("adBlock", enabled ? "on" : "off");
        pushConfig();
      }
      return localStorage.getItem("adBlock") !== "off";
    },

    // Hosts pinned to Ultraviolet after Scramjet failed on them.
    rescued() {
      return pinnedHosts();
    },

    unpin(host) {
      localStorage.setItem(
        "ghostyUvHosts",
        JSON.stringify(pinnedHosts().filter(entry => entry !== host)),
      );
    },
  };

  window.__ghosty = ghosty;
})();
