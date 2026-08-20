// Ghosty transport: Epoxy first, the bare server as a rescue.
//
// Epoxy speaks HTTP/2 over Wisp and is the fast path for everything. A handful of
// hosts — gemini.google.com is the one that started this — answer with a frame the
// WASM h2 client rejects, and the whole request dies with PROTOCOL_ERROR. The bare
// server on this same origin talks plain HTTP/1.1, so it gets those pages.
//
// Websockets stay on Epoxy: they were measured working and bare's socket protocol
// buys nothing here.

// Static, not a dynamic import inside init(): deferring it costs eleven seconds on
// the first proxied request, because nothing starts fetching the wasm until then.
import EpoxyTransport from "/epoxy/index.mjs?v=hdrpatch2";

const BARE = "/ca/v3/";
const MAX_HEADER_VALUE = 3072;

// Hop-by-hop names plus the ones the bare server refuses to relay.
const SKIP_SEND = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "accept-encoding",
]);

// bare-mux hands headers over as an array of pairs on some paths and as a plain
// object on others. The bundled epoxy build carries the same normalisation.
function headerPairs(headers) {
  if (!headers) return [];
  return headers[Symbol.iterator] ? [...headers] : Object.entries(headers);
}

function joinBareHeaders(headers) {
  if (headers.has("x-bare-headers")) return headers.get("x-bare-headers");
  const parts = [];
  for (const [name, value] of headers) {
    if (!name.startsWith("x-bare-headers-")) continue;
    parts[parseInt(name.slice("x-bare-headers-".length), 10)] = value.startsWith(";")
      ? value.slice(1)
      : value;
  }
  return parts.join("");
}

function siteOf(host) {
  const parts = String(host).split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : host;
}

// The Sec-Fetch-* trio describes the browsing context, and every proxied request
// leaves from our own origin inside an iframe, so the browser stamps values that
// describe Ghosty rather than the site being visited. Google's login endpoint reads
// them: it answers 401 to `cross-site`, and to any partial set, and only serves the
// sign-in page for a coherent top-level navigation. That is exactly what the user is
// doing, so restate it that way — site recomputed from the real referer, and the
// iframe Ghosty renders into reported as the document it is standing in for.
//
// Measured on accounts.google.com/ServiceLogin: no headers 302, site alone 401,
// site+mode 401, site+dest 401, all three consistent 302.
function fixSecFetch(pairs, remote) {
  let referer = null;
  const at = { site: -1, mode: -1, dest: -1 };
  for (let i = 0; i < pairs.length; i++) {
    const name = String(pairs[i][0]).toLowerCase();
    if (name === "referer") referer = pairs[i][1];
    else if (name === "sec-fetch-site") at.site = i;
    else if (name === "sec-fetch-mode") at.mode = i;
    else if (name === "sec-fetch-dest") at.dest = i;
  }
  if (at.site < 0 && at.mode < 0 && at.dest < 0) return pairs;

  let site = "none";
  if (referer) {
    try {
      const from = new URL(referer);
      if (from.origin === remote.origin) site = "same-origin";
      else if (siteOf(from.hostname) === siteOf(remote.hostname)) site = "same-site";
      else site = "cross-site";
    } catch {
      site = "cross-site";
    }
  }

  const copy = pairs.slice();
  const put = (index, name, value) => {
    if (index < 0) copy.push([name, value]);
    else copy[index] = [copy[index][0], value];
  };

  const dest = at.dest < 0 ? "" : String(copy[at.dest][1]);
  const mode = at.mode < 0 ? "" : String(copy[at.mode][1]);
  const navigating = mode === "navigate" || dest === "document" || dest === "iframe";

  put(at.site, "sec-fetch-site", site);
  put(at.mode, "sec-fetch-mode", navigating ? "navigate" : mode || "no-cors");
  put(at.dest, "sec-fetch-dest", navigating ? "document" : dest || "empty");
  return copy;
}

