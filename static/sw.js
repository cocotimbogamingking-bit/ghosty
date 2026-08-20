// Scramjet is the primary engine (prefix /a/). Ultraviolet stays mounted at /uv/ as a
// fallback for sites Scramjet mis-rewrites, and the legacy Dynamic engine at /a/q/.
importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = self.$scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// The transport hands back a decompressed body but the origin's headers still describe
// the compressed one. Left in place, the browser stops reading at content-length: a 2.9MB
// stylesheet arrives cut in half and half of YouTube's layout never applies.
scramjet.addEventListener("handleResponse", event => {
  delete event.responseHeaders["content-encoding"];
  delete event.responseHeaders["content-length"];
  delete event.responseHeaders["transfer-encoding"];
});

let uv = null;
let dynamic = null;

try {
  importScripts("/assets/mathematics/bundle.js?v=sj1");
  importScripts("/assets/mathematics/config.js?v=sj1");
  importScripts("/assets/mathematics/sw.js?v=sj1");
  uv = new UVServiceWorker();
} catch (err) {
  console.error("[sw] ultraviolet fallback unavailable:", err);
}

try {
  importScripts("/assets/history/config.js?v=2025-04-15");
  importScripts("/assets/history/worker.js?v=2025-04-15");
  dynamic = new Dynamic();
  self.dynamic = dynamic;
} catch (err) {
  console.error("[sw] dynamic engine unavailable:", err);
}

const SCRAM_PREFIX = "/a/";
const UV_PREFIX = uv ? __uv$config.prefix : "/uv/";

// Same xor codec engine.js hands to Scramjet. Kept here as real functions because the
// copy inside scramjet.config is stored as source text, not something callable.
function xorEncode(str) {
  if (!str) return str;
  return encodeURIComponent(
    str
      .toString()
      .split("")
      .map((char, i) => (i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
      .join(""),
  );
}

function xorDecode(str) {
  if (!str) return str;
  return decodeURIComponent(str)
    .split("")
    .map((char, i) => (i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char))
    .join("");
}

// Without these, an updated worker sits in "waiting" until every tab using the old
// one is closed, so a fixed proxy keeps serving through the broken previous version.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

// Paths that belong to the proxy itself. A proxied page requests these because the
// engine injects them, so they must never be resolved against the proxied site.
const OWN_PATHS = [
  "/scram/",
  "/assets/mathematics/",
  "/assets/history/",
  "/baremux/",
  "/epoxy/",
  "/wisp/",
];

function isOwnAsset(url) {
  return url.origin === location.origin && OWN_PATHS.some(p => url.pathname.startsWith(p));
}

// Only event.clientId, never resultingClientId: for a navigation the resulting client
// does not exist until this handler responds, so awaiting it deadlocks the page.
async function clientUrl(event) {
  if (event.clientId) {
    try {
      const client = await self.clients.get(event.clientId);
      if (client && client.url) return client.url;
    } catch {}
  }
  if (event.request.referrer && event.request.referrer.startsWith(location.origin)) {
    return event.request.referrer;
  }
  return null;
}

// Returns { engine, base } for a proxied page URL, or null if it is not one.
function originOf(proxiedUrl) {
  let path;
  try {
    path = new URL(proxiedUrl).pathname;
  } catch {
    return null;
  }
  try {
    if (path.startsWith(SCRAM_PREFIX)) {
      return { engine: "scramjet", base: new URL(xorDecode(path.slice(SCRAM_PREFIX.length))) };
    }
    if (uv && path.startsWith(UV_PREFIX)) {
      return { engine: "uv", base: new URL(__uv$config.decodeUrl(path.slice(UV_PREFIX.length))) };
    }
  } catch {}
  return null;
}

// Some sites build request URLs from a root-absolute path or a hardcoded absolute
// origin, which skips the rewriter. Those land here unproxied; if the client that made
// the request is a proxied page, resolve against that page's real URL and send it back
// through whichever engine owns that page.
async function reproxy(event) {
  let requestUrl;
  try {
    requestUrl = new URL(event.request.url);
  } catch {
    return null;
  }
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") return null;
  if (requestUrl.origin === location.origin) {
    if (requestUrl.pathname.startsWith(SCRAM_PREFIX)) return null;
    if (requestUrl.pathname.startsWith(UV_PREFIX)) return null;
    if (isOwnAsset(requestUrl)) return null;
  }

  const from = await clientUrl(event);
  if (!from) return null;
  const owner = originOf(from);
  if (!owner) return null;

  const target =
    requestUrl.origin === location.origin
      ? new URL(requestUrl.pathname + requestUrl.search, owner.base)
      : requestUrl;

  if (target.origin === location.origin) return null;

  const proxied =
    owner.engine === "scramjet"
      ? location.origin + SCRAM_PREFIX + xorEncode(target.href)
      : location.origin + UV_PREFIX + __uv$config.encodeUrl(target.href);

  const init = {
    method: event.request.method,
    headers: event.request.headers,
    mode: event.request.mode === "navigate" ? "same-origin" : event.request.mode,
    credentials: event.request.credentials,
    cache: event.request.cache,
    redirect: event.request.redirect,
    referrer: from,
    referrerPolicy: event.request.referrerPolicy,
  };
  if (event.request.method !== "GET" && event.request.method !== "HEAD") {
    init.body = await event.request.clone().arrayBuffer();
  }

  const request = new Request(proxied, init);
  return owner.engine === "scramjet"
    ? scramjet.fetch({ request, clientId: event.clientId })
    : uv.fetch({ request });
}

const WASM_PATH = "/scram/scramjet.wasm.wasm";

// A proxied page only works inside the tab shell: bare-mux gets its port by asking the
// open windows, and only the app's own pages answer. A top-level tab sitting on /a/ has
// no page behind it to answer, so it has nothing to fetch through. "document" is the
// browser's own word for that case; an iframe inside the shell reports "iframe" instead
// and must be left alone, or the shell would load itself inside itself.
function isTopLevelNav(event) {
  return event.request.mode === "navigate" && event.request.destination === "document";
}

// /a/q/ belongs to the legacy Dynamic engine, which carries its own page, so it is the
// one thing under /a/ that does not need the shell.
function isProxiedPath(url) {
  if (url.origin !== location.origin) return false;
  if (url.pathname.startsWith(SCRAM_PREFIX)) return !url.pathname.startsWith(SCRAM_PREFIX + "q/");
  return url.pathname.startsWith(UV_PREFIX);
}

// Only the proxy's own paths get near Scramjet. loadConfig() opens its IndexedDB, and
// opening it before the page-side controller has created the object stores leaves a
// store-less database that the controller can no longer upgrade.
function isScramjetPath(url) {
  return (
    url.origin === location.origin &&
    (url.pathname.startsWith(SCRAM_PREFIX) || url.pathname === WASM_PATH)
  );
}

// The config lands in IndexedDB only once the page-side controller has finished init().
// A request arriving before that used to fall through to the network and come back as the
// site's own 404 page, which the frame then kept. Waiting is the only honest answer.
let configWait = null;
let configuredFromDb = false;

// Scramjet accepts its config two ways and only one of them works. loadConfig() reads
// IndexedDB and also installs the config into the engine's own module state; the
// "loadConfig" postMessage the page sends when it is already controlled just assigns the
// field, leaving that module state empty, and the first fetch dies on config.prefix of
// undefined. So the field is cleared and the database read is forced exactly once.
function scramjetReady() {
  if (configuredFromDb) return Promise.resolve(true);
  // One shared wait for every request that arrives during startup. Letting each request
  // run its own retry loop means a page full of assets opens that many database reads.
  if (!configWait) {
    configWait = (async () => {
      for (let attempt = 0; attempt < 40; attempt++) {
        try {
          scramjet.config = null;
          await scramjet.loadConfig();
          if (scramjet.config) {
            configuredFromDb = true;
            return true;
          }
        } catch (err) {
          if (attempt === 0) console.warn("[sw] waiting for scramjet config:", err);
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      console.error("[sw] scramjet config never arrived");
      configWait = null;
      return false;
    })();
  }
  return configWait;
}

// The wasm rewriter finishes loading a moment after the config does, so the first
// request out of a cold worker can throw on an engine that is seconds from working.
async function scramjetFetch(event) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (scramjet.config && scramjet.route(event)) return await scramjet.fetch(event);
      return null;
    } catch (err) {
      if (attempt === 3) {
        console.error("[sw] scramjet fetch failed:", err);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 900));
    }
  }
  return null;
}

