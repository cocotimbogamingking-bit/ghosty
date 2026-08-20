// Scramjet is the primary engine (prefix /a/). Ultraviolet stays mounted at /uv/ as a
// fallback for sites Scramjet mis-rewrites, and the legacy Dynamic engine at /a/q/.
importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = self.$scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// YouTube's ads do not come from an ad domain. They are listed inside the same player
// response as the video and streamed from the same googlevideo host, so a domain
// blocklist cannot separate them — measured: adPlacements 1, adSlots 8, ad showing.
// What a proxy can do that an extension cannot is edit the response on the way past:
// renaming the keys leaves the player looking up fields that are no longer there, and
// it never asks for the ad streams in the first place.
const AD_KEYS = [
  // Player ads: pre-roll, mid-roll and the ad break scheduler.
  '"adPlacements"',
  '"playerAds"',
  '"adSlots"',
  '"adBreakHeartbeatParams"',
  '"playerAdParams"',
  // Feed and search ads. Renaming the renderer key means the component that draws it
  // is never looked up, so the entry arrives as something YouTube cannot render.
  '"adSlotRenderer"',
  '"inFeedAdLayoutRenderer"',
  '"promotedVideoRenderer"',
  '"compactPromotedVideoRenderer"',
  '"displayAdRenderer"',
  '"promotedSparklesWebRenderer"',
  '"promotedSparklesTextSearchRenderer"',
  '"searchPyvRenderer"',
  '"carouselAdRenderer"',
  '"primetimePromoRenderer"',
  '"bannerPromoRenderer"',
  '"statementBannerRenderer"',
  '"adsEngagementPanelRenderer"',
  '"brandVideoShelfRenderer"',
  '"brandVideoSingletonRenderer"',
];
// Longest key, used as the overlap kept between chunks so a key split across a stream
// boundary is still caught.
const AD_KEY_MAX = 40;

// Belt to the renaming's braces: an ad slot that arrives through a path this does not
// cover still ends up hidden, and the empty container it sits in goes with it.
const AD_CSS = [
  "ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-promoted-video-renderer,",
  "ytd-compact-promoted-video-renderer,ytd-display-ad-renderer,ytd-companion-slot-renderer,",
  "ytd-action-companion-ad-renderer,ytd-promoted-sparkles-web-renderer,ytd-search-pyv-renderer,",
  "ytd-carousel-ad-renderer,ytd-primetime-promo-renderer,ytd-banner-promo-renderer,",
  "ytd-statement-banner-renderer,ytd-brand-video-shelf-renderer,ytd-brand-video-singleton-renderer,",
  "ytm-promoted-video-renderer,ytm-companion-slot-renderer,",
  "#player-ads,#masthead-ad,.ytp-ad-module,.ytp-ad-overlay-container,.ytd-companion-slot-renderer,",
  "ytd-rich-item-renderer:has(ytd-ad-slot-renderer),",
  "ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer),",
  "ytd-rich-section-renderer:has(ytd-statement-banner-renderer),",
  "ytd-item-section-renderer:has(>#contents>ytd-ad-slot-renderer)",
  "{display:none!important}",
].join("");

function injectAdCss(html) {
  if (html.includes("ghosty-ad-css")) return html;
  const style = '<style id="ghosty-ad-css">' + AD_CSS + "</style>";
  const head = html.indexOf("<head");
  if (head < 0) return style + html;
  const close = html.indexOf(">", head);
  if (close < 0) return style + html;
  return html.slice(0, close + 1) + style + html.slice(close + 1);
}

function stripAdKeys(text) {
  let out = text;
  for (const key of AD_KEYS) {
    if (out.includes(key)) out = out.split(key).join(key.slice(0, -1) + '_ghosty"');
  }
  return out;
}

function adStrippingStream() {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let carry = "";
  let counted = false;
  const emit = (text, controller) => {
    const stripped = stripAdKeys(text);
    if (!counted && stripped !== text) {
      counted = true;
      ytAdsStripped++;
      announceBlocked();
    }
    if (stripped) controller.enqueue(encoder.encode(stripped));
  };
  return new TransformStream({
    transform(chunk, controller) {
      const text = carry + decoder.decode(chunk, { stream: true });
      const cut = Math.max(0, text.length - AD_KEY_MAX);
      carry = text.slice(cut);
      if (cut) emit(text.slice(0, cut), controller);
    },
    flush(controller) {
      emit(carry + decoder.decode(), controller);
    },
  });
}

function isYouTube(url) {
  try {
    const host = (typeof url === "string" ? new URL(url) : url).hostname;
    return /(^|\.)(youtube\.com|youtube-nocookie\.com|m\.youtube\.com)$/.test(host);
  } catch {
    return false;
  }
}

