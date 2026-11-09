/* ============================================================
   Triple Crusade — Design System: navegação, cores e demos
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 1. Navegação por seções (hash) ---------- */
  /* As páginas e os links do menu são lidos a cada navegação, para que
     seções criadas pelo editor funcionem sem recarregar. */
  const nav = document.getElementById("nav");
  const burger = document.getElementById("burger");
  const pagesNow = () => Array.from(document.querySelectorAll(".page"));
  let HOME = "gate";

  function show(id, keepScroll) {
    const pages = pagesNow();
    if (!pages.some(p => p.id === id)) id = pages.some(p => p.id === HOME) ? HOME : (pages[0] && pages[0].id);
    document.body.dataset.page = id;
    pages.forEach(p => p.classList.toggle("active", p.id === id));
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === id));
    nav.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    if (!keepScroll) window.scrollTo({ top: 0 });
    document.dispatchEvent(new CustomEvent("ds:page", { detail: id }));
  }
  /* #pagina abre a seção; #nome-de-ancora rola até a âncora (scroll point) */
  function route() {
    let h = ""; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { h = location.hash.slice(1); }
    if (pagesNow().some(p => p.id === h)) { show(h); return; }
    const t = h && document.getElementById(h);
    if (t && t.closest(".page")) {
      const pg = t.closest(".page");
      if (!pg.classList.contains("active")) show(pg.id, true);
      requestAnimationFrame(() => t.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }
    show(h);
  }
  window.addEventListener("hashchange", route);

  /* destinos especiais: section:next, scrollpoint:first, browser:back, copy:texto … */
  const anchorsNow = () => Array.from(document.querySelectorAll(".page.active .ds-anchor[id]"));
  function toast(msg) {
    let t = document.getElementById("ds-toast");
    if (!t) { t = document.createElement("div"); t.id = "ds-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 1600);
  }
  function special(url) {
    const m = /^(section|scrollpoint|browser|copy|clipboard):(.*)$/s.exec(url || "");
    if (!m) return false;
    const [, kind, arg] = m;
    if (kind === "browser") {
      if (arg === "back") history.back(); else if (arg === "forward") history.forward();
      else if (arg === "top") window.scrollTo({ top: 0, behavior: "smooth" }); else if (arg === "print") window.print();
      return true;
    }
    if (kind === "copy") { (navigator.clipboard ? navigator.clipboard.writeText(arg) : Promise.reject()).then(() => toast("Copiado!"), () => window.prompt("Copie:", arg)); return true; }
    if (kind === "clipboard") { window.prompt("Copie:", arg); return true; }
    if (kind === "section") {
      const ids = pagesNow().map(p => p.id), cur = ids.indexOf(document.body.dataset.page);
      const to = { first: 0, last: ids.length - 1, next: Math.min(ids.length - 1, cur + 1), previous: Math.max(0, cur - 1) }[arg];
      if (to !== undefined) location.hash = ids[to];
      return true;
    }
    if (kind === "scrollpoint") {
      const list = anchorsNow(); if (!list.length) return true;
      const y = window.scrollY + 8;
      const abs = e => e.getBoundingClientRect().top + window.scrollY;
      let t = { first: list[0], last: list[list.length - 1] }[arg];
      if (arg === "next") t = list.find(e => abs(e) > y + 4) || list[list.length - 1];
      if (arg === "previous") t = [...list].reverse().find(e => abs(e) < y - 4) || list[0];
      if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    return false;
  }
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (a && special(a.getAttribute("href"))) { e.preventDefault(); return; }
    const g = e.target.closest("[data-go]");
    if (g) { if (!special(g.dataset.go)) location.hash = g.dataset.go; }
  });
  document.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-go][role=button]")) {
      e.preventDefault(); if (!special(e.target.dataset.go)) location.hash = e.target.dataset.go;
    }
  });
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
  });
  route();

  /* ---------- 2. Cartões de cor (leem as variáveis do CSS) ---------- */
  const rootStyle = getComputedStyle(document.documentElement);
  function readableText(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#000" : "#fff";
  }
  function toRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  }
  function renderSwatches() {
  document.querySelectorAll(".swatch").forEach(el => {
    let hex = rootStyle.getPropertyValue(el.dataset.var).trim();
    if (/^#[0-9a-f]{3}$/i.test(hex)) hex = "#" + [...hex.slice(1)].map(c => c + c).join("");
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    el.style.background = hex;
    el.style.color = readableText(hex);
    el.innerHTML = `<b>${el.dataset.label}</b>${hex.toUpperCase()}<br>${toRgb(hex)}`;
    el.title = "Clique para copiar";
    el.onclick = () => {
      navigator.clipboard && navigator.clipboard.writeText(hex.toUpperCase());
      const old = el.innerHTML;
      el.innerHTML = "<b>Copiado!</b>" + hex.toUpperCase();
      setTimeout(() => (el.innerHTML = old), 900);
    };
  });
  }
  renderSwatches();
  window.DS = { renderSwatches, show, route, special, setHome: id => { HOME = id; } };

  /* ---------- 3. Menus de pedra: foco ao clicar ---------- */
  function focusGroup(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll("button").forEach(b =>
      b.addEventListener("click", () => {
        c.querySelectorAll("button").forEach(x => x.classList.remove("focus", "active"));
        b.classList.add(c.id === "demo-tabs" ? "active" : "focus");
      })
    );
  }
  focusGroup("demo-menu");
  focusGroup("demo-tabs");

  /* ---------- 4. Exploração em grid (W A S D, Q E) ---------- */
  const gridEl = document.getElementById("grid");
  const info = document.getElementById("grid-info");
  const N = 7;
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N, L, S, O
  const dirNames = ["Norte", "Leste", "Sul", "Oeste"];
  const walls = new Set(["2,2", "2,3", "4,1", "4,4", "5,4", "1,5"]);
  const enemy = "5,1";
  let px = 3, py = 5, face = 0;

  function drawGrid() {
    gridEl.innerHTML = "";
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = document.createElement("div");
        c.className = "cell";
        const key = x + "," + y;
        if (walls.has(key)) c.classList.add("wall");
        if (key === enemy) { c.classList.add("enemy"); c.textContent = "💀"; }
        if (x === px && y === py) {
          const t = document.createElement("span");
          t.className = "token";
          t.textContent = "▲";
          t.style.display = "inline-block";
          t.style.transform = `rotate(${face * 90}deg)`;
          c.appendChild(t);
        }
        gridEl.appendChild(c);
      }
    }
    info.textContent = "Direção: " + dirNames[face] + " · Posição: " + px + "," + py;
  }
  function tryMove(dx, dy) {
    const nx = px + dx, ny = py + dy;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N || walls.has(nx + "," + ny)) return;
    px = nx; py = ny;
    if (nx + "," + ny === enemy) info.textContent = "Encontro! Inimigo à frente.";
  }
  function act(k) {
    const f = dirs[face], r = dirs[(face + 1) % 4];
    if (k === "w") tryMove(f[0], f[1]);
    else if (k === "s") tryMove(-f[0], -f[1]);
    else if (k === "d") tryMove(r[0], r[1]);
    else if (k === "a") tryMove(-r[0], -r[1]);
    else if (k === "q") face = (face + 3) % 4;
    else if (k === "e") face = (face + 1) % 4;
    const keepMsg = info.textContent.startsWith("Encontro");
    drawGrid();
    if (keepMsg && px + "," + py === enemy) info.textContent = "Encontro! Inimigo à frente.";
  }
  const keyMap = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };
  gridEl.addEventListener("keydown", e => {
    let k = e.key.toLowerCase();
    k = keyMap[k] || k;
    if ("wasdqe".includes(k) && k.length === 1) { e.preventDefault(); act(k); }
  });
  gridEl.addEventListener("click", () => gridEl.focus());
  document.querySelectorAll(".pad button").forEach(b =>
    b.addEventListener("click", () => act(b.dataset.act))
  );
  drawGrid();

  /* ---------- 5. Barras ATB ---------- */
  const atbBars = document.querySelectorAll("#atb .atb-bar");
  const atbBtn = document.getElementById("atb-toggle");
  let atbTimer = null, atbVals = [0, 0, 0];

  function atbTick() {
    atbBars.forEach((bar, i) => {
      const fill = bar.querySelector("i");
      const spd = Number(fill.dataset.spd);
      atbVals[i] = Math.min(100, atbVals[i] + spd / 60);
      fill.style.width = atbVals[i] + "%";
      bar.classList.toggle("ready", atbVals[i] >= 100);
      if (atbVals[i] >= 100) setTimeout(() => { atbVals[i] = 0; }, 600);
    });
  }
  atbBtn.addEventListener("click", () => {
    if (atbTimer) { clearInterval(atbTimer); atbTimer = null; atbBtn.textContent = "Iniciar"; }
    else { atbTimer = setInterval(atbTick, 50); atbBtn.textContent = "Pausar"; }
  });

  /* ---------- 6. Menu de batalha ---------- */
  const log = document.getElementById("battle-log");
  const skillPop = document.getElementById("skill-pop");
  document.getElementById("skill-open").addEventListener("click", () => {
    skillPop.hidden = false;
    log.textContent = "Escolha uma habilidade (A, B ou C).";
  });
  document.getElementById("skill-back").addEventListener("click", () => {
    skillPop.hidden = true;
    log.textContent = "Escolha uma ação.";
  });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-cmd]");
    if (!b) return;
    log.textContent = b.dataset.cmd;
    if (b.classList.contains("skill-btn")) skillPop.hidden = true;
  });
})();
