let qp;

try {
  qp = window.top.location.pathname === "/d";
} catch {
  try {
    qp = window.parent.location.pathname === "/d";
  } catch {
    qp = false;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  // Custom initialization

  const nav = document.querySelector(".f-nav");

  if (nav) {
    const themeId = localStorage.getItem("theme");
    const here = window.location.pathname;
    // data-label drives the hover plate; without it the icons are a guessing game.
    const link = (href, icon, label, extra = "") =>
      `<a class="sidebar-link${here === href ? " active" : ""}" href="${href}" data-label="${label}"${extra}>
         <i class="fa-solid ${icon}"></i>
       </a>`;

    const html = `
      <div class="sidebar-top">
        <a class="sidebar-logo" href="/" data-label="Home">
           <i class="fa-solid fa-ghost"></i>
        </a>
      </div>
      <div class="sidebar-menu">
        ${link("/a", "fa-gamepad", "Games")}
        ${link("/b", "fa-compass", "Apps")}
        <a class="sidebar-link" href="#" data-label="Music" onclick="event.preventDefault(); go('https://soundcloud.com');">
           <i class="fa-solid fa-music"></i>
        </a>
        <a class="sidebar-link" href="#" data-label="Movies" onclick="event.preventDefault(); go('https://tubitv.com');">
           <i class="fa-solid fa-film"></i>
        </a>
        <div class="sidebar-rule"></div>
        <a class="sidebar-link" href="#" data-label="Search everything &nbsp;Ctrl K"
           onclick="event.preventDefault(); window.__ghostyPalette && window.__ghostyPalette.open();">
           <i class="fa-solid fa-bolt"></i>
        </a>
      </div>
      <div class="sidebar-bottom">
        ${qp ? "" : link("/d", "fa-plus", "New tab")}
        ${link("/c", "fa-gear", "Settings")}
      </div>`;
    nav.innerHTML = html;

    // Inject Glow Background
    if (!document.querySelector(".glow-wrapper")) {
      const glowStr = `
        <div class="glow-orb glow-1"></div>
        <div class="glow-orb glow-2"></div>
        <div class="glow-orb glow-3"></div>
      `;
      const wrapper = document.createElement("div");
      wrapper.className = "glow-wrapper";
      wrapper.innerHTML = glowStr;
      document.body.insertBefore(wrapper, document.body.firstChild);
    }

    // Inject Top Nav ONLY if not on Home page
    const pathName = window.location.pathname.replace(".html", "").replace("/", "");
    const isHome = pathName === "" || pathName === "index" || pathName === "home";

    if (!document.querySelector(".top-nav") && !isHome) {
      const displayPath = pathName === "a" ? "games" : pathName === "b" ? "apps" : pathName === "c" ? "settings" : pathName || "home";
      // Every control here used to be a decorative <i> with no handler. They now do
      // what their icon says, which is the whole point of putting them on screen.
      const topnavStr = `
         <div class="nav-actions">
            <i class="fa-solid fa-arrow-left" title="Back" onclick="history.back()"></i>
            <i class="fa-solid fa-arrow-right" title="Forward" onclick="history.forward()"></i>
            <i class="fa-solid fa-rotate-right" title="Reload" onclick="location.reload()"></i>
         </div>
         <div class="url-bar-container">
           <div class="url-bar" title="Search everything (Ctrl+K)"
                onclick="window.__ghostyPalette && window.__ghostyPalette.open()">
              <i class="fa-solid fa-lock"></i>
              <span class="prefix">ghosty://</span><span class="path">${displayPath}</span>
              <kbd class="url-kbd">Ctrl K</kbd>
           </div>
         </div>
         <div class="right-actions">
            <i class="fa-solid fa-bolt" title="Command palette"
               onclick="window.__ghostyPalette && window.__ghostyPalette.open()"></i>
            <i class="fa-solid fa-gamepad" title="Games" onclick="(window.ghostNav||(u=>location.href=u))('/a')"></i>
            <i class="fa-solid fa-window-restore" title="Tabs" onclick="(window.ghostNav||(u=>location.href=u))('/d')"></i>
            <i class="fa-solid fa-gear" title="Settings" onclick="(window.ghostNav||(u=>location.href=u))('/c')"></i>
         </div>
      `;
      const tnav = document.createElement("div");
      tnav.className = "top-nav";
      tnav.innerHTML = topnavStr;
      document.body.insertBefore(tnav, nav.nextSibling);
    }
  }

  // LocalStorage Setup for 'dy'
  if (localStorage.getItem("dy") === null || localStorage.getItem("dy") === undefined) {
    localStorage.setItem("dy", "false");
  }

  // Theme Logic
  const themeid = localStorage.getItem("theme");
  const themeEle = document.createElement("link");
  themeEle.rel = "stylesheet";
  const themes = {
    catppuccinMocha: "/assets/css/themes/catppuccin/mocha.css?v=00",
    catppuccinMacchiato: "/assets/css/themes/catppuccin/macchiato.css?v=00",
    catppuccinFrappe: "/assets/css/themes/catppuccin/frappe.css?v=00",
    catppuccinLatte: "/assets/css/themes/catppuccin/latte.css?v=00",
    Inverted: "/assets/css/themes/colors/inverted.css?v=00",
    sky: "/assets/css/themes/colors/sky.css?v=00",
  };

  if (themes[themeid]) {
    themeEle.href = themes[themeid];
    document.body.appendChild(themeEle);
  } else {
    const customThemeEle = document.createElement("style");
    customThemeEle.textContent = localStorage.getItem(`theme-${themeid}`);
    document.head.appendChild(customThemeEle);
  }

  // Favicon and Name Logic
  const icon = document.getElementById("tab-favicon");
  const name = document.getElementById("t");
  const selectedValue = localStorage.getItem("selectedOption");

  function setCloak(nameValue, iconUrl) {
    const customName = localStorage.getItem("CustomName");
    const customIcon = localStorage.getItem("CustomIcon");

    let FinalNameValue = nameValue;
    let finalIconUrl = iconUrl;

    if (customName) {
      FinalNameValue = customName;
    }
    if (customIcon) {
      finalIconUrl = customIcon;
    }

    if (finalIconUrl) {
      icon.setAttribute("href", finalIconUrl);
      localStorage.setItem("icon", finalIconUrl);
    }
    if (FinalNameValue) {
      name.textContent = FinalNameValue;
      localStorage.setItem("name", FinalNameValue);
    }
  }

  const options = {
    Google: { name: "Google", icon: "/assets/media/favicon/google.png" },
    "Savvas Realize": {
      name: "Savvas Realize",
      icon: "/assets/media/favicon/savvas-realize.png",
    },
    SmartPass: {
      name: "SmartPass",
      icon: "/assets/media/favicon/smartpass.png",
    },
    "World Book Online - Super Home": {
      name: "Super Home Page",
      icon: "/assets/media/favicon/wbo.ico",
    },
    "World Book Online - Student": {
      name: "WBO Student | Home Page",
      icon: "/assets/media/favicon/wbo.ico",
    },
    "World Book Online - Timelines": {
      name: "Timelines - Home Page",
      icon: "/assets/media/favicon/wbo.ico",
    },
    Naviance: {
      name: "Naviance Student",
      icon: "/assets/media/favicon/naviance.png",
    },
    "PBS Learning Media": {
      name: "PBS LearningMedia | Teaching Resources For Students And Teachers",
      icon: "/assets/media/favicon/pbslearningmedia.ico",
    },
    "PBS Learning Media Student Home": {
      name: "Student Homepage | PBS LearningMedia",
      icon: "/assets/media/favicon/pbslearningmedia.ico",
    },
    Drive: {
      name: "My Drive - Google Drive",
      icon: "/assets/media/favicon/drive.png",
    },
    Classroom: { name: "Home", icon: "/assets/media/favicon/classroom.png" },
    Schoology: {
      name: "Home | Schoology",
      icon: "/assets/media/favicon/schoology.png",
    },
    Gmail: { name: "Gmail", icon: "/assets/media/favicon/gmail.png" },
    Clever: {
      name: "Clever | Portal",
      icon: "/assets/media/favicon/clever.png",
    },
    Khan: {
      name: "Dashboard | Khan Academy",
      icon: "/assets/media/favicon/khan.png",
    },
    Dictionary: {
      name: "Dictionary.com | Meanings & Definitions of English Words",
      icon: "/assets/media/favicon/dictionary.png",
    },
    Thesaurus: {
      name: "Synonyms and Antonyms of Words | Thesaurus.com",
      icon: "/assets/media/favicon/thesaurus.png",
    },
    Campus: {
      name: "Infinite Campus",
      icon: "/assets/media/favicon/campus.png",
    },
    IXL: { name: "IXL | Dashboard", icon: "/assets/media/favicon/ixl.png" },
    Canvas: { name: "Dashboard", icon: "/assets/media/favicon/canvas.png" },
    CodeHS: { name: "Sandbox | CodeHS", icon: "/assets/media/favicon/codehs.png" },
    LinkIt: { name: "Test Taker", icon: "/assets/media/favicon/linkit.ico" },
    Edpuzzle: { name: "Edpuzzle", icon: "/assets/media/favicon/edpuzzle.png" },
    "i-Ready Math": {
      name: "Math To Do, i-Ready",
      icon: "/assets/media/favicon/i-ready.ico",
    },
    "i-Ready Reading": {
      name: "Reading To Do, i-Ready",
      icon: "/assets/media/favicon/i-ready.ico",
    },
    "ClassLink Login": {
      name: "Login",
      icon: "/assets/media/favicon/classlink-login.png",
    },
    "Google Meet": {
      name: "Google Meet",
      icon: "/assets/media/favicon/google-meet.png",
    },
    "Google Docs": {
      name: "Google Docs",
      icon: "/assets/media/favicon/google-docs.ico",
    },
    "Google Slides": {
      name: "Google Slides",
      icon: "/assets/media/favicon/google-slides.ico",
    },
    Wikipedia: {
      name: "Wikipedia",
      icon: "/assets/media/favicon/wikipedia.png",
    },
    Britannica: {
      name: "Encyclopedia Britannica | Britannica",
      icon: "/assets/media/favicon/britannica.png",
    },
    Ducksters: {
      name: "Ducksters",
      icon: "/assets/media/favicon/ducksters.png",
    },
    Minga: {
      name: "Minga – Creating Amazing Schools",
      icon: "/assets/media/favicon/minga.png",
    },
    "i-Ready Learning Games": {
      name: "Learning Games, i-Ready",
      icon: "/assets/media/favicon/i-ready.ico",
    },
    "NoRedInk Home": {
      name: "Student Home | NoRedInk",
      icon: "/assets/media/favicon/noredink.png",
    },
    Desmos: {
      name: "Desmos | Graphing Calculator",
      icon: "/assets/media/favicon/desmos.ico",
    },
    "Newsela Binder": {
      name: "Newsela | Binder",
      icon: "/assets/media/favicon/newsela.png",
    },
    "Newsela Assignments": {
      name: "Newsela | Assignments",
      icon: "/assets/media/favicon/newsela.png",
    },
    "Newsela Home": {
      name: "Newsela | Instructional Content Platform",
      icon: "/assets/media/favicon/newsela.png",
    },
    "PowerSchool Sign In": {
      name: "Student and Parent Sign In",
      icon: "/assets/media/favicon/powerschool.png",
    },
    "PowerSchool Grades and Attendance": {
      name: "Grades and Attendance",
      icon: "/assets/media/favicon/powerschool.png",
    },
    "PowerSchool Teacher Comments": {
      name: "Teacher Comments",
      icon: "/assets/media/favicon/powerschool.png",
    },
    "PowerSchool Standards Grades": {
      name: "Standards Grades",
      icon: "/assets/media/favicon/powerschool.png",
    },
    "PowerSchool Attendance": {
      name: "Attendance",
      icon: "/assets/media/favicon/powerschool.png",
    },
    Nearpod: { name: "Nearpod", icon: "/assets/media/favicon/nearpod.png" },
    StudentVUE: {
      name: "StudentVUE",
      icon: "/assets/media/favicon/studentvue.ico",
    },
    "Quizlet Home": {
      name: "Flashcards, learning tools and textbook solutions | Quizlet",
      icon: "/assets/media/favicon/quizlet.webp",
    },
    "Google Forms Locked Mode": {
      name: "Start your quiz",
      icon: "/assets/media/favicon/googleforms.png",
    },
    DeltaMath: {
      name: "DeltaMath",
      icon: "/assets/media/favicon/deltamath.png",
    },
    Kami: { name: "Kami", icon: "/assets/media/favicon/kami.png" },
    "GoGuardian Admin Restricted": {
      name: "Restricted",
      icon: "/assets/media/favicon/goguardian-lock.png",
    },
    "GoGuardian Teacher Block": {
      name: "Uh oh!",
      icon: "/assets/media/favicon/goguardian.png",
    },
    "World History Encyclopedia": {
      name: "World History Encyclopedia",
      icon: "/assets/media/favicon/worldhistoryencyclopedia.png",
    },
    "Big Ideas Math Assignment Player": {
      name: "Assignment Player",
      icon: "/assets/media/favicon/bim.ico",
    },
    "Big Ideas Math": {
      name: "Big Ideas Math",
      icon: "/assets/media/favicon/bim.ico",
    },
  };

  if (options[selectedValue]) {
    setCloak(options[selectedValue].name, options[selectedValue].icon);
  }

  // Event Key Logic
  const eventKey = JSON.parse(localStorage.getItem("eventKey")) || ["Ctrl", "E"];
  const pLink = localStorage.getItem("pLink") || "https://classroom.google.com/";
  let pressedKeys = [];

  document.addEventListener("keydown", event => {
    pressedKeys.push(event.key);
    if (pressedKeys.length > eventKey.length) {
      pressedKeys.shift();
    }
    if (eventKey.every((key, index) => key === pressedKeys[index])) {
      window.location.href = pLink;
      pressedKeys = [];
    }
  });

  // Background Image Logic
  const savedBackgroundImage = localStorage.getItem("backgroundImage");
  if (savedBackgroundImage) {
    document.body.style.backgroundImage = `url('${savedBackgroundImage}')`;
  }

  // ═══ iPhone-Style Disclaimer Notification (every 5 min) ═══
  (function initDisclaimerNotif() {
    // Inject styles once
    const style = document.createElement("style");
    style.textContent = `
      /* Slides in from the right, low on the page. Up at the top it covered the
         library's "Surprise me" button and the right end of the search bar for as
         long as it was on screen. */
      .ios-notif {
        position: fixed;
        bottom: 52px;
        right: 20px;
        width: 330px;
        max-width: calc(100vw - 40px);
        background: rgba(25, 23, 21, 0.94);
        -webkit-backdrop-filter: blur(22px);
        backdrop-filter: blur(22px);
        border: 1px solid var(--line-2, rgba(244,239,230,0.13));
        border-radius: 14px;
        padding: 14px 16px;
        z-index: 99980;
        cursor: pointer;
        box-shadow: var(--lift-3, 0 16px 40px rgba(0,0,0,0.46));
        transform: translateX(calc(100% + 30px));
        opacity: 0;
        transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease;
        font-family: var(--sans, 'Inter', system-ui, sans-serif);
      }
      .ios-notif.show {
        transform: translateX(0);
        opacity: 1;
      }
      .ios-notif.hide {
        transform: translateX(calc(100% + 30px));
        opacity: 0;
      }
      .ios-notif-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 9px;
      }
      .ios-notif-icon {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: rgba(210, 163, 93, 0.11);
        border: 1px solid var(--line, rgba(244,239,230,0.07));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: var(--brass, #d2a35d);
        flex-shrink: 0;
      }
      .ios-notif-app {
        font-size: 11.5px;
        font-weight: 500;
        color: var(--paper-2, #b7ae9f);
        flex: 1;
        letter-spacing: 0.01em;
      }
      .ios-notif-time {
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--paper-4, #57504a);
      }
      .ios-notif-title {
        font-family: var(--serif, Georgia, serif);
        font-size: 16px;
        font-weight: 400;
        letter-spacing: -0.015em;
        color: var(--paper, #f4efe6);
        margin-bottom: 5px;
      }
      .ios-notif-body {
        font-size: 12px;
        color: var(--paper-3, #82796d);
        line-height: 1.55;
      }
      .ios-notif-grab {
        display: none;
      }
    `;
    document.head.appendChild(style);

    function showDisclaimer() {
      // Don't show if splash screen is still visible
      if (document.getElementById("splash-screen")) return;

      // Remove any existing
      const existing = document.querySelector(".ios-notif");
      if (existing) existing.remove();

      const notif = document.createElement("div");
      notif.className = "ios-notif";
      notif.innerHTML = `
        <div class="ios-notif-header">
          <div class="ios-notif-icon"><i class="fa-solid fa-ghost"></i></div>
          <span class="ios-notif-app">Ghosty</span>
          <span class="ios-notif-time">now</span>
        </div>
        <div class="ios-notif-title">A quick disclaimer</div>
        <div class="ios-notif-body">
          For local testing and educational use only. The developer is not
          responsible for misuse during school hours or in restricted
          environments. Use at your own risk.
        </div>
      `;

      // Dismiss on click
      notif.addEventListener("click", () => {
        notif.classList.remove("show");
        notif.classList.add("hide");
        setTimeout(() => notif.remove(), 500);
      });

      document.body.appendChild(notif);

      // Slide in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          notif.classList.add("show");
        });
      });

      // Auto dismiss after 8 seconds
      setTimeout(() => {
        if (notif.parentNode) {
          notif.classList.remove("show");
          notif.classList.add("hide");
          setTimeout(() => notif.remove(), 500);
        }
      }, 8000);
    }

    // Show first time after 10 seconds, then every 5 minutes
    setTimeout(showDisclaimer, 10000);
    setInterval(showDisclaimer, 5 * 60 * 1000);
  })();
});
