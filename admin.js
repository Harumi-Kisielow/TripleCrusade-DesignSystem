/* ============================================================
   Editor visual — Triple Crusade
   Tudo na página é um "item" (data-b) que pode ser selecionado, movido,
   estilizado, duplicado, ocultado ou criado. As alterações são salvas em
   content.json como operações sobre os itens e enviadas ao GitHub.
   A senha protege o token (criptografado neste navegador).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- constantes ---------- */
  const LEGACY_TEXT_SEL = "h1,h2,h3,h4,p,li,figcaption,th,td,.callout,.vn-name,.legend span,.aff,.card strong,.gate-card strong";
  const LEGACY_SLOT_SEL = ".img-slot,.logo-placeholder,.logo-box";
  const ATOMIC = "#grid,#grid-info,#battle-log,.swatch";
  const SLOTCLS = ".img-slot,.logo-box,.logo-placeholder";
  const VARS = [
    ["--primary", "Azul do logo"], ["--gold", "Dourado (destaques)"], ["--bg", "Fundo do site"],
    ["--panel", "Painéis"], ["--text", "Texto"], ["--muted", "Texto secundário"],
    ["--stone-900", "Pedra 900"], ["--stone-700", "Pedra 700"], ["--stone-500", "Pedra 500"],
    ["--parchment", "Pergaminho"], ["--wood", "Madeira"],
    ["--skill-a", "Skill A"], ["--skill-b", "Skill B"], ["--skill-c", "Skill C"],
    ["--hp", "HP"], ["--durability", "Durabilidade"],
    ["--world-green", "Mundo: verde"], ["--world-olive", "Mundo: oliva"], ["--world-taupe", "Mundo: cinza-bege"],
    ["--world-umber", "Mundo: cinza-terra"], ["--world-black", "Mundo: preto"]
  ];
  const TEXT_TAGS_OK = new Set(["B", "STRONG", "I", "EM", "BR", "CODE", "KBD", "SMALL", "A", "SPAN"]);
  const ADD_TAGS = new Set(["DIV", "P", "H1", "H2", "H3", "H4", "SPAN", "A", "UL", "LI", "FIGURE", "STRONG", "EM", "SECTION", "TABLE", "TBODY", "TR", "TD", "TH"]);
  const ATTR_OK = ["href", "alt", "role", "tabindex", "data-go"];
  const CSS_OK = new Set(["color", "background-color", "font-size", "font-weight", "font-style", "font-family", "text-align",
    "width", "max-width", "height", "min-height", "padding", "margin", "border-width", "border-color", "border-style",
    "border-radius", "opacity", "position", "left", "top", "z-index", "object-fit", "display", "transform",
    "letter-spacing", "line-height", "gap", "text-transform", "box-shadow", "text-decoration",
    "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
    "aspect-ratio", "align-self", "justify-self", "align-items", "justify-content", "min-width", "max-height",
    "--cols", "--gap", "object-position"]);
  const NOTEXT_TAGS = new Set(["BUTTON", "IMG", "INPUT", "SELECT", "TEXTAREA", "HR", "BR", "TABLE", "TBODY", "TR", "UL", "OL"]);
  const FONTS = [["Padrão", "var(--font-ui)"], ["Título (serifada)", "var(--font-display)"], ["Código", "monospace"]];
  const VAULT_KEY = "ds_admin_vault";
  const SHORT = new Set(["margin", "padding", "border-radius", "border-width", "gap"]);
  const FITS = ["cover", "contain", "fill"];

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const hash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const slug = n => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const safePath = p => typeof p === "string" && /^imgs\/[A-Za-z0-9_\-./]+$/.test(p) && !p.includes("..");
  const safeHref = h => typeof h === "string" && /^(https?:\/\/|#|mailto:)[^\s"'<>]*$/i.test(h);
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const uid = () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- estado ---------- */
  let content = { v: 2, vars: {}, bg: {}, ops: {}, order: {}, add: {} };
  let saved = null;
  const nodes = new Map();          // id -> elemento
  const origInfo = new Map();       // id -> {html, h} (original, só folhas)
  const pending = new Map();        // path -> {b64, mime}
  const previews = new Map();       // path -> dataURL
  const cleanVars = {};
  const bound = new WeakSet();
  let editing = false, sel = null, session = null, panel = null, bar = null, dropLine = null, bgStyle = null, drag = null;
  let lastGesture = 0, handles = null, guideV = null, guideH = null, rs = null, panMode = false, ro = null;

  /* ---------- utilidades de DOM ---------- */
  const isAtomic = e => e.matches(ATOMIC);
  const dchildren = e => Array.from(e.children).filter(c => c.dataset && c.dataset.b);
  const isLeaf = e => !e.querySelector("[data-b]");
  const isSlot = e => e.matches(SLOTCLS) || !!(content.ops[e.dataset.b] || {}).img;
  const hasImg = e => !!(content.ops[e.dataset.b] || {}).img;
  const isProtected = e => e.classList.contains("page") || e.tagName === "HEADER" || e.tagName === "FOOTER";
  const pageOf = e => { const p = e.closest(".page"); return p ? p.id : "site"; };
  const isTextLeaf = e => !isAtomic(e) && !NOTEXT_TAGS.has(e.tagName) && !hasImg(e) && isLeaf(e) && leafText(e).trim() !== "";
  const canContain = e => {
    if (isAtomic(e)) return false;
    if (e.tagName === "TBODY" || e.tagName === "UL") return true;
    if (NOTEXT_TAGS.has(e.tagName)) return false;
    if (hasImg(e)) return true;                       // imagem aceita itens por cima
    return !(isLeaf(e) && leafText(e).trim() !== "");
  };
  function leafText(e) {
    const c = e.cloneNode(true);
    $$(".slot-img", c).forEach(x => x.remove());
    return c.textContent;
  }
  function leafHtml(e) {
    const c = e.cloneNode(true);
    $$(".slot-img", c).forEach(x => x.remove());
    $$(".slot-orig", c).forEach(w => w.replaceWith(...Array.from(w.childNodes)));
    c.removeAttribute("contenteditable");
    return c.innerHTML;
  }
  function label(e) {
    const names = { H1: "Título 1", H2: "Título 2", H3: "Título 3", H4: "Título 4", P: "Parágrafo", LI: "Item de lista", A: "Link", BUTTON: "Botão", DIV: "Caixa", SPAN: "Texto", SECTION: "Página", HEADER: "Cabeçalho", FOOTER: "Rodapé", NAV: "Menu", TD: "Célula", TH: "Cabeçalho de tabela", TR: "Linha" };
    let n = names[e.tagName] || e.tagName.toLowerCase();
    if (isSlot(e)) n = "Imagem";
    const t = leafText(e).trim().replace(/\s+/g, " ").slice(0, 28);
    return n + (isLeaf(e) && t ? ` — “${t}”` : "");
  }
  const op = id => (content.ops[id] = content.ops[id] || {});
  function cleanOp(id) { const o = content.ops[id]; if (o && !Object.keys(o).length) delete content.ops[id]; }

  /* ---------- sanitização ---------- */
  function sanitize(html) {
    const d = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
    (function walk(node) {
      Array.from(node.childNodes).forEach(c => {
        if (c.nodeType !== 1) return;
        if (c.tagName === "SCRIPT" || c.tagName === "STYLE") { c.remove(); return; }
        walk(c);
        if (TEXT_TAGS_OK.has(c.tagName)) {
          Array.from(c.attributes).forEach(a => {
            const keep = c.tagName === "A" && a.name === "href" && safeHref(a.value);
            if (!keep) c.removeAttribute(a.name);
          });
        } else {
          const frag = document.createDocumentFragment();
          while (c.firstChild) frag.appendChild(c.firstChild);
          if (c.tagName === "DIV" || c.tagName === "P") frag.appendChild(document.createElement("br"));
          c.replaceWith(frag);
        }
      });
    })(d.body);
    return d.body.innerHTML.replace(/(<br>)+$/, "");
  }
  function okCss(prop, val) {
    if (prop === "aspect-ratio") return typeof val === "string" && /^(auto|\d{1,2}(\.\d{1,3})?(\s*\/\s*\d{1,2}(\.\d{1,3})?)?)$/.test(val);
    return CSS_OK.has(prop) && typeof val === "string" && val.length <= 100 &&
      /^[#%.,()\w\s\-+]+$/.test(val) && !/url\s*\(|expression|javascript|@/i.test(val);
  }

  /* ---------- aplicar conteúdo ---------- */
  function createNode(id, spec) {
    const tag = String(spec.tag || "").toUpperCase();
    if (!ADD_TAGS.has(tag)) return null;
    const e = document.createElement(tag.toLowerCase());
    e.dataset.b = id; e.dataset.added = "1";
    if (typeof spec.cls === "string" && /^[\w\- ]{0,120}$/.test(spec.cls)) e.className = spec.cls;
    const at = spec.attrs || {};
    if (safeHref(at.href)) e.setAttribute("href", at.href);
    if (typeof at.alt === "string") e.setAttribute("alt", at.alt.slice(0, 200));
    if (at.role === "button") e.setAttribute("role", "button");
    if (/^-?\d{1,2}$/.test(String(at.tabindex || ""))) e.setAttribute("tabindex", at.tabindex);
    if (/^[a-z0-9\-]+$/.test(at["data-go"] || "") && document.getElementById(at["data-go"])) e.setAttribute("data-go", at["data-go"]);
    return e;
  }
  function wrapOrig(e) {
    if (e.querySelector(":scope > .slot-orig")) return;
    const w = mk("span", "slot-orig");
    while (e.firstChild) w.appendChild(e.firstChild);
    e.appendChild(w);
  }
  function unwrapOrig(e) {
    const w = e.querySelector(":scope > .slot-orig");
    if (w) w.replaceWith(...Array.from(w.childNodes));
  }
  function setImage(e, img) {
    $$(":scope > .slot-img", e).forEach(x => x.remove());
    if (img && safePath(img.path)) {
      wrapOrig(e);
      const i = mk("img", "slot-img"); i.src = previews.get(img.path) || img.path; i.alt = img.alt || ""; i.draggable = false;
      const o = content.ops[e.dataset.b] || {};
      if (FITS.includes(o.fit)) i.style.objectFit = o.fit;
      e.insertBefore(i, e.firstChild);
      e.classList.add("has-img");
      e.removeAttribute("contenteditable");
      if (o.frame) setFrame(e, o.frame);
      syncSize(e);
    } else {
      unwrapOrig(e);
      e.classList.remove("has-img");
      syncSize(e);
    }
  }
  /* classes auxiliares: a imagem acompanha o tamanho / cantos / moldura do item */
  function syncSize(e) {
    const st = e.style;
    e.classList.toggle("ds-w", !!st.width);
    e.classList.toggle("ds-h", !!(st.height || st.aspectRatio));
    e.classList.toggle("ds-rad", !!(st.borderRadius || st.borderTopLeftRadius || st.borderTopRightRadius || st.borderBottomLeftRadius || st.borderBottomRightRadius));
    e.classList.toggle("ds-frame", !!(content.ops[e.dataset.b] || {}).frame);
  }
  /* zoom e enquadramento da imagem dentro da moldura */
  function setFrame(e, f) {
    const i = $(":scope > .slot-img", e);
    if (!i) return;
    const z = Math.min(5, Math.max(1, Number(f && f.z) || 1));
    const x = Math.min(100, Math.max(0, f && f.x !== undefined ? Number(f.x) : 50));
    const y = Math.min(100, Math.max(0, f && f.y !== undefined ? Number(f.y) : 50));
    if (!f) { i.style.transform = ""; i.style.transformOrigin = ""; i.style.objectPosition = ""; e.classList.remove("ds-frame"); return; }
    i.style.objectPosition = `${x}% ${y}%`;
    i.style.transformOrigin = `${x}% ${y}%`;
    i.style.transform = z === 1 ? "" : `scale(${z})`;
    e.classList.add("ds-frame");
  }
  function setBgImg(e, b) {
    if (b && safePath(b.path)) {
      const d = Math.min(0.9, Math.max(0, Number(b.dim) || 0));
      const src = (previews.get(b.path) || b.path).replace(/"/g, "%22");
      e.style.backgroundImage = `linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${d})),url("${src}")`;
      e.style.backgroundSize = ["cover", "contain", "auto"].includes(b.size) ? b.size : "cover";
      e.style.backgroundPosition = "center";
      e.style.backgroundRepeat = "no-repeat";
    } else {
      ["backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat"].forEach(p => e.style[p] = "");
    }
  }
  function applyOpTo(e, id, o) {
    if (o.t && typeof o.t.v === "string" && isLeaf(e)) {
      const oi = origInfo.get(id);
      if (o.t.h === undefined || (oi && oi.h === o.t.h)) e.innerHTML = sanitize(o.t.v);
    }
    if (o.s) Object.entries(o.s).sort((a, b) => SHORT.has(b[0]) - SHORT.has(a[0])).forEach(([p, v]) => { if (okCss(p, v)) e.style.setProperty(p, v); });
    e.classList.toggle("ds-hidden", !!o.hide);
    if (o.img) {
      const oi = origInfo.get(id);
      if (o.img.h === undefined || (oi && oi.h === o.img.h)) setImage(e, o.img);
    }
    if (o.bgimg) setBgImg(e, o.bgimg);
    if (o.frame) setFrame(e, o.frame);
    syncSize(e);
    if (o.href && safeHref(o.href) && e.tagName === "A") e.setAttribute("href", o.href);
    if (o.go && /^[a-z0-9\-]+$/.test(o.go) && document.getElementById(o.go)) e.setAttribute("data-go", o.go);
  }
  function fixFree() {
    $$("[data-b]").forEach(e => {
      if (e.style.position === "absolute" && e.parentElement && getComputedStyle(e.parentElement).position === "static")
        e.parentElement.style.position = "relative";
    });
  }
  function applyVars() {
    Object.entries(cleanVars).forEach(([k, v]) => {
      const c = content.vars[k];
      document.documentElement.style.setProperty(k, /^#[0-9a-f]{6}$/i.test(c || "") ? c : v);
    });
    window.DS && window.DS.renderSwatches();
  }
  function applyBg() {
    if (!bgStyle) { bgStyle = mk("style"); document.head.appendChild(bgStyle); }
    let css = "";
    Object.entries(content.bg).forEach(([page, b]) => {
      if (!safePath(b.path) || !/^[a-z0-9\-]+$/.test(page)) return;
      const dim = Math.min(0.9, Math.max(0, Number(b.dim) || 0));
      const src = (previews.get(b.path) || b.path).replace(/"/g, "%22");
      css += `body[data-page="${page}"]{background-image:linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})),url("${src}");background-size:cover;background-attachment:fixed;background-position:center}\n`;
    });
    bgStyle.textContent = css;
  }
  function applyAll() {
    // 1. itens adicionados
    Object.entries(content.add).forEach(([id, spec]) => { const e = createNode(id, spec); if (e) nodes.set(id, e); });
    // 2. operações
    Object.entries(content.ops).forEach(([id, o]) => { const e = nodes.get(id); if (e) applyOpTo(e, id, o); });
    // 3. ordem / posição
    Object.entries(content.order).forEach(([pid, ids]) => {
      const parent = nodes.get(pid); if (!parent || !Array.isArray(ids)) return;
      ids.forEach(id => { const n = nodes.get(id); if (n && n !== parent && !n.contains(parent)) parent.appendChild(n); });
    });
    Object.entries(content.add).forEach(([id, spec]) => {
      const n = nodes.get(id);
      if (n && !n.parentNode) { const p = nodes.get(spec.parent) || $(".page.active") || $(".page"); p && p.appendChild(n); }
    });
    fixFree(); applyVars(); applyBg();
  }

  /* ---------- migração do formato antigo ---------- */
  function migrate(j, legacyText, legacySlots) {
    const out = { v: 2, vars: j.vars || {}, bg: j.bg || {}, ops: j.ops || {}, order: j.order || {}, add: j.add || {} };
    Object.entries(j.text || {}).forEach(([k, d]) => {
      const e = legacyText.get(k);
      if (e && e.dataset.b && isLeaf(e)) { (out.ops[e.dataset.b] = out.ops[e.dataset.b] || {}).t = { h: d.h, v: d.v }; }
    });
    Object.entries(j.images || {}).forEach(([k, d]) => {
      const e = legacySlots.get(k);
      if (e && e.dataset.b && d && d.path) { (out.ops[e.dataset.b] = out.ops[e.dataset.b] || {}).img = { path: d.path, h: d.h }; }
    });
    return out;
  }

  /* ---------- marcar alteração ---------- */
  function countChanges() { return pending.size + (JSON.stringify(content) !== JSON.stringify(saved) ? 1 : 0); }
  function markDirty() { updateStatus(); }
  function setS(e, prop, val) {
    const id = e.dataset.b, o = op(id); o.s = o.s || {};
    if (val === null || val === undefined || val === "") { delete o.s[prop]; e.style.removeProperty(prop); }
    else { if (!okCss(prop, val)) return; o.s[prop] = val; e.style.setProperty(prop, val); }
    if (!Object.keys(o.s).length) delete o.s;
    cleanOp(id); fixFree(); syncSize(e); markDirty(); placeBar();
  }
  function recordOrder(container) {
    if (!container || !container.dataset.b) return;
    content.order[container.dataset.b] = dchildren(container).map(c => c.dataset.b);
  }

  /* ---------- texto editável ---------- */
  function onTextInput(e) {
    const id = e.dataset.b, oi = origInfo.get(id), v = sanitize(e.innerHTML);
    const o = op(id);
    if (oi && v === oi.html) delete o.t;
    else o.t = oi ? { h: oi.h, v } : { v };
    cleanOp(id); markDirty();
  }
  function refreshEditable() {
    nodes.forEach(e => {
      const should = editing && isTextLeaf(e);
      if (should) {
        e.setAttribute("contenteditable", "true"); e.spellcheck = false;
        if (!bound.has(e)) {
          bound.add(e);
          e.addEventListener("input", () => editing && onTextInput(e));
          e.addEventListener("paste", ev => {
            if (!editing) return;
            ev.preventDefault();
            document.execCommand("insertText", false, (ev.clipboardData || window.clipboardData).getData("text/plain"));
          });
        }
      } else e.removeAttribute("contenteditable");
    });
  }

  /* ---------- imagens ---------- */
  const fileInput = mk("input"); fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.hidden = true;
  let fileCb = null;
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0]; fileInput.value = "";
    if (!f || !fileCb) return;
    if (f.size > 20 * 1024 * 1024) { alert("Imagem acima de 20 MB. Reduza o arquivo antes de enviar."); return; }
    const r = new FileReader();
    r.onload = () => fileCb({ name: f.name, url: r.result, b64: r.result.split(",")[1], mime: f.type });
    r.readAsDataURL(f);
  });
  document.body.appendChild(fileInput);
  function pickImage(cb) { fileCb = cb; fileInput.click(); }
  function registerImage(f, folder) {
    const ext = (f.name.match(/\.[a-z0-9]+$/i) || [".png"])[0].toLowerCase();
    const base = slug(f.name.replace(/\.[^.]+$/, "")) || "imagem";
    const path = `imgs/${folder}/${base}-${hash(f.b64.slice(0, 4000) + f.b64.length).slice(0, 4)}${ext}`;
    pending.set(path, { b64: f.b64, mime: f.mime }); previews.set(path, f.url);
    return path;
  }
  function chooseImageFor(e) {
    pickImage(f => {
      const path = registerImage(f, pageOf(e));
      const o = op(e.dataset.b), oi = origInfo.get(e.dataset.b);
      o.img = Object.assign({ path }, oi ? { h: oi.h } : {});
      setImage(e, o.img); refreshEditable(); buildProps(); markDirty(); placeBar();
    });
  }
  function chooseBgFor(e) {
    pickImage(f => {
      const path = registerImage(f, pageOf(e));
      const o = op(e.dataset.b); const prev = o.bgimg || {};
      o.bgimg = { path, dim: prev.dim || 0, size: prev.size || "cover" };
      setBgImg(e, o.bgimg); buildProps(); markDirty();
    });
  }

  /* ---------- seleção ---------- */
  function select(e) {
    if (sel) sel.classList.remove("ds-sel");
    sel = e && e.isConnected ? e : null;
    if (sel) sel.classList.add("ds-sel");
    if (ro) { ro.disconnect(); if (sel) ro.observe(sel); }
    if (panMode && !(sel && hasImg(sel))) { panMode = false; document.body.classList.remove("ds-pan"); }
    buildProps(); placeBar(); updateAddHint();
  }
  function updateAddHint() {
    const h = panel && $("#adm-add-target", panel); if (!h) return;
    h.textContent = sel ? "Item selecionado: " + label(sel) + ". Dica: clique numa área vazia da página para desmarcar e adicionar no final dela."
      : "Nada selecionado: o novo item entra no final desta página.";
  }
  document.addEventListener("click", ev => {
    if (!editing || !ev.isTrusted || ev.target === fileInput) return;
    if (ev.target.closest(".adm-panel,.adm-modal,.adm-backdrop,.adm-bar,.adm-handles")) return;
    const t = ev.target.closest("[data-b]");
    if (!t && performance.now() - lastGesture < 80) return;     // clique "fantasma" ao soltar um arraste: não desmarca
    if (!t) { select(null); return; }
    if (ev.target.closest("a,button,[data-go],[data-cmd],label,select,input")) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    select(t);
  }, true);
  let hov = null;
  document.addEventListener("mouseover", ev => {
    if (!editing) return;
    const t = ev.target.closest && ev.target.closest(".adm-panel,.adm-bar,.adm-modal") ? null : ev.target.closest && ev.target.closest("[data-b]");
    if (hov === t) return;
    if (hov) hov.classList.remove("ds-hover");
    hov = t; if (hov && hov !== sel) hov.classList.add("ds-hover");
  });
  window.addEventListener("hashchange", () => { select(null); setTimeout(() => { fixFree(); refreshPageControls(); }, 0); });
  window.addEventListener("scroll", () => placeBar(), true);
  window.addEventListener("resize", () => placeBar());
  window.addEventListener("beforeunload", ev => { if (editing && countChanges() > 0) { ev.preventDefault(); ev.returnValue = ""; } });
  document.addEventListener("keydown", ev => {
    if (!editing || !sel) return;
    const typing = ev.target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName);
    if (typing) { if (ev.key === "Escape" && ev.target.isContentEditable) ev.target.blur(); return; }
    if (ev.key === "Escape") { select(null); return; }
    if ((ev.key === "Delete" || ev.key === "Backspace") && !isProtected(sel)) { ev.preventDefault(); removeItem(sel); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "d") { ev.preventDefault(); duplicate(sel); return; }
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!k) return;
    const step = ev.shiftKey ? 5 : 0.5;
    if (ev.altKey) { ev.preventDefault(); if (k[1]) moveStep(k[1]); return; }
    if (nudge(sel, k[0] * step, k[1] * step)) { ev.preventDefault(); buildProps(); }
  });

  /* ---------- barra flutuante do item selecionado ---------- */
  function buildBar() {
    bar = mk("div", "adm-bar");
    bar.innerHTML = `<button type="button" data-a="drag" title="Arrastar para mover">✥</button>
      <button type="button" data-a="up" title="Subir">▲</button>
      <button type="button" data-a="down" title="Descer">▼</button>
      <button type="button" data-a="img" title="Enviar / trocar imagem">📷</button>
      <button type="button" data-a="dup" title="Duplicar">⧉</button>
      <button type="button" data-a="parent" title="Selecionar o item que contém este">↰</button>
      <button type="button" data-a="del" title="Excluir" class="danger">🗑</button>`;
    document.body.appendChild(bar);
    bar.addEventListener("pointerdown", ev => { const b = ev.target.closest("[data-a=drag]"); if (b) startDrag(ev); });
    bar.addEventListener("click", ev => {
      const b = ev.target.closest("button"); if (!b || !sel) return;
      const a = b.dataset.a;
      if (a === "up") moveStep(-1); else if (a === "down") moveStep(1);
      else if (a === "dup") duplicate(sel); else if (a === "del") removeItem(sel);
      else if (a === "img") chooseImageFor(sel);
      else if (a === "parent") { const p = sel.parentElement && sel.parentElement.closest("[data-b]"); if (p) select(p); }
    });
    dropLine = mk("div", "adm-droplines"); document.body.appendChild(dropLine);
    handles = mk("div", "adm-handles");
    ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach(h => { const d = mk("i", "adm-h adm-h-" + h); d.dataset.h = h; handles.appendChild(d); });
    document.body.appendChild(handles);
    handles.addEventListener("pointerdown", ev => { const h = ev.target.closest("[data-h]"); if (h) startResize(ev, h.dataset.h); });
    guideV = mk("div", "adm-guide adm-guide-v"); guideH = mk("div", "adm-guide adm-guide-h"); document.body.append(guideV, guideH);
    if (window.ResizeObserver) ro = new ResizeObserver(() => placeBar());
  }
  const resizable = e => !isProtected(e) && !isAtomic(e) && !/^(TD|TH|TR|TBODY|LI|TABLE|UL|OL|BUTTON)$/.test(e.tagName);
  function startResize(ev, h) {
    const e = sel; if (!e || !resizable(e)) return;
    ev.preventDefault(); ev.stopPropagation();
    const r = e.getBoundingClientRect(), par = e.parentElement, pr = par.getBoundingClientRect();
    const abs = e.style.position === "absolute";
    rs = { el: e, h, x0: ev.clientX, y0: ev.clientY, w0: r.width, h0: r.height, pb: parentBox(e), abs,
      l0: r.left - pr.left - par.clientLeft, t0: r.top - pr.top - par.clientTop, img: hasImg(e), hasAspect: !!e.style.aspectRatio, hasH: !!e.style.height };
    document.body.classList.add("ds-moving");
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeEnd, { once: true });
  }
  function onResizeMove(ev) {
    if (!rs) return;
    const { el: e, h, pb, abs } = rs;
    const dx = ev.clientX - rs.x0, dy = ev.clientY - rs.y0;
    const E = h.includes("e"), W = h.includes("w"), N = h.includes("n"), S = h.includes("s");
    let w = rs.w0, hh = rs.h0, L = rs.l0, T = rs.t0;
    if (E) w = rs.w0 + dx; if (W) { w = rs.w0 - dx; L = rs.l0 + dx; }
    if (S) hh = rs.h0 + dy; if (N) { hh = rs.h0 - dy; T = rs.t0 + dy; }
    const corner = (E || W) && (N || S);
    const lock = corner && (rs.img ? !ev.shiftKey : ev.shiftKey);
    if (lock) {
      const sx = w / rs.w0, sy = hh / rs.h0, k = Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy;
      w = rs.w0 * k; hh = rs.h0 * k; if (W) L = rs.l0 + (rs.w0 - w); if (N) T = rs.t0 + (rs.h0 - hh);
    }
    w = Math.max(16, w); hh = Math.max(16, hh);
    const setW = E || W, setH = N || S || corner;
    if (setW) setS(e, "width", r1(Math.min(abs ? 300 : 100, w / pb.w * 100)) + "%");
    // imagem com altura automática + proporção travada: só a largura muda
    const autoH = rs.img && lock && !rs.hasH;
    const asp = rs.hasAspect && lock;
    if (setH && !autoH && !asp) {
      if (rs.hasAspect) setS(e, "aspect-ratio", null);
      setS(e, "height", abs && pb.h > 40 ? r1(hh / pb.h * 100) + "%" : Math.round(hh) + "px");
    }
    if (abs) { if (W) setS(e, "left", r1(L / pb.w * 100) + "%"); if (N) setS(e, "top", r1(T / pb.h * 100) + "%"); }
    placeBar();
  }
  function onResizeEnd() {
    window.removeEventListener("pointermove", onResizeMove);
    document.body.classList.remove("ds-moving"); rs = null; lastGesture = performance.now(); buildProps(); placeBar();
  }
  /* mover a imagem dentro da moldura (modo ✋) */
  document.addEventListener("pointerdown", ev => {
    if (!editing || !panMode || !sel || !hasImg(sel) || !sel.contains(ev.target) || ev.target.closest(".adm-panel,.adm-bar,.adm-handles")) return;
    ev.preventDefault(); ev.stopPropagation();
    const id = sel.dataset.b, o = op(id); const f0 = Object.assign({ z: 1, x: 50, y: 50 }, o.frame);
    const r = sel.getBoundingClientRect(), x0 = ev.clientX, y0 = ev.clientY;
    if (!sel.style.height && !sel.style.aspectRatio) { const im = $(":scope > .slot-img", sel); if (im && im.naturalWidth) setS(sel, "aspect-ratio", r1(im.naturalWidth / im.naturalHeight * 1000) / 1000 + ""); }
    const mv = m => {
      const x = Math.min(100, Math.max(0, f0.x - (m.clientX - x0) / r.width * 100)), y = Math.min(100, Math.max(0, f0.y - (m.clientY - y0) / r.height * 100));
      o.frame = { z: f0.z, x: Math.round(x), y: Math.round(y) }; setFrame(sel, o.frame); markDirty();
    };
    const up = () => { window.removeEventListener("pointermove", mv); lastGesture = performance.now(); buildProps(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up, { once: true });
  }, true);
  document.addEventListener("wheel", ev => {
    if (!editing || !panMode || !sel || !hasImg(sel) || !sel.contains(ev.target)) return;
    ev.preventDefault();
    const o = op(sel.dataset.b), f = Object.assign({ z: 1, x: 50, y: 50 }, o.frame);
    f.z = Math.min(4, Math.max(1, Math.round((f.z + (ev.deltaY < 0 ? 0.1 : -0.1)) * 100) / 100));
    if (f.z === 1 && f.x === 50 && f.y === 50) { delete o.frame; setFrame(sel, null); } else { o.frame = f; setFrame(sel, f); }
    syncSize(sel); markDirty(); buildProps();
  }, { passive: false });
  function placeBar() {
    if (!bar) return;
    if (!sel || !sel.isConnected || sel.offsetParent === null && sel.tagName !== "HEADER") { bar.style.display = "none"; if (handles) handles.style.display = "none"; return; }
    const r = sel.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) { bar.style.display = "none"; if (handles) handles.style.display = "none"; return; }
    bar.style.display = "flex";
    const prot = isProtected(sel);
    $$("[data-a]", bar).forEach(b => {
      const a = b.dataset.a;
      b.style.display = (prot && ["drag", "up", "down", "dup", "del"].includes(a)) || (a === "img" && !(isSlot(sel) || isLeaf(sel) && !isTextLeaf(sel) && !isAtomic(sel))) ? "none" : "";
    });
    const h = 34;
    let top = r.top - h - 6; if (top < 52) top = Math.min(r.bottom + 6, innerHeight - h - 6);
    const left = Math.max(6, Math.min(r.left, innerWidth - bar.offsetWidth - 6));
    bar.style.top = top + "px"; bar.style.left = left + "px";
    placeHandles(r);
  }
  function placeHandles(r) {
    if (!handles) return;
    if (!sel || !resizable(sel) || panMode || (drag && !drag.free)) { handles.style.display = "none"; return; }
    r = r || sel.getBoundingClientRect();
    const abs = sel.style.position === "absolute";
    handles.style.display = "block";
    handles.style.left = r.left + "px"; handles.style.top = r.top + "px"; handles.style.width = r.width + "px"; handles.style.height = r.height + "px";
    $$("[data-h]", handles).forEach(d => { d.style.display = abs || ["e", "s", "se"].includes(d.dataset.h) ? "" : "none"; });
  }
  function moveStep(dir) {
    const e = sel; if (!e || isProtected(e)) return;
    let n = dir < 0 ? e.previousElementSibling : e.nextElementSibling;
    while (n && !(n.dataset && n.dataset.b)) n = dir < 0 ? n.previousElementSibling : n.nextElementSibling;
    if (!n) return;
    if (dir < 0) e.parentElement.insertBefore(e, n); else e.parentElement.insertBefore(e, n.nextElementSibling);
    recordOrder(e.parentElement); markDirty(); placeBar();
  }

  /* ---------- arrastar ---------- */
  function orient(c) {
    const kids = dchildren(c).filter(k => k !== (drag && drag.el) && k.offsetParent !== null);
    if (kids.length >= 2) {
      const a = kids[0].getBoundingClientRect(), b = kids[1].getBoundingClientRect();
      return Math.abs(b.top - a.top) < Math.min(a.height, b.height) / 2 ? "x" : "y";
    }
    const cs = getComputedStyle(c);
    if (cs.display.includes("flex") && cs.flexDirection.startsWith("row")) return "x";
    if (cs.display.includes("grid") && cs.gridTemplateColumns.split(" ").length > 1) return "x";
    return "y";
  }
  const isDropBox = e => canContain(e) && (!dchildren(e).length || e.matches(".ds-box,.ds-cols,.ds-hero,.page") || hasImg(e));
  function sibPlace(A, container, x, y) {
    const rect = A.getBoundingClientRect(), ax = orient(container);
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const before = ax === "x" ? x < cx : y < cy;
    return { container, ref: before ? A : nextData(A), rect, ax, before, mode: "sib" };
  }
  function intoPlace(T, x, y) {
    const kids = dchildren(T).filter(k => k !== drag.el && k.offsetParent !== null);
    if (!kids.length) return { container: T, ref: null, rect: T.getBoundingClientRect(), mode: "into" };
    const ax = orient(T);
    let best = null, bd = Infinity;
    kids.forEach(k => { const r = k.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; best = { k, r, cx, cy }; } });
    const before = ax === "x" ? x < best.cx : y < best.cy;
    const idx = kids.indexOf(best.k);
    return { container: T, ref: before ? best.k : (kids[idx + 1] || null), rect: best.r, ax, before, mode: "sib" };
  }
  function findDrop(x, y, alt) {
    const stack = document.elementsFromPoint(x, y);
    let T = null;
    for (const n of stack) {
      if (n.closest(".adm-panel,.adm-bar,.adm-droplines,.adm-modal")) continue;
      const b = n.closest("[data-b]");
      if (!b || b === drag.el || drag.el.contains(b)) continue;
      T = b; break;
    }
    if (!T) return null;
    const up = n => (n.parentElement ? n.parentElement.closest("[data-b]") : null);
    // Alt: entra dentro do item sob o mouse
    if (alt) { let C = T; while (C && !canContain(C)) C = up(C); return C ? intoPlace(C, x, y) : null; }
    // 1) reordenar entre os irmãos do nível original
    const old = up(drag.el);
    if (old) {
      let A = T;
      while (A && A !== old && up(A) !== old) A = up(A);
      if (A && A !== old && A !== drag.el) return sibPlace(A, old, x, y);
    }
    // 2) soltar dentro de uma caixa (vazia, criada no editor, ou com imagem)
    for (let N = T; N; N = up(N)) { if (N !== drag.el && !drag.el.contains(N) && isDropBox(N)) return intoPlace(N, x, y); }
    // 3) irmão do item sob o mouse
    const parent = up(T);
    return parent ? sibPlace(T, parent, x, y) : null;
  }
  const nextData = e => { let n = e.nextElementSibling; while (n && !(n.dataset && n.dataset.b)) n = n.nextElementSibling; return n; };
  function showDrop(t) {
    if (!t) { dropLine.style.display = "none"; return; }
    const r = t.rect, s = dropLine.style; s.display = "block";
    if (t.mode === "into") { s.left = r.left + 4 + "px"; s.top = r.top + 4 + "px"; s.width = Math.max(40, r.width - 8) + "px"; s.height = "4px"; return; }
    if (t.ax === "x") { s.left = (t.before ? r.left : r.right) - 2 + "px"; s.top = r.top + "px"; s.width = "4px"; s.height = r.height + "px"; }
    else { s.left = r.left + "px"; s.top = (t.before ? r.top : r.bottom) - 2 + "px"; s.width = r.width + "px"; s.height = "4px"; }
  }
  function startDrag(ev) {
    const e = sel; if (!e || isProtected(e)) return;
    ev.preventDefault();
    const er = e.getBoundingClientRect();
    drag = { el: e, free: e.style.position === "absolute", offX: ev.clientX - er.left, offY: ev.clientY - er.top, target: null, oldParent: e.parentElement };
    e.classList.add("ds-dragging"); document.body.classList.add("ds-moving");
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd, { once: true });
  }
  function onDragMove(ev) {
    if (!drag) return;
    if (drag.free) {
      const p = drag.el.offsetParent || drag.el.parentElement, r = p.getBoundingClientRect();
      let l = (ev.clientX - drag.offX - r.left - p.clientLeft) / p.clientWidth * 100, t = (ev.clientY - drag.offY - r.top - p.clientTop) / p.clientHeight * 100;
      const ew = drag.el.offsetWidth / p.clientWidth * 100, eh = drag.el.offsetHeight / p.clientHeight * 100;
      guideV.style.display = guideH.style.display = "none";
      if (!ev.altKey) {
        const TH = 1.6, fx = [[0, 0], [(100 - ew) / 2, 50], [100 - ew, 100]], fy = [[0, 0], [(100 - eh) / 2, 50], [100 - eh, 100]];
        const sx = fx.find(c => Math.abs(l - c[0]) < TH), sy = fy.find(c => Math.abs(t - c[0]) < TH);
        if (sx) { l = sx[0]; guideV.style.cssText = `display:block;left:${r.left + p.clientLeft + p.clientWidth * sx[1] / 100}px;top:${r.top}px;height:${r.height}px`; }
        if (sy) { t = sy[0]; guideH.style.cssText = `display:block;top:${r.top + p.clientTop + p.clientHeight * sy[1] / 100}px;left:${r.left}px;width:${r.width}px`; }
      }
      drag.el.style.left = l.toFixed(2) + "%"; drag.el.style.top = t.toFixed(2) + "%";
      placeBar();
    } else { drag.target = findDrop(ev.clientX, ev.clientY, ev.altKey); showDrop(drag.target); }
  }
  function onDragEnd() {
    window.removeEventListener("pointermove", onDragMove);
    const d = drag; drag = null; if (!d) return;
    lastGesture = performance.now();
    d.el.classList.remove("ds-dragging"); document.body.classList.remove("ds-moving"); dropLine.style.display = "none";
    guideV.style.display = guideH.style.display = "none";
    if (d.free) {
      const o = op(d.el.dataset.b); o.s = o.s || {};
      o.s.left = d.el.style.left; o.s.top = d.el.style.top; markDirty();
      if (d.el.style.position !== "absolute") { /* segurança */ }
    } else if (d.target) {
      const { container, ref } = d.target;
      if (container === d.el || d.el.contains(container)) return;
      if (ref) container.insertBefore(d.el, ref); else container.appendChild(d.el);
      recordOrder(d.oldParent); recordOrder(container); markDirty();
    }
    placeBar(); buildProps();
  }

  /* ---------- criar / duplicar / excluir ---------- */
  function spawn(spec, parentEl, refEl) {
    const id = uid();
    content.add[id] = { tag: spec.tag, cls: spec.cls || "", attrs: spec.attrs || {}, parent: parentEl.dataset.b };
    const e = createNode(id, content.add[id]); nodes.set(id, e);
    if (spec.t != null) { op(id).t = { v: spec.t }; e.innerHTML = sanitize(spec.t); }
    if (spec.s) { op(id).s = {}; Object.entries(spec.s).forEach(([p, v]) => { if (okCss(p, v)) { op(id).s[p] = v; e.style.setProperty(p, v); } }); if (!Object.keys(op(id).s).length) delete op(id).s; }
    if (spec.img) { op(id).img = spec.img; setImage(e, spec.img); }
    if (spec.bgimg) { op(id).bgimg = spec.bgimg; setBgImg(e, spec.bgimg); }
    if (spec.fit && FITS.includes(spec.fit)) { op(id).fit = spec.fit; const im = $(":scope > .slot-img", e); if (im) im.style.objectFit = spec.fit; }
    if (spec.frame) { op(id).frame = Object.assign({}, spec.frame); setFrame(e, spec.frame); }
    syncSize(e);
    cleanOp(id);
    if (refEl) parentEl.insertBefore(e, refEl); else parentEl.appendChild(e);
    (spec.children || []).forEach(c => spawn(c, e, null));
    recordOrder(parentEl);
    return e;
  }
  function specOf(e) {
    const spec = { tag: e.tagName.toLowerCase(), cls: e.className.replace(/\b(ds-sel|ds-hover|ds-dragging|has-img|ds-hidden|ds-w|ds-h|ds-rad|ds-frame)\b/g, "").replace(/\s+/g, " ").trim(), attrs: {}, s: {} };
    ATTR_OK.forEach(a => { if (e.hasAttribute(a)) spec.attrs[a] = e.getAttribute(a); });
    CSS_OK.forEach(p => { const v = e.style.getPropertyValue(p); if (v) spec.s[p] = v; });
    const o = content.ops[e.dataset.b] || {};
    if (o.img) spec.img = { path: o.img.path };
    if (o.fit) spec.fit = o.fit;
    if (o.frame) spec.frame = Object.assign({}, o.frame);
    if (o.bgimg) spec.bgimg = Object.assign({}, o.bgimg);
    const kids = dchildren(e);
    if (kids.length) spec.children = kids.map(specOf);
    else if (!isAtomic(e) && !o.img) spec.t = leafHtml(e);
    return spec;
  }
  function duplicate(e) {
    if (isProtected(e)) return;
    if (e.id || e.querySelector("[id]") || isAtomic(e) || e.querySelector(ATOMIC)) {
      alert("Este item é interativo (tem funcionamento próprio) e não pode ser duplicado. Você pode movê-lo, estilizá-lo ou ocultá-lo."); return;
    }
    const n = spawn(specOf(e), e.parentElement, nextData(e));
    fixFree(); refreshEditable(); select(n); markDirty();
  }
  function removeAdded(e) {
    dchildren(e).forEach(removeAdded);
    const id = e.dataset.b;
    delete content.add[id]; delete content.ops[id]; delete content.order[id]; nodes.delete(id);
    const p = e.parentElement; e.remove(); if (p) recordOrder(p.closest("[data-b]") === p ? p : p.closest("[data-b]"));
  }
  function removeItem(e) {
    if (isProtected(e)) return;
    if (!confirm("Excluir este item?" + (e.dataset.added ? "" : "\n(Itens originais ficam só ocultos e podem ser restaurados no painel, em Página.)"))) return;
    if (e.dataset.added) removeAdded(e);
    else { op(e.dataset.b).hide = 1; e.classList.add("ds-hidden"); }
    select(null); refreshPageControls(); markDirty();
  }
  const PRESETS = {
    text: () => ({ tag: "p", t: "Novo texto. Clique para editar." }),
    title: () => ({ tag: "h2", t: "Novo título" }),
    image: () => ({ tag: "div", cls: "img-slot", t: "Clique em 📷 para enviar a imagem", s: { "min-height": "180px" } }),
    button: () => ({ tag: "a", cls: "btn btn-primary", attrs: { href: "#" }, t: "Botão" }),
    box: () => ({ tag: "div", cls: "ds-box", children: [{ tag: "p", t: "Texto da caixa" }] }),
    cols: () => PRESETS.cols2(),
    cols2: () => mkCols(2), cols3: () => mkCols(3), cols4: () => mkCols(4),
    hero: () => ({ tag: "div", cls: "ds-box ds-hero", s: { "min-height": "280px" }, children: [{ tag: "h2", t: "Título sobre a imagem", s: { position: "absolute", left: "8%", top: "38%", color: "#ffffff", margin: "0" } }] }),
    space: () => ({ tag: "div", cls: "ds-space" }),
    icon: () => ({ tag: "span", cls: "ds-icon", t: "★" })
  };
  const mkCols = n => ({ tag: "div", cls: "ds-cols", s: { "--cols": Array(n).fill(r1(100 / n) + "fr").join(" ") }, children: Array.from({ length: n }, () => PRESETS.box()) });
  function addBlock(type) {
    let parent, ref = null;
    const where = $("#adm-where", panel).value;
    if (sel && where === "inside" && canContain(sel)) parent = sel;
    else if (sel && !isProtected(sel)) { parent = sel.parentElement.closest("[data-b]"); ref = nextData(sel); }
    else parent = sel && canContain(sel) ? sel : ($(".page.active") || $(".page"));
    const e = spawn(PRESETS[type](), parent, ref);
    fixFree(); refreshEditable(); select(e); markDirty();
    e.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (type === "image") chooseImageFor(e);
    if (type === "hero") chooseBgFor(e);
  }

  /* ---------- painel ---------- */
  const PAGES = () => $$(".page").map(p => [p.id, { gate: "Seletor inicial", home: "Design System: início", fundamentos: "Fundamentos", identidade: "Identidade", ilustracao: "Ilustração", componentes: "Componentes", interacoes: "Interações", presskit: "Press Kit" }[p.id] || p.id]);
  const currentPage = () => document.body.dataset.page || "gate";
  function rgbToHex(c) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c || "");
    if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
    return "#" + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, "0")).join("");
  }
  function buildPanel() {
    panel = mk("aside", "adm-panel");
    panel.innerHTML = `
      <div class="adm-head" title="Arraste para mover o painel"><b>🛠 Editor visual</b><span class="adm-head-btns"><button type="button" id="adm-dock" title="Encostar na esquerda / direita">⇄</button><button type="button" id="adm-min" title="Minimizar">–</button></span></div>
      <div class="adm-body">
        <label class="adm-lbl adm-top"><b>Página</b> <select id="adm-goto"></select></label>
        <p class="adm-tip">Clique em qualquer item da página para selecioná-lo. Texto: clique e digite. Use a barra que aparece sobre o item para mover, duplicar ou excluir. Ao arrastar, segure Alt para soltar DENTRO de uma caixa. Atalhos: Ctrl+D duplica · Delete exclui · Esc sai do texto / desmarca · setas movem itens de posição livre · arraste o nome de um campo numérico para ajustar o valor.</p>
        <details open><summary>Item selecionado</summary><div id="adm-props"></div></details>
        <details><summary>Adicionar à página</summary>
          <p id="adm-add-target" class="adm-small"></p>
          <label class="adm-lbl">Onde
            <select id="adm-where"><option value="after">Logo depois do item selecionado</option><option value="inside">Dentro do item selecionado</option></select></label>
          <div class="adm-grid" id="adm-add">
            <button type="button" data-add="text">Texto</button><button type="button" data-add="title">Título</button>
            <button type="button" data-add="image">Imagem</button><button type="button" data-add="button">Botão/link</button>
            <button type="button" data-add="box">Caixa</button><button type="button" data-add="cols2">2 colunas</button>
            <button type="button" data-add="cols3">3 colunas</button><button type="button" data-add="cols4">4 colunas</button>
            <button type="button" data-add="hero">Imagem + texto</button><button type="button" data-add="icon">Ícone</button>
            <button type="button" data-add="space">Espaço</button>
          </div></details>
        <details><summary>Página</summary>
          <div id="adm-bgbox"><b class="adm-sub">Fundo desta página</b>
            <div class="adm-row"><button type="button" id="adm-bg-up">📷 Escolher imagem</button><button type="button" id="adm-bg-rm" class="danger">Remover</button></div>
            <label class="adm-lbl">Escurecer <input type="range" id="adm-dim" min="0" max="90" value="0"><span id="adm-dim-v">0%</span></label></div>
          <div class="adm-row"><button type="button" id="adm-restore">Restaurar itens excluídos</button><span id="adm-hidden-n" class="adm-small"></span></div></details>
        <details><summary>Cores do site</summary><div class="adm-colors" id="adm-colors"></div>
          <button type="button" id="adm-colors-reset" class="danger">Restaurar cores originais</button></details>
        <div id="adm-changes" class="adm-changes"></div>
        <div id="adm-status" class="adm-status"></div>
        <div class="adm-row"><button type="button" id="adm-save" class="primary">💾 Salvar no GitHub</button><button type="button" id="adm-discard">Descartar</button></div>
        <button type="button" id="adm-exit" class="adm-exit">Sair do modo admin</button>
      </div>`;
    document.body.appendChild(panel);

    $("#adm-goto", panel).innerHTML = PAGES().map(([id, l]) => `<option value="${id}">${l}</option>`).join("");
    $("#adm-goto", panel).value = currentPage();
    $("#adm-goto", panel).addEventListener("change", e => { location.hash = e.target.value; });
    $("#adm-add", panel).addEventListener("click", ev => { const b = ev.target.closest("[data-add]"); if (b) addBlock(b.dataset.add); });

    const box = $("#adm-colors", panel);
    VARS.forEach(([k, l]) => {
      const row = mk("label", "adm-color", `<span>${l}</span>`);
      const inp = mk("input"); inp.type = "color"; inp.dataset.var = k; inp.value = content.vars[k] || cleanVars[k] || "#000000";
      inp.addEventListener("input", () => { content.vars[k] = inp.value; applyVars(); markDirty(); });
      row.appendChild(inp); box.appendChild(row);
    });
    $("#adm-colors-reset", panel).addEventListener("click", () => { content.vars = {}; applyVars(); syncColors(); markDirty(); });

    $("#adm-bg-up", panel).addEventListener("click", () => pickImage(f => {
      const page = currentPage();
      const path = registerImage(f, "fundos");
      content.bg[page] = { path, dim: (content.bg[page] && content.bg[page].dim) || 0 };
      applyBg(); refreshPageControls(); markDirty();
    }));
    $("#adm-bg-rm", panel).addEventListener("click", () => { delete content.bg[currentPage()]; applyBg(); refreshPageControls(); markDirty(); });
    $("#adm-dim", panel).addEventListener("input", e => {
      const b = content.bg[currentPage()]; if (!b) return;
      b.dim = e.target.value / 100; $("#adm-dim-v", panel).textContent = e.target.value + "%"; applyBg(); markDirty();
    });
    $("#adm-restore", panel).addEventListener("click", () => {
      const pg = $(".page.active"); if (!pg) return;
      Object.entries(content.ops).forEach(([id, o]) => { const e = nodes.get(id); if (o.hide && e && (pg.contains(e))) { delete o.hide; e.classList.remove("ds-hidden"); cleanOp(id); } });
      refreshPageControls(); markDirty();
    });
    $("#adm-min", panel).addEventListener("click", () => panel.classList.toggle("min"));
    $("#adm-dock", panel).addEventListener("click", () => { const left = panel.dataset.side !== "left"; dockPanel(left ? "left" : "right"); });
    panelDrag();
    $("#adm-save", panel).addEventListener("click", saveAll);
    $("#adm-discard", panel).addEventListener("click", () => {
      if (!confirm("Descartar todas as alterações não salvas? A página será recarregada e você entrará de novo com a senha.")) return;
      pending.clear(); content = JSON.parse(JSON.stringify(saved)); location.reload();
    });
    $("#adm-exit", panel).addEventListener("click", () => {
      if (countChanges() > 0 && !confirm("Há alterações não salvas. Sair mesmo assim? (A página será recarregada.)")) return;
      pending.clear(); location.reload();
    });
    buildProps(); refreshPageControls(); updateStatus(true); updateAddHint();
  }
  function dockPanel(side) {
    panel.dataset.side = side; panel.style.top = ""; panel.style.bottom = "14px";
    panel.style.left = side === "left" ? "14px" : ""; panel.style.right = side === "left" ? "" : "14px";
    try { localStorage.setItem("ds_admin_pos", JSON.stringify({ side })); } catch (e) { /* sem storage */ }
  }
  function panelDrag() {
    try { const p = JSON.parse(localStorage.getItem("ds_admin_pos")); if (p && p.side) dockPanel(p.side); if (p && p.x !== undefined) { panel.style.left = Math.min(p.x, innerWidth - 120) + "px"; panel.style.top = Math.max(0, Math.min(p.y, innerHeight - 60)) + "px"; panel.style.right = panel.style.bottom = "auto"; } } catch (e) { /* sem storage */ }
    $(".adm-head", panel).addEventListener("pointerdown", ev => {
      if (ev.target.closest("button") || innerWidth <= 720) return;
      ev.preventDefault();
      const r = panel.getBoundingClientRect(), ox = ev.clientX - r.left, oy = ev.clientY - r.top;
      panel.classList.add("moving");
      const mv = m => {
        const x = Math.max(0, Math.min(innerWidth - 120, m.clientX - ox)), y = Math.max(0, Math.min(innerHeight - 50, m.clientY - oy));
        panel.style.left = x + "px"; panel.style.top = y + "px"; panel.style.right = "auto"; panel.style.bottom = "auto";
      };
      const up = () => {
        window.removeEventListener("pointermove", mv); panel.classList.remove("moving");
        const q = panel.getBoundingClientRect();
        try { localStorage.setItem("ds_admin_pos", JSON.stringify({ x: Math.round(q.left), y: Math.round(q.top) })); } catch (e) { /* sem storage */ }
      };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up, { once: true });
    });
  }
  function syncColors() { $$(".adm-color input", panel).forEach(i => { i.value = content.vars[i.dataset.var] || cleanVars[i.dataset.var] || "#000000"; }); }
  function refreshPageControls() {
    if (!panel) return;
    $("#adm-goto", panel).value = currentPage();
    const b = content.bg[currentPage()];
    $("#adm-dim", panel).value = b ? Math.round((b.dim || 0) * 100) : 0;
    $("#adm-dim-v", panel).textContent = $("#adm-dim", panel).value + "%";
    $("#adm-dim", panel).disabled = !b; $("#adm-bg-rm", panel).disabled = !b;
    const pg = $(".page.active");
    const n = pg ? Object.entries(content.ops).filter(([id, o]) => o.hide && nodes.get(id) && pg.contains(nodes.get(id))).length : 0;
    $("#adm-hidden-n", panel).textContent = n ? n + " excluído(s) nesta página" : "";
    $("#adm-restore", panel).disabled = !n;
  }
  function updateStatus(clear) {
    if (!panel) return;
    const n = countChanges();
    $("#adm-changes", panel).textContent = n ? `${n} alteração(ões) não salva(s)` : "Tudo salvo.";
    const st = $("#adm-status", panel);
    if (!clear && !st.textContent.startsWith("Enviando")) st.textContent = "";
    refreshPageControls();
  }

  /* ============================================================
     Painel: propriedades do item (reescrito)
     ============================================================ */
  const openSecs = new Map();
  function section(title, open) {
    const d = mk("details", "adm-sub");
    d.open = openSecs.has(title) ? openSecs.get(title) : !!open;
    d.addEventListener("toggle", () => openSecs.set(title, d.open));
    d.appendChild(mk("summary", "", title)); return d;
  }
  const r1 = n => Math.round(n * 10) / 10;
  function parentBox(e) {
    const p = e.parentElement, cs = getComputedStyle(p);
    if (e.style.position === "absolute") return { w: p.clientWidth || 1, h: p.clientHeight || 1 };
    return { w: Math.max(1, p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), h: p.clientHeight || 1 };
  }
  /* campo numérico com "arrastar o rótulo para ajustar" */
  function scrub(labelEl, input) {
    labelEl.classList.add("adm-scrub"); labelEl.title = "Arraste para os lados para ajustar";
    labelEl.addEventListener("pointerdown", ev => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const x0 = ev.clientX, v0 = parseFloat(input.value) || 0, step = Number(input.step) || 1;
      const mv = m => {
        let v = v0 + Math.round((m.clientX - x0) / 3) * step * (m.shiftKey ? 10 : 1);
        if (input.min !== "") v = Math.max(Number(input.min), v);
        if (input.max !== "") v = Math.min(Number(input.max), v);
        input.value = Math.round(v * 100) / 100; input.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const up = () => { window.removeEventListener("pointermove", mv); document.body.classList.remove("ds-moving"); };
      document.body.classList.add("ds-moving");
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up, { once: true });
    });
  }
  function row(lbl, ctrl) {
    const r = mk("label", "adm-prop"), sp = mk("span", "", lbl);
    r.appendChild(sp); r.appendChild(ctrl);
    const num = ctrl.matches && ctrl.matches("input[type=number]") ? ctrl : ctrl.querySelector && ctrl.querySelector("input[type=number]");
    if (num) scrub(sp, num);
    return r;
  }
  function numInput(e, prop, unit, opts) {
    opts = opts || {};
    const i = mk("input"); i.type = "number"; i.step = opts.step || 1; if (opts.min !== undefined) i.min = opts.min; if (opts.max !== undefined) i.max = opts.max;
    const cur = parseFloat(e.style.getPropertyValue(prop) || (opts.fromComputed === false ? "" : getComputedStyle(e)[opts.cprop || prop]));
    i.value = isNaN(cur) ? "" : (opts.scale ? Math.round(cur * opts.scale) : Math.round(cur * 100) / 100);
    i.addEventListener("input", () => {
      if (i.value === "") return setS(e, prop, null);
      const v = opts.scale ? Number(i.value) / opts.scale : i.value;
      setS(e, prop, v + (unit || ""));
    });
    return i;
  }
  /* medida com unidade (% ou px) — troca de unidade mantém o tamanho visual */
  function dimInput(e, prop, axis) {
    const wrap = mk("span", "adm-dim");
    const raw = e.style.getPropertyValue(prop);
    let unit = /%$/.test(raw) ? "%" : "px";
    const i = mk("input"); i.type = "number"; i.step = unit === "%" ? 0.5 : 1; i.min = 0; i.max = unit === "%" ? 300 : 5000;
    const rect = e.getBoundingClientRect();
    const px = prop === "width" ? rect.width : rect.height;
    const num = parseFloat(raw);
    i.placeholder = "auto";
    i.value = isNaN(num) ? "" : r1(num);
    const u = mk("select"); u.innerHTML = `<option value="%">%</option><option value="px">px</option>`; u.value = unit;
    const apply = () => { if (i.value === "") setS(e, prop, null); else setS(e, prop, i.value + unit); };
    i.addEventListener("input", apply);
    u.addEventListener("change", () => {
      const pb = parentBox(e), base = axis === "w" ? pb.w : pb.h;
      const curPx = i.value === "" ? px : (unit === "%" ? parseFloat(i.value) / 100 * base : parseFloat(i.value));
      unit = u.value; i.step = unit === "%" ? 0.5 : 1; i.max = unit === "%" ? 300 : 5000;
      i.value = r1(unit === "%" ? curPx / base * 100 : curPx); apply();
    });
    wrap.appendChild(i); wrap.appendChild(u); return wrap;
  }
  function rotateControl(e) {
    const wrap = mk("span", "adm-rn");
    const rg = mk("input"); rg.type = "range"; rg.min = -180; rg.max = 180; rg.step = 1;
    const n = mk("input"); n.type = "number"; n.min = -360; n.max = 360; n.step = 1;
    const m = /rotate\((-?[\d.]+)deg\)/.exec(e.style.getPropertyValue("transform") || "");
    rg.value = m ? m[1] : 0; n.value = m ? m[1] : "";
    const go = v => setS(e, "transform", v === "" || Number(v) === 0 ? null : `rotate(${Number(v)}deg)`);
    rg.addEventListener("input", () => { n.value = rg.value; go(rg.value); });
    n.addEventListener("input", () => { rg.value = n.value || 0; go(n.value); });
    wrap.appendChild(rg); wrap.appendChild(n); return wrap;
  }
  function rangeNum(e, prop, unit, min, max, step) {
    const wrap = mk("span", "adm-rn");
    const rg = mk("input"); rg.type = "range"; rg.min = min; rg.max = max; rg.step = step || 1;
    const n = mk("input"); n.type = "number"; n.min = min; n.max = max; n.step = step || 1;
    const cur = parseFloat(e.style.getPropertyValue(prop));
    rg.value = isNaN(cur) ? min : cur; n.value = isNaN(cur) ? "" : r1(cur);
    const go = v => { if (v === "") setS(e, prop, null); else setS(e, prop, v + unit); };
    rg.addEventListener("input", () => { n.value = rg.value; go(rg.value); });
    n.addEventListener("input", () => { rg.value = n.value || min; go(n.value); });
    wrap.appendChild(rg); wrap.appendChild(n); return wrap;
  }
  function colorInput(e, prop) {
    const wrap = mk("span", "adm-colorwrap");
    const i = mk("input"); i.type = "color";
    const inline = e.style.getPropertyValue(prop);
    i.value = rgbToHex(inline) || (/^#[0-9a-f]{6}$/i.test(inline) ? inline : rgbToHex(getComputedStyle(e)[prop === "background-color" ? "backgroundColor" : prop === "border-color" ? "borderTopColor" : "color"]) || "#000000");
    i.addEventListener("input", () => setS(e, prop, i.value));
    const x = mk("button", "", "✕"); x.type = "button"; x.title = "Limpar";
    x.addEventListener("click", ev => { ev.preventDefault(); setS(e, prop, null); buildProps(); });
    wrap.appendChild(i); wrap.appendChild(x); return wrap;
  }
  function selInput(opts, cur, onch) {
    const s = mk("select"); s.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join(""); s.value = cur;
    s.addEventListener("change", () => onch(s.value)); return s;
  }
  function btn(txt, title, fn, cls) { const b = mk("button", cls || "", txt); b.type = "button"; if (title) b.title = title; b.addEventListener("click", ev => { ev.preventDefault(); fn(ev); }); return b; }
  /* margens / espaço interno por lado */
  function sidesInput(e, base, min, max) {
    const wrap = mk("span", "adm-sides");
    const SIDES = [["top", "↑", "Cima"], ["right", "→", "Direita"], ["bottom", "↓", "Baixo"], ["left", "←", "Esquerda"]];
    const all = mk("input"); all.type = "number"; all.min = min; all.max = max; all.placeholder = "todos"; all.title = "Todos os lados";
    const ins = {};
    const read = s => { const v = parseFloat(e.style.getPropertyValue(base + "-" + s)); return isNaN(v) ? "" : r1(v); };
    SIDES.forEach(([s, ic, nm]) => {
      const i = mk("input"); i.type = "number"; i.min = min; i.max = max; i.title = nm; i.placeholder = ic; i.value = read(s); ins[s] = i;
      i.addEventListener("input", () => { setS(e, base + "-" + s, i.value === "" ? null : i.value + "px"); all.value = ""; });
    });
    all.addEventListener("input", () => {
      SIDES.forEach(([s]) => { const o = content.ops[e.dataset.b]; if (o && o.s) delete o.s[base + "-" + s]; e.style.removeProperty(base + "-" + s); });
      setS(e, base, all.value === "" ? null : all.value + "px");
      SIDES.forEach(([s]) => { ins[s].value = all.value; });
    });
    const sh = parseFloat(e.style.getPropertyValue(base)); if (!isNaN(sh) && SIDES.every(([s]) => read(s) === r1(sh))) all.value = r1(sh);
    wrap.appendChild(all); SIDES.forEach(([s]) => wrap.appendChild(ins[s]));
    return wrap;
  }

  /* ---------- alinhar ---------- */
  function note(msg) { const h = panel && $("#adm-note", panel); if (!h) return; h.textContent = msg; clearTimeout(note.t); note.t = setTimeout(() => { h.textContent = ""; }, 4500); }
  function alignItem(e, how) {
    if (isProtected(e)) return;
    const free = e.style.position === "absolute";
    const horiz = ["left", "center", "right"].includes(how);
    if (free) {
      const par = e.parentElement;
      const ew = e.offsetWidth / par.clientWidth * 100, eh = e.offsetHeight / par.clientHeight * 100;   // tamanho sem a rotação
      if (horiz) setS(e, "left", r1(how === "left" ? 0 : how === "center" ? (100 - ew) / 2 : 100 - ew) + "%");
      else setS(e, "top", r1(how === "top" ? 0 : how === "middle" ? (100 - eh) / 2 : 100 - eh) + "%");
    } else if (horiz) {
      if (/^inline/.test(getComputedStyle(e).display)) { setS(e, "display", "block"); if (!e.style.width) setS(e, "width", "fit-content"); }
      setS(e, "margin-left", how === "left" ? "0px" : "auto");
      setS(e, "margin-right", how === "right" ? "0px" : "auto");
    } else {
      const d = getComputedStyle(e.parentElement).display;
      if (!/flex|grid/.test(d)) { note("Alinhar para cima/baixo só funciona dentro de colunas. Para itens soltos, ligue a posição livre."); return; }
      setS(e, "align-self", how === "top" ? "start" : how === "middle" ? "center" : "end");
    }
    buildProps();
  }
  function nudge(e, dx, dy) {
    if (e.style.position !== "absolute") return false;
    const l = parseFloat(e.style.left) || 0, t = parseFloat(e.style.top) || 0;
    if (dx) setS(e, "left", r1(l + dx) + "%"); if (dy) setS(e, "top", r1(t + dy) + "%");
    return true;
  }

  /* ---------- colunas ---------- */
  function colFr(e) {
    const n = dchildren(e).length;
    const t = (e.style.getPropertyValue("--cols") || "").trim().split(/\s+/).map(x => /^[\d.]+fr$/.test(x) ? parseFloat(x) : NaN);
    if (t.length === n && t.every(x => x > 0)) { const s = t.reduce((a, b) => a + b, 0); return t.map(x => r1(x / s * 100)); }
    return Array(n).fill(r1(100 / Math.max(1, n)));
  }
  function setCols(e, pcts) {
    const s = pcts.reduce((a, b) => a + b, 0) || 1;
    setS(e, "--cols", pcts.map(x => Math.max(1, r1(x / s * 100)) + "fr").join(" "));
  }
  function setColPct(e, i, p) {
    const cur = colFr(e), n = cur.length; if (n < 2) return cur;
    p = Math.min(95, Math.max(5, p));
    const rest = cur.reduce((a, b, k) => a + (k === i ? 0 : b), 0) || 1;
    const out = cur.map((x, k) => k === i ? p : x / rest * (100 - p));
    setCols(e, out); return colFr(e);
  }
  function setColCount(e, n) {
    n = Math.max(1, Math.min(6, n));
    let kids = dchildren(e);
    if (n < kids.length && !confirm("Remover " + (kids.length - n) + " coluna(s) do final, com o que estiver dentro delas?")) return false;
    while (kids.length > n) { const k = kids.pop(); if (k.dataset.added) removeAdded(k); else { op(k.dataset.b).hide = 1; k.classList.add("ds-hidden"); } }
    while (kids.length < n) { const c = spawn(PRESETS.box(), e, null); kids.push(c); }
    setCols(e, Array(n).fill(100 / n));
    recordOrder(e); fixFree(); refreshEditable(); markDirty(); return true;
  }
  const COL_PRESETS = {
    1: [["100", "100%"]], 2: [["50,50", "50 / 50"], ["33,67", "33 / 67"], ["67,33", "67 / 33"], ["25,75", "25 / 75"], ["75,25", "75 / 25"]],
    3: [["33,33,34", "33 / 33 / 33"], ["25,50,25", "25 / 50 / 25"], ["50,25,25", "50 / 25 / 25"], ["25,25,50", "25 / 25 / 50"]],
    4: [["25,25,25,25", "Iguais"], ["20,30,30,20", "20 / 30 / 30 / 20"], ["40,20,20,20", "40 / 20 / 20 / 20"]],
    5: [["20,20,20,20,20", "Iguais"]], 6: [["17,17,17,17,16,16", "Iguais"]]
  };
  function colsSection(e) {
    const s = section("Colunas", true);
    const kids = dchildren(e), n = kids.length;
    s.appendChild(row("Quantidade", selInput([1, 2, 3, 4, 5, 6].map(k => [k, k + (k === 1 ? " coluna" : " colunas")]), n, v => { if (setColCount(e, Number(v))) buildProps(); else buildProps(); })));
    const pcts = colFr(e), inputs = [];
    const grid = mk("div", "adm-colgrid");
    pcts.forEach((p, i) => {
      const lab = mk("label", "adm-colcell", `<span>Col. ${i + 1}</span>`);
      const inp = mk("input"); inp.type = "number"; inp.min = 5; inp.max = 95; inp.step = 1; inp.value = p; inputs.push(inp);
      inp.addEventListener("input", () => { if (inp.value === "") return; const out = setColPct(e, i, Number(inp.value)); inputs.forEach((x, k) => { if (k !== i) x.value = out[k]; }); });
      scrub(lab.firstChild, inp); lab.appendChild(mk("em", "", "%")); lab.insertBefore(inp, lab.lastChild); grid.appendChild(lab);
    });
    s.appendChild(grid);
    s.appendChild(row("Proporção pronta", selInput([["", "Escolher…"]].concat(COL_PRESETS[n] || []), "", v => { if (v) { setCols(e, v.split(",").map(Number)); buildProps(); } })));
    s.appendChild(row("Espaço entre (px)", (() => { const i = mk("input"); i.type = "number"; i.min = 0; i.max = 120; const g = parseFloat(e.style.getPropertyValue("--gap")); i.value = isNaN(g) ? "" : g; i.placeholder = "16"; i.addEventListener("input", () => setS(e, "--gap", i.value === "" ? null : i.value + "px")); return i; })()));
    s.appendChild(row("Alinhar colunas", selInput([["", "Esticar (padrão)"], ["start", "Topo"], ["center", "Meio"], ["end", "Base"]], e.style.getPropertyValue("align-items"), v => setS(e, "align-items", v || null))));
    s.appendChild(mk("p", "adm-small", "As colunas são fluidas: as larguras são proporções e se ajustam à tela. No celular elas empilham sozinhas. Selecione uma coluna para mudar fundo, borda ou espaçamento dela."));
    return s;
  }

  /* ---------- imagem ---------- */
  const SHADOWS = [["", "Nenhuma"], ["0 2px 6px rgba(0,0,0,.35)", "Suave"], ["0 6px 18px rgba(0,0,0,.5)", "Média"], ["0 12px 32px rgba(0,0,0,.65)", "Forte"]];
  function radiusControl(e) {
    const box = mk("div", "adm-radius");
    const raw = e.style.getPropertyValue("border-radius");
    let unit = /%$/.test(raw) ? "%" : "px";
    const rg = mk("input"); rg.type = "range"; const n = mk("input"); n.type = "number"; n.min = 0;
    const u = mk("select"); u.innerHTML = `<option value="px">px</option><option value="%">%</option>`; u.value = unit;
    const lim = () => { const m = unit === "%" ? 50 : 200; rg.min = 0; rg.max = m; n.max = m; };
    lim();
    const cur = parseFloat(raw); rg.value = isNaN(cur) ? 0 : cur; n.value = isNaN(cur) ? "" : r1(cur);
    const clearCorners = () => ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"].forEach(p => { const o = content.ops[e.dataset.b]; if (o && o.s) delete o.s[p]; e.style.removeProperty(p); });
    const go = v => { clearCorners(); setS(e, "border-radius", v === "" ? null : v + unit); syncSize(e); };
    rg.addEventListener("input", () => { n.value = rg.value; go(rg.value); });
    n.addEventListener("input", () => { rg.value = n.value || 0; go(n.value); });
    u.addEventListener("change", () => { unit = u.value; lim(); const v = Math.min(Number(n.value) || 0, Number(n.max)); n.value = v; rg.value = v; go(String(v)); });
    const top = mk("div", "adm-rn"); top.appendChild(rg); top.appendChild(n); top.appendChild(u); box.appendChild(top);
    const pre = mk("div", "adm-row");
    [["Reto", "0", "px"], ["Suave", "12", "px"], ["Redondo", "28", "px"], ["Círculo", "50", "%"]].forEach(([t, v, un]) => pre.appendChild(btn(t, "", () => { unit = un; u.value = un; lim(); n.value = v; rg.value = v; go(v); })));
    box.appendChild(pre);
    const det = mk("details", "adm-sub"); det.appendChild(mk("summary", "", "Cada canto separado"));
    const cg = mk("div", "adm-sides");
    [["border-top-left-radius", "↖"], ["border-top-right-radius", "↗"], ["border-bottom-left-radius", "↙"], ["border-bottom-right-radius", "↘"]].forEach(([p, ic]) => {
      const i = mk("input"); i.type = "number"; i.min = 0; i.max = 300; i.title = p; i.placeholder = ic;
      const v = parseFloat(e.style.getPropertyValue(p)); i.value = isNaN(v) ? "" : r1(v);
      i.addEventListener("input", () => {
        const all = e.style.getPropertyValue("border-radius");
        if (all) { // desfaz o atalho "todos os cantos" antes: remover o atalho apaga os cantos individuais
          setS(e, "border-radius", null);
          ["border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius"].forEach(q => setS(e, q, all));
        }
        setS(e, p, i.value === "" ? null : i.value + "px"); syncSize(e);
      });
      cg.appendChild(i);
    });
    det.appendChild(cg); box.appendChild(det);
    return box;
  }
  function imageSection(e, o, id) {
    const s = section("Imagem", true);
    const r = mk("div", "adm-row");
    r.appendChild(btn("📷 " + (o.img ? "Trocar imagem" : "Enviar imagem"), "", () => chooseImageFor(e), "primary"));
    if (o.img) r.appendChild(btn("Remover", "", () => { delete op(id).img; delete op(id).frame; cleanOp(id); setImage(e, null); refreshEditable(); buildProps(); markDirty(); }, "danger"));
    s.appendChild(r);
    if (!o.img) { s.appendChild(mk("p", "adm-small", "Envie uma imagem para liberar tamanho, cantos, zoom e enquadramento.")); return s; }
    s.appendChild(mk("b", "adm-sub", "Tamanho"));
    s.appendChild(row("Largura", dimInput(e, "width", "w")));
    s.appendChild(row("Altura", dimInput(e, "height", "h")));
    s.appendChild(row("Proporção da moldura", selInput([["", "Livre / original"], ["1", "1:1 quadrada"], ["1.333", "4:3"], ["1.778", "16:9"], ["0.75", "3:4 retrato"], ["0.5625", "9:16 retrato"], ["2.333", "21:9 panorâmica"]],
      (e.style.aspectRatio || "").replace(/\s/g, "") === "" ? "" : String(parseFloat(e.style.aspectRatio) || ""), v => {
        if (v) { setS(e, "height", null); setS(e, "aspect-ratio", v); } else setS(e, "aspect-ratio", null);
        syncSize(e); buildProps();
      })));
    s.appendChild(row("Ajuste na moldura", selInput([["", "Padrão"], ["cover", "Preencher (corta)"], ["contain", "Caber inteira"], ["fill", "Esticar (distorce)"]], o.fit || "", v => { const oo = op(id); if (v) oo.fit = v; else delete oo.fit; const i = $(":scope > .slot-img", e); if (i) i.style.objectFit = v; markDirty(); })));
    s.appendChild(mk("p", "adm-small", "Dica: arraste as alças azuis nos cantos da imagem. Elas mantêm a proporção; segure Shift para esticar livremente."));
    s.appendChild(btn("Voltar ao tamanho original", "", () => { ["width", "height", "aspect-ratio"].forEach(p => setS(e, p, null)); delete op(id).frame; cleanOp(id); setFrame(e, null); syncSize(e); buildProps(); }));
    s.appendChild(mk("b", "adm-sub", "Zoom e enquadramento"));
    const f = o.frame || { z: 1, x: 50, y: 50 };
    const upd = () => {
      const oo = op(id);
      if (f.z === 1 && f.x === 50 && f.y === 50) { delete oo.frame; cleanOp(id); setFrame(e, null); }
      else {
        if (!e.style.height && !e.style.aspectRatio) { const im = $(":scope > .slot-img", e); if (im && im.naturalWidth) setS(e, "aspect-ratio", r1(im.naturalWidth / im.naturalHeight * 1000) / 1000 + ""); syncSize(e); }
        oo.frame = { z: f.z, x: f.x, y: f.y }; setFrame(e, oo.frame);
      }
      syncSize(e); markDirty(); placeBar();
    };
    const sl = (lbl, key, min, max, step, fmt) => {
      const rg = mk("input"); rg.type = "range"; rg.min = min; rg.max = max; rg.step = step; rg.value = f[key];
      const v = mk("em", "", fmt(f[key])); const w = mk("span", "adm-rn"); w.appendChild(rg); w.appendChild(v);
      rg.addEventListener("input", () => { f[key] = Number(rg.value); v.textContent = fmt(f[key]); upd(); });
      s.appendChild(row(lbl, w)); return rg;
    };
    sl("Zoom", "z", 1, 4, 0.05, x => Math.round(x * 100) + "%");
    sl("Posição horizontal", "x", 0, 100, 1, x => x + "%");
    sl("Posição vertical", "y", 0, 100, 1, x => x + "%");
    s.appendChild(btn(panMode ? "✋ Arrastando na imagem (clique p/ parar)" : "✋ Mover a imagem na moldura", "Ligue e arraste direto sobre a imagem; a roda do mouse dá zoom", () => { panMode = !panMode; document.body.classList.toggle("ds-pan", panMode); buildProps(); }, panMode ? "primary" : ""));
    s.appendChild(mk("b", "adm-sub", "Cantos"));
    s.appendChild(radiusControl(e));
    return s;
  }

  function buildProps() {
    const box = $("#adm-props", panel); if (!box) return;
    box.innerHTML = "";
    if (!sel) { box.appendChild(mk("p", "adm-tip", "Nenhum item selecionado.")); return; }
    const e = sel, id = e.dataset.b, o = content.ops[id] || {};
    // caminho (clique para subir de nível)
    const trail = mk("div", "adm-trail"); const chain = [];
    for (let n = e; n && chain.length < 5; n = n.parentElement && n.parentElement.closest("[data-b]")) { chain.unshift(n); if (n.classList.contains("page")) break; }
    chain.forEach((n, k) => { const b = mk("button", k === chain.length - 1 ? "on" : "", esc(label(n).split(" — ")[0])); b.type = "button"; b.addEventListener("click", () => select(n)); trail.appendChild(b); });
    box.appendChild(trail);
    box.appendChild(mk("div", "adm-sel-name", esc(label(e))));
    box.appendChild(mk("p", "adm-note", ""));
    box.lastChild.id = "adm-note";

    if (e.tagName === "BUTTON" && isLeaf(e)) {
      const i = mk("input"); i.type = "text"; i.value = leafText(e);
      i.addEventListener("input", () => {
        e.textContent = i.value; const oi = origInfo.get(id), v = esc(i.value), oo = op(id);
        oo.t = oi ? { h: oi.h, v } : { v }; markDirty(); placeBar();
      });
      box.appendChild(row("Texto do botão", i));
    }
    if (e.tagName === "A") {
      const i = mk("input"); i.type = "text"; i.placeholder = "https://… ou #pagina"; i.value = e.getAttribute("href") || "";
      i.addEventListener("input", () => { if (safeHref(i.value)) { e.setAttribute("href", i.value); op(id).href = i.value; markDirty(); } });
      box.appendChild(row("Link (destino)", i));
    }
    if (e.hasAttribute("data-go")) {
      box.appendChild(row("Leva para", selInput(PAGES(), e.getAttribute("data-go"), v => { e.setAttribute("data-go", v); op(id).go = v; markDirty(); })));
    }

    if (e.matches(".ds-cols")) box.appendChild(colsSection(e));

    const imgItem = isSlot(e) || (isLeaf(e) && !isTextLeaf(e) && !isAtomic(e) && !NOTEXT_TAGS.has(e.tagName));
    if (imgItem) box.appendChild(imageSection(e, o, id));
    else if (isLeaf(e) && !isAtomic(e) && e.matches("span,div") && leafText(e).trim().length <= 4) {
      const s = section("Imagem no lugar do ícone"); const r = mk("div", "adm-row");
      r.appendChild(btn("📷 Usar uma imagem", "", () => chooseImageFor(e))); s.appendChild(r); box.appendChild(s);
    }

    // tamanho e posição
    if (!isAtomic(e)) {
      const ps = section("Tamanho e posição", !imgItem);
      if (!isProtected(e)) {
        const al = mk("div", "adm-align");
        [["left", "⬅", "Alinhar à esquerda"], ["center", "⬌", "Centralizar na horizontal"], ["right", "➡", "Alinhar à direita"], ["top", "⬆", "Alinhar ao topo"], ["middle", "⬍", "Centralizar na vertical"], ["bottom", "⬇", "Alinhar à base"]]
          .forEach(([k, t, ti]) => al.appendChild(btn(t, ti, () => alignItem(e, k))));
        ps.appendChild(row("Alinhar", al));
      }
      if (!imgItem) {
        ps.appendChild(row("Largura", dimInput(e, "width", "w")));
        ps.appendChild(row("Altura", dimInput(e, "height", "h")));
        ps.appendChild(row("Altura mínima (px)", numInput(e, "min-height", "px", { min: 0, max: 2000, fromComputed: false })));
      }
      ps.appendChild(row("Girar (graus)", rotateControl(e)));
      ps.appendChild(row("Espaço externo (px)", sidesInput(e, "margin", -300, 400)));
      ps.appendChild(row("Espaço interno (px)", sidesInput(e, "padding", 0, 300)));
      if (!isProtected(e)) {
        const free = e.style.position === "absolute";
        const cb = mk("input"); cb.type = "checkbox"; cb.checked = free;
        cb.addEventListener("change", () => {
          if (cb.checked) {
            const par = e.parentElement;
            if (getComputedStyle(par).position === "static") par.style.position = "relative";
            const pr = par.getBoundingClientRect(), er = e.getBoundingClientRect();
            setS(e, "left", r1((er.left - pr.left - par.clientLeft) / par.clientWidth * 100) + "%");
            setS(e, "top", r1((er.top - pr.top - par.clientTop) / par.clientHeight * 100) + "%");
            if (!e.style.width) setS(e, "width", r1(Math.min(100, er.width / par.clientWidth * 100)) + "%");
            ["margin", "margin-left", "margin-right", "margin-top", "margin-bottom"].forEach(p => setS(e, p, null));
            setS(e, "position", "absolute");
          } else { ["position", "left", "top"].forEach(p => setS(e, p, null)); }
          buildProps(); placeBar();
        });
        ps.appendChild(row("Posição livre", cb));
        ps.appendChild(mk("p", "adm-small", "Posição livre: arraste o item (✥) para qualquer lugar da caixa, use as setas do teclado (Shift = passo maior) e as alças para o tamanho. Guias magnéticas ajudam a centralizar; segure Alt para soltar sem encaixe."));
        ps.appendChild(row("Camada (z-index)", numInput(e, "z-index", "", { min: -5, max: 99, fromComputed: false })));
        const lay = mk("div", "adm-row");
        lay.appendChild(btn("⤒ Para frente", "", () => { const z = Math.max(0, ...$$("[data-b]", e.parentElement).map(x => parseInt(x.style.zIndex) || 0)); setS(e, "z-index", String(z + 1)); if (!e.style.position) setS(e, "position", "relative"); buildProps(); }));
        lay.appendChild(btn("⤓ Para trás", "", () => { setS(e, "z-index", "0"); buildProps(); }));
        ps.appendChild(lay);
      }
      box.appendChild(ps);
    }

    // imagem de fundo
    if (!isAtomic(e)) {
      const s = section("Imagem de fundo (texto por cima)", !!o.bgimg);
      const r = mk("div", "adm-row");
      r.appendChild(btn("📷 " + (o.bgimg ? "Trocar fundo" : "Escolher fundo"), "", () => chooseBgFor(e)));
      if (o.bgimg) r.appendChild(btn("Remover", "", () => { delete op(id).bgimg; cleanOp(id); setBgImg(e, null); buildProps(); markDirty(); }, "danger"));
      s.appendChild(r);
      if (o.bgimg) {
        const dim = mk("input"); dim.type = "range"; dim.min = 0; dim.max = 90; dim.value = Math.round((o.bgimg.dim || 0) * 100);
        dim.addEventListener("input", () => { o.bgimg.dim = dim.value / 100; setBgImg(e, o.bgimg); markDirty(); });
        s.appendChild(row("Escurecer", dim));
        s.appendChild(row("Tamanho", selInput([["cover", "Preencher"], ["contain", "Caber inteira"], ["auto", "Original"]], o.bgimg.size || "cover", v => { o.bgimg.size = v; setBgImg(e, o.bgimg); markDirty(); })));
      }
      box.appendChild(s);
    }

    // aparência
    const st = section("Aparência", true);
    st.appendChild(row("Cor do texto", colorInput(e, "color")));
    st.appendChild(row("Cor de fundo", colorInput(e, "background-color")));
    st.appendChild(row("Tamanho da letra (px)", numInput(e, "font-size", "px", { min: 6, max: 200 })));
    st.appendChild(row("Peso", selInput([["", "Padrão"], ["400", "Normal"], ["700", "Negrito"], ["900", "Extra negrito"]], e.style.fontWeight || "", v => setS(e, "font-weight", v || null))));
    st.appendChild(row("Fonte", selInput([["", "Padrão"]].concat(FONTS.map(([l, v]) => [v, l])), e.style.fontFamily || "", v => setS(e, "font-family", v || null))));
    const al = mk("div", "adm-seg"); [["left", "⇤"], ["center", "↔"], ["right", "⇥"]].forEach(([v, t]) => { const b = mk("button", e.style.textAlign === v ? "on" : "", t); b.type = "button"; b.title = "Texto " + v; b.addEventListener("click", () => { setS(e, "text-align", e.style.textAlign === v ? null : v); buildProps(); }); al.appendChild(b); });
    st.appendChild(row("Alinhamento do texto", al));
    st.appendChild(row("Borda (px)", (() => { const i = numInput(e, "border-width", "px", { min: 0, max: 30, fromComputed: false }); i.addEventListener("input", () => { if (i.value !== "") setS(e, "border-style", "solid"); }); return i; })()));
    st.appendChild(row("Cor da borda", colorInput(e, "border-color")));
    if (!(imgItem && o.img)) { st.appendChild(mk("b", "adm-sub", "Cantos")); st.appendChild(radiusControl(e)); }
    st.appendChild(row("Sombra", selInput(SHADOWS, e.style.getPropertyValue("box-shadow") || "", v => setS(e, "box-shadow", v || null))));
    st.appendChild(row("Opacidade (%)", numInput(e, "opacity", "", { min: 0, max: 100, scale: 100, fromComputed: false })));
    st.appendChild(btn("Restaurar aparência original", "", () => { Object.keys((content.ops[id] || {}).s || {}).forEach(p => e.style.removeProperty(p)); if (content.ops[id]) delete content.ops[id].s; cleanOp(id); fixFree(); syncSize(e); buildProps(); markDirty(); placeBar(); }));
    box.appendChild(st);
  }

  /* ---------- cripto / GitHub / login (mantidos) ---------- */
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64e = buf => { let s = ""; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encryptVault(pass, payload) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pass, salt);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload)));
    return { salt: b64e(salt), iv: b64e(iv), data: b64e(data) };
  }
  async function decryptVault(pass, v) {
    const key = await deriveKey(pass, b64d(v.salt));
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(v.iv) }, key, b64d(v.data))));
  }
  const readVault = () => { try { return JSON.parse(localStorage.getItem(VAULT_KEY)); } catch (e) { return null; } };

  async function gh(method, url, body) {
    const r = await fetch("https://api.github.com" + url, {
      method, headers: { Authorization: "Bearer " + session.token, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    let j = null; try { j = await r.json(); } catch (e) { /* sem corpo */ }
    return { ok: r.ok, status: r.status, json: j };
  }
  async function verifyToken(token, owner, repo) {
    session = { token, owner, repo, branch: "main" };
    const r = await gh("GET", `/repos/${owner}/${repo}`);
    if (r.status === 401) throw new Error("Token inválido ou expirado.");
    if (r.status === 404) throw new Error("Repositório não encontrado. Confira o nome (dono/repositório) e se o token tem acesso a ele.");
    if (!r.ok) throw new Error("Erro do GitHub (" + r.status + ").");
    if (r.json.permissions && !r.json.permissions.push) throw new Error("O token não tem permissão de escrita. Marque Contents: Read and write.");
    session.branch = r.json.default_branch || "main";
    return session;
  }
  async function putFile(path, b64, msg) {
    const q = `/repos/${session.owner}/${session.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
    const cur = await gh("GET", q + "?ref=" + encodeURIComponent(session.branch) + "&t=" + Date.now());
    const body = { message: msg, content: b64, branch: session.branch };
    if (cur.ok && cur.json && cur.json.sha) body.sha = cur.json.sha;
    const r = await gh("PUT", q, body);
    if (!r.ok) throw new Error(`Falha ao enviar ${path}: ` + ((r.json && r.json.message) || r.status));
  }
  function usedImages() {
    const u = new Set();
    Object.values(content.ops).forEach(o => { if (o.img) u.add(o.img.path); if (o.bgimg) u.add(o.bgimg.path); });
    Object.values(content.bg).forEach(b => u.add(b.path));
    return u;
  }
  async function saveAll() {
    const status = $("#adm-status", panel), btn = $("#adm-save", panel); btn.disabled = true;
    try {
      const used = usedImages();
      const toSend = Array.from(pending.entries()).filter(([p]) => used.has(p));
      let n = 0;
      for (const [path, f] of toSend) { status.textContent = `Enviando imagem ${++n}/${toSend.length}…`; await putFile(path, f.b64, "Admin: envia " + path); }
      status.textContent = "Salvando o layout…";
      content.vars = Object.fromEntries(Object.entries(content.vars).filter(([k, v]) => cleanVars[k] !== v));
      content.v = 2;
      await putFile("content.json", b64e(enc.encode(JSON.stringify(content, null, 2) + "\n")), "Admin: atualiza conteúdo");
      toSend.forEach(([p]) => pending.delete(p));
      pending.clear();
      saved = JSON.parse(JSON.stringify(content));
      status.textContent = "✔ Salvo! O site publica em 1 a 2 minutos.";
    } catch (e) { status.textContent = "✖ " + e.message; }
    btn.disabled = false; updateStatus(true);
  }

  function setEditing(on) {
    editing = on; document.body.classList.toggle("editing", on);
    refreshEditable();
  }
  function enterAdmin(sess) {
    session = sess; saved = JSON.parse(JSON.stringify(content));
    buildPanel(); buildBar(); setEditing(true);
    $("#admin-link").textContent = "Admin (ativo)";
  }
  function guessRepo() {
    const h = location.hostname; if (!h.endsWith(".github.io")) return "";
    const seg = location.pathname.split("/").filter(Boolean)[0];
    return h.split(".")[0] + "/" + (seg && !/\.(html?|json)$/i.test(seg) ? seg : h);
  }
  function modal(html) {
    const bd = mk("div", "adm-backdrop"), m = mk("div", "adm-modal", html);
    bd.appendChild(m); document.body.appendChild(bd);
    bd.addEventListener("mousedown", ev => { if (ev.target === bd) bd.remove(); });
    return { bd, m, close: () => bd.remove() };
  }
  function openLogin() {
    if (panel) { panel.classList.remove("min"); return; }
    const vault = readVault();
    if (vault) {
      const { m, close } = modal(`<h3>Entrar no editor</h3>
        <p class="adm-small">Repositório: <code>${esc(vault.owner)}/${esc(vault.repo)}</code></p>
        <form id="f"><input type="password" id="pw" placeholder="Sua senha do admin" autocomplete="current-password" required autofocus>
        <div class="adm-err" id="err"></div><button class="primary" type="submit">Entrar</button></form>
        <a href="#" id="reset" class="adm-small">Esqueci a senha / reconfigurar</a>`);
      $("#f", m).addEventListener("submit", async ev => {
        ev.preventDefault(); const err = $("#err", m); err.textContent = "Verificando…";
        try {
          let p; try { p = await decryptVault($("#pw", m).value, vault.v); } catch (e) { throw new Error("Senha incorreta."); }
          const s = await verifyToken(p.token, vault.owner, vault.repo); close(); enterAdmin(s);
        } catch (e) { err.textContent = e.message; }
      });
      $("#reset", m).addEventListener("click", ev => {
        ev.preventDefault();
        if (confirm("Isso apaga o token salvo neste navegador. Você precisará colar o token do GitHub de novo. Continuar?")) { localStorage.removeItem(VAULT_KEY); close(); openLogin(); }
      });
    } else {
      const { m, close } = modal(`<h3>Configurar o editor (1ª vez)</h3><form id="f">
        <label>Repositório (dono/nome)<input id="repo" value="${esc(guessRepo())}" placeholder="seuusuario/seurepositorio" required></label>
        <label>Token do GitHub<input id="tok" type="password" placeholder="github_pat_…" autocomplete="off" required></label>
        <label>Crie uma senha para o admin<input id="pw" type="password" minlength="6" placeholder="mínimo 6 caracteres" autocomplete="new-password" required></label>
        <p class="adm-small">O token fica criptografado só neste navegador e é protegido pela sua senha. Nas próximas vezes você digita apenas a senha.</p>
        <div class="adm-err" id="err"></div><button class="primary" type="submit">Configurar e entrar</button></form>`);
      $("#f", m).addEventListener("submit", async ev => {
        ev.preventDefault(); const err = $("#err", m); err.textContent = "Verificando…";
        try {
          const [owner, repo] = $("#repo", m).value.trim().replace(/^https?:\/\/github\.com\//, "").split("/");
          if (!owner || !repo) throw new Error("Use o formato dono/repositório.");
          const s = await verifyToken($("#tok", m).value.trim(), owner, repo);
          const v = await encryptVault($("#pw", m).value, { token: s.token });
          localStorage.setItem(VAULT_KEY, JSON.stringify({ owner, repo, v })); close(); enterAdmin(s);
        } catch (e) { err.textContent = e.message; }
      });
    }
  }

  /* ---------- inicialização ---------- */
  async function init() {
    VARS.forEach(([k]) => { cleanVars[k] = getComputedStyle(document.documentElement).getPropertyValue(k).trim(); });
    // índices do formato antigo (para migrar edições já salvas)
    const legacyText = new Map(), legacySlots = new Map();
    $$(".page").forEach(page => {
      let ti = 0, si = 0;
      $$(LEGACY_TEXT_SEL, page).forEach(e => { if (!e.closest(SLOTCLS)) legacyText.set(page.id + ":" + (ti++), e); });
      $$(LEGACY_SLOT_SEL, page).forEach(e => legacySlots.set(page.id + ":" + (si++), e));
    });
    $$("[data-b]").forEach(e => {
      nodes.set(e.dataset.b, e);
      if (isLeaf(e)) origInfo.set(e.dataset.b, { html: e.innerHTML, h: hash(e.innerHTML) });
    });
    try {
      const r = await fetch("content.json?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) content = migrate(await r.json(), legacyText, legacySlots);
    } catch (e) { /* sem content.json */ }
    applyAll();
    $("#admin-link").addEventListener("click", ev => { ev.preventDefault(); openLogin(); });
    if (/[?&]admin\b/.test(location.search)) openLogin();
  }
  init();
})();
