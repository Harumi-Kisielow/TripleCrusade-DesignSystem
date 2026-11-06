/* ============================================================
   Navegação, cores, carimbo e cursor/arrastar — Design System
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
    if (!valid.includes(id)) id = "home";
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

  /* ---------- 2. Swatches: lê as variáveis CSS e mostra HEX ---------- */
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

  /* ---------- 3. Carimbo (escolhe ferramenta → clica na área) ---------- */
  const okBtn = document.getElementById("stamp-ok");
  const noBtn = document.getElementById("stamp-no");
  const area = document.getElementById("stamp-area");
  let tool = null;

  function pick(t) {
    tool = t;
    okBtn.classList.toggle("selected", t === "ok");
    noBtn.classList.toggle("selected", t === "no");
  }
  okBtn.addEventListener("click", () => pick("ok"));
  noBtn.addEventListener("click", () => pick("no"));
  area.addEventListener("click", e => {
    if (!tool) return;
    const r = area.getBoundingClientRect();
    const mark = document.createElement("div");
    mark.className = "stamp-mark " + tool;
    mark.textContent = tool === "ok" ? "APROVADO" : "RECUSADO";   // edite os textos aqui
    mark.style.left = e.clientX - r.left + "px";
    mark.style.top = e.clientY - r.top + "px";
    area.appendChild(mark);
  });

  /* ---------- 4. Cursor customizado + clicar e arrastar ---------- */
  const play = document.getElementById("playground");
  const cursor = document.getElementById("cursor");
  const item = document.getElementById("drag-item");
  const CURSOR_IDLE = "☝";   // troque por <img src="idle.png"> se quiser sprites
  const CURSOR_GRAB = "✊";
  let dragging = false, offX = 0, offY = 0;

  cursor.textContent = CURSOR_IDLE;

  play.addEventListener("pointermove", e => {
    const r = play.getBoundingClientRect();
    cursor.style.left = e.clientX - r.left + "px";
    cursor.style.top = e.clientY - r.top + "px";
    if (dragging) {
      const x = Math.min(Math.max(e.clientX - r.left - offX, 0), r.width - item.offsetWidth);
      const y = Math.min(Math.max(e.clientY - r.top - offY, 0), r.height - item.offsetHeight);
      item.style.left = x + "px";
      item.style.top = y + "px";
    }
  });
  item.addEventListener("pointerdown", e => {
    dragging = true;
    const ir = item.getBoundingClientRect();
    offX = e.clientX - ir.left;
    offY = e.clientY - ir.top;
    item.setPointerCapture(e.pointerId);
    cursor.textContent = CURSOR_GRAB;
  });
  const release = () => { dragging = false; cursor.textContent = CURSOR_IDLE; };
  item.addEventListener("pointerup", release);
  item.addEventListener("pointercancel", release);
})();