async function drain(body) {
  if (body == null) return null;
  if (typeof body === "string") return body;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body;
  if (body instanceof Blob) return await body.arrayBuffer();
  if (typeof body.getReader === "function") return await new Response(body).arrayBuffer();
  return body;
}

export default class GhostyTransport {
  ready = false;

  constructor(options) {
    this.options = options || {};
    this.epoxy = null;
    // Hosts epoxy has already proven it cannot serve. Retrying it on every asset of
    // a page that is going to fail anyway just doubles the wait.
    this.h1Hosts = new Set();
  }

  async init() {
    this.epoxy = new EpoxyTransport(this.options);
    await this.epoxy.init();
    this.ready = true;
  }

  async meta() {}

  async request(remote, method, body, headers, signal) {
    const host = remote.hostname;
    const buffered = await drain(body);
    const sending = fixSecFetch(headerPairs(headers), remote);

    if (!this.h1Hosts.has(host)) {
      try {
        return await this.epoxy.request(remote, method, buffered, sending, signal);
      } catch (err) {
        const reason = String(err && err.message ? err.message : err);
        // A rescue is only worth it for a transport-level failure. An aborted
        // request is the caller changing its mind, not the engine breaking.
        if (signal && signal.aborted) throw err;
        this.h1Hosts.add(host);
        console.warn("[transport] epoxy failed on " + host + ", retrying over HTTP/1.1:", reason);
      }
    }

    return await this.bareRequest(remote, method, buffered, sending, signal);
  }

  async bareRequest(remote, method, body, headers, signal) {
    const send = {};
    for (const [name, value] of headerPairs(headers)) {
      if (SKIP_SEND.has(String(name).toLowerCase())) continue;
      send[name] = value;
    }
    // The bare server pipes the upstream bytes through untouched, so asking for a
    // compressed body would hand Scramjet brotli it never decodes.
    send["Accept-Encoding"] = "identity";
    if (!send["User-Agent"] && !send["user-agent"]) send["User-Agent"] = navigator.userAgent;

    const outgoing = new Headers();
    outgoing.set("x-bare-url", remote.href);
    const encoded = JSON.stringify(send);
    if (encoded.length > MAX_HEADER_VALUE) {
      let part = 0;
      for (let at = 0; at < encoded.length; at += MAX_HEADER_VALUE) {
        outgoing.set("x-bare-headers-" + part++, ";" + encoded.slice(at, at + MAX_HEADER_VALUE));
      }
    } else {
      outgoing.set("x-bare-headers", encoded);
    }

    const answer = await fetch(BARE, {
      method,
      headers: outgoing,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      signal,
      redirect: "manual",
      credentials: "omit",
    });

    if (!answer.headers.has("x-bare-status") && !answer.headers.has("x-bare-headers-0")) {
      throw new Error("bare server error " + answer.status + ": " + (await answer.text()).slice(0, 200));
    }

    const raw = JSON.parse(joinBareHeaders(answer.headers) || "{}");
    // Same shape the bundled epoxy build returns: a plain object, lowercase names,
    // an array only where the upstream really sent the header more than once. An
    // array of pairs here reads back downstream as {0:"content-type",1:"date",...}.
    const out = {};
    for (const [name, value] of Object.entries(raw)) {
      const lower = name.toLowerCase();
      if (lower === "content-encoding" || lower === "content-length" || lower === "transfer-encoding") continue;
      const values = Array.isArray(value) ? value : [value];
      for (const one of values) {
        if (out[lower] === undefined) out[lower] = one;
        else if (Array.isArray(out[lower])) out[lower].push(one);
        else out[lower] = [out[lower], one];
      }
    }

    return {
      body: answer.body,
      headers: out,
      status: parseInt(answer.headers.get("x-bare-status") || "200", 10),
      statusText: answer.headers.get("x-bare-status-text") || "",
    };
  }

  connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
    return this.epoxy.connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror);
  }
}
