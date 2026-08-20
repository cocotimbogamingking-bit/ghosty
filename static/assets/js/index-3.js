// index.js — the service worker and the engines are registered by assets/js/engine.js
let xl;

try {
  xl = window.top.location.pathname === "/d";
} catch {
  try {
    xl = window.parent.location.pathname === "/d";
  } catch {
    xl = false;
  }
}

const form = document.getElementById("fv");
const input = document.getElementById("input");

if (form && input) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      if (xl) processUrl(input.value, "");
      else processUrl(input.value, "/d");
    } catch {
      processUrl(input.value, "/d");
    }
  });
}
function processUrl(value, path) {
  let url = value.trim();
  const engine = localStorage.getItem("engine");
  const searchUrl = engine ? engine : "https://search.brave.com/search?q=";

  if (!isUrl(url)) {
    url = searchUrl + url;
  } else if (!(url.startsWith("https://") || url.startsWith("http://"))) {
    url = `https://${url}`;
  }

  const proxied = __ghosty.url(url);
  sessionStorage.setItem("GoUrl", proxied);
  remember(url);
  const dy = localStorage.getItem("dy");

  if (dy === "true") {
    window.location.href = `/a/q/${__uv$config.encodeUrl(url)}`;
  } else if (path) {
    location.href = path;
  } else {
    window.location.href = proxied;
  }
}

function go(value) {
  processUrl(value, "/d");
}

function blank(value) {
  processUrl(value);
}

function dy(value) {
  processUrl(value, `/a/q/${__uv$config.encodeUrl(value)}`);
}

// Feeds the recent-sites row on the home page. Search-engine queries are skipped:
// the row is for places to go back to, not for a log of what was typed.
function remember(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const engine = localStorage.getItem("engine") || "https://search.brave.com/search?q=";
    if (host === new URL(engine).hostname.replace(/^www\./, "")) return;
    const list = JSON.parse(localStorage.getItem("ghostyRecent") || "[]").filter(
      entry => entry && entry.host !== host,
    );
    list.unshift({ host, url });
    localStorage.setItem("ghostyRecent", JSON.stringify(list.slice(0, 6)));
  } catch {}
}

function isUrl(val = "") {
  if (/^http(s?):\/\//.test(val) || (val.includes(".") && val.substr(0, 1) !== " ")) {
    return true;
  }
  return false;
}