// Shown instead of a wrong page while the engine is still coming up. Navigations get a
// page that retries itself; anything else gets a plain 503 the site can handle.
function notReady(event) {
  if (event.request.destination === "document" || event.request.destination === "iframe") {
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Ghosty</title>" +
        "<style>html{background:#0b0b10;color:#8a8aa3;font:14px system-ui;display:grid;place-items:center;height:100%}</style>" +
        "<p>Conectando…<script>" +
        // Capped, or a worker that never comes up turns into a reload loop. The counter is
        // keyed by path: sessionStorage is shared with every other frame in the tab, and a
        // single key would make one slow site give up on all the rest.
        "var k='ghostyRetry:'+location.pathname,n=+(sessionStorage.getItem(k)||0);" +
        "if(n<8){sessionStorage.setItem(k,n+1);setTimeout(function(){location.reload()},1200)}" +
        "else{sessionStorage.removeItem(k);document.body.textContent='No se pudo conectar. Recarga la pestaña.'}" +
        "</script>",
      { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
    );
  }
  return new Response("proxy engine not ready", { status: 503, headers: { "cache-control": "no-store" } });
}

self.addEventListener("fetch", event => {
  event.respondWith(
    (async () => {
      let requestUrl;
      try {
        requestUrl = new URL(event.request.url);
      } catch {
        return await fetch(event.request);
      }

      if (isTopLevelNav(event) && isProxiedPath(requestUrl)) {
        return Response.redirect(
          location.origin + "/d?go=" + encodeURIComponent(requestUrl.pathname + requestUrl.search),
          302,
        );
      }

      // /a/q/ is checked first: it sits inside Scramjet's /a/ prefix, and an xor-encoded
      // URL always begins with the letters of "http", never "q/".
      if (dynamic) {
        try {
          if (await dynamic.route(event)) return await dynamic.fetch(event);
        } catch {}
      }

      if (isScramjetPath(requestUrl)) {
        await scramjetReady();
        const answer = await scramjetFetch(event);
        if (answer) return answer;
        // A /a/ path belongs to nobody else. Falling through would hand the frame the
        // server's own 404 page, and the frame would keep it.
        if (requestUrl.pathname.startsWith(SCRAM_PREFIX)) return notReady(event);
      }

      if (uv) {
        try {
          if (uv.route(event)) return await uv.fetch(event);
        } catch (err) {
          console.error("[sw] ultraviolet fetch failed:", err);
        }
      }

      try {
        const recovered = await reproxy(event);
        if (recovered) return recovered;
      } catch {}

      return await fetch(event.request);
    })(),
  );
});