scramjet.addEventListener("handleResponse", event => {
  // The transport hands back a decompressed body but the origin's headers still describe
  // the compressed one. Left in place, the browser stops reading at content-length: a
  // 2.9MB stylesheet arrives cut in half and half of YouTube's layout never applies.
  delete event.responseHeaders["content-encoding"];
  delete event.responseHeaders["content-length"];
  delete event.responseHeaders["transfer-encoding"];

  if (!blockingOn || !isYouTube(event.url)) return;
  const type = String(event.responseHeaders["content-type"] || "").toLowerCase();
  if (!type.includes("json") && !type.includes("html") && !type.includes("javascript")) return;

  const body = event.responseBody;
  // dispatchEvent is synchronous and the Response is built the moment it returns, so
  // the body can only be swapped for something that is ready now: a string, or a
  // stream with the edit wired into it.
  if (typeof body === "string") {
    const stripped = stripAdKeys(body);
    if (stripped !== body) {
      ytAdsStripped++;
      announceBlocked();
    }
    event.responseBody = type.includes("html") ? injectAdCss(stripped) : stripped;
  } else if (body && typeof body.pipeThrough === "function") {
    event.responseBody = body.pipeThrough(adStrippingStream());
  }
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

let blocklist = null;
try {
  importScripts("/assets/js/blocklist.js?v=sj4");
  blocklist = self.GHOSTY_BLOCKLIST;
} catch (err) {
  console.error("[sw] blocklist unavailable:", err);
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

// ── ad and tracker blocking ──────────────────────────────────────────────────────
// The proxy already sees every request a page makes, decoded, so this is the one place
// where blocking costs nothing extra. Matching is by domain suffix on a label boundary,
// so "ads.example.com" never matches "example.com" by accident and vice versa.
let blockingOn = true;
let blockedCount = 0;
// Player responses that had their ad fields renamed. Counted apart from the domain
// blocks so the badge does not claim a network request was stopped when it was not.
let ytAdsStripped = 0;
const blockSuffixes = blocklist || [];

function isBlocked(hostname) {
  if (!blockingOn || !blockSuffixes.length) return false;
  const host = hostname.toLowerCase();
  for (const suffix of blockSuffixes) {
    if (host === suffix || host.endsWith("." + suffix)) return true;
  }
  return false;
}

// The real destination of a proxied request, or null when it is not one.
function targetOf(url) {
  try {
    if (url.pathname.startsWith(SCRAM_PREFIX)) {
      return new URL(xorDecode(url.pathname.slice(SCRAM_PREFIX.length)));
    }
    if (uv && url.pathname.startsWith(UV_PREFIX)) {
      return new URL(__uv$config.decodeUrl(url.pathname.slice(UV_PREFIX.length)));
    }
  } catch {}
  return null;
}

// A blocked request must still look like a normal answer or the page's own error
// handling fires; an empty 200 of the right shape is the quietest thing to return.
function blockedResponse(request) {
  const destination = request.destination;
  if (destination === "script") {
    return new Response("", { status: 200, headers: { "content-type": "application/javascript" } });
  }
  if (destination === "style") {
    return new Response("", { status: 200, headers: { "content-type": "text/css" } });
  }
  if (destination === "image") {
    // 1x1 transparent GIF, so layouts that size themselves off the image still work.
    const gif = Uint8Array.from(
      atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
      c => c.charCodeAt(0),
    );
    return new Response(gif, { status: 200, headers: { "content-type": "image/gif" } });
  }
  return new Response("", { status: 200, headers: { "content-type": "text/plain" } });
}

async function announceBlocked() {
  try {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({
        ghosty: "blocked",
        count: blockedCount + ytAdsStripped,
        requests: blockedCount,
        players: ytAdsStripped,
      });
    }
  } catch {}
}

self.addEventListener("message", event => {
  const data = event.data;
  if (!data || data.ghosty !== "config") return;
  if (typeof data.blocking === "boolean") blockingOn = data.blocking;
  if (data.reset) {
    blockedCount = 0;
    ytAdsStripped = 0;
  }
  announceBlocked();
});

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

// Second chance for a page Scramjet cannot serve. The two engines rewrite differently,
// so a site that trips one often works on the other; the host is remembered and sent to
// the pages, which pin it to Ultraviolet from then on instead of failing first every time.
const uvHosts = new Set();

async function failOverToUv(event, requestUrl) {
  if (!uv) return null;
  const destination = event.request.destination;
  if (destination !== "document" && destination !== "iframe") return null;

  let target;
  try {
    target = new URL(xorDecode(requestUrl.pathname.slice(SCRAM_PREFIX.length)));
  } catch {
    return null;
  }

  try {
    const request = new Request(location.origin + UV_PREFIX + __uv$config.encodeUrl(target.href), {
      method: event.request.method,
      headers: event.request.headers,
      mode: "same-origin",
      credentials: event.request.credentials,
      redirect: event.request.redirect,
    });
    const answer = await uv.fetch({ request, clientId: event.clientId });
    if (!answer) return null;
    uvHosts.add(target.hostname);
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ ghosty: "failover", host: target.hostname });
    }
    console.warn("[sw] scramjet failed for", target.hostname, "— served through ultraviolet");
    return answer;
  } catch (err) {
    console.error("[sw] ultraviolet failover failed:", err);
    return null;
  }
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

      // Checked before either engine runs, so a blocked tracker never opens a socket.
      // Navigations are exempt: blocking one would strand the user on a blank tab.
      if (!isTopLevelNav(event) && event.request.destination !== "iframe") {
        const target = targetOf(requestUrl);
        if (target && isBlocked(target.hostname)) {
          blockedCount++;
          announceBlocked();
          return blockedResponse(event.request);
        }
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
        if (requestUrl.pathname.startsWith(SCRAM_PREFIX)) {
          const rescued = await failOverToUv(event, requestUrl);
          if (rescued) return rescued;
          // A /a/ path belongs to nobody else. Falling through would hand the frame the
          // server's own 404 page, and the frame would keep it.
          return notReady(event);
        }
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
