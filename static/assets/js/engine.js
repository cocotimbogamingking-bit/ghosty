// Ghosty proxy engines. Scramjet is the default; Ultraviolet stays as a per-site fallback.
// Load order on every page: /baremux/index.js, /scram/scramjet.all.js, UV bundle+config, then this.
(() => {
  const SCRAM_PREFIX = "/a/";
  const UV_PREFIX = "/uv/";
  const SW_URL = "/sw.js?v=sj3";
  const EPOXY = "/epoxy/index.mjs?v=hdrpatch2";

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
  const transportReady = conn.setTransport(EPOXY, [{ wisp: wispUrl }]).catch(err => {
    console.error("[engine] setTransport failed:", err);
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

  const ghosty = {
    ready: Promise.all([transportReady, configReady, swReady]),
    engine: current,

    // Full same-origin path for a target URL, ready to drop into location.href or iframe.src.
    url(target) {
      const href = String(target);
      if (current() === "uv") return UV_PREFIX + self.__uv$config.encodeUrl(href);
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
  };

  window.__ghosty = ghosty;
})();
