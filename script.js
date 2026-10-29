(() => {
  "use strict";

  const STORAGE_KEY = "table-v2";
  const THEMES = ["light", "night", "dark"];
  const ROT_STEP = 15;
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.6;

  const LAMP_W = 240;
  const LAMP_H = 240;
  const LAMP_OX = 130;
  const LAMP_OY = 100;
  const LAMP_DIR = { x: 0.574, y: 0.819 };

  const WOODS = [
    { name: "Oak", color: "#e0b074" },
    { name: "Maple", color: "#efd0a0" },
    { name: "Walnut", color: "#8a5a3a" },
    { name: "Cherry", color: "#b4573f" },
    { name: "Ash", color: "#c9b8a2" },
    { name: "Midnight", color: "#6a5aa8" },
    { name: "Teal", color: "#4b8a8c" },
  ];
  const DEFAULT_WOOD = WOODS[0].color;

  const desk = document.getElementById("desk");
  const itemsEl = document.getElementById("items");
  const plantsEl = document.getElementById("plants");
  const addMenu = document.getElementById("addMenu");
  const swatchesEl = document.getElementById("swatches");
  const woodPicker = document.getElementById("woodPicker");
  const resetBtn = document.getElementById("resetBtn");
  const engineSel = document.getElementById("engine");

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function uid() {
    return "w" + Math.random().toString(36).slice(2, 9);
  }

  const defaultState = () => ({
    theme: "light",
    wood: DEFAULT_WOOD,
    engine: "google",
    zTop: 20,
    items: [
      { id: uid(), type: "lamp", x: 0.042, y: 0.48, z: 1, rot: 0, scale: 0.6, data: { on: true } },
      { id: uid(), type: "note", x: 0.168, y: 0.364, z: 2, rot: -8, scale: 0.8, data: { text: "LETS GO\nHACKCUB!!", color: "pink" } },
      { id: uid(), type: "todo", x: 0.302, y: 0.047, z: 3, rot: -6, scale: 0.82, data: { tasks: [{ t: "ship", d: false }, { t: "super star", d: false }] } },
      { id: uid(), type: "weather", x: 0.603, y: 0.038, z: 4, rot: 0, scale: 0.6, data: { city: null, unit: "c", cache: null } },
      { id: uid(), type: "timer", x: 0.798, y: 0.028, z: 5, rot: 0, scale: 0.86, data: { mins: 5, left: 300, endAt: null } },
      { id: uid(), type: "note", x: 0.749, y: 0.509, z: 6, rot: 10, scale: 0.8, data: { text: "What is the\npurpose of life\nif not super\nstar??", color: "blue" } },
      { id: uid(), type: "search", x: 0.495, y: 0.475, z: 7, rot: 0, scale: 1.14 },
      { id: uid(), type: "notebook", x: 0.222, y: 0.922, z: 8, rot: 10, scale: 0.72, data: { text: "", open: false } },
      { id: uid(), type: "link", x: 0.031, y: 0.842, z: 9, rot: 0, scale: 0.84, data: { label: "News", url: "https://news.google.com", color: "lilac", kind: "custom" } },
      { id: uid(), type: "link", x: 0.512, y: 0.933, z: 10, rot: 0, scale: 0.7, data: { label: "Mail", url: "https://mail.google.com", color: "pink", kind: "custom" } },
      { id: uid(), type: "clock", x: 0.727, y: 0.936, z: 11, rot: -8, scale: 0.9 },
      { id: uid(), type: "calendar", x: 0.961, y: 0.868, z: 12, rot: 0, scale: 0.84 },
    ],
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.items)) return defaultState();
      if (!s.wood) s.wood = DEFAULT_WOOD;
      if (!s.engine) s.engine = "google";
      return s;
    } catch {
      return defaultState();
    }
  }

  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {}
    }, 120);
  }

  const state = load();

  const ENGINES = {
    google: "https://www.google.com/search?q=",
    duckduckgo: "https://duckduckgo.com/?q=",
    bing: "https://www.bing.com/search?q=",
    brave: "https://search.brave.com/search?q=",
  };

  function engineLabel(k) {
    return { google: "Google", duckduckgo: "DuckDuckGo", bing: "Bing", brave: "Brave" }[k] || "Google";
  }

  function searchUrl(q) {
    if (/^(https?:\/\/)?[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(q)) {
      return /^https?:\/\//i.test(q) ? q : "https://" + q;
    }
    return (ENGINES[state.engine] || ENGINES.google) + encodeURIComponent(q);
  }

  const tickers = new Set();
  setInterval(() => tickers.forEach((f) => f()), 250);

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [0, 0.25, 0.5].forEach((t) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.22);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch {}
  }

  function wmo(code) {
    if (code === 0) return ["\u2600\ufe0f", "Clear"];
    if (code <= 2) return ["\u26c5", "Partly cloudy"];
    if (code === 3) return ["\u2601\ufe0f", "Cloudy"];
    if (code === 45 || code === 48) return ["\ud83c\udf2b\ufe0f", "Fog"];
    if (code >= 51 && code <= 57) return ["\ud83c\udf26\ufe0f", "Drizzle"];
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ["\ud83c\udf27\ufe0f", "Rain"];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ["\u2744\ufe0f", "Snow"];
    if (code >= 95) return ["\u26c8\ufe0f", "Storm"];
    return ["\u2601\ufe0f", "Cloudy"];
  }

  const SCREEN_KEY = "table-screen-v1";
  const screenLog = (() => {
    try {
      return JSON.parse(localStorage.getItem(SCREEN_KEY)) || {};
    } catch {
      return {};
    }
  })();
  const screenEls = new Set();
  let sinceSave = 0;

  const dayKey = (d) =>
    d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

  function fmtTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? h + "h " + m + "m" : m + "m";
  }

  function saveScreen() {
    const keys = Object.keys(screenLog).sort();
    while (keys.length > 30) delete screenLog[keys.shift()];
    try {
      localStorage.setItem(SCREEN_KEY, JSON.stringify(screenLog));
    } catch {}
  }

  function paintScreen(el) {
    const now = new Date();
    const vals = [];
    const names = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      vals.push(screenLog[dayKey(d)] || 0);
      names.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    }
    el.querySelector(".mon-total").textContent = fmtTime(vals[6]);
    el.querySelector(".mon-sub").textContent = vals[5]
      ? "Yesterday you spent " + fmtTime(vals[5]) + " here."
      : "Counted while this tab is open and visible.";
    const wk = el.querySelector(".mon-week");
    if (!wk.children.length) for (let i = 0; i < 7; i++) wk.appendChild(document.createElement("i"));
    const top = Math.max(...vals, 3600);
    [...wk.children].forEach((b, i) => {
      b.style.height = Math.max(4, Math.round((vals[i] / top) * 44)) + "px";
      b.title = names[i] + " " + fmtTime(vals[i]);
      b.classList.toggle("now", i === 6);
    });
  }

  setInterval(() => {
    if (document.visibilityState === "visible") {
      const k = dayKey(new Date());
      screenLog[k] = (screenLog[k] || 0) + 1;
      if (++sinceSave >= 15) {
        sinceSave = 0;
        saveScreen();
      }
    }
    screenEls.forEach((el) => {
      if (!el.isConnected) screenEls.delete(el);
      else paintScreen(el);
    });
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveScreen();
  });
  window.addEventListener("pagehide", saveScreen);

  function safeUrl(raw) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
    } catch {
      return null;
    }
  }

  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };

  const LINK_PRESETS = [
    ["News", "https://news.google.com", "paper", "news"],
    ["Trading", "https://www.tradingview.com", "ink", "trading"],
    ["Crypto", "https://www.coingecko.com", "yellow", "crypto"],
    ["Finance", "https://finance.yahoo.com", "mint", "finance"],
    ["Mail", "https://mail.google.com", "pink", "mail"],
    ["Maps", "https://maps.google.com", "blue", "maps"],
    ["Videos", "https://www.youtube.com", "ink", "videos"],
    ["Music", "https://open.spotify.com", "lilac", "music"],
    ["Code", "https://github.com", "ink", "code"],
    ["Docs", "https://docs.google.com", "blue", "docs"],
    ["Shopping", "https://www.amazon.com", "yellow", "shop"],
    ["Reddit", "https://www.reddit.com", "pink", "reddit"],
  ];

  const LINK_ART = {
    news: `<svg class="lk-art" viewBox="0 0 230 138" aria-hidden="true">
      <path class="k-ln" fill="none" style="stroke-width:3" d="M14 46H216"/>
      <path class="k-ln" fill="none" style="stroke-width:1.5" d="M14 51H216"/>
      <rect class="k-f1 k-ln" x="14" y="62" width="76" height="46" rx="2"/>
      <path class="k-f2" d="M15 107L40 84L58 98L72 86L89 107Z"/>
      <circle class="k-ac" cx="74" cy="76" r="6"/>
      <path class="k-soft" d="M102 68H216M102 80H216M102 92H190M102 104H216"/>
      <path class="k-soft" d="M14 120H216M14 130H150"/>
    </svg>`,
    mail: `<svg class="lk-art" viewBox="0 0 210 128" aria-hidden="true">
      <path class="k-f2 k-ln" d="M3 3L105 72L207 3Z"/>
      <rect class="k-ac k-ln" x="158" y="14" width="38" height="46" rx="2"/>
      <rect fill="none" stroke="var(--outline)" stroke-dasharray="3 3" style="stroke-width:1.5" x="163" y="19" width="28" height="36"/>
      <circle class="k-f2" cx="177" cy="37" r="7"/>
    </svg>`,
    trading: `<svg class="lk-art" viewBox="0 0 210 124" aria-hidden="true">
      <path fill="none" stroke="var(--digit)" style="stroke-width:2;opacity:.55" stroke-linecap="round" d="M92 74V112M112 66V104M132 70V100M152 52V92M172 40V80M192 28V66"/>
      <path fill="none" stroke="var(--digit)" style="stroke-width:1.5;opacity:.25" d="M80 114H204"/>
      <rect class="k-down" x="87" y="84" width="10" height="18" rx="2"/>
      <rect class="k-up" x="107" y="74" width="10" height="20" rx="2"/>
      <rect class="k-down" x="127" y="78" width="10" height="12" rx="2"/>
      <rect class="k-up" x="147" y="60" width="10" height="24" rx="2"/>
      <rect class="k-up" x="167" y="48" width="10" height="22" rx="2"/>
      <rect class="k-up" x="187" y="34" width="10" height="22" rx="2"/>
    </svg>`,
    crypto: `<svg class="lk-art" viewBox="0 0 190 112" aria-hidden="true">
      <circle class="k-f1 k-ln" cx="136" cy="76" r="26"/>
      <circle class="k-ac k-ln" cx="156" cy="50" r="32"/>
      <circle fill="none" class="k-ln" cx="156" cy="50" r="24"/>
      <path class="k-f2 k-ln" d="M156 34L171 50L156 66L141 50Z"/>
    </svg>`,
    finance: `<svg class="lk-art" viewBox="0 0 210 112" aria-hidden="true">
      <rect class="k-ln" fill="none" style="opacity:.55" x="8" y="8" width="194" height="96" rx="5"/>
      <circle class="k-f2 k-ln" cx="170" cy="56" r="26"/>
      <text class="k-ink" x="170" y="66" text-anchor="middle" style="font:700 30px Quicksand,sans-serif">$</text>
      <circle class="k-f1" cx="26" cy="92" r="5"/>
      <circle class="k-f1" cx="190" cy="20" r="5"/>
    </svg>`,
    maps: `<svg class="lk-art" viewBox="0 0 210 124" aria-hidden="true">
      <rect class="k-f2" x="70" y="0" width="70" height="124"/>
      <path class="k-ln" fill="none" style="opacity:.45" d="M70 0V124M140 0V124"/>
      <path class="k-route" d="M16 104C46 76 68 112 104 80S160 66 182 44"/>
      <path class="k-ac k-ln" d="M182 62C172 50 172 36 182 36C192 36 192 50 182 62Z"/>
      <circle class="k-ink" cx="182" cy="46" r="3"/>
    </svg>`,
    videos: `<svg class="lk-art" viewBox="0 0 200 130" aria-hidden="true">
      <path class="k-lt" d="M6 0H23L13 30H-4ZM40 0H57L47 30H30ZM74 0H91L81 30H64ZM108 0H125L115 30H98ZM142 0H159L149 30H132ZM176 0H193L183 30H166Z"/>
      <path class="k-ln" fill="none" d="M0 30H200"/>
      <path class="k-ac k-ln" d="M150 56L150 98L184 77Z"/>
    </svg>`,
    music: `<svg class="lk-art" viewBox="0 0 160 164" aria-hidden="true">
      <circle class="k-ln" style="fill:#17142a" cx="80" cy="64" r="48"/>
      <circle fill="none" stroke="#fff" style="stroke-opacity:.12;stroke-width:1.5" cx="80" cy="64" r="38"/>
      <circle fill="none" stroke="#fff" style="stroke-opacity:.12;stroke-width:1.5" cx="80" cy="64" r="29"/>
      <path fill="none" stroke="#fff" stroke-linecap="round" style="stroke-opacity:.22;stroke-width:3" d="M47 44A38 38 0 0 1 69 28"/>
      <circle class="k-ac k-ln" cx="80" cy="64" r="15"/>
      <circle class="k-ink" cx="80" cy="64" r="2.6"/>
    </svg>`,
    code: `<svg class="lk-art" viewBox="0 0 200 112" aria-hidden="true">
      <path fill="none" stroke="var(--ui-active)" stroke-linecap="round" stroke-linejoin="round" style="stroke-width:4" d="M20 32L38 46L20 60"/>
      <rect class="k-ac k-blink" x="112" y="52" width="12" height="4"/>
    </svg>`,
    docs: `<svg class="lk-art" viewBox="0 0 170 130" aria-hidden="true">
      <path class="k-f1 k-ln" d="M138 0L170 32H138Z"/>
      <path class="k-soft" d="M16 68H152M16 82H152M16 96H110"/>
    </svg>`,
    shop: `<svg class="lk-art" viewBox="0 0 160 130" aria-hidden="true">
      <path class="k-ln" fill="none" style="stroke-width:3" d="M52 0C52 -30 108 -30 108 0"/>
      <path class="k-ln" fill="none" style="opacity:.5" d="M0 20H160"/>
    </svg>`,
    reddit: `<svg class="lk-art" viewBox="0 0 190 110" aria-hidden="true">
      <path class="k-ln" style="fill:var(--face)" d="M24 108V128L50 108"/>
      <rect style="fill:var(--face)" x="25" y="104" width="24" height="6"/>
      <path class="k-ink" d="M158 40L170 24L182 40Z"/>
      <path class="k-ink" d="M158 52L170 68L182 52Z"/>
    </svg>`,
  };

  const TYPES = {
    lamp: {
      label: "Lamp",
      addable: true,
      removable: true,
      resizable: true,
      className: "lamp",
      data: () => ({ on: true }),
      build(el) {
        el.innerHTML = `
          <svg width="240" height="240" viewBox="0 -30 240 240" aria-label="Desk lamp">
            <ellipse class="lp-base-side" cx="70" cy="178" rx="58" ry="26"/>
            <ellipse class="lp-base" cx="70" cy="168" rx="58" ry="26"/>
            <ellipse class="lp-base-in" cx="72" cy="162" rx="30" ry="12"/>
            <path class="lp-stem-o" d="M72 158C70 122 76 92 100 52"/>
            <path class="lp-stem" d="M72 158C70 122 76 92 100 52"/>
            <g transform="rotate(-35 130 70)">
              <path class="lp-shell" d="M40 70A90 60 0 0 1 220 70Z"/>
              <path class="lp-shine" d="M62 60A74 48 0 0 1 118 24"/>
              <ellipse class="lp-rim" cx="130" cy="70" rx="90" ry="17"/>
              <ellipse class="lp-inner" cx="130" cy="72" rx="80" ry="12"/>
              <circle class="lp-bulb" cx="130" cy="72" r="9"/>
            </g>
          </svg>`;
      },
    },

    clock: {
      label: "Clock",
      addable: true,
      removable: true,
      resizable: true,
      className: "widget w-clock",
      build(el) {
        el.innerHTML = `
          <svg class="cat-ears" viewBox="0 0 56 34" aria-hidden="true">
            <path d="M6 34V12L14 3L22 11H34L42 3L50 12V34Z"/>
            <circle class="eye" cx="21" cy="24" r="2"/>
            <circle class="eye" cx="35" cy="24" r="2"/>
            <path class="mouth" d="M25 29Q28 32 28 28Q28 32 31 29"/>
          </svg>
          <div class="clock-screen" role="timer" aria-label="Clock">
            <div class="clock-hm"><b data-h>12</b><i>:</i><b data-m>00</b></div>
            <b class="clock-ap" data-ap>AM</b>
          </div>`;
        tickClocks();
      },
    },

    calendar: {
      label: "Calendar",
      addable: true,
      removable: true,
      resizable: true,
      className: "widget w-calendar",
      build(el) {
        const now = new Date();
        let y = now.getFullYear();
        let m = now.getMonth();
        let busy = false;

        function sheetHTML(yy, mm) {
          const first = new Date(yy, mm, 1).getDay();
          const days = new Date(yy, mm + 1, 0).getDate();
          const label = new Date(yy, mm, 1).toLocaleString("en-US", { month: "short" }).toUpperCase() + " " + yy;
          const isNow = yy === now.getFullYear() && mm === now.getMonth();
          let cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<span class="dow">${d}</span>`).join("");
          for (let i = 0; i < 42; i++) {
            const d = i - first + 1;
            cells += d >= 1 && d <= days ? `<span${isNow && d === now.getDate() ? ' class="today"' : ""}>${d}</span>` : "<span></span>";
          }
          return `
            <div class="cal-head">
              <button type="button" class="cal-nav" data-d="-1" aria-label="Previous month">\u2039</button>
              <button type="button" class="cal-month" title="Back to today">${label}</button>
              <button type="button" class="cal-nav" data-d="1" aria-label="Next month">\u203a</button>
              <svg class="cal-art" viewBox="0 0 92 32" aria-hidden="true">
                <path class="m2" d="M40 30L58 8L76 30Z"/>
                <path class="m1" d="M8 30L32 6L56 30Z"/>
                <path class="m1" d="M50 30L68 12L88 30Z"/>
              </svg>
            </div>
            <div class="cal-grid">${cells}</div>`;
        }

        el.innerHTML = `<div class="cal-pages"><div class="cal-sheet"></div></div>`;
        const pages = el.querySelector(".cal-pages");
        const sheet = el.querySelector(".cal-sheet");
        sheet.innerHTML = sheetHTML(y, m);

        function go(ny, nm, dir) {
          if (busy) return;
          busy = true;
          const flip = document.createElement("div");
          flip.className = "cal-flip " + (dir > 0 ? "next" : "prev");
          flip.setAttribute("aria-hidden", "true");
          if (dir > 0) {
            flip.innerHTML = sheet.innerHTML;
            sheet.innerHTML = sheetHTML(ny, nm);
            pages.appendChild(flip);
            setTimeout(() => {
              flip.remove();
              busy = false;
            }, 520);
          } else {
            flip.innerHTML = sheetHTML(ny, nm);
            pages.appendChild(flip);
            setTimeout(() => {
              sheet.innerHTML = sheetHTML(ny, nm);
              flip.remove();
              busy = false;
            }, 520);
          }
          y = ny;
          m = nm;
        }

        el.addEventListener("click", (e) => {
          const b = e.target.closest(".cal-nav, .cal-month");
          if (!b || !sheet.contains(b)) return;
          if (b.classList.contains("cal-month")) {
            const diff = (now.getFullYear() - y) * 12 + now.getMonth() - m;
            if (diff) go(now.getFullYear(), now.getMonth(), diff > 0 ? 1 : -1);
            return;
          }
          const d = Number(b.dataset.d);
          const t = new Date(y, m + d, 1);
          go(t.getFullYear(), t.getMonth(), d);
        });

        el.addEventListener(
          "wheel",
          (e) => {
            e.preventDefault();
            const d = e.deltaY > 0 ? 1 : -1;
            const t = new Date(y, m + d, 1);
            go(t.getFullYear(), t.getMonth(), d);
          },
          { passive: false }
        );
      },
    },

    note: {
      label: "Sticky note",
      addable: true,
      removable: true,
      resizable: true,
      className: "sticky w-note",
      data: () => ({ text: "", color: "pink" }),
      variants: [
        { label: "Sticky note (pink)", data: { text: "", color: "pink" } },
        { label: "Sticky note (blue)", data: { text: "", color: "blue" } },
        { label: "Sticky note (yellow)", data: { text: "", color: "yellow" } },
        { label: "Sticky note (mint)", data: { text: "", color: "mint" } },
        { label: "Sticky note (lilac)", data: { text: "", color: "lilac" } },
      ],
      build(el, item) {
        const d = (item.data = item.data || { text: "", color: "pink" });
        el.classList.add("c-" + (d.color || "pink"));
        el.innerHTML = `<div class="face"></div><textarea placeholder="Write something..." aria-label="Sticky note" spellcheck="false"></textarea>`;
        const ta = el.querySelector("textarea");
        ta.value = d.text || "";
        ta.addEventListener("input", () => {
          d.text = ta.value;
          save();
        });
      },
    },

    todo: {
      label: "To-do sticky",
      addable: true,
      removable: true,
      resizable: true,
      className: "sticky c-yellow w-todo",
      data: () => ({ tasks: [] }),
      build(el, item) {
        const data = (item.data = item.data || { tasks: [] });
        if (!Array.isArray(data.tasks)) data.tasks = [];
        el.innerHTML = `
          <div class="face"></div>
          <div class="todo-head"><span>To-do</span><small class="todo-count"></small></div>
          <ul class="todo-list"></ul>
          <form class="todo-add">
            <input type="text" maxlength="80" placeholder="Add a task..." aria-label="New task" autocomplete="off">
            <button type="submit" aria-label="Add task">+</button>
          </form>`;
        const list = el.querySelector(".todo-list");
        const form = el.querySelector(".todo-add");
        const input = form.querySelector("input");

        function draw() {
          list.innerHTML = "";
          data.tasks.forEach((t) => {
            const li = document.createElement("li");
            li.className = t.d ? "done" : "";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = !!t.d;
            cb.setAttribute("aria-label", "Done");
            cb.addEventListener("change", () => {
              t.d = cb.checked;
              li.className = t.d ? "done" : "";
              save();
              if (t.d) document.dispatchEvent(new CustomEvent("table:task-done"));
            });

            const text = document.createElement("span");
            text.textContent = t.t;

            const del = document.createElement("button");
            del.type = "button";
            del.className = "task-del";
            del.textContent = "\u00d7";
            del.setAttribute("aria-label", "Delete task");
            del.addEventListener("click", () => {
              data.tasks.splice(data.tasks.indexOf(t), 1);
              save();
              draw();
            });

            li.append(cb, text, del);
            list.appendChild(li);
          });
        }

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const v = input.value.trim();
          if (!v) return;
          data.tasks.push({ t: v, d: false });
          input.value = "";
          save();
          draw();
        });

        draw();
      },
    },

    notebook: {
      label: "Notebook",
      addable: true,
      removable: true,
      resizable: true,
      className: "widget w-notebook",
      data: () => ({ text: "", open: false }),
      build(el, item) {
        const d = (item.data = item.data || { text: "", open: false });
        el.innerHTML = `
          <div class="nb-cover">
            <svg class="nb-cat" viewBox="0 0 94 84" aria-hidden="true">
              <path d="M14 72C6 52 8 30 18 14L31 29C39 26 55 26 63 29L76 14C86 30 88 52 80 72C68 82 26 82 14 72Z"/>
              <circle class="dot" cx="33" cy="52" r="3.4"/>
              <circle class="dot" cx="61" cy="52" r="3.4"/>
              <path d="M44 58L47 61L50 58"/>
              <path d="M40 66Q47 72 47 64Q47 72 54 66"/>
            </svg>
            <span class="nb-star s1">\u2605</span>
            <span class="nb-star s2">\u2605</span>
            <button type="button" class="nb-open" aria-label="Open notebook" title="Open notebook"></button>
          </div>
          <span class="nb-tab t1"></span>
          <span class="nb-tab t2"></span>
          <span class="nb-tab t3"></span>
          <div class="nb-page">
            <textarea placeholder="Dear diary..." aria-label="Notebook page" spellcheck="false"></textarea>
            <button type="button" class="nb-close" aria-label="Close notebook">\u00d7</button>
          </div>`;
        const ta = el.querySelector("textarea");
        ta.value = d.text || "";
        const apply = () => el.classList.toggle("open", !!d.open);
        ta.addEventListener("input", () => {
          d.text = ta.value;
          save();
        });
        el.querySelector(".nb-open").addEventListener("click", () => {
          d.open = true;
          apply();
          save();
        });
        el.querySelector(".nb-close").addEventListener("click", () => {
          d.open = false;
          apply();
          save();
        });
        apply();
      },
    },

    search: {
      label: "Monitor search",
      addable: true,
      removable: true,
      resizable: true,
      className: "monitor",
      build(el) {
        el.innerHTML = `
          <div class="mon-stand"><span class="mon-neck"></span><span class="mon-foot"></span></div>
          <div class="mon-body">
            <div class="mon-glass">
              <div class="mon-stat">
                <div>
                  <p class="mon-label">Time on this desk today</p>
                  <b class="mon-total">0m</b>
                </div>
                <div class="mon-week" aria-label="Last 7 days"></div>
              </div>
              <p class="mon-sub"></p>
              <form class="mon-form">
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <input type="text" class="search-input" aria-label="Search" autocomplete="off" spellcheck="false">
                <button type="submit" aria-label="Search">\u21b5</button>
              </form>
            </div>
            <div class="mon-chin"><span class="mon-led"></span></div>
          </div>`;

        const input = el.querySelector("input");
        input.placeholder = "Search with " + engineLabel(state.engine);
        el.querySelector(".mon-form").addEventListener("submit", (e) => {
          e.preventDefault();
          const q = input.value.trim();
          if (q) location.href = searchUrl(q);
        });
        screenEls.add(el);
        paintScreen(el);
      },
    },

    timer: {
      label: "Focus timer",
      addable: true,
      removable: true,
      resizable: true,
      className: "widget w-timer",
      data: () => ({ mins: 25, left: 1500, endAt: null }),
      build(el, item) {
        const d = (item.data = item.data || { mins: 25, left: 1500, endAt: null });
        el.innerHTML = `
          <div class="dial">
            <div class="timer-face">
              <span class="timer-label">FOCUS</span>
              <b class="timer-digits">25:00</b>
              <div class="timer-btns">
                <button type="button" data-a="minus" aria-label="Minus 5 minutes">\u2212</button>
                <button type="button" data-a="toggle" aria-label="Start or pause">\u25b6</button>
                <button type="button" data-a="reset" aria-label="Reset">\u21ba</button>
                <button type="button" data-a="plus" aria-label="Plus 5 minutes">+</button>
              </div>
            </div>
          </div>`;
        const digits = el.querySelector(".timer-digits");
        const dial = el.querySelector(".dial");
        const toggle = el.querySelector('[data-a="toggle"]');
        const pad = (n) => String(n).padStart(2, "0");
        const remaining = () => (d.endAt ? Math.max(0, Math.ceil((d.endAt - Date.now()) / 1000)) : d.left);

        function draw() {
          const r = remaining();
          digits.textContent = pad(Math.floor(r / 60)) + ":" + pad(r % 60);
          dial.style.setProperty("--p", (r / (d.mins * 60)) * 100 + "%");
          toggle.textContent = d.endAt ? "\u23f8" : "\u25b6";
        }

        function tick() {
          if (!el.isConnected) {
            tickers.delete(tick);
            return;
          }
          if (d.endAt && remaining() === 0) {
            d.endAt = null;
            d.left = 0;
            save();
            el.classList.add("ringing");
            setTimeout(() => el.classList.remove("ringing"), 6000);
            beep();
            document.dispatchEvent(new CustomEvent("table:timer-done"));
          }
          draw();
        }

        el.querySelector(".timer-btns").addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          el.classList.remove("ringing");
          const a = b.dataset.a;
          if (a === "toggle") {
            if (d.endAt) {
              d.left = remaining();
              d.endAt = null;
            } else {
              if (d.left <= 0) d.left = d.mins * 60;
              d.endAt = Date.now() + d.left * 1000;
            }
          } else if (a === "reset") {
            d.endAt = null;
            d.left = d.mins * 60;
          } else if (!d.endAt) {
            d.mins = clamp(d.mins + (a === "plus" ? 5 : -5), 5, 180);
            d.left = d.mins * 60;
          }
          save();
          draw();
        });

        tickers.add(tick);
        draw();
      },
    },

    weather: {
      label: "Weather",
      addable: true,
      removable: true,
      resizable: true,
      className: "widget w-weather",
      data: () => ({ city: null, unit: "c", cache: null }),
      build(el, item) {
        const d = (item.data = item.data || { city: null, unit: "c", cache: null });
        el.innerHTML = `
          <div class="wx-screen">
            <button type="button" class="wx-temp" aria-label="Switch unit">--</button>
            <div class="wx-meta"><span class="wx-icon">\u2601\ufe0f</span><span class="wx-text">Loading</span></div>
          </div>
          <div class="wx-city"></div>
          <form class="wx-form">
            <input type="text" placeholder="Search city..." aria-label="City" autocomplete="off">
            <button type="submit">Go</button>
            <button type="button" class="wx-geo" aria-label="Use my location">\u25ce</button>
          </form>`;
        const temp = el.querySelector(".wx-temp");
        const icon = el.querySelector(".wx-icon");
        const text = el.querySelector(".wx-text");
        const cityEl = el.querySelector(".wx-city");
        const form = el.querySelector(".wx-form");
        const input = form.querySelector("input");

        function paint() {
          cityEl.textContent = d.city ? d.city.name : "Pick a city";
          const c = d.cache;
          if (!c) {
            temp.textContent = "--";
            text.textContent = d.city ? "Loading" : "No city yet";
            return;
          }
          const f = (v) => Math.round(d.unit === "f" ? (v * 9) / 5 + 32 : v);
          temp.textContent = f(c.t) + "\u00b0" + (d.unit === "f" ? "F" : "C");
          const [ic, tx] = wmo(c.c);
          icon.textContent = ic;
          text.textContent = tx + " \u00b7 H" + f(c.hi) + "\u00b0 L" + f(c.lo) + "\u00b0";
        }

        async function fetchWx() {
          if (!d.city) return;
          try {
            const url =
              "https://api.open-meteo.com/v1/forecast?latitude=" + d.city.lat +
              "&longitude=" + d.city.lon +
              "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto";
            const r = await fetch(url);
            if (!r.ok) throw new Error("bad response");
            const j = await r.json();
            d.cache = {
              t: j.current.temperature_2m,
              c: j.current.weather_code,
              hi: j.daily.temperature_2m_max[0],
              lo: j.daily.temperature_2m_min[0],
            };
            save();
            paint();
          } catch {
            if (!d.cache) text.textContent = "Offline";
          }
        }

        async function findCity(q) {
          text.textContent = "Searching";
          try {
            const r = await fetch(
              "https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + encodeURIComponent(q)
            );
            const j = await r.json();
            const g = j.results && j.results[0];
            if (!g) {
              text.textContent = "City not found";
              return;
            }
            d.city = { name: g.name, lat: g.latitude, lon: g.longitude };
            d.cache = null;
            save();
            paint();
            fetchWx();
          } catch {
            text.textContent = "Offline";
          }
        }

        temp.addEventListener("click", () => {
          d.unit = d.unit === "c" ? "f" : "c";
          save();
          paint();
        });

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const q = input.value.trim();
          if (q) findCity(q);
          input.value = "";
        });

        form.querySelector(".wx-geo").addEventListener("click", () => {
          if (!navigator.geolocation) {
            text.textContent = "No location";
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (p) => {
              d.city = { name: "My location", lat: p.coords.latitude, lon: p.coords.longitude };
              d.cache = null;
              save();
              paint();
              fetchWx();
            },
            () => {
              text.textContent = "Location blocked";
            }
          );
        });

        const refresh = setInterval(() => {
          if (!el.isConnected) {
            clearInterval(refresh);
            return;
          }
          fetchWx();
        }, 900000);

        paint();
        fetchWx();
      },
    },

    link: {
      label: "Link",
      menuHead: "Links",
      addable: true,
      removable: true,
      resizable: true,
      className: "widget w-link",
      data: () => ({ label: "Link", url: "https://example.com", color: "blue", kind: "custom" }),
      variants: LINK_PRESETS.map(([label, url, color, kind]) => ({ label, data: { label, url, color, kind } })).concat([
        { label: "Custom link...", data: { ask: true } },
      ]),
      build(el, item) {
        const d = (item.data = item.data || { label: "Link", url: "https://example.com", color: "blue", kind: "custom" });
        const kind = LINK_ART[d.kind] ? d.kind : "custom";
        el.classList.add("lk-" + kind, "c-" + (d.color || "blue"));

        const a = document.createElement("a");
        a.className = "link-a";
        a.rel = "noopener";
        if (LINK_ART[kind]) a.insertAdjacentHTML("afterbegin", LINK_ART[kind]);

        let img = null;
        let letter = null;
        if (kind === "custom") {
          const logo = document.createElement("span");
          logo.className = "lk-logo";
          img = document.createElement("img");
          img.alt = "";
          img.width = 40;
          img.height = 40;
          img.hidden = true;
          letter = document.createElement("b");
          img.addEventListener("load", () => {
            img.hidden = false;
            letter.hidden = true;
          });
          img.addEventListener("error", () => {
            img.hidden = true;
            letter.hidden = false;
          });
          logo.append(img, letter);
          a.append(logo);
        }

        const name = document.createElement("span");
        name.className = "link-name";
        const host = document.createElement("span");
        host.className = "link-host";
        a.append(name, host);

        function paint() {
          const url = safeUrl(d.url) || "";
          const h = url ? hostOf(url) : "";
          a.href = url || "#";
          a.title = url || "";
          name.textContent = d.label || "Link";
          host.textContent = (h || "no address") + " \u2197";
          if (img) {
            letter.textContent = (d.label || h || "?").charAt(0).toUpperCase();
            if (h) img.src = "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(h);
          }
        }
        paint();

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "edit";
        edit.textContent = "\u270e";
        edit.setAttribute("aria-label", "Edit link");
        edit.addEventListener("click", () => {
          const label = prompt("Name for this link", d.label);
          if (label === null) return;
          const raw = prompt("Web address", d.url);
          if (raw === null) return;
          const url = safeUrl(raw.trim());
          if (!url) {
            alert("That web address doesn't look right.");
            return;
          }
          d.label = label.trim() || d.label;
          d.url = url;
          paint();
          save();
        });

        el.append(a, edit);
      },
    },
  };

  const elById = new Map();
  const findItem = (id) => state.items.find((i) => i.id === id);

  function render(item) {
    const type = TYPES[item.type];
    if (!type) return;

    const el = document.createElement("div");
    el.className = "item " + type.className;
    el.dataset.id = item.id;
    el.style.zIndex = item.z || 1;
    el.style.setProperty("--rot", (item.rot || 0) + "deg");
    el.style.setProperty("--scale", item.scale || 1);
    el.style.setProperty("--fx", item.flip ? -1 : 1);
    type.build(el, item);

    if (type.removable) {
      const x = document.createElement("button");
      x.type = "button";
      x.className = "remove";
      x.textContent = "\u00d7";
      x.setAttribute("aria-label", "Remove " + type.label);
      x.addEventListener("click", () => removeItem(item.id));
      el.appendChild(x);
    }

    if (type.resizable) {
      const r = document.createElement("div");
      r.className = "resize";
      r.setAttribute("aria-hidden", "true");
      el.appendChild(r);
    }

    itemsEl.appendChild(el);
    elById.set(item.id, el);
    place(el, item);
  }

  function extent(el, item, scale) {
    const s = scale == null ? item.scale || 1 : scale;
    const r = ((item.rot || 0) * Math.PI) / 180;
    const c = Math.abs(Math.cos(r));
    const n = Math.abs(Math.sin(r));
    const w = el.offsetWidth * s;
    const h = el.offsetHeight * s;
    return { hw: (w * c + h * n) / 2, hh: (w * n + h * c) / 2 };
  }

  function maxScaleFor(el, item) {
    const { hw, hh } = extent(el, item, 1);
    return Math.min(MAX_SCALE, desk.clientWidth / (2 * hw), desk.clientHeight / (2 * hh));
  }

  function bounds(el, item) {
    const { hw, hh } = extent(el, item);
    const hx = el.offsetWidth / 2;
    const hy = el.offsetHeight / 2;
    const minX = hw - hx;
    const minY = hh - hy;
    return {
      minX,
      maxX: Math.max(minX, desk.clientWidth - hw - hx),
      minY,
      maxY: Math.max(minY, desk.clientHeight - hh - hy),
    };
  }

  function place(el, item) {
    const cap = maxScaleFor(el, item);
    if ((item.scale || 1) > cap) {
      item.scale = Math.max(MIN_SCALE, cap);
      el.style.setProperty("--scale", item.scale);
    }
    const b = bounds(el, item);
    el.style.left = b.minX + item.x * (b.maxX - b.minX) + "px";
    el.style.top = b.minY + item.y * (b.maxY - b.minY) + "px";
    if (item.type === "lamp") updateLights();
  }

  function setPos(el, item, left, top) {
    const b = bounds(el, item);
    const l = clamp(left, b.minX, b.maxX);
    const t = clamp(top, b.minY, b.maxY);
    el.style.left = l + "px";
    el.style.top = t + "px";
    item.x = b.maxX > b.minX ? (l - b.minX) / (b.maxX - b.minX) : 0;
    item.y = b.maxY > b.minY ? (t - b.minY) / (b.maxY - b.minY) : 0;
  }

  function placeAll() {
    state.items.forEach((item) => {
      const el = elById.get(item.id);
      if (el) place(el, item);
    });
    updateLights();
    updateShadows();
  }

  const lightEls = new Map();
  let litLamps = [];

  function updateLights() {
    litLamps = [];
    state.items.forEach((item) => {
      if (item.type !== "lamp") return;
      const el = elById.get(item.id);
      if (!el) return;

      let light = lightEls.get(item.id);
      if (!light) {
        light = document.createElement("div");
        light.className = "light";
        light.setAttribute("aria-hidden", "true");
        desk.appendChild(light);
        lightEls.set(item.id, light);
      }

      const s = item.scale || 1;
      const r = ((item.rot || 0) * Math.PI) / 180;
      const c = Math.cos(r);
      const n = Math.sin(r);
      const f = item.flip ? -1 : 1;
      const ox = f * (LAMP_OX - LAMP_W / 2) * s;
      const oy = (LAMP_OY - LAMP_H / 2) * s;
      const cx = el.offsetLeft + el.offsetWidth / 2;
      const cy = el.offsetTop + el.offsetHeight / 2;
      const lx = cx + ox * c - oy * n;
      const ly = cy + ox * n + oy * c;
      const dx0 = f * LAMP_DIR.x;
      const dx = dx0 * c - LAMP_DIR.y * n;
      const dy = dx0 * n + LAMP_DIR.y * c;
      const on = state.theme === "night" && !(item.data && item.data.on === false);

      light.style.setProperty("--lx", lx + "px");
      light.style.setProperty("--ly", ly + "px");
      light.style.setProperty("--beam", (Math.atan2(-dx, dy) * 180) / Math.PI + "deg");
      light.style.setProperty("--ls", s);
      light.style.setProperty("--lamp-on", on ? 1 : 0);
      el.classList.toggle("lit", on);
      if (on) litLamps.push({ x: lx, y: ly });
    });
  }

  function updateShadows() {
    state.items.forEach((item) => {
      const el = elById.get(item.id);
      if (!el) return;
      let ux = -0.5;
      let uy = 0.87;
      if (state.theme === "dark") {
        ux = 0;
        uy = 1;
      } else if (state.theme === "night") {
        ux = 0.3;
        uy = 0.95;
        if (item.type !== "lamp" && litLamps.length) {
          const cx = el.offsetLeft + el.offsetWidth / 2;
          const cy = el.offsetTop + el.offsetHeight / 2;
          let best = null;
          let bd = Infinity;
          litLamps.forEach((l) => {
            const d = Math.hypot(cx - l.x, cy - l.y);
            if (d < bd) {
              bd = d;
              best = l;
            }
          });
          if (best && bd > 1) {
            ux = (cx - best.x) / bd;
            uy = (cy - best.y) / bd;
          }
        }
      }
      const r = ((item.rot || 0) * Math.PI) / 180;
      const sx = ux * Math.cos(r) + uy * Math.sin(r);
      const sy = -ux * Math.sin(r) + uy * Math.cos(r);
      el.style.setProperty("--sx", (item.flip ? -sx : sx).toFixed(3));
      el.style.setProperty("--sy", sy.toFixed(3));
    });
  }

  function addItem(type, data) {
    let payload = data ? JSON.parse(JSON.stringify(data)) : null;
    if (payload && payload.ask) {
      const label = (prompt("Name for this link") || "").trim();
      if (!label) return;
      const url = safeUrl((prompt("Web address, for example example.com") || "").trim());
      if (!url) {
        alert("That web address doesn't look right.");
        return;
      }
      payload = { label, url, color: "blue", kind: "custom" };
    }
    const item = {
      id: uid(),
      type,
      x: 0.3 + Math.random() * 0.4,
      y: 0.25 + Math.random() * 0.4,
      z: ++state.zTop,
      rot: 0,
      scale: 1,
    };
    if (payload) item.data = payload;
    else if (TYPES[type].data) item.data = TYPES[type].data();
    state.items.push(item);
    render(item);
    updateLights();
    updateShadows();
    save();
  }

  function removeItem(id) {
    const idx = state.items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    state.items.splice(idx, 1);
    const el = elById.get(id);
    if (el) el.remove();
    elById.delete(id);
    const light = lightEls.get(id);
    if (light) light.remove();
    lightEls.delete(id);
    updateLights();
    updateShadows();
    save();
  }

  let drag = null;
  let suppressClick = false;

  itemsEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("textarea, input, select, button")) return;
    const el = e.target.closest(".item");
    if (!el) return;
    const item = findItem(el.dataset.id);
    if (!item) return;

    item.z = ++state.zTop;
    el.style.zIndex = item.z;

    const base = { el, item, px: e.clientX, py: e.clientY, pid: e.pointerId, active: false };
    if (e.target.closest(".resize")) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      drag = {
        ...base,
        mode: "resize",
        cx,
        cy,
        r0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
        s0: item.scale || 1,
      };
    } else {
      drag = { ...base, mode: "move", left: el.offsetLeft, top: el.offsetTop };
    }
    if (!e.target.closest("a")) e.preventDefault();
  });

  itemsEl.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!(e.buttons & 1)) {
      endDrag();
      return;
    }
    const { el, item } = drag;

    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) < 4) return;
      drag.active = true;
      el.classList.add(drag.mode === "move" ? "dragging" : "resizing");
      el.setPointerCapture(drag.pid);
    }

    if (drag.mode === "move") {
      setPos(el, item, drag.left + (e.clientX - drag.px), drag.top + (e.clientY - drag.py));
    } else {
      const r = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
      item.scale = clamp((drag.s0 * r) / drag.r0, MIN_SCALE, Math.max(MIN_SCALE, maxScaleFor(el, item)));
      el.style.setProperty("--scale", item.scale);
      setPos(el, item, el.offsetLeft, el.offsetTop);
    }

    if (item.type === "lamp") updateLights();
    updateShadows();
  });

  function endDrag() {
    if (!drag) return;
    if (drag.active) {
      drag.el.classList.remove("dragging", "resizing");
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
    }
    drag = null;
    save();
  }
  itemsEl.addEventListener("pointerup", endDrag);
  itemsEl.addEventListener("pointercancel", endDrag);
  itemsEl.addEventListener(
    "click",
    (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  itemsEl.addEventListener("contextmenu", (e) => {
    const el = e.target.closest(".item");
    if (!el) return;
    e.preventDefault();
    const item = findItem(el.dataset.id);
    if (!item) return;
    if (item.type === "lamp" && !e.shiftKey) {
      item.flip = !item.flip;
      el.style.setProperty("--fx", item.flip ? -1 : 1);
    } else {
      item.rot = (item.rot || 0) + (e.shiftKey && item.type !== "lamp" ? -ROT_STEP : ROT_STEP);
      el.style.setProperty("--rot", item.rot + "deg");
    }
    setPos(el, item, el.offsetLeft, el.offsetTop);
    if (item.type === "lamp") updateLights();
    updateShadows();
    save();
  });

  itemsEl.addEventListener("dblclick", (e) => {
    const el = e.target.closest(".lamp");
    if (!el) return;
    const item = findItem(el.dataset.id);
    if (!item) return;
    item.data = item.data || {};
    item.data.on = item.data.on === false;
    updateLights();
    updateShadows();
    save();
  });

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }

  function hexToHsl(hex) {
    const [R, G, B] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
      else if (max === G) h = (B - R) / d + 2;
      else h = (R - G) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  const hsl = (h, s, l) => `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;

  function paintWood() {
    const theme = state.theme;
    const base =
      theme === "light"
        ? state.wood
        : mix(state.wood, theme === "night" ? "#24102e" : "#160d28", theme === "night" ? 0.8 : 0.92);
    const { h, s, l } = hexToHsl(base);
    const root = document.documentElement.style;
    root.setProperty("--wood", hsl(h, s, l));
    root.setProperty("--wood-hi", hsl(h, s, clamp(l + 0.06, 0, 0.95)));
    root.setProperty("--wood-lo", hsl(h, s, clamp(l - 0.07, 0.02, 1)));
    root.setProperty("--edge", hsl(h, s, l * 0.62));
  }

  const themeBtns = document.querySelectorAll("[data-theme-btn]");

  function setTheme(theme) {
    if (!THEMES.includes(theme)) theme = "light";
    document.documentElement.dataset.theme = theme;
    themeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeBtn === theme)));
    state.theme = theme;
    paintWood();
    updateLights();
    updateShadows();
    save();
  }

  themeBtns.forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeBtn)));

  function markSwatches() {
    swatchesEl.querySelectorAll(".swatch").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.color.toLowerCase() === state.wood.toLowerCase()));
    });
    woodPicker.value = state.wood;
  }

  function setWood(color) {
    state.wood = color;
    paintWood();
    markSwatches();
    save();
  }

  WOODS.forEach((w) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.dataset.color = w.color;
    b.style.background = w.color;
    b.title = w.name;
    b.setAttribute("aria-label", w.name + " wood");
    b.addEventListener("click", () => setWood(w.color));
    swatchesEl.appendChild(b);
  });

  woodPicker.addEventListener("input", () => setWood(woodPicker.value));

  engineSel.value = ENGINES[state.engine] ? state.engine : "google";
  engineSel.addEventListener("change", () => {
    state.engine = engineSel.value;
    document.querySelectorAll(".search-input").forEach((i) => (i.placeholder = "Search with " + engineLabel(state.engine)));
    save();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.target.closest("input, textarea, select")) return;
    const i = document.querySelector(".search-input");
    if (i) {
      e.preventDefault();
      i.focus();
    }
  });

  resetBtn.addEventListener("click", () => {
    if (!confirm("Put everything back where it started?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    location.reload();
  });

  Object.entries(TYPES)
    .filter(([, t]) => t.addable)
    .forEach(([key, t]) => {
      if (t.menuHead) {
        const h = document.createElement("li");
        h.className = "pop-head";
        h.textContent = t.menuHead;
        addMenu.appendChild(h);
      }
      (t.variants || [{ label: t.label }]).forEach((v) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = v.label;
        b.addEventListener("click", () => {
          addItem(key, v.data);
          closePops();
        });
        li.appendChild(b);
        addMenu.appendChild(li);
      });
    });

  const wraps = [...document.querySelectorAll(".menu-wrap")];

  function setPop(wrap, open) {
    wrap.querySelector(".pop").hidden = !open;
    wrap.querySelector("[aria-expanded]").setAttribute("aria-expanded", String(open));
  }

  function closePops(except) {
    wraps.forEach((w) => {
      if (w !== except) setPop(w, false);
    });
  }

  wraps.forEach((w) => {
    w.querySelector("[aria-expanded]").addEventListener("click", () => {
      const open = w.querySelector(".pop").hidden;
      closePops(w);
      setPop(w, open);
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu-wrap")) closePops();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePops();
  });

  function tickClocks() {
    const d = new Date();
    let h = d.getHours();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const pad = (n) => String(n).padStart(2, "0");
    document.querySelectorAll("[data-h]").forEach((n) => (n.textContent = h));
    document.querySelectorAll("[data-m]").forEach((n) => (n.textContent = pad(d.getMinutes())));
    document.querySelectorAll("[data-ap]").forEach((n) => (n.textContent = ap));
  }
  setInterval(tickClocks, 1000);

  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const LEAF = "M0 0C-14 4 -20 -14 -10 -24C-6 -28 -2 -32 0 -40C2 -32 6 -28 10 -24C20 -14 14 4 0 0Z";

  function leaf(x, y, rot, s, k) {
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${s.toFixed(2)})"><path class="lf lf${k}" d="${LEAF}"/><path class="vein" d="M0 -3V-32"/></g>`;
  }

  function buildPlants() {
    const r = rng(7);
    const cx = 100;
    const cy = 96;
    let pot = `<svg style="left:-16px;top:-8px" width="210" height="210" viewBox="0 0 210 210"><circle class="pot" cx="${cx}" cy="${cy}" r="52"/>`;
    [
      { n: 11, rad: 34, s: 1.2 },
      { n: 12, rad: 14, s: 1.08 },
      { n: 8, rad: 2, s: 0.92 },
    ].forEach((ring) => {
      for (let i = 0; i < ring.n; i++) {
        const a = (i / ring.n) * 360 + (r() - 0.5) * 24;
        const rad = (a * Math.PI) / 180;
        pot += leaf(
          cx + Math.sin(rad) * ring.rad,
          cy - Math.cos(rad) * ring.rad,
          a + (r() - 0.5) * 22,
          ring.s * (0.88 + r() * 0.26),
          1 + Math.floor(r() * 3)
        );
      }
    });
    pot += `<ellipse class="pot" cx="${cx}" cy="150" rx="38" ry="21"/>
      <path class="pot-face" d="M70 142L74 132L84 138M130 142L126 132L116 138"/>
      <circle class="pot-eye" cx="88" cy="150" r="2.6"/><circle class="pot-eye" cx="112" cy="150" r="2.6"/>
      <path class="pot-face" d="M96 156Q100 160 100 155Q100 160 104 156"/></svg>`;

    const stems = [
      [[330, -6], [262, 38], [196, 104], [128, 150], [78, 222]],
      [[338, 66], [284, 92], [244, 146], [212, 206], [196, 268]],
      [[286, -6], [236, 30], [178, 46], [124, 42], [70, 60]],
    ];
    let ivy = `<svg style="right:-14px;top:-14px" width="340" height="300" viewBox="0 0 340 300">`;
    stems.forEach((pts) => {
      ivy += `<path class="stem" d="M${pts.map((p) => p.join(" ")).join("L")}"/>`;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const len = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(2, Math.round(len / 24));
        const ang = (Math.atan2(x2 - x1, -(y2 - y1)) * 180) / Math.PI;
        for (let j = 0; j < steps; j++) {
          const t = j / steps;
          const px = x1 + (x2 - x1) * t;
          const py = y1 + (y2 - y1) * t;
          [-1, 1].forEach((side) => {
            ivy += leaf(px, py, ang + side * (48 + r() * 24), 0.85 + r() * 0.4, 1 + Math.floor(r() * 3));
          });
        }
      }
    });
    ivy += "</svg>";

    plantsEl.innerHTML = pot + ivy;
  }

  setTheme(state.theme);
  markSwatches();
  buildPlants();
  state.items.forEach(render);
  placeAll();
  tickClocks();
  window.addEventListener("resize", placeAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeAll);
})();