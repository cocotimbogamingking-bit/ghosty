// cloak.js
let appInd;
const g = window.location.pathname === "/a";
const a = window.location.pathname === "/b";
const c = window.location.pathname === "/gt";

let t;

try {
  t = window.top.location.pathname === "/d";
} catch {
  try {
    t = window.parent.location.pathname === "/d";
  } catch {
    t = false;
  }
}

function Span(name) {
  return name.split("").map(char => {
    const span = document.createElement("span");
    span.textContent = char;
    return span;
  });
}

function saveToLocal(path) {
  sessionStorage.setItem("GoUrl", path);
}

// Most of the bundled games ship no icon of their own. Rather than leave a hole in the
// grid, build a tile from the title: same name always gets the same hue, so the wall of
// cards stays varied but stable between reloads.
function initialsOf(name) {
  const words = String(name).replace(/[^\w\s.]/g, " ").trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hueOf(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

function makeTile(name) {
  const tile = document.createElement("div");
  tile.className = "tile-fallback";
  const hue = hueOf(String(name));
  // Folded into a warm band and drained of saturation: enough drift that two
  // neighbouring fallbacks are not identical, not enough to put a cool tile in
  // the middle of a warm page.
  const warm = 16 + (hue % 46);
  tile.style.setProperty("--tile-a", `hsl(${warm} 12% 19%)`);
  tile.style.setProperty("--tile-b", `hsl(${warm - 8} 14% 11%)`);
  tile.textContent = initialsOf(name);
  return tile;
}

function handleClick(app) {
  if (typeof app.say !== "undefined") {
    alert(app.say);
  }

  let Selected = app.link;
  if (app.links && app.links.length > 1) {
    Selected = getSelected(app.links);
    if (!Selected) {
      return false;
    }
  }

  if (app.local) {
    saveToLocal(Selected);
    if (t) {
      window.location.href = Selected;
    } else {
      window.location.href = "/d";
    }
  } else if (app.local2) {
    saveToLocal(Selected);
    window.location.href = Selected;
  } else if (app.blank) {
    blank(Selected);
  } else if (app.now) {
    now(Selected);
    if (t) {
      window.location.href = Selected;
    }
  } else if (app.custom) {
    Custom(app);
  } else if (app.dy) {
    dy(Selected);
  } else {
    go(Selected);
    if (t) {
      blank(Selected);
    }
  }
  return false;
}

function getSelected(links) {
  const options = links.map((link, index) => `${index + 1}: ${link.name}`).join("\n");
  const choice = prompt(`Select a link by entering the corresponding number:\n${options}`);
  const selectedIndex = Number.parseInt(choice, 10) - 1;

  if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= links.length) {
    alert("Invalid selection. Please try again.");
    return null;
  }

  return links[selectedIndex].url;
}

function CustomApp(customApp) {
  let apps;
  if (g) {
    apps = localStorage.getItem("Gcustom");
  } else if (c) {
    apps = localStorage.getItem("Tcustom");
  } else if (a) {
    apps = localStorage.getItem("Acustom");
  }

  if (apps === null) {
    apps = {};
  } else {
    apps = JSON.parse(apps);
  }

  const key = `custom${Object.keys(apps).length + 1}`;

  apps[key] = customApp;

  if (g) {
    localStorage.setItem("Gcustom", JSON.stringify(apps));
  } else if (c) {
    localStorage.setItem("Tcustom", JSON.stringify(apps));
  } else if (a) {
    localStorage.setItem("Acustom", JSON.stringify(apps));
  }
}

function setPin(index) {
  let pins;
  if (g) {
    pins = localStorage.getItem("Gpinned");
  } else if (c) {
    pins = localStorage.getItem("Tpinned");
  } else if (a) {
    pins = localStorage.getItem("Apinned");
  }

  if (pins === null || pins === "") {
    pins = [];
  } else {
    pins = pins.split(",").map(Number);
  }
  if (pinContains(index, pins)) {
    const remove = pins.indexOf(index);
    pins.splice(remove, 1);
  } else {
    pins.push(index);
  }
  if (g) {
    localStorage.setItem("Gpinned", pins);
  } else if (c) {
    localStorage.setItem("Tpinned", pins);
  } else if (a) {
    localStorage.setItem("Apinned", pins);
  }
  location.reload();
}

function pinContains(i, p) {
  if (p === "") {
    return false;
  }
  for (const x of p) {
    if (x === i) {
      return true;
    }
  }
  return false;
}

function Custom(app) {
  const title = prompt("Enter title for the app:");
  const link = prompt("Enter link for the app:");
  if (title && link) {
    const customApp = {
      name: `[Custom] ${title}`,
      link: link,
      image: "/assets/media/icons/custom.webp",
      custom: false,
    };

    CustomApp(customApp);
    CreateCustomApp(customApp);
  }
}

function CreateCustomApp(customApp) {
  const columnDiv = document.createElement("div");
  columnDiv.classList.add("column");
  columnDiv.setAttribute("data-category", "all");

  const pinIcon = document.createElement("i");
  pinIcon.classList.add("fa", "fa-map-pin");
  pinIcon.ariaHidden = true;

  const btn = document.createElement("button");
  btn.appendChild(pinIcon);
  btn.className = "pin-btn";
  btn.type = "button";
  btn.onclick = event => {
    event.stopPropagation();
    setPin(appInd);
  };
  btn.title = "Pin";

  const linkElem = document.createElement("a");
  linkElem.onclick = () => {
    handleClick(customApp);
  };

  const image = document.createElement("img");
  image.width = 145;
  image.height = 145;
  image.src = customApp.image;
  image.loading = "lazy";

  const paragraph = document.createElement("p");

  for (const span of Span(customApp.name)) {
    paragraph.appendChild(span);
  }

  linkElem.appendChild(image);
  linkElem.appendChild(paragraph);
  columnDiv.appendChild(linkElem);
  columnDiv.appendChild(btn);

  const nonPinnedApps = document.querySelector(".apps");
  nonPinnedApps.insertBefore(columnDiv, nonPinnedApps.firstChild);
}

document.addEventListener("DOMContentLoaded", () => {
  let storedApps;
  if (g) {
    storedApps = JSON.parse(localStorage.getItem("Gcustom"));
  } else if (c) {
    storedApps = JSON.parse(localStorage.getItem("Tcustom"));
  } else if (a) {
    storedApps = JSON.parse(localStorage.getItem("Acustom"));
  }
  if (storedApps) {
    for (const app of Object.values(storedApps)) {
      CreateCustomApp(app);
    }
  }
});

let path = "/assets/json/a.min.json";
if (g) {
  path = "/assets/json/g.min.json";
} else if (c) {
  path = "/assets/json/t.min.json";
} else if (a) {
  path = "/assets/json/a.min.json";
}
fetch(path)
  .then(response => {
    return response.json();
  })
  .then(appsList => {
    appsList.sort((a, b) => {
      if (a.name.startsWith("[Custom]")) {
        return -1;
      }
      if (b.name.startsWith("[Custom]")) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
    const nonPinnedApps = document.querySelector(".apps");
    const pinnedApps = document.querySelector(".pinned");
    let pinList;
    if (g) {
      pinList = localStorage.getItem("Gpinned") || "";
    } else if (a) {
      pinList = localStorage.getItem("Apinned") || "";
    } else if (c) {
      pinList = localStorage.getItem("Tpinned") || "";
    }
    pinList = pinList ? pinList.split(",").map(Number) : [];
    appInd = 0;

    for (const app of appsList) {
      if (app.categories?.includes("local")) {
        app.local = true;
      } else if (app.link && (app.link.includes("now.gg") || app.link.includes("nowgg.me"))) {
        if (app.partial === null || app.partial === undefined) {
          app.partial = true;
          app.say = "Now.gg is currently not working for some users.";
        }
      } else if (app.link?.includes("nowgg.nl")) {
        if (app.error === null || app.error === undefined) {
          app.error = true;
          app.say = "NowGG.nl is currently down.";
        }
      }

      const pinNum = appInd;

      const columnDiv = document.createElement("div");
      columnDiv.classList.add("column");
      columnDiv.setAttribute("data-category", app.categories.join(" "));

      const pinIcon = document.createElement("i");
      pinIcon.classList.add("fa", "fa-map-pin");
      pinIcon.ariaHidden = true;

      const btn = document.createElement("button");
      btn.appendChild(pinIcon);
      btn.className = "pin-btn";
      btn.type = "button";
      btn.onclick = event => {
        event.stopPropagation();
        setPin(pinNum);
      };
      btn.title = "Pin";

      const link = document.createElement("a");

      link.onclick = () => {
        handleClick(app);
      };

      let image;
      if (app.image) {
        image = document.createElement("img");
        image.width = 145;
        image.height = 145;
        image.loading = "lazy";
        image.src = app.image;
        // A dead icon URL used to leave the browser's broken-image glyph in the card.
        image.onerror = () => image.replaceWith(makeTile(app.name));
      } else {
        image = makeTile(app.name);
      }

      const paragraph = document.createElement("p");

      for (const span of Span(app.name)) {
        paragraph.appendChild(span);
      }

      // Terracotta and amber, not red and yellow. A broken tile should read as
      // a note in the margin, not as the loudest thing on the page.
      if (app.error) {
        columnDiv.classList.add("is-broken");
        if (!app.say) {
          app.say = "This app is currently not working.";
        }
      } else if (app.load) {
        columnDiv.classList.add("is-slow");
        if (!app.say) {
          app.say = "This app may experience excessive loading times.";
        }
      } else if (app.partial) {
        columnDiv.classList.add("is-slow");
        if (!app.say) {
          app.say = "This app is currently experiencing some issues, it may not work for you. (Dynamic doesn't work in about:blank)";
        }
      }

      link.appendChild(image);
      link.appendChild(paragraph);
      columnDiv.appendChild(link);

      if (appInd !== 0) {
        columnDiv.appendChild(btn);
      }

      if (pinList != null && appInd !== 0) {
        if (pinContains(appInd, pinList)) {
          pinnedApps.appendChild(columnDiv);
        } else {
          nonPinnedApps.appendChild(columnDiv);
        }
      } else {
        nonPinnedApps.appendChild(columnDiv);
      }
      appInd += 1;
    }

    const appsContainer = document.getElementById("apps-container");
    if (appsContainer) {
      appsContainer.appendChild(pinnedApps);
      appsContainer.appendChild(nonPinnedApps);
    }

    // The chips are built from what the catalogue actually contains, so a category
    // never appears with nothing behind it.
    const row = document.getElementById("category-row");
    if (row) {
      const LABELS = {
        all: "All",
        local: "Built in",
        "2P": "2 player",
        sports: "Sports",
        emu: "Emulators",
        flash: "Flash",
        android: "Android",
        game: "Cloud",
        media: "Media",
        social: "Social",
        tools: "Tools",
      };
      const counts = {};
      for (const card of document.getElementsByClassName("column")) {
        for (const name of (card.getAttribute("data-category") || "").split(" ")) {
          if (name && name !== "all") counts[name] = (counts[name] || 0) + 1;
        }
      }
      const order = Object.keys(counts)
        .filter(name => counts[name] >= 5 && LABELS[name])
        .sort((a, b) => counts[b] - counts[a]);

      const makeChip = (value, label) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (value === "all" ? " active" : "");
        chip.textContent = label;
        chip.addEventListener("click", () => setCategory(value, chip));
        row.appendChild(chip);
      };
      makeChip("all", LABELS.all);
      for (const name of order) makeChip(name, LABELS[name]);
    }
    applyFilter();
  })
  .catch(error => {
    console.error("Error fetching JSON data:", error);
  });

// Search text and category are applied together. They used to be two functions that each
// rewrote every card's display, so picking a category threw the search away and vice
// versa. The old code also set display:block on a flex card, which knocked the icon and
// the title out of their centred layout for the rest of the session.
let activeCategory = "all";

function applyFilter() {
  const input = document.getElementById("search");
  const text = input ? input.value.trim().toLowerCase() : "";
  const cards = document.getElementsByClassName("column");
  let shown = 0;

  for (const card of cards) {
    const title = card.getElementsByTagName("p")[0];
    const name = title ? title.textContent.toLowerCase() : "";
    const categories = (card.getAttribute("data-category") || "").split(" ");
    const matchesText = !text || name.includes(text);
    const matchesCategory = activeCategory === "all" || categories.includes(activeCategory);
    const visible = matchesText && matchesCategory;
    card.style.display = visible ? "" : "none";
    if (visible) shown++;
  }

  const counter = document.getElementById("result-count");
  if (counter) counter.textContent = shown + (shown === 1 ? " result" : " results");
  const empty = document.getElementById("no-results");
  if (empty) empty.hidden = shown > 0;
}

function setCategory(value, chip) {
  activeCategory = value;
  const row = document.getElementById("category-row");
  if (row) {
    for (const button of row.querySelectorAll(".chip")) button.classList.remove("active");
  }
  if (chip) chip.classList.add("active");
  applyFilter();
}

// Opens a random card that is currently visible, so it respects the filter you set.
function surpriseMe() {
  const visible = [...document.getElementsByClassName("column")].filter(
    card => card.style.display !== "none",
  );
  if (!visible.length) return;
  const pick = visible[Math.floor(Math.random() * visible.length)];
  const link = pick.querySelector("a");
  if (link) link.click();
}

// Kept because the markup still calls them by name.
function category() {
  applyFilter();
}

function bar() {
  applyFilter();
}
