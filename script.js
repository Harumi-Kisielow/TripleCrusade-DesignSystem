/* ============================================================
   Triple Crusade — Design System: navegação, cores e demos
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 1. Navegação por seções (hash) ---------- */
  const pages = document.querySelectorAll(".page");
  const navLinks = document.querySelectorAll("[data-nav]");
  const nav = document.getElementById("nav");
  const burger = document.getElementById("burger");
  const valid = Array.from(pages).map(p => p.id);

  function show(id) {
    if (!valid.includes(id)) id = "gate";
    document.body.dataset.page = id;
    pages.forEach(p => p.classList.toggle("active", p.id === id));
    navLinks.forEach(a => a.classList.toggle("active", a.dataset.nav === id));
    nav.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0 });
  }
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));
  document.querySelectorAll("[data-go]").forEach(btn =>
    btn.addEventListener("click", () => { location.hash = btn.dataset.go; })
  );
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
  });
  show(location.hash.slice(1));

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
  document.querySelectorAll(".swatch").forEach(el => {
    let hex = rootStyle.getPropertyValue(el.dataset.var).trim();
    if (/^#[0-9a-f]{3}$/i.test(hex)) hex = "#" + [...hex.slice(1)].map(c => c + c).join("");
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    el.style.background = hex;
    el.style.color = readableText(hex);
    el.innerHTML = `<b>${el.dataset.label}</b>${hex.toUpperCase()}<br>${toRgb(hex)}`;
    el.title = "Clique para copiar";
    el.addEventListener("click", () => {
      navigator.clipboard && navigator.clipboard.writeText(hex.toUpperCase());
      const old = el.innerHTML;
      el.innerHTML = "<b>Copiado!</b>" + hex.toUpperCase();
      setTimeout(() => (el.innerHTML = old), 900);
    });
  });

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
  document.querySelectorAll("[data-cmd]").forEach(b =>
    b.addEventListener("click", () => {
      log.textContent = b.dataset.cmd;
      if (b.classList.contains("skill-btn")) skillPop.hidden = true;
    })
  );
})();
