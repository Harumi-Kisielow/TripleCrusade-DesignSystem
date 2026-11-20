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
  const ATOMIC = "#grid,#grid-info,#battle-log";
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
  const ADD_TAGS = new Set(["DIV", "P", "H1", "H2", "H3", "H4", "SPAN", "A", "UL", "LI", "FIGURE", "STRONG", "EM", "SECTION", "TABLE", "TBODY", "TR", "TD", "TH", "HR", "AUDIO"]);
  const ATTR_OK = ["href", "alt", "role", "tabindex", "data-go", "data-nav"];
  const CSS_OK = new Set(["color", "background-color", "font-size", "font-weight", "font-style", "font-family", "text-align",
    "width", "max-width", "height", "min-height", "padding", "margin", "border-width", "border-color", "border-style",
    "border-radius", "opacity", "position", "left", "top", "z-index", "object-fit", "display", "transform",
    "letter-spacing", "line-height", "gap", "text-transform", "box-shadow", "text-decoration",
    "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
    "aspect-ratio", "align-self", "justify-self", "align-items", "justify-content", "min-width", "max-height",
    "--cols", "--gap", "--tc-slide-card-width", "--tc-slide-columns", "--tc-slide-gap",
    "--tc-slide-image-column", "--tc-slide-copy-column", "--tc-slide-image-width",
    "--tc-slide-image-max-height", "--tc-slide-copy-width", "--tc-scene-columns",
    "--tc-scene-gap", "--tc-scene-image-left", "--tc-scene-image-width",
    "--tc-scene-copy-column", "object-position"]);
  const NOTEXT_TAGS = new Set(["BUTTON", "IMG", "INPUT", "SELECT", "TEXTAREA", "HR", "BR", "TABLE", "TBODY", "TR", "UL", "OL", "AUDIO"]);
  const FONTS = [["Padrão", "var(--font-ui)"], ["Título (serifada)", "var(--font-display)"], ["Código", "monospace"]];
  const VAULT_KEY = "ds_admin_vault";
  const SHORT = new Set(["margin", "padding", "border-radius", "border-width", "gap"]);
  const FITS = ["cover", "contain", "fill"];
  const STYLE_LAYOUT_PROPS = new Set(["position", "left", "top", "width", "height", "min-width", "max-width", "min-height", "max-height", "z-index", "transform", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "--tc-slide-card-width", "--tc-slide-columns", "--tc-slide-gap", "--tc-slide-image-column", "--tc-slide-copy-column", "--tc-slide-image-width", "--tc-slide-image-max-height", "--tc-slide-copy-width",
    "--tc-scene-columns", "--tc-scene-gap", "--tc-scene-image-left", "--tc-scene-image-width", "--tc-scene-copy-column"]);

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ELEMENTS = window.TCEditorElements;
  if (!ELEMENTS) throw new Error("O catálogo do editor não foi carregado.");
  const hash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const slug = n => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const safePath = p => typeof p === "string" && /^imgs\/[A-Za-z0-9_\-./]+$/.test(p) && !p.includes("..");
  const safeAudioPath = p => typeof p === "string" && /^audio\/[A-Za-z0-9_\-./]+$/.test(p) && !p.includes("..");
  const safeAssetPath = p => safePath(p) || safeAudioPath(p);
  const HREF_RE = /^(https?:\/\/|#|mailto:|tel:|sms:|skype:|browser:|section:|scrollpoint:|file:)[^\s"'<>]*$|^(copy|clipboard):[^"'<>]*$/i;
  const safeHref = h => typeof h === "string" && h.length < 700 && HREF_RE.test(h) && !/javascript:/i.test(h);
  const GO_RE = /^((section|scrollpoint):(next|previous|first|last)|[a-z0-9\-]+)$/;
  const PREVIEW = /[?&]preview\b/.test(location.search);
  const DEFAULT_TITLE = document.title;
  /* aplica um link; "||blank" no fim abre em nova aba, "file:nome" aponta para files/nome */
  function setHref(e, raw) {
    const [u0, flags] = String(raw).split("||"); let u = u0;
    if (/^file:/i.test(u)) { const n = u.slice(5); if (!/^[\w.\-]+$/.test(n)) return; u = "files/" + n; }
    e.setAttribute("href", u);
    if (flags && /\bblank\b/.test(flags)) { e.setAttribute("target", "_blank"); e.setAttribute("rel", "noopener noreferrer"); }
    else { e.removeAttribute("target"); e.removeAttribute("rel"); }
  }
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const uid = () => "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- estado ---------- */
  let content = { v: 2, vars: {}, bg: {}, ops: {}, order: {}, add: {}, pages: {}, site: {}, styles: {} };
  let curTab = "item";
  let saved = null;
  const nodes = new Map();          // id -> elemento
  const origInfo = new Map();       // id -> {html, h} (original, só folhas)
  const pending = new Map();        // path -> {b64, mime}
  const previews = new Map();       // path -> dataURL
  const mediaPreviews = new Map();  // path -> object URL for local audio previews
  const cleanVars = {};
  const bound = new WeakSet();
  let editing = false, sel = null, session = null, panel = null, bar = null, dropLine = null, bgStyle = null, siteStyle = null, responsiveStyle = null, animationStyle = null, drag = null;
  let timerTicker = null;
  let siteRefreshTimer = null;
  let moveMode = false, siteInteractionsPaused = false;
  let lastGesture = 0, handles = null, guideV = null, guideH = null, rs = null, panMode = false, bgPan = false, ro = null;

  /* ---------- utilidades de DOM ---------- */
  const isAtomic = e => e.matches(ATOMIC);
  const dchildren = e => Array.from(e.children).filter(c => c.dataset && c.dataset.b);
  const isLeaf = e => !e.querySelector("[data-b]");
  const isSlot = e => e.matches(SLOTCLS) || !!(content.ops[e.dataset.b] || {}).img;
  const isComponentSlide = e => e.classList.contains("elem") && e.parentElement &&
    e.parentElement.classList.contains("tc-carousel") && e.parentElement.classList.contains("elem-row");
  const hasImg = e => !!(content.ops[e.dataset.b] || {}).img;
  const isProtected = e => e.classList.contains("page") || e.tagName === "HEADER" || e.tagName === "FOOTER" || e.tagName === "MAIN";
  const pageOf = e => { const p = e.closest(".page"); return p ? p.id : "site"; };
  const isTextLeaf = e => !e.matches(".swatch,.ds-timer,.ds-icon") && !isAtomic(e) && !NOTEXT_TAGS.has(e.tagName) && !hasImg(e) && isLeaf(e) && leafText(e).trim() !== "";
  const canContain = e => {
    if (isAtomic(e)) return false;
    if (e.tagName === "TBODY" || e.tagName === "UL") return true;
    if (NOTEXT_TAGS.has(e.tagName)) return false;
    if (hasImg(e)) return true;                       // imagem aceita itens por cima
    return !(isLeaf(e) && leafText(e).trim() !== "");
  };
  function leafText(e) {
    const c = e.cloneNode(true);
    $$(".ds-bg-layer", c).forEach(x => x.remove());
    $$(".slot-img", c).forEach(x => x.remove());
    return c.textContent;
  }
  function leafHtml(e) {
    const c = e.cloneNode(true);
    $$(".ds-bg-layer", c).forEach(x => x.remove());
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
  function renderTimer(e, timer) {
    const target = timer && Date.parse(timer.target);
    if (!Number.isFinite(target)) {
      e.textContent = "Defina a data final nas opções do elemento.";
      return;
    }
    const remaining = Math.max(0, target - Date.now());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    e.textContent = `${String(days).padStart(2, "0")} d  ${String(hours).padStart(2, "0")} h  ${String(minutes).padStart(2, "0")} min  ${String(seconds).padStart(2, "0")} s`;
    e.setAttribute("aria-label", `Faltam ${days} dias, ${hours} horas, ${minutes} minutos e ${seconds} segundos`);
  }
  function applyHover(e, hover) {
    ["lift", "scale", "glow"].forEach(effect => e.classList.remove("ds-effect-" + effect));
    e.style.removeProperty("--ds-hover-color");
    if (!hover || !["lift", "scale", "glow"].includes(hover.effect)) return;
    e.classList.add("ds-effect-" + hover.effect);
    if (/^#[0-9a-f]{6}$/i.test(hover.color || "")) e.style.setProperty("--ds-hover-color", hover.color);
  }

  /* ---------- aplicar conteúdo ---------- */
  function createNode(id, spec) {
    const tag = String(spec.tag || "").toUpperCase();
    if (!ADD_TAGS.has(tag)) return null;
    const e = document.createElement(tag.toLowerCase());
    e.dataset.b = id; e.dataset.added = "1";
    if (typeof spec.cls === "string" && /^[\w\- ]{0,120}$/.test(spec.cls)) e.className = spec.cls;
    const at = spec.attrs || {};
    if (safeHref(at.href)) setHref(e, at.href);
    if (/^[a-z][a-z0-9\-]{0,40}$/.test(at.id || "") && !document.getElementById(at.id)) e.id = at.id;
    if (/^[a-z0-9\-]+$/.test(at["data-nav"] || "")) e.setAttribute("data-nav", at["data-nav"]);
    if (typeof at.alt === "string") e.setAttribute("alt", at.alt.slice(0, 200));
    if (tag === "AUDIO") {
      e.controls = true;
      e.preload = "metadata";
      if (safeAudioPath(at.src)) e.src = mediaPreviews.get(at.src) || at.src;
    }
    if (at.role === "button") e.setAttribute("role", "button");
    if (/^-?\d{1,2}$/.test(String(at.tabindex || ""))) e.setAttribute("tabindex", at.tabindex);
    if (GO_RE.test(at["data-go"] || "")) e.setAttribute("data-go", at["data-go"]);
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
  function setSpotlight(img, enabled) {
    if (!img) return;
    if (enabled) {
      img.dataset.spotlight = "true";
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", img.alt ? `Ampliar imagem: ${img.alt}` : "Ampliar imagem");
    } else {
      delete img.dataset.spotlight;
      img.removeAttribute("tabindex");
      img.removeAttribute("role");
      img.removeAttribute("aria-label");
    }
  }
  function setImage(e, img) {
    if (e.tagName === "IMG") {
      if (img && safePath(img.path)) {
        e.src = previews.get(img.path) || img.path;
        if (typeof img.alt === "string") e.alt = img.alt;
        setSpotlight(e, img.spotlight === true);
      } else {
        const original = orig.el.get(e.dataset.b);
        const attrs = original && original.attrs;
        const src = attrs && attrs.find(([name]) => name === "src");
        const alt = attrs && attrs.find(([name]) => name === "alt");
        if (src) e.setAttribute("src", src[1]); else e.removeAttribute("src");
        if (alt) e.setAttribute("alt", alt[1]); else e.removeAttribute("alt");
        setSpotlight(e, false);
      }
      return;
    }
    $$(":scope > .slot-img", e).forEach(x => x.remove());
    if (img && safePath(img.path)) {
      wrapOrig(e);
      const i = mk("img", "slot-img"); i.src = previews.get(img.path) || img.path; i.alt = img.alt || ""; i.draggable = false;
      setSpotlight(i, img.spotlight === true);
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
  function youtubeVideoId(value) {
    if (typeof value !== "string") return "";
    let url;
    try { url = new URL(value.split("||")[0], location.href); } catch (e) { return ""; }
    const host = url.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (/^(www\.|m\.)?youtube\.com$/.test(host) || host === "youtube-nocookie.com") {
      id = url.searchParams.get("v") || (/^\/(embed|shorts|live)\/([^/]+)/.exec(url.pathname) || [])[2] || "";
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  }
  function refreshYouTubeThumbnail(e) {
    const o = content.ops[e.dataset.b] || {};
    const image = $(":scope > .slot-img", e);
    if (o.thumbnail !== "youtube") {
      if (image && image.dataset.youtubeThumb) setImage(e, o.img || null);
      return;
    }
    const scope = e.closest(".ds-video-block, .video-asset");
    const link = scope && Array.from(scope.querySelectorAll("a[href]")).find(a => youtubeVideoId(a.getAttribute("href") || ""));
    const videoId = link && youtubeVideoId(link.getAttribute("href") || "");
    if (!videoId) {
      if (image && image.dataset.youtubeThumb) setImage(e, o.img || null);
      return;
    }
    if (image && image.dataset.youtubeThumb) {
      image.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      image.alt = "Miniatura do vídeo no YouTube";
      return;
    }
    if (image) image.remove();
    wrapOrig(e);
    const thumb = mk("img", "slot-img");
    thumb.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    thumb.alt = "Miniatura do vídeo no YouTube";
    thumb.draggable = false;
    thumb.dataset.youtubeThumb = "1";
    e.insertBefore(thumb, e.firstChild);
    e.classList.add("has-img");
    e.removeAttribute("contenteditable");
    syncSize(e);
  }
  function refreshYouTubeThumbnails(root) {
    $$(".ds-video-poster, .video-asset .pk-slot", root || document).forEach(refreshYouTubeThumbnail);
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
  const bgDims = new Map();
  function setBgImg(e, b) {
    if (b && safePath(b.path)) {
      const dim = Math.min(0.9, Math.max(0, Number(b.dim) || 0));
      const src = (previews.get(b.path) || b.path).replace(/"/g, "%22");
      const size = b.size === "stretch" ? "100% 100%" : b.size === "free" ? (Math.min(400, Math.max(10, Number(b.w) || 100))) + "% auto" : ["cover", "contain", "auto"].includes(b.size) ? b.size : "cover";
      const px = b.x === undefined ? 50 : Math.min(100, Math.max(0, Number(b.x) || 0)), py = b.y === undefined ? 50 : Math.min(100, Math.max(0, Number(b.y) || 0));
      const brightness = Math.min(2, Math.max(0.25, Number(b.brightness) || 1));
      const blur = Math.min(24, Math.max(0, Number(b.blur) || 0));
      const zoom = Math.min(4, Math.max(1, Number(b.zoom) || 1));
      let layer = $(":scope > .ds-bg-layer", e);
      if (!layer) {
        layer = mk("span", "ds-bg-layer");
        layer.setAttribute("aria-hidden", "true");
        layer.contentEditable = "false";
        e.prepend(layer);
      }
      layer.style.inset = blur ? "-" + (blur * 2) + "px" : "0";
      layer.style.borderRadius = "inherit";
      layer.style.clipPath = "inherit";
      layer.style.backgroundImage = `linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})),url("${src}")`;
      layer.style.backgroundSize = "100% 100%, " + size;
      layer.style.backgroundPosition = "center, " + px + "% " + py + "%";
      layer.style.backgroundRepeat = "no-repeat";
      layer.style.filter = `brightness(${brightness}) blur(${blur}px)`;
      layer.style.transform = `scale(${zoom})`;
      e.classList.add("ds-bgimg");
      e.classList.toggle("ds-art", !!b.art);
      if (!bgDims.has(b.path)) { const im = new Image(); im.onload = () => bgDims.set(b.path, { w: im.naturalWidth, h: im.naturalHeight }); im.src = (previews.get(b.path) || b.path); }
    } else {
      const layer = $(":scope > .ds-bg-layer", e);
      if (layer) layer.remove();
      e.classList.remove("ds-art", "ds-bgimg");
    }
  }
  const HEX_RE = /^#[0-9a-f]{6}$/i;
  function applySw(e, sw) {
    if (!sw) return;
    if (typeof sw.label === "string") e.dataset.label = sw.label.slice(0, 60);
    if (HEX_RE.test(sw.hex || "")) { e.dataset.hex = sw.hex; e.removeAttribute("data-var"); }
    window.DS && window.DS.renderSwatches();
  }
  function applyOpTo(e, id, o) {
    if (o.t && typeof o.t.v === "string" && isLeaf(e)) {
      const oi = origInfo.get(id);
      if (o.t.h === undefined || (oi && oi.h === o.t.h)) e.innerHTML = sanitize(o.t.v);
    }
    if (o.s) Object.entries(o.s).sort((a, b) => SHORT.has(b[0]) - SHORT.has(a[0])).forEach(([p, v]) => { if (okCss(p, v)) e.style.setProperty(p, v); });
    e.classList.toggle("ds-hidden", !!o.hide);
    if (o.carouselPaused) e.dataset.tcCarouselPaused = "true";
    else delete e.dataset.tcCarouselPaused;
    if (o.img) {
      const oi = origInfo.get(id);
      if (o.img.h === undefined || (oi && oi.h === o.img.h)) setImage(e, o.img);
    }
    if (o.bgimg) setBgImg(e, o.bgimg);
    if (o.sw) applySw(e, o.sw);
    if (o.frame) setFrame(e, o.frame);
    if (o.icon && e.matches(".ds-icon")) ELEMENTS.renderIcon(e, o.icon);
    if (o.hover) applyHover(e, o.hover);
    if (e.matches(".ds-timer")) renderTimer(e, o.timer);
    syncSize(e);
    if (o.href && safeHref(o.href) && e.tagName === "A") setHref(e, o.href);
    if (o.go && GO_RE.test(o.go)) e.setAttribute("data-go", o.go);
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
  function applySiteSettings() {
    const site = content.site || {};
    const title = typeof site.title === "string" ? site.title.trim().slice(0, 120) : "";
    const description = typeof site.description === "string" ? site.description.trim().slice(0, 300) : "";
    const brand = $("#b4");
    const brandIcon = $("#b3");
    if (brand) brand.textContent = typeof site.brandName === "string" && site.brandName ? site.brandName.slice(0, 80) : "Triple Crusade";
    if (brandIcon) brandIcon.textContent = typeof site.brandIcon === "string" && site.brandIcon ? site.brandIcon.slice(0, 8) : "✦";
    document.title = title || DEFAULT_TITLE;
    document.documentElement.lang = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(site.language || "") ? site.language : "pt-BR";
    const setMeta = (selector, attrs, value) => {
      let el = $(selector);
      if (!el) { el = document.createElement("meta"); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); document.head.appendChild(el); }
      if (value) el.setAttribute("content", value); else el.removeAttribute("content");
    };
    setMeta('meta[name="description"]', { name: "description" }, description);
    setMeta('meta[property="og:title"]', { property: "og:title" }, title || document.title);
    setMeta('meta[property="og:description"]', { property: "og:description" }, description);
    const shareImage = safePath(site.shareImage)
      ? (previews.get(site.shareImage) || new URL(site.shareImage, location.href).href)
      : "";
    setMeta('meta[property="og:image"]', { property: "og:image" }, shareImage);
    setMeta('meta[property="og:type"]', { property: "og:type" }, "website");
    setMeta('meta[name="twitter:card"]', { name: "twitter:card" }, shareImage ? "summary_large_image" : "summary");
    setMeta('meta[name="twitter:title"]', { name: "twitter:title" }, title || document.title);
    setMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
    setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, shareImage);
    let canonical = $('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    if (typeof site.canonicalUrl === "string" && /^https?:\/\/[^\s"'<>]+$/i.test(site.canonicalUrl)) canonical.href = site.canonicalUrl;
    else canonical.removeAttribute("href");
    let icon = $('link[rel="icon"]');
    if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; document.head.appendChild(icon); }
    if (safePath(site.icon)) { icon.href = previews.get(site.icon) || site.icon; }
    else { icon.removeAttribute("href"); }

    if (!siteStyle) { siteStyle = mk("style"); siteStyle.id = "ds-site-settings"; document.head.appendChild(siteStyle); }
    const maxWidthValue = Number(site.maxWidth);
    const maxWidth = Math.max(640, Math.min(1600, Number.isFinite(maxWidthValue) && maxWidthValue > 0 ? maxWidthValue : 980));
    const gutter = Math.max(0, Math.min(64, Number.isFinite(Number(site.gutter)) ? Number(site.gutter) : 16));
    const radius = Math.max(0, Math.min(48, Number.isFinite(Number(site.radius)) ? Number(site.radius) : 6));
    const lineHeight = Math.max(1.2, Math.min(2, Number.isFinite(Number(site.lineHeight)) ? Number(site.lineHeight) : 1.6));
    const transition = Math.max(0, Math.min(800, Number.isFinite(Number(site.transition)) ? Number(site.transition) : 250));
    const fontChoices = {
      "system": 'system-ui, -apple-system, "Segoe UI", sans-serif',
      "trebuchet": '"Trebuchet MS", system-ui, sans-serif',
      "cinzel": '"Cinzel", Georgia, serif',
      "bodoni": '"Libre Bodoni", Georgia, serif',
      "marcellus": '"Marcellus SC", Georgia, serif',
      "georgia": 'Georgia, "Times New Roman", serif'
    };
    const bodyFont = fontChoices[site.bodyFont] || fontChoices.bodoni;
    const headingFont = fontChoices[site.headingFont] || fontChoices.cinzel;
    siteStyle.textContent = `:root{--maxw:${maxWidth}px;--site-gutter:${gutter}px;--radius:${radius}px;--site-line-height:${lineHeight};--site-transition:${transition}ms;--font-ui:${bodyFont};--font-display:${headingFont};--topbar-position:${site.stickyHeader === false ? "relative" : "sticky"}}main{padding-left:var(--site-gutter);padding-right:var(--site-gutter)}body{line-height:var(--site-line-height)}`;
    if (site.home && document.getElementById(site.home) && window.DS) window.DS.setHome(site.home);
  }
  function applyResponsiveStyles() {
    if (!responsiveStyle) { responsiveStyle = mk("style"); responsiveStyle.id = "ds-mobile-settings"; document.head.appendChild(responsiveStyle); }
    const css = [];
    Object.entries(content.ops).forEach(([id, op]) => {
      if (!/^[A-Za-z0-9_-]+$/.test(id)) return;
      const declarations = [];
      if (op.hideMobile) declarations.push("display:none!important");
      if (op.mobile && typeof op.mobile === "object") {
        Object.entries(op.mobile).forEach(([prop, value]) => {
          if (CSS_OK.has(prop) && okCss(prop, value)) declarations.push(`${prop}:${value}!important`);
        });
      }
      if (declarations.length) css.push(`[data-b="${id}"]{${declarations.join(";")}}`);
    });
    responsiveStyle.textContent = `@media(max-width:720px){${css.join("")}}`;
  }
  const ANIM_EFFECTS = [
    ["", "Nenhum"], ["fade", "Aparecer"], ["rise", "Subir"],
    ["slide", "Deslizar"], ["zoom", "Zoom"], ["flip", "Virar"],
    ["bounce", "Pular"], ["spin", "Girar"], ["scale-x", "Expandir"],
    ["blur", "Desfocar"]
  ];
  const ANIM_KEYS = ["fade", "rise", "slide", "zoom", "flip", "bounce", "spin", "scale-x", "blur"];

  function applyAnimations() {
    if (!animationStyle) { animationStyle = mk("style"); animationStyle.id = "ds-element-animations"; document.head.appendChild(animationStyle); }
    const effects = { fade: "ds-fade", rise: "ds-rise", slide: "ds-slide", zoom: "ds-zoom", flip: "ds-flip", bounce: "ds-bounce", spin: "ds-spin", "scale-x": "ds-scale-x", blur: "ds-blur" };
    const rules = [];
    Object.entries(content.ops).forEach(([id, op]) => {
      const animation = op.animation;
      if (!/^[A-Za-z0-9_-]+$/.test(id) || !animation || !Object.prototype.hasOwnProperty.call(effects, animation.effect)) return;
      const duration = Math.max(100, Math.min(3000, Number(animation.duration) || 500));
      const delay = Math.max(0, Math.min(3000, Number(animation.delay) || 0));
      const selector = `[data-b="${id}"]`;
      rules.push(`${selector}{animation:${effects[animation.effect]} ${duration}ms ease ${delay}ms both}`);
      rules.push(`@media(prefers-reduced-motion:reduce){${selector}{animation:none!important}}`);
    });
    animationStyle.textContent = `@keyframes ds-fade{from{opacity:0}to{opacity:1}}@keyframes ds-rise{from{opacity:0;translate:0 20px}to{opacity:1;translate:0 0}}@keyframes ds-slide{from{opacity:0;translate:-20px 0}to{opacity:1;translate:0 0}}@keyframes ds-zoom{from{opacity:0;scale:.92}to{opacity:1;scale:1}}@keyframes ds-flip{from{opacity:0;transform:perspective(600px) rotateY(-15deg)}to{opacity:1;transform:none}}@keyframes ds-bounce{0%{opacity:0;translate:0 -20px}60%{opacity:1;translate:0 6px}100%{translate:0 0}}@keyframes ds-spin{from{opacity:0;rotate:-90deg}to{opacity:1;rotate:0deg}}@keyframes ds-scale-x{from{opacity:0;scale:0 1}to{opacity:1;scale:1 1}}@keyframes ds-blur{from{opacity:0;filter:blur(8px)}to{opacity:1;filter:none}}${rules.join("")}`;
  }
  function setupScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('ds-anim-pending');
          entry.target.classList.add('ds-anim-triggered');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    
    Object.entries(content.ops).forEach(([id, op]) => {
      if (!op.animation || !op.animation.effect) return;
      const el = nodes.get(id);
      if (!el || editing) return;
      el.classList.add('ds-anim-pending');
      observer.observe(el);
    });
  }
  function applySharedStyle(styleId) {
    const style = content.styles[styleId];
    if (!style || !/^[A-Z]+$/.test(style.tag || "")) return;
    nodes.forEach(e => {
      const current = content.ops[e.dataset.b] || {};
      if (current.style !== styleId || e.tagName !== style.tag) return;
      const previous = current.s || {};
      const next = Object.assign({}, previous);
      Object.keys(previous).filter(prop => !STYLE_LAYOUT_PROPS.has(prop)).forEach(prop => { e.style.removeProperty(prop); delete next[prop]; });
      Object.entries(style.s || {}).forEach(([prop, value]) => {
        if (!STYLE_LAYOUT_PROPS.has(prop) && okCss(prop, value)) { next[prop] = value; e.style.setProperty(prop, value); }
      });
      if (Object.keys(next).length) current.s = next; else delete current.s;
      if (style.bgimg && safePath(style.bgimg.path)) {
        current.bgimg = Object.assign({}, style.bgimg);
        setBgImg(e, current.bgimg);
      } else {
        delete current.bgimg;
        setBgImg(e, null);
      }
      if (style.animation && ANIM_KEYS.includes(style.animation.effect)) current.animation = Object.assign({}, style.animation);
      else delete current.animation;
      cleanOp(e.dataset.b);
      syncSize(e);
    });
  }
  function syncSharedStyle(e) {
    const current = content.ops[e.dataset.b] || {}, styleId = current.style;
    const style = styleId && content.styles[styleId];
    if (!style || style.tag !== e.tagName) return;
    style.s = Object.fromEntries(Object.entries(current.s || {}).filter(([prop]) => !STYLE_LAYOUT_PROPS.has(prop)));
    if (current.bgimg && safePath(current.bgimg.path)) style.bgimg = Object.assign({}, current.bgimg);
    else delete style.bgimg;
    if (current.animation && ANIM_KEYS.includes(current.animation.effect)) style.animation = Object.assign({}, current.animation);
    else delete style.animation;
    applySharedStyle(styleId);
  }
  function refreshStyleLibrary() {
    const box = $("#adm-styles", panel); if (!box) return;
    box.innerHTML = "";
    const styles = Object.entries(content.styles).filter(([, style]) => style && /^[A-Z]+$/.test(style.tag || ""));
    if (!styles.length) box.appendChild(mk("p", "adm-small", "Salve a aparência de um item para reutilizá-la em outros itens do mesmo tipo."));
    styles.forEach(([id, style]) => {
      const item = mk("div", "adm-style");
      const label = mk("span"); label.textContent = `${style.name || "Estilo"} · ${style.tag.toLowerCase()}`;
      item.appendChild(label);
      item.appendChild(btn("Aplicar", "", () => {
        if (!sel) { note("Selecione primeiro um item."); return; }
        if (!attachSharedStyle(sel, id)) { note("Este estilo só pode ser aplicado a itens do tipo " + style.tag.toLowerCase() + "."); return; }
        markDirty(); buildProps(); refreshStyleLibrary();
      }));
      item.appendChild(btn("Renomear", "", () => {
        const name = prompt("Nome do estilo:", style.name || "Estilo");
        if (!name || !name.trim()) return;
        style.name = name.trim().slice(0, 60); markDirty(); buildProps(); refreshStyleLibrary();
      }));
      item.appendChild(btn("Excluir", "", () => {
        if (!confirm("Excluir o estilo compartilhado? Os itens vinculados manterão a aparência atual.")) return;
        nodes.forEach(e => { const current = content.ops[e.dataset.b]; if (current && current.style === id) delete current.style; });
        delete content.styles[id]; markDirty(); buildProps(); refreshStyleLibrary();
      }, "danger"));
      box.appendChild(item);
    });
  }
  function attachSharedStyle(e, styleId) {
    const style = content.styles[styleId], current = op(e.dataset.b);
    if (!style || style.tag !== e.tagName) return false;
    current.style = styleId;
    applySharedStyle(styleId);
    return true;
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
    Object.keys(content.styles).forEach(applySharedStyle);
    fixFree(); applyVars(); applyBg(); applySiteSettings(); applyResponsiveStyles(); applyAnimations(); refreshYouTubeThumbnails(); setupScrollAnimations();
  }

  /* ---------- migração do formato antigo ---------- */
  function migrate(j, legacyText, legacySlots) {
    const out = normContent({ v: 2, vars: j.vars || {}, bg: j.bg || {}, ops: j.ops || {}, order: j.order || {}, add: j.add || {}, pages: j.pages || {}, site: j.site || {}, styles: j.styles || {} });
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
  /* ---------- itens vinculados: copiam o estilo do item selecionado (o "chefe") ---------- */
  const linked = new Set();
  const LINK_SKIP = new Set(["left", "top", "position", "transform", "z-index", "--cols", "--gap"]);
  function syncLinked() {
    if (!sel || !linked.size) return;
    const so = content.ops[sel.dataset.b] || {};
    linked.forEach(n => {
      if (!n.isConnected || n === sel) return;
      const id = n.dataset.b, o = op(id);
      CSS_OK.forEach(p => {
        if (LINK_SKIP.has(p)) return;
        const v = (so.s || {})[p], cur = (o.s || {})[p];
        if (v === cur) return;
        if (v) { o.s = o.s || {}; o.s[p] = v; n.style.setProperty(p, v); }
        else { if (o.s) delete o.s[p]; n.style.removeProperty(p); }
      });
      if (o.s && !Object.keys(o.s).length) delete o.s;
      if (JSON.stringify(so.bgimg || null) !== JSON.stringify(o.bgimg || null)) {
        if (so.bgimg) { o.bgimg = Object.assign({}, so.bgimg); setBgImg(n, o.bgimg); } else { delete o.bgimg; setBgImg(n, null); }
      }
      syncSize(n); cleanOp(id);
    });
  }
  function toggleLink(t) {
    if (!sel || t === sel || isProtected(t) || t.contains(sel) || sel.contains(t)) return;
    if (linked.has(t)) { linked.delete(t); t.classList.remove("ds-linked"); }
    else { linked.add(t); t.classList.add("ds-linked"); }
    syncLinked(); markDirty(); buildProps();
  }
  function clearLinks() { linked.forEach(n => n.classList.remove("ds-linked")); linked.clear(); }
  function markDirty() { syncLinked(); applyResponsiveStyles(); applyAnimations(); updateStatus(); scheduleCommit(); refreshTreeSoon(); }
  let treeTimer = null;
  function refreshTreeSoon() { clearTimeout(treeTimer); treeTimer = setTimeout(() => { refreshTree(); refreshSections(); }, 160); }
  function setS(e, prop, val) {
    const id = e.dataset.b, o = op(id); o.s = o.s || {};
    if (val === null || val === undefined || val === "") { delete o.s[prop]; e.style.removeProperty(prop); }
    else { if (!okCss(prop, val)) return; o.s[prop] = val; e.style.setProperty(prop, val); }
    if (isComponentSlide(e) && prop === "width") {
      if (val === null || val === undefined || val === "") {
        delete o.s["--tc-slide-card-width"];
        e.style.removeProperty("--tc-slide-card-width");
      } else {
        o.s["--tc-slide-card-width"] = val;
        e.style.setProperty("--tc-slide-card-width", val);
      }
    }
    if (!Object.keys(o.s).length) delete o.s;
    cleanOp(id); syncSharedStyle(e); fixFree(); syncSize(e); markDirty(); placeBar();
  }
  function recordOrder(container) {
    if (!container || !container.dataset.b) return;
    content.order[container.dataset.b] = dchildren(container).map(c => c.dataset.b);
  }

  /* ---------- texto editável ---------- */
  function onTextInput(e) {
    const id = e.dataset.b, oi = origInfo.get(id), copy = e.cloneNode(true);
    $$(".ds-bg-layer", copy).forEach(x => x.remove());
    const v = sanitize(copy.innerHTML);
    const o = op(id);
    if (oi && v === oi.html) delete o.t;
    else o.t = oi ? { h: oi.h, v } : { v };
    cleanOp(id); markDirty(); refreshSiteFeatures();
  }
  function refreshSiteFeatures() {
    clearTimeout(siteRefreshTimer);
    siteRefreshTimer = setTimeout(() => document.dispatchEvent(new CustomEvent("ds:content-updated")), 120);
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
  let fileCb = null, fileKind = "image";
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0], cb = fileCb, kind = fileKind;
    fileInput.value = ""; fileCb = null;
    if (!f || !cb) return;
    if (f.size > 20 * 1024 * 1024) { alert("Arquivo acima de 20 MB. Reduza o arquivo antes de enviar."); return; }
    if (kind === "image" ? !f.type.startsWith("image/") : !f.type.startsWith("audio/")) {
      alert(kind === "image" ? "Escolha um arquivo de imagem." : "Escolha um arquivo de áudio.");
      return;
    }
    const r = new FileReader();
    r.onload = () => cb({ name: f.name, url: kind === "audio" ? URL.createObjectURL(f) : r.result, b64: r.result.split(",")[1], mime: f.type });
    r.onerror = () => alert("Não foi possível ler o arquivo selecionado.");
    r.readAsDataURL(f);
  });
  document.body.appendChild(fileInput);
  function pickFile(kind, cb) { fileKind = kind; fileCb = cb; fileInput.accept = kind === "audio" ? "audio/*" : "image/*"; fileInput.click(); }
  function pickImage(cb) { pickFile("image", cb); }
  function registerImage(f, folder) {
    const ext = (f.name.match(/\.[a-z0-9]+$/i) || [".png"])[0].toLowerCase();
    const base = slug(f.name.replace(/\.[^.]+$/, "")) || "imagem";
    const path = `imgs/${folder}/${base}-${hash(f.b64.slice(0, 4000) + f.b64.length).slice(0, 4)}${ext}`;
    pending.set(path, { b64: f.b64, mime: f.mime }); previews.set(path, f.url);
    return path;
  }
  function registerAudio(f, folder) {
    const ext = (f.name.match(/\.[a-z0-9]+$/i) || [".mp3"])[0].toLowerCase();
    const base = slug(f.name.replace(/\.[^.]+$/, "")) || "audio";
    const path = `audio/${folder}/${base}-${hash(f.b64.slice(0, 4000) + f.b64.length).slice(0, 4)}${ext}`;
    pending.set(path, { b64: f.b64, mime: f.mime }); mediaPreviews.set(path, f.url);
    return path;
  }
  function chooseAudioFor(e) {
    pickFile("audio", f => {
      const spec = content.add[e.dataset.b];
      if (!spec || e.tagName !== "AUDIO") { alert("O bloco de áudio não está configurado corretamente."); return; }
      const previous = spec.attrs && spec.attrs.src;
      if (previous && mediaPreviews.has(previous)) {
        URL.revokeObjectURL(mediaPreviews.get(previous));
        mediaPreviews.delete(previous);
      }
      const path = registerAudio(f, pageOf(e));
      spec.attrs = Object.assign({}, spec.attrs, { src: path });
      e.src = f.url; e.load(); markDirty(); buildProps(); placeBar();
    });
  }
  window.addEventListener("beforeunload", () => mediaPreviews.forEach(url => URL.revokeObjectURL(url)));
  function chooseImageFor(e) {
    pickImage(f => {
      const path = registerImage(f, pageOf(e));
      const o = op(e.dataset.b), oi = origInfo.get(e.dataset.b);
      delete o.thumbnail;
      o.img = Object.assign({ path }, oi ? { h: oi.h } : {});
      setImage(e, o.img); refreshEditable(); buildProps(); markDirty(); placeBar(); refreshSiteFeatures();
    });
  }
  function chooseBgFor(e) {
    pickImage(f => {
      const path = registerImage(f, pageOf(e));
      const o = op(e.dataset.b); const prev = Object.assign({}, o.bgimg || {});
      const btnLike = !prev.path && e.matches("button,[role=button],.stone-btn,.btn,.card,.gate-card,a");
      o.bgimg = Object.assign({}, prev, { path, dim: prev.dim || 0, size: prev.size || (btnLike ? "stretch" : "cover") });
      if (prev.art || btnLike) o.bgimg.art = true;
      setBgImg(e, o.bgimg); syncSharedStyle(e); buildProps(); markDirty(); refreshSiteFeatures();
    });
  }

  /* ---------- seleção ---------- */
  function select(e, keepTab) {
    clearLinks();
    if (sel) sel.classList.remove("ds-sel");
    sel = e && e.isConnected ? e : null;
    if (sel) sel.classList.add("ds-sel");
    if (ro) { ro.disconnect(); if (sel) ro.observe(sel); }
    if (panMode && !(sel && hasImg(sel))) { panMode = false; document.body.classList.remove("ds-pan"); }
    if (bgPan && !(sel && (content.ops[sel.dataset.b] || {}).bgimg)) { bgPan = false; document.body.classList.remove("ds-pan"); }
    buildProps(); placeBar(); updateAddHint(); refreshTree();
    const previewButton = panel && $("#adm-anim-preview", panel);
    if (previewButton) previewButton.disabled = !sel || isProtected(sel);
  }
  function makeFree(e) {
    if (!e || isProtected(e) || e.style.position === "absolute") return;
    const parent = e.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect(), rect = e.getBoundingClientRect();
    const width = Math.max(1, parent.clientWidth), height = Math.max(1, parent.clientHeight);
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    if (parent.dataset.b && !dchildren(parent).some(child => child !== e && !child.classList.contains("ds-hidden"))) {
      const parentStyles = op(parent.dataset.b).s || (op(parent.dataset.b).s = {});
      parentStyles["min-height"] = Math.max(1, Math.ceil(parentRect.height)) + "px";
      parent.style.minHeight = parentStyles["min-height"];
    }
    const styles = op(e.dataset.b).s || (op(e.dataset.b).s = {});
    styles.position = "absolute";
    styles.left = r1((rect.left - parentRect.left - parent.clientLeft) / width * 100) + "%";
    styles.top = r1((rect.top - parentRect.top - parent.clientTop) / height * 100) + "%";
    if (!e.style.width) styles.width = r1(Math.min(100, rect.width / width * 100)) + "%";
    ["margin", "margin-left", "margin-right", "margin-top", "margin-bottom"].forEach(prop => {
      delete styles[prop];
      e.style.removeProperty(prop);
    });
    Object.entries(styles).forEach(([prop, value]) => e.style.setProperty(prop, value));
    return true;
  }
  function startCanvasMove(ev, target) {
    if (!target || target === document.querySelector("main")) return;
    select(target);
    if (curTab !== "item") showTab("item");
    if (!makeFree(target) && target.style.position !== "absolute") return;
    startDrag(ev);
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
    if (!t || t.tagName === "MAIN") { select(null); return; }
    if (ev.shiftKey && sel && t !== sel) { ev.preventDefault(); ev.stopImmediatePropagation(); toggleLink(t); return; }
    select(t); if (curTab !== "item" && curTab !== "add") showTab("item");
    if (t.closest("a[href]")) ev.preventDefault();
    if (t.closest("a[href],[data-go]")) ev.stopPropagation();
  }, true);
  document.addEventListener("click", ev => {
    if (!editing || !siteInteractionsPaused || ev.target.closest(".adm-panel,.adm-modal,.adm-backdrop,.adm-bar,.adm-handles")) return;
    if (!ev.target.isContentEditable) ev.preventDefault();
    ev.stopImmediatePropagation();
  }, true);
  document.addEventListener("keydown", ev => {
    if (!editing || !siteInteractionsPaused || ev.ctrlKey || ev.metaKey ||
      ev.target.closest(".adm-panel,.adm-modal,.adm-backdrop,.adm-bar") ||
      ev.target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName)) return;
    const targetItem = ev.target.closest("[data-b]");
    if (sel && targetItem === sel && /^Arrow/.test(ev.key)) { ev.stopPropagation(); return; }
    if (!ev.target.closest("a,button,[role='button'],[data-go],.tc-carousel,.tc-character-stage,.tc-scene-stage,#grid,#atb,#skill-pop,.pad,[data-cmd]")) return;
    if (["Enter", " ", "ArrowLeft", "ArrowRight"].includes(ev.key)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      return;
    }
    if (/^[wasdqe]$/i.test(ev.key)) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);
  ["pointerdown", "mousedown"].forEach(type => document.addEventListener(type, ev => {
    if (!editing || !siteInteractionsPaused || moveMode || panMode || bgPan ||
      ev.target.closest(".adm-panel,.adm-modal,.adm-backdrop,.adm-bar,.adm-handles") ||
      ev.target.isContentEditable) return;
    ev.stopImmediatePropagation();
  }, true));
  document.addEventListener("pointerdown", ev => {
    if (!editing || !moveMode || ev.button !== 0 ||
      ev.target.closest(".adm-panel,.adm-modal,.adm-backdrop,.adm-bar,.adm-handles,a,button,input,select,textarea")) return;
    const target = ev.target.closest("[data-b]");
    if (!target || target.tagName === "MAIN" || isProtected(target)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    startCanvasMove(ev, target);
  }, true);
  let hov = null;
  document.addEventListener("mouseover", ev => {
    if (!editing) return;
    const t = ev.target.closest && ev.target.closest(".adm-panel,.adm-bar,.adm-modal") ? null : ev.target.closest && ev.target.closest("[data-b]");
    if (hov === t) return;
    if (hov) hov.classList.remove("ds-hover");
    hov = t && t.tagName === "MAIN" ? null : t; if (hov && hov !== sel) hov.classList.add("ds-hover");
  });
  window.addEventListener("hashchange", () => { select(null); setTimeout(() => { fixFree(); refreshPageControls(); }, 0); });
  window.addEventListener("scroll", () => placeBar(), true);
  window.addEventListener("resize", () => placeBar());
  window.addEventListener("beforeunload", ev => { if (editing && countChanges() > 0) { ev.preventDefault(); ev.returnValue = ""; } });
  document.addEventListener("keydown", ev => {
    if (globalKeys(ev)) return;
    if (!editing) return;
    if (ev.key === "Delete" || ev.key === "Backspace") {
      const image = ev.target.closest && ev.target.closest(".slot-img");
      const item = image && image.closest("[data-b]");
      if (item) select(item);
    }
    if (!sel) return;
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
    handles.addEventListener("pointerdown", ev => { const h = ev.target.closest("[data-h]"); if (h) startResize(ev, h.dataset.h, h); });
    guideV = mk("div", "adm-guide adm-guide-v"); guideH = mk("div", "adm-guide adm-guide-h"); document.body.append(guideV, guideH);
    if (window.ResizeObserver) ro = new ResizeObserver(() => placeBar());
  }
  const resizable = e => !isProtected(e) && !isAtomic(e) && !e.matches(".ds-anchor") && !/^(TD|TH|TR|TBODY|LI|TABLE|UL|OL)$/.test(e.tagName);
  function startResize(ev, h, handle) {
    const e = sel; if (!e || !resizable(e)) return;
    ev.preventDefault(); ev.stopPropagation();
    handle.setPointerCapture(ev.pointerId);
    const r = e.getBoundingClientRect(), par = e.parentElement, pr = par.getBoundingClientRect();
    const abs = e.style.position === "absolute";
    rs = { el: e, h, handle, pointerId: ev.pointerId, x0: ev.clientX, y0: ev.clientY, w0: r.width, h0: r.height, pb: parentBox(e), abs,
      l0: r.left - pr.left - par.clientLeft, t0: r.top - pr.top - par.clientTop, img: hasImg(e), hasAspect: !!e.style.aspectRatio, hasH: !!e.style.height };
    document.body.classList.add("ds-moving");
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeEnd);
    window.addEventListener("pointercancel", onResizeEnd);
  }
  function onResizeMove(ev) {
    if (!rs || ev.pointerId !== rs.pointerId) return;
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
  function onResizeEnd(ev) {
    if (!rs || ev.pointerId !== rs.pointerId) return;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeEnd);
    window.removeEventListener("pointercancel", onResizeEnd);
    if (rs.handle.hasPointerCapture(rs.pointerId)) rs.handle.releasePointerCapture(rs.pointerId);
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
  /* mover / dar zoom na imagem de fundo (texto por cima) */
  function bgFree(e, b) {
    const d = bgDims.get(b.path), bw = e.clientWidth, bh = e.clientHeight; if (!d) return null;
    let iw, ih;
    const zoom = Math.min(4, Math.max(1, Number(b.zoom) || 1));
    if (b.size === "stretch") return null;
    if (b.size === "free") { iw = bw * (Math.min(400, Math.max(10, Number(b.w) || 100)) / 100); ih = iw * d.h / d.w; }
    else if (b.size === "contain") { const k = Math.min(bw / d.w, bh / d.h); iw = d.w * k; ih = d.h * k; }
    else if (b.size === "auto") { iw = d.w; ih = d.h; }
    else { const k = Math.max(bw / d.w, bh / d.h); iw = d.w * k; ih = d.h * k; }
    return { x: bw - iw * zoom, y: bh - ih * zoom };
  }
  document.addEventListener("pointerdown", ev => {
    if (!editing || !bgPan || !sel || ev.target.closest(".adm-panel,.adm-bar,.adm-handles") || !sel.contains(ev.target)) return;
    const o = op(sel.dataset.b), b = o.bgimg; if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const fr = bgFree(sel, b), x0 = ev.clientX, y0 = ev.clientY, bx = b.x === undefined ? 50 : b.x, by = b.y === undefined ? 50 : b.y;
    if (!fr) { note("No modo \"Esticar\" a imagem já ocupa tudo. Troque o Tamanho para Livre ou Preencher."); return; }
    const mv = m => {
      if (Math.abs(fr.x) > 1) b.x = Math.round(Math.min(100, Math.max(0, bx + (m.clientX - x0) / fr.x * 100)));
      if (Math.abs(fr.y) > 1) b.y = Math.round(Math.min(100, Math.max(0, by + (m.clientY - y0) / fr.y * 100)));
      setBgImg(sel, b); markDirty();
    };
    const up = () => { window.removeEventListener("pointermove", mv); lastGesture = performance.now(); buildProps(); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up, { once: true });
  }, true);
  document.addEventListener("wheel", ev => {
    if (!editing || !bgPan || !sel || !sel.contains(ev.target)) return;
    const b = op(sel.dataset.b).bgimg; if (!b) return;
    ev.preventDefault();
    b.zoom = Math.min(4, Math.max(1, Math.round(((Number(b.zoom) || 1) + (ev.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100));
    setBgImg(sel, b); markDirty(); buildProps();
  }, { passive: false });
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
      recordOrder(d.oldParent); recordOrder(container); markDirty(); refreshSiteFeatures();
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
    if (spec.thumbnail === "youtube") op(id).thumbnail = "youtube";
    if (spec.icon) { op(id).icon = Object.assign({}, spec.icon); ELEMENTS.renderIcon(e, op(id).icon); }
    if (spec.bgimg) { op(id).bgimg = spec.bgimg; setBgImg(e, spec.bgimg); }
    if (spec.sw) { op(id).sw = { label: String(spec.sw.label || "").slice(0, 60), hex: spec.sw.hex }; applySw(e, op(id).sw); }
    if (typeof spec.style === "string" && content.styles[spec.style] && content.styles[spec.style].tag === e.tagName) op(id).style = spec.style;
    if (spec.fit && FITS.includes(spec.fit)) { op(id).fit = spec.fit; const im = $(":scope > .slot-img", e); if (im) im.style.objectFit = spec.fit; }
    if (spec.frame) { op(id).frame = Object.assign({}, spec.frame); setFrame(e, spec.frame); }
    syncSize(e);
    cleanOp(id);
    if (refEl) parentEl.insertBefore(e, refEl); else parentEl.appendChild(e);
    if (op(id).style) applySharedStyle(op(id).style);
    (spec.children || []).forEach(c => spawn(c, e, null));
    recordOrder(parentEl);
    if (spec.sw) window.DS && window.DS.renderSwatches();
    refreshSiteFeatures();
    return e;
  }
  function specOf(e) {
    const spec = { tag: e.tagName.toLowerCase(), cls: e.className.replace(/\b(ds-sel|ds-hover|ds-dragging|has-img|ds-hidden|ds-w|ds-h|ds-rad|ds-frame)\b/g, "").replace(/\s+/g, " ").trim(), attrs: {}, s: {} };
    ATTR_OK.forEach(a => { if (e.hasAttribute(a)) spec.attrs[a] = e.getAttribute(a); });
    CSS_OK.forEach(p => { const v = e.style.getPropertyValue(p); if (v) spec.s[p] = v; });
    const o = content.ops[e.dataset.b] || {};
    if (e.tagName === "AUDIO") {
      const source = content.add[e.dataset.b] && content.add[e.dataset.b].attrs && content.add[e.dataset.b].attrs.src;
      if (safeAudioPath(source)) spec.attrs.src = source;
      else delete spec.attrs.src;
    }
    if (o.img) spec.img = { path: o.img.path };
    if (o.icon) spec.icon = Object.assign({}, o.icon);
    if (o.thumbnail === "youtube") spec.thumbnail = "youtube";
    if (o.style) spec.style = o.style;
    if (o.fit) spec.fit = o.fit;
    if (o.frame) spec.frame = Object.assign({}, o.frame);
    if (o.bgimg) spec.bgimg = Object.assign({}, o.bgimg);
    if (e.matches(".swatch")) {
      const cur = swatchHex(e);
      spec.sw = { label: ((e.dataset.label || "Cor") + (e.dataset.copy ? "" : "")).slice(0, 60), hex: cur };
      spec.cls = "swatch"; return spec;
    }
    const kids = dchildren(e);
    if (kids.length) spec.children = kids.map(specOf);
    else if (!isAtomic(e) && !o.img) spec.t = leafHtml(e);
    return spec;
  }
  function swatchHex(e) {
    let h = e.dataset.hex || getComputedStyle(document.documentElement).getPropertyValue(e.dataset.var || "").trim();
    if (/^#[0-9a-f]{3}$/i.test(h)) h = "#" + [...h.slice(1)].map(c => c + c).join("");
    return HEX_RE.test(h) ? h : "#8a8a8a";
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
    if (e.tcCarouselControls) e.tcCarouselControls.remove();
    if (e.tcCarouselSelectorGroup) e.tcCarouselSelectorGroup.remove();
    if (e.tcSceneControls) e.tcSceneControls.remove();
    delete content.add[id]; delete content.ops[id]; delete content.order[id]; nodes.delete(id);
    const p = e.parentElement; e.remove(); if (p) recordOrder(p.closest("[data-b]") === p ? p : p.closest("[data-b]"));
  }
  function removeItem(e) {
    if (isProtected(e)) return;
    if (!confirm("Excluir este item?" + (e.dataset.added ? "" : "\n(Itens originais ficam só ocultos e podem ser restaurados no painel, em Página.)"))) return;
    if (e.dataset.added) removeAdded(e);
    else { op(e.dataset.b).hide = 1; e.classList.add("ds-hidden"); }
    select(null); refreshPageControls(); markDirty(); refreshSiteFeatures();
  }
  const mkCols = n => ({ tag: "div", cls: "ds-cols", s: { "--cols": Array(n).fill(r1(100 / n) + "fr").join(" ") }, children: Array.from({ length: n }, () => PRESETS.box()) });
  function uniqueAnchor() { let n = 1; while (document.getElementById("ancora-" + n)) n++; return "ancora-" + n; }
  const PRESETS = ELEMENTS.createPresets(uniqueAnchor, n => mkCols(n));
  function addBlock(type) {
    let parent, ref = null;
    const where = $("#adm-where", panel).value;
    if (sel && where === "inside" && canContain(sel)) parent = sel;
    else if (sel && !isProtected(sel)) { parent = sel.parentElement.closest("[data-b]"); ref = nextData(sel); }
    else parent = sel && canContain(sel) ? sel : ($(".page.active") || $(".page"));
    const e = spawn(PRESETS[type](), parent, ref);
    let target = e;
    if (type === "video") {
      const poster = $(".ds-video-poster", e);
      if (poster) { op(poster.dataset.b).thumbnail = "youtube"; target = poster; }
    }
    if (type === "timer") {
      op(e.dataset.b).timer = { target: new Date(Date.now() + 7 * 86400000).toISOString() };
      renderTimer(e, op(e.dataset.b).timer);
    }
    fixFree(); refreshEditable(); refreshYouTubeThumbnails(); select(target); markDirty();
    e.scrollIntoView({ block: "nearest", behavior: "smooth" });
    showTab("item");
    if (type === "image" || type === "animation") chooseImageFor(e);
    if (type === "audio") chooseAudioFor(e);
    if (type === "hero") chooseBgFor(e);
  }

  /* ---------- painel ---------- */
  const PAGES = () => $$(".page").map(p => [p.id, pageTitle(p.id)]);
  const currentPage = () => document.body.dataset.page || "home";
  function rgbToHex(c) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c || "");
    if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
    return "#" + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, "0")).join("");
  }
  function buildPanel() {
    panel = mk("aside", "adm-panel");
    panel.innerHTML = `
      <div class="adm-head">
        <div class="adm-brand"><span class="adm-brand-mark">✦</span><span><b>Triple Crusade</b><small>EDITOR VISUAL</small></span></div>
        <span class="adm-head-btns"><button type="button" id="adm-min" title="Minimizar painel">−</button></span>
      </div>
      <div class="adm-toolbar">
        <div class="adm-toolgroup"><button type="button" id="adm-undo" title="Desfazer (Ctrl+Z)">↶</button><button type="button" id="adm-redo" title="Refazer (Ctrl+Shift+Z)">↷</button></div>
        <div class="adm-toolgroup"><button type="button" id="adm-move-mode" title="Ativar para arrastar elementos diretamente no canvas">↔ <span>Mover</span></button><button type="button" id="adm-interaction-toggle" aria-pressed="false" title="Pausar interações do site para testar o layout">⏸ <span>Pausar</span></button><button type="button" id="adm-anim-open" title="Abrir os efeitos do elemento selecionado">✧</button><button type="button" id="adm-anim-preview" title="Reproduzir a animação do elemento selecionado">▶</button></div>
        <div class="adm-toolgroup adm-view-tools" aria-label="Pré-visualização">
          <button type="button" data-view="desktop" title="Visualização desktop">▭</button>
          <button type="button" data-view="tablet" title="Prévia tablet">▯</button>
          <button type="button" data-view="mobile" class="adm-mobile-switch" role="switch" aria-checked="false" title="Alternar prévia de celular">▯ Mobile</button>
        </div>
        <button type="button" id="adm-viewsite" title="Abrir o site em outra aba (Alt+V)">↗</button>
      </div>
      <label class="adm-pagebar"><span>PÁGINA</span><select id="adm-goto"></select></label>
      <div class="adm-tabs" id="adm-tabs">
        <button type="button" data-tab="item" class="on"><span class="tab-icon">◇</span>Elemento</button>
        <button type="button" data-tab="add"><span class="tab-icon">＋</span>Adicionar</button>
        <button type="button" data-tab="tree"><span class="tab-icon">☷</span>Camadas</button>
        <button type="button" data-tab="sections"><span class="tab-icon">▤</span>Seções</button>
        <button type="button" data-tab="page"><span class="tab-icon">◫</span>Página</button>
        <button type="button" data-tab="site"><span class="tab-icon">⚙</span>Site</button>
      </div>
      <div class="adm-body">
        <div class="adm-pane on" data-pane="item">
          <p class="adm-tip">Selecione no canvas para editar. Ative <b>Mover</b> para posicionar livremente; desative para editar texto e reorganizar itens.</p>
          <div id="adm-props"></div>
        </div>
        <div class="adm-pane" data-pane="add">
          <div class="adm-pane-heading"><b>Adicionar elemento</b><span>Monte sua página em blocos</span></div>
          <p id="adm-add-target" class="adm-small"></p>
          <label class="adm-lbl">Onde
            <select id="adm-where"><option value="after">Logo depois do item selecionado</option><option value="inside">Dentro do item selecionado</option></select></label>
          <div id="adm-add"></div>
          <details open><summary>Estilos compartilhados</summary><div id="adm-styles"></div></details>
        </div>
        <div class="adm-pane" data-pane="tree"><p class="adm-small">Todos os itens da página. Clique para selecionar, duplo clique para editar, arraste para reorganizar (solte no meio de uma caixa para colocar dentro) e use 👁 para ocultar.</p><div id="adm-tree" class="adm-tree"></div></div>
        <div class="adm-pane" data-pane="sections"><div id="adm-sections" class="adm-sections"></div></div>
        <div class="adm-pane" data-pane="page">
          <div class="adm-pane-heading"><b>Fundo e tema</b><span>Personalize a página atual</span></div>
          <details open><summary>Fundo da página</summary>
          <div id="adm-bgbox"><b class="adm-sub">Fundo desta página</b>
            <div class="adm-row"><button type="button" id="adm-bg-up">📷 Escolher imagem</button><button type="button" id="adm-bg-rm" class="danger">Remover</button></div>
            <div class="adm-row"><button type="button" id="adm-bg-share">Aplicar em outras páginas…</button></div>
            <label class="adm-lbl">Escurecer <input type="range" id="adm-dim" min="0" max="90" value="0"><span id="adm-dim-v">0%</span></label></div>
          <div class="adm-row"><button type="button" id="adm-restore">Restaurar itens excluídos</button><span id="adm-hidden-n" class="adm-small"></span></div></details>
          <details><summary>Cores do site</summary><div class="adm-colors" id="adm-colors"></div>
          <button type="button" id="adm-colors-reset" class="danger">Restaurar cores originais</button></details>
        </div>
        <div class="adm-pane" data-pane="site"><div id="adm-site"></div></div>
      </div>
      <div class="adm-foot">
        <div id="adm-changes" class="adm-changes"></div>
        <div id="adm-status" class="adm-status"></div>
        <div class="adm-row"><button type="button" id="adm-save" class="primary" title="Ctrl+S">Salvar alterações</button><button type="button" id="adm-discard">Descartar</button></div>
        <button type="button" id="adm-exit" class="adm-exit">Sair do modo admin</button>
      </div>`;
    document.body.appendChild(panel);
    const palette = $("#adm-add", panel);
    ELEMENTS.categories.forEach((category, index) => {
      const group = mk("details", "adm-add-group");
      group.open = index < 2;
      group.appendChild(mk("summary", "", category.title));
      const grid = mk("div", "adm-grid");
      category.types.forEach(type => {
        const item = mk("button", "", ELEMENTS.labels[type]);
        item.type = "button"; item.dataset.add = type;
        grid.appendChild(item);
      });
      group.appendChild(grid); palette.appendChild(group);
    });
    const reopen = mk("button", "adm-reopen", "✦ Editor");
    reopen.type = "button";
    reopen.addEventListener("click", () => panel.classList.remove("collapsed"));
    document.body.appendChild(reopen);

    refreshPageSelect();
    $("#adm-tabs", panel).addEventListener("click", ev => { const b = ev.target.closest("[data-tab]"); if (b) { showTab(b.dataset.tab); if (b.dataset.tab === "site") buildSiteSettings(); if (b.dataset.tab === "add") refreshStyleLibrary(); } });
    $("#adm-undo", panel).addEventListener("click", undo);
    $("#adm-redo", panel).addEventListener("click", redo);
    $("#adm-viewsite", panel).addEventListener("click", viewSite);
    $("#adm-move-mode", panel).addEventListener("click", () => {
      moveMode = !moveMode;
      $("#adm-move-mode", panel).classList.toggle("on", moveMode);
      document.body.classList.toggle("ds-move-mode", moveMode);
      note(moveMode ? "Mover ativado: arraste um item diretamente no canvas." : "Mover desativado: clique para selecionar ou editar texto.");
    });
    $("#adm-interaction-toggle", panel).addEventListener("click", () => {
      siteInteractionsPaused = !siteInteractionsPaused;
      const toggle = $("#adm-interaction-toggle", panel);
      toggle.classList.toggle("on", siteInteractionsPaused);
      toggle.setAttribute("aria-pressed", String(siteInteractionsPaused));
      toggle.innerHTML = siteInteractionsPaused ? "▶ <span>Retomar</span>" : "⏸ <span>Pausar</span>";
      toggle.title = siteInteractionsPaused ? "Retomar as interações do site no canvas" : "Pausar interações do site para testar o layout";
      note(siteInteractionsPaused ? "Interações do site pausadas. O editor continua funcionando." : "Interações do site ativadas.");
    });
    $("#adm-anim-preview", panel).disabled = true;
    $("#adm-anim-open", panel).addEventListener("click", () => {
      if (!sel) { note("Selecione um elemento para configurar a animação."); return; }
      showTab("item");
      const animation = Array.from($$(".adm-section", panel)).find(section => $(".adm-section-header", section).textContent.includes("Animação"));
      if (animation) {
        animation.classList.remove("closed");
        openSecs.set("🎬 Animação", true);
        animation.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    $("#adm-anim-preview", panel).addEventListener("click", previewSelectedAnimation);
    $$(".adm-view-tools [data-view]", panel).forEach(button => button.addEventListener("click", () => {
      if (button.dataset.view === "mobile" && pv && pv.mode === "mobile") closePreview();
      else openPreview(button.dataset.view);
    }));
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
    buildSiteSettings();
    refreshStyleLibrary();

    $("#adm-bg-up", panel).addEventListener("click", () => pickImage(f => {
      const page = currentPage();
      const path = registerImage(f, "fundos");
      const dim = (content.bg[page] && content.bg[page].dim) || 0;
      content.bg[page] = { path, dim };
      applyBg(); refreshPageControls(); markDirty();
      askBgScope("Onde usar este fundo?", ids => { ids.forEach(id => { content.bg[id] = { path, dim: (content.bg[id] && content.bg[id].dim) || dim }; }); applyBg(); refreshPageControls(); markDirty(); });
    }));
    $("#adm-bg-share", panel).addEventListener("click", () => {
      const cur = content.bg[currentPage()]; if (!cur) return;
      askBgScope("Aplicar este fundo em quais páginas?", ids => { ids.forEach(id => { content.bg[id] = { path: cur.path, dim: cur.dim || 0 }; }); applyBg(); markDirty(); });
    });
    $("#adm-bg-rm", panel).addEventListener("click", () => {
      const had = content.bg[currentPage()]; delete content.bg[currentPage()]; applyBg(); refreshPageControls(); markDirty();
      if (had) askBgScope("Remover também de outras páginas?", ids => { ids.forEach(id => { if (content.bg[id] && content.bg[id].path === had.path) delete content.bg[id]; }); applyBg(); markDirty(); }, true);
    });
    $("#adm-dim", panel).addEventListener("input", e => {
      const b = content.bg[currentPage()]; if (!b) return;
      b.dim = e.target.value / 100; $("#adm-dim-v", panel).textContent = e.target.value + "%"; applyBg(); markDirty();
    });
    $("#adm-restore", panel).addEventListener("click", () => {
      const pg = $(".page.active"); if (!pg) return;
      Object.entries(content.ops).forEach(([id, o]) => { const e = nodes.get(id); if (o.hide && e && (pg.contains(e))) { delete o.hide; e.classList.remove("ds-hidden"); cleanOp(id); } });
      refreshPageControls(); markDirty();
    });
    $("#adm-min", panel).addEventListener("click", () => panel.classList.toggle("collapsed"));
    $("#adm-save", panel).addEventListener("click", saveAll);
    $("#adm-discard", panel).addEventListener("click", () => {
      if (!confirm("Descartar todas as alterações não salvas? A página será recarregada e você entrará de novo com a senha.")) return;
      pending.clear(); content = JSON.parse(JSON.stringify(saved)); location.reload();
    });
    $("#adm-exit", panel).addEventListener("click", () => {
      if (countChanges() > 0 && !confirm("Há alterações não salvas. Sair mesmo assim? (A página será recarregada.)")) return;
      pending.clear(); location.reload();
    });
    buildProps(); refreshPageControls(); updateStatus(true); updateAddHint(); updateUndoButtons();
  }
  function showTab(name) {
    curTab = name;
    $$(".adm-pane", panel).forEach(p => p.classList.toggle("on", p.dataset.pane === name));
    $$("[data-tab]", panel).forEach(b => b.classList.toggle("on", b.dataset.tab === name));
    panel.classList.remove("min", "collapsed");
    if (name === "tree") refreshTree(); if (name === "sections") refreshSections(); if (name === "site" && window.buildSitePane) window.buildSitePane();
  }
  function dockPanel(side) {}
  function panelDrag() {}
  function syncColors() { $$(".adm-color input", panel).forEach(i => { i.value = content.vars[i.dataset.var] || cleanVars[i.dataset.var] || "#000000"; }); }
  function buildSiteSettings() {
    const box = $("#adm-site", panel); if (!box) return;
    box.innerHTML = "";
    const site = content.site || (content.site = {});
    const group = (title, intro) => {
      const d = mk("details", "adm-sub"); d.open = true; d.appendChild(mk("summary", "", title));
      if (intro) d.appendChild(mk("p", "adm-small", intro));
      box.appendChild(d); return d;
    };
    const set = (key, value) => {
      if (value === "" || value === null || value === undefined) delete site[key]; else site[key] = value;
      applySiteSettings(); markDirty();
    };
    const text = (parent, title, key, placeholder, multiline, maxLength) => {
      const input = mk(multiline ? "textarea" : "input");
      if (!multiline) input.type = "text";
      input.value = typeof site[key] === "string" ? site[key] : "";
      input.placeholder = placeholder || "";
      if (maxLength) input.maxLength = maxLength;
      input.addEventListener("input", () => set(key, input.value));
      parent.appendChild(row(title, input));
    };
    const select = (parent, title, key, options, fallback) => {
      const value = site[key] || fallback || options[0][0];
      parent.appendChild(row(title, selInput(options, value, v => set(key, v))));
    };
    const range = (parent, title, key, min, max, step, unit, fallback) => {
      const wrap = mk("span", "adm-rn");
      const input = mk("input"); input.type = "range"; input.min = min; input.max = max; input.step = step;
      input.value = site[key] === undefined ? fallback : site[key];
      const output = mk("em", "", input.value + unit); wrap.append(input, output);
      input.addEventListener("input", () => { const value = Number(input.value); output.textContent = value + unit; set(key, value); });
      parent.appendChild(row(title, wrap));
    };
    const imageControl = (parent, title, key) => {
      const controls = mk("div", "adm-row");
      controls.appendChild(btn("📷 Escolher", "", () => pickImage(file => {
        site[key] = registerImage(file, "site"); applySiteSettings(); buildSiteSettings(); markDirty();
      })));
      if (safePath(site[key])) controls.appendChild(btn("Remover", "", () => { delete site[key]; applySiteSettings(); buildSiteSettings(); markDirty(); }, "danger"));
      parent.appendChild(mk("b", "adm-sub", title)); parent.appendChild(controls);
      parent.appendChild(mk("p", "adm-small", safePath(site[key]) ? site[key] : "Nenhuma imagem escolhida."));
    };

    const identity = group("Identidade e compartilhamento", "Configurações globais publicadas com o site.");
    text(identity, "Título do site", "title", document.title, false, 120);
    text(identity, "Descrição (SEO)", "description", "Resumo que aparece em buscadores e compartilhamentos", true, 300);
    const canonical = mk("input"); canonical.type = "text"; canonical.placeholder = "https://seudominio.com/";
    canonical.value = typeof site.canonicalUrl === "string" ? site.canonicalUrl : "";
    const canonicalHint = mk("p", "adm-small", "Informe uma URL https:// ou http:// completa, se houver domínio próprio.");
    canonical.addEventListener("input", () => {
      const value = canonical.value.trim();
      if (!value || /^https?:\/\/[^\s"'<>]+$/i.test(value)) { canonicalHint.textContent = ""; set("canonicalUrl", value); }
      else canonicalHint.textContent = "URL inválida. Inclua http:// ou https://.";
    });
    identity.appendChild(row("URL canônica", canonical));
    identity.appendChild(canonicalHint);
    text(identity, "Nome no cabeçalho", "brandName", "Triple Crusade", false, 80);
    text(identity, "Símbolo no cabeçalho", "brandIcon", "✦", false, 8);
    select(identity, "Idioma", "language", [["pt-BR", "Português (Brasil)"], ["en", "English"], ["es", "Español"], ["fr", "Français"], ["ja", "日本語"]], "pt-BR");
    imageControl(identity, "Ícone do site (favicon)", "icon");
    imageControl(identity, "Imagem de compartilhamento", "shareImage");

    const layout = group("Layout global", "Ajuste largura, espaçamento e identidade visual em todas as páginas.");
    select(layout, "Página inicial", "home", PAGES(), "home");
    range(layout, "Largura máxima", "maxWidth", 640, 1600, 20, "px", 980);
    range(layout, "Margem lateral", "gutter", 0, 48, 2, "px", 16);
    range(layout, "Arredondamento padrão", "radius", 0, 32, 1, "px", 6);
    range(layout, "Altura entre linhas", "lineHeight", 1.2, 2, 0.05, "", 1.6);
    range(layout, "Duração da transição", "transition", 0, 800, 25, "ms", 250);
    select(layout, "Fonte do texto", "bodyFont", [["bodoni", "Libre Bodoni"], ["system", "Sistema"], ["trebuchet", "Trebuchet MS"], ["georgia", "Georgia"], ["marcellus", "Marcellus SC"], ["cinzel", "Cinzel"]], "bodoni");
    select(layout, "Fonte dos títulos", "headingFont", [["cinzel", "Cinzel"], ["system", "Sistema"], ["trebuchet", "Trebuchet MS"], ["georgia", "Georgia"], ["marcellus", "Marcellus SC"], ["bodoni", "Libre Bodoni"]], "cinzel");
    const sticky = mk("input"); sticky.type = "checkbox"; sticky.checked = site.stickyHeader !== false;
    sticky.addEventListener("change", () => set("stickyHeader", sticky.checked));
    layout.appendChild(row("Cabeçalho fixo ao rolar", sticky));
    box.appendChild(btn("Restaurar configurações globais", "", () => {
      if (!confirm("Restaurar título, identidade e layout globais aos padrões?")) return;
      content.site = {}; applySiteSettings(); buildSiteSettings(); markDirty();
    }, "danger"));
    box.appendChild(mk("p", "adm-small", "A aba Build contém os blocos para montar páginas. Em Página você define fundos e paleta; estas opções ajustam o site inteiro. Domínio próprio e publicação continuam configurados no GitHub Pages."));
  }
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
  function buildSection(title, contentFn, openByDefault = true) {
    const isOpen = openSecs.has(title) ? openSecs.get(title) : openByDefault;
    const section = mk("div", "adm-section" + (isOpen ? "" : " closed"));
    const header = mk("div", "adm-section-header", `<span class="caret">▼</span> ${title}`);
    header.addEventListener("click", () => {
      const closed = section.classList.toggle("closed");
      openSecs.set(title, !closed);
    });
    const body = mk("div", "adm-section-body");
    contentFn(body);
    section.append(header, body);
    return section;
  }
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
    const s = mk("select");
    opts.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = String(value); option.textContent = String(label); s.appendChild(option);
    });
    s.value = cur == null ? "" : String(cur);
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
  function note(msg) { const h = panel && ($("#adm-note", panel) || $("#adm-status", panel)); if (!h) return; h.textContent = msg; clearTimeout(note.t); note.t = setTimeout(() => { h.textContent = ""; }, 4500); }
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
    return buildSection("Colunas", s => {
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
    }, true);
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
    return buildSection("🖼️ Imagem", s => {
      if (e.matches(".ds-video-poster") || e.matches(".video-asset .pk-slot")) {
        s.appendChild(row("Miniatura do vídeo", selInput([["custom", "Imagem enviada"], ["youtube", "Automática do YouTube"]],
          o.thumbnail === "youtube" ? "youtube" : "custom", mode => {
            const oo = op(id);
            if (mode === "youtube") oo.thumbnail = "youtube"; else delete oo.thumbnail;
            setImage(e, mode === "youtube" ? null : oo.img || null);
            refreshYouTubeThumbnail(e); markDirty(); buildProps();
          })));
      }
      const r = mk("div", "adm-row");
      r.appendChild(btn("📷 " + (o.img ? "Trocar imagem" : "Enviar imagem"), "", () => chooseImageFor(e), "primary"));
      if (o.img) r.appendChild(btn("Remover", "", () => { delete op(id).img; delete op(id).frame; cleanOp(id); setImage(e, null); refreshEditable(); buildProps(); markDirty(); }, "danger"));
      s.appendChild(r);
      if (!o.img) {
        s.appendChild(mk("p", "adm-small", o.thumbnail === "youtube"
          ? "A miniatura aparece quando houver um link válido do YouTube no mesmo bloco. Você também pode escolher uma imagem enviada."
          : e.tagName === "IMG" ? "Envie uma imagem para trocar a arte deste item." : "Envie uma imagem para liberar tamanho, cantos, zoom e enquadramento."));
        return;
      }
      if (e.tagName === "IMG") {
        const alt = mk("input");
        alt.type = "text";
        alt.maxLength = 200;
        alt.value = o.img.alt || e.alt || "";
        alt.addEventListener("input", () => {
          op(id).img.alt = alt.value;
          e.alt = alt.value;
          markDirty();
        });
        s.appendChild(row("Texto alternativo", alt));
        const spotlight = mk("input");
        spotlight.type = "checkbox";
        spotlight.checked = o.img.spotlight === true;
        spotlight.addEventListener("change", () => {
          op(id).img.spotlight = spotlight.checked;
          setSpotlight(e, spotlight.checked);
          markDirty();
        });
        s.appendChild(row("Zoom spotlight ao clicar", spotlight));
        return;
      }
      const spotlight = mk("input");
      spotlight.type = "checkbox";
      spotlight.checked = o.img.spotlight === true;
      spotlight.addEventListener("change", () => {
        const image = op(id).img;
        if (spotlight.checked) image.spotlight = true;
        else delete image.spotlight;
        setSpotlight($(":scope > .slot-img", e), spotlight.checked);
        markDirty();
      });
      s.appendChild(row("Zoom spotlight ao clicar", spotlight));
      s.appendChild(mk("p", "adm-small", "Abre a imagem ampliada em tela cheia, sem moldura. Desative para impedir o zoom."));
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
    }, true);
  }

  function buildProps() {
    const box = $("#adm-props", panel); if (!box) return;
    box.innerHTML = "";
    if (!sel) { box.appendChild(mk("p", "adm-tip", "Nenhum item selecionado.")); return; }
    const e = sel, id = e.dataset.b, o = content.ops[id] || {};

    // Caminho (clique para subir de nível)
    const trail = mk("div", "adm-trail"); const chain = [];
    for (let n = e; n && chain.length < 5; n = n.parentElement && n.parentElement.closest("[data-b]")) { chain.unshift(n); if (n.classList.contains("page")) break; }
    chain.forEach((n, k) => { const b = mk("button", k === chain.length - 1 ? "on" : "", esc(label(n).split(" — ")[0])); b.type = "button"; b.addEventListener("click", () => select(n)); trail.appendChild(b); });
    box.appendChild(trail);
    box.appendChild(mk("div", "adm-sel-name", esc(label(e))));
    box.appendChild(mk("p", "adm-note", ""));
    box.lastChild.id = "adm-note";
    if (!isProtected(e)) {
      box.appendChild(btn("Excluir item selecionado", "Itens originais ficam ocultos e podem ser restaurados; itens adicionados são removidos.", () => removeItem(e), "danger"));
    }
    if (e.matches(".tc-carousel,.tc-scene-stage")) {
      box.appendChild(buildSection("Comportamento do carrossel", s => {
        const paused = mk("input");
        paused.type = "checkbox";
        paused.checked = !!o.carouselPaused;
        paused.addEventListener("change", () => {
          const current = op(id);
          if (paused.checked) current.carouselPaused = true;
          else delete current.carouselPaused;
          if (paused.checked) e.dataset.tcCarouselPaused = "true";
          else delete e.dataset.tcCarouselPaused;
          e.classList.toggle("tc-carousel--paused", paused.checked);
          cleanOp(id);
          refreshSiteFeatures();
          markDirty();
        });
        s.appendChild(row("Pausar navegação e interação", paused));
        s.appendChild(mk("p", "adm-small", "Quando ativado, setas, seletores e teclado não mudam o slide. O slide atual continua visível."));
      }, true));
    }
    if (!isProtected(e)) {
      const lk = mk("div", "adm-link");
      if (linked.size) {
        lk.appendChild(mk("span", "", "🔗 " + linked.size + " item(ns) copiam o estilo deste (tamanho, fundo, borda, cores)."));
        lk.appendChild(btn("Desvincular", "", () => { clearLinks(); buildProps(); }));
      } else lk.appendChild(mk("span", "adm-small", "Dica: Shift+clique em outros itens para eles copiarem o estilo deste."));
      box.appendChild(lk);
    }

    if (e.matches(".ds-icon")) {
      box.appendChild(buildSection("Ícone", s => {
        const current = Object.assign({ name: "sparkles" }, o.icon || {});
        const choices = Object.entries(ELEMENTS.iconNames).map(([name, title]) => [name, title]);
        s.appendChild(row("Símbolo", selInput(choices, current.name, value => {
          op(id).icon = Object.assign({}, current, { name: value });
          ELEMENTS.renderIcon(e, op(id).icon); markDirty();
        })));
        const outline = mk("input"); outline.type = "checkbox"; outline.checked = current.outline === true;
        outline.addEventListener("change", () => {
          op(id).icon = Object.assign({}, op(id).icon || current, { outline: outline.checked });
          ELEMENTS.renderIcon(e, op(id).icon); markDirty();
        });
        s.appendChild(row("Traço outline", outline));
        [["Cor", "color", "#e8b93c"], ["Cor no hover", "hover", "#ffffff"]].forEach(([title, key, fallback]) => {
          const input = mk("input"); input.type = "color"; input.value = /^#[0-9a-f]{6}$/i.test(current[key] || "") ? current[key] : fallback;
          input.addEventListener("input", () => {
            op(id).icon = Object.assign({}, op(id).icon || current, { [key]: input.value });
            ELEMENTS.renderIcon(e, op(id).icon); markDirty();
          });
          s.appendChild(row(title, input));
        });
        s.appendChild(mk("p", "adm-small", "Escolha um ícone de interface ou uma marca social. Defina o destino na seção Link."));
      }, true));
    }

    if (e.matches(".ds-timer")) {
      box.appendChild(buildSection("Contagem regressiva", s => {
        const input = mk("input"); input.type = "datetime-local";
        const target = o.timer && Date.parse(o.timer.target);
        if (Number.isFinite(target)) {
          const local = new Date(target - new Date(target).getTimezoneOffset() * 60000);
          input.value = local.toISOString().slice(0, 16);
        }
        input.addEventListener("input", () => {
          const targetDate = input.value ? new Date(input.value) : null;
          op(id).timer = { target: targetDate && Number.isFinite(targetDate.getTime()) ? targetDate.toISOString() : "" };
          renderTimer(e, op(id).timer); markDirty();
        });
        s.appendChild(row("Data e hora finais", input));
        s.appendChild(mk("p", "adm-small", "A contagem usa o fuso horário local e atualiza automaticamente."));
      }, true));
    }

    if (isComponentSlide(e)) {
      box.appendChild(buildSection("Layout do carrossel", s => {
        const side = e.style.getPropertyValue("--tc-slide-image-column") === "2" ? "right" : "left";
        s.appendChild(row("Posição da imagem", selInput([["left", "Imagem à esquerda"], ["right", "Imagem à direita"]], side, value => {
          setS(e, "--tc-slide-image-column", value === "right" ? "2" : "1");
          setS(e, "--tc-slide-copy-column", value === "right" ? "1" : "2");
          setS(e, "--tc-slide-columns", value === "right"
            ? "minmax(0, 1.1fr) minmax(0, .9fr)"
            : "minmax(0, .9fr) minmax(0, 1.1fr)");
        })));
        const range = (title, prop, min, max, initial, unit) => {
          const input = mk("input");
          input.type = "range"; input.min = min; input.max = max;
          const parsed = Number.parseFloat(e.style.getPropertyValue(prop));
          input.value = Number.isFinite(parsed) ? parsed : initial;
          const value = mk("em", "", input.value + unit);
          const wrap = mk("span", "adm-rn"); wrap.append(input, value);
          input.addEventListener("input", () => {
            value.textContent = input.value + unit;
            if (prop === "--tc-slide-card-width") setS(e, "width", input.value + unit);
            else setS(e, prop, input.value + unit);
          });
          s.appendChild(row(title, wrap));
        };
        range("Largura da imagem", "--tc-slide-image-width", 25, 100, 100, "%");
        range("Altura máxima da imagem", "--tc-slide-image-max-height", 100, 520, 320, "px");
        range("Espaço entre imagem e texto", "--tc-slide-gap", 8, 64, 32, "px");
        range("Largura do cartão", "--tc-slide-card-width", 60, 100, 100, "%");
        s.appendChild(mk("p", "adm-small", "O texto continua independente da imagem; selecione-o no canvas para editar conteúdo, fonte e aparência."));
      }, true));
    }

    if (e.matches(".tc-scene-stage")) {
      box.appendChild(buildSection("Layout do carrossel", s => {
        const side = e.style.getPropertyValue("--tc-scene-copy-column") === "1" ? "left" : "right";
        s.appendChild(row("Posição do texto", selInput([["right", "Texto à direita"], ["left", "Texto à esquerda"]], side, value => {
          const right = value === "right";
          setS(e, "--tc-scene-image-left", right ? "0%" : "39%");
          setS(e, "--tc-scene-copy-column", right ? "2" : "1");
          setS(e, "--tc-scene-columns", right
            ? "minmax(0, 1.65fr) minmax(280px, .9fr)"
            : "minmax(280px, .9fr) minmax(0, 1.65fr)");
        })));
        const range = (title, prop, min, max, initial, unit) => {
          const input = mk("input");
          input.type = "range"; input.min = min; input.max = max;
          const parsed = Number.parseFloat(e.style.getPropertyValue(prop));
          input.value = Number.isFinite(parsed) ? parsed : initial;
          const value = mk("em", "", input.value + unit);
          const wrap = mk("span", "adm-rn"); wrap.append(input, value);
          input.addEventListener("input", () => {
            value.textContent = input.value + unit;
            setS(e, prop, input.value + unit);
          });
          s.appendChild(row(title, wrap));
        };
        range("Largura da imagem", "--tc-scene-image-width", 35, 75, 61, "%");
        range("Espaço entre colunas", "--tc-scene-gap", 8, 64, 32, "px");
        s.appendChild(mk("p", "adm-small", "Selecione uma imagem do cenário para ajustar corte, zoom e enquadramento; selecione o texto para editar seus campos."));
      }, true));
    }

    if (e.tagName === "AUDIO") {
      box.appendChild(buildSection("Áudio", s => {
        const source = content.add[id] && content.add[id].attrs && content.add[id].attrs.src;
        s.appendChild(mk("p", "adm-small", source ? source.split("/").pop() : "Nenhum arquivo selecionado."));
        s.appendChild(btn(source ? "Trocar arquivo de áudio" : "Enviar arquivo de áudio", "MP3, OGG, WAV ou outro formato aceito pelo navegador (máx. 20 MB)", () => chooseAudioFor(e), "primary"));
      }, true));
    }

    if (!isProtected(e) && !e.matches(".ds-icon")) {
      box.appendChild(buildSection("Ao passar o mouse", s => {
        const current = o.hover || {};
        s.appendChild(row("Efeito", selInput([["", "Nenhum"], ["lift", "Elevar"], ["scale", "Ampliar suavemente"], ["glow", "Brilho"]], current.effect || "", value => {
          if (!value) { delete op(id).hover; applyHover(e, null); }
          else { op(id).hover = Object.assign({}, current, { effect: value }); applyHover(e, op(id).hover); }
          markDirty();
        })));
        const color = mk("input"); color.type = "color"; color.value = /^#[0-9a-f]{6}$/i.test(current.color || "") ? current.color : "#e8b93c";
        color.addEventListener("input", () => {
          if (!op(id).hover) op(id).hover = { effect: "glow" };
          op(id).hover.color = color.value; applyHover(e, op(id).hover); markDirty();
        });
        s.appendChild(row("Cor do efeito", color));
      }, false));
    }

    // Caixa de cor especializada
    if (e.matches(".swatch")) {
      box.appendChild(buildSection("Caixa de cor", s => {
        const nm = mk("input"); nm.type = "text"; nm.value = e.dataset.label || "";
        nm.addEventListener("input", () => { const sw = op(id).sw = Object.assign({ hex: swatchHex(e) }, op(id).sw, { label: nm.value }); applySw(e, sw); markDirty(); });
        s.appendChild(row("Nome", nm));
        const hx = mk("input"); hx.type = "text"; hx.value = swatchHex(e).toUpperCase(); hx.maxLength = 7;
        const co = mk("input"); co.type = "color"; co.value = swatchHex(e);
        const setHex = v => {
          if (!HEX_RE.test(v)) return;
          if (e.dataset.var && !e.dataset.hex) { content.vars[e.dataset.var] = v; applyVars(); syncColors(); }
          else { const sw = op(id).sw = Object.assign({ label: e.dataset.label || "" }, op(id).sw, { hex: v }); applySw(e, sw); }
          markDirty();
        };
        hx.addEventListener("input", () => { let v = hx.value.trim(); if (v[0] !== "#") v = "#" + v; if (HEX_RE.test(v)) { co.value = v; setHex(v); } });
        co.addEventListener("input", () => { hx.value = co.value.toUpperCase(); setHex(co.value); });
        s.appendChild(row("Cor (hex)", hx)); s.appendChild(row("Seletor", co));
        s.appendChild(mk("p", "adm-small", "Use Ctrl+D (ou Duplicar) para criar mais caixas, p.ex. Fase 2, Fase 3."));
      }, true));
    }

    // Colunas especializadas
    if (e.matches(".ds-cols")) box.appendChild(colsSection(e));

    // 1. 📐 Tamanho e Posição (sempre mostrada)
    box.appendChild(buildSection("📐 Tamanho e Posição", ps => {
      if (!isProtected(e)) {
        const al = mk("div", "adm-align");
        [["left", "⬅", "Alinhar à esquerda"], ["center", "⬌", "Centralizar na horizontal"], ["right", "➡", "Alinhar à direita"], ["top", "⬆", "Alinhar ao topo"], ["middle", "⬍", "Centralizar na vertical"], ["bottom", "⬇", "Alinhar à base"]]
          .forEach(([k, t, ti]) => al.appendChild(btn(t, ti, () => alignItem(e, k))));
        ps.appendChild(row("Alinhar", al));
      }
      ps.appendChild(row("Largura", dimInput(e, "width", "w")));
      ps.appendChild(row("Altura", dimInput(e, "height", "h")));
      ps.appendChild(row("Altura mínima (px)", numInput(e, "min-height", "px", { min: 0, max: 2000, fromComputed: false })));
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
        if (free) {
          ps.appendChild(row("Posição X (left)", dimInput(e, "left", "%")));
          ps.appendChild(row("Posição Y (top)", dimInput(e, "top", "%")));
        }
        ps.appendChild(mk("p", "adm-small", "Posição livre: arraste o item (✥) para qualquer lugar da caixa, use as setas do teclado (Shift = passo maior) e as alças para o tamanho. Guias magnéticas ajudam a centralizar; segure Alt para soltar sem encaixe."));
        ps.appendChild(row("Camada (z-index)", numInput(e, "z-index", "", { min: -5, max: 99, fromComputed: false })));
        const lay = mk("div", "adm-row");
        lay.appendChild(btn("⤒ Para frente", "", () => { const z = Math.max(0, ...$$("[data-b]", e.parentElement).map(x => parseInt(x.style.zIndex) || 0)); setS(e, "z-index", String(z + 1)); if (!e.style.position) setS(e, "position", "relative"); buildProps(); }));
        lay.appendChild(btn("⤓ Para trás", "", () => { setS(e, "z-index", "0"); buildProps(); }));
        ps.appendChild(lay);
      }
      ps.appendChild(row("Girar (graus)", rotateControl(e)));
      ps.appendChild(row("Espaço externo (px)", sidesInput(e, "margin", -300, 400)));
      ps.appendChild(row("Espaço interno (px)", sidesInput(e, "padding", 0, 300)));
    }, true));

    // 2. 🎨 Aparência (sempre mostrada)
    box.appendChild(buildSection("🎨 Aparência", st => {
      if (!isProtected(e)) {
        const styleChoices = [["", "Independente"]].concat(Object.entries(content.styles)
          .filter(([, shared]) => shared && shared.tag === e.tagName)
          .map(([styleId, shared]) => [styleId, shared.name || "Estilo"]));
        st.appendChild(row("Estilo compartilhado", selInput(styleChoices, o.style || "", styleId => {
          if (styleId) attachSharedStyle(e, styleId);
          else { delete op(id).style; cleanOp(id); }
          markDirty(); buildProps(); refreshStyleLibrary();
        })));
        const acts = mk("div", "adm-row");
        acts.appendChild(btn("Criar estilo", "", () => {
          const name = prompt("Nome do estilo compartilhado:", "Novo estilo");
          if (!name || !name.trim()) return;
          const styleId = uid();
          content.styles[styleId] = {
            name: name.trim().slice(0, 60),
            tag: e.tagName,
            s: Object.fromEntries(Object.entries(o.s || {}).filter(([prop]) => !STYLE_LAYOUT_PROPS.has(prop))),
            ...(o.bgimg ? { bgimg: Object.assign({}, o.bgimg) } : {}),
            ...(o.animation ? { animation: Object.assign({}, o.animation) } : {})
          };
          op(id).style = styleId;
          applySharedStyle(styleId); markDirty(); buildProps(); refreshStyleLibrary();
        }, "primary"));
        if (o.style && content.styles[o.style]) acts.appendChild(btn("Atualizar estilo", "", () => {
          syncSharedStyle(e); markDirty(); buildProps(); refreshStyleLibrary();
        }));
        st.appendChild(acts);
      }
      st.appendChild(row("Cor do texto", colorInput(e, "color")));
      st.appendChild(row("Cor de fundo", colorInput(e, "background-color")));
      if (!e.matches(".ds-icon") && e.matches("h1,h2,h3,h4,p,li,td,th,a,button,.callout,.ds-box")) {
        st.appendChild(row("Alinhamento do texto", selInput([["", "Padrão"], ["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]], e.style.textAlign || "", value => setS(e, "text-align", value || null))));
      }

      if (!isAtomic(e)) {
        const r = mk("div", "adm-row");
        r.appendChild(btn("📷 " + (o.bgimg ? "Trocar fundo" : "Escolher fundo"), "", () => chooseBgFor(e)));
        if (o.bgimg) r.appendChild(btn("Remover", "", () => { delete op(id).bgimg; cleanOp(id); setBgImg(e, null); buildProps(); markDirty(); refreshSiteFeatures(); }, "danger"));
        st.appendChild(r);
        if (o.bgimg) {
          const dim = mk("input"); dim.type = "range"; dim.min = 0; dim.max = 90; dim.value = Math.round((o.bgimg.dim || 0) * 100);
          dim.addEventListener("input", () => { o.bgimg.dim = dim.value / 100; setBgImg(e, o.bgimg); markDirty(); });
          st.appendChild(row("Escurecer", dim));
          const effectRange = (key, title, min, max, step, scale, unit) => {
            const input = mk("input");
            input.type = "range"; input.min = min; input.max = max; input.step = step;
            input.value = Math.round((Number(o.bgimg[key]) || (key === "brightness" || key === "zoom" ? 1 : 0)) * scale);
            const value = mk("em", "", input.value + unit);
            const wrap = mk("span", "adm-rn"); wrap.append(input, value);
            input.addEventListener("input", () => {
              value.textContent = input.value + unit;
              o.bgimg[key] = Number(input.value) / scale;
              setBgImg(e, o.bgimg); markDirty();
            });
            st.appendChild(row(title, wrap));
          };
          effectRange("brightness", "Brilho", 25, 200, 5, 100, "%");
          effectRange("blur", "Desfoque", 0, 24, 1, 1, "px");
          effectRange("zoom", "Zoom", 100, 400, 5, 100, "%");
          st.appendChild(row("Tamanho", selInput([["stretch", "Esticar (arte do botão)"], ["free", "Livre (zoom e posição)"], ["cover", "Preencher (corta)"], ["contain", "Caber inteira"], ["auto", "Original"]], o.bgimg.size || "cover", v => { o.bgimg.size = v; setBgImg(e, o.bgimg); markDirty(); })));
          const pos = (k, lab, mn, mx, def) => { const i = mk("input"); i.type = "range"; i.min = mn; i.max = mx; i.value = o.bgimg[k] === undefined ? def : o.bgimg[k]; i.addEventListener("input", () => { o.bgimg[k] = Number(i.value); setBgImg(e, o.bgimg); markDirty(); }); st.appendChild(row(lab, i)); };
          if (o.bgimg.size === "free") pos("w", "Largura no modo livre (%)", 10, 400, 100);
          pos("x", "Posição ←→", 0, 100, 50); pos("y", "Posição ↑↓", 0, 100, 50);
          st.appendChild(btn(bgPan ? "✋ Arrastando a imagem de fundo (clique p/ parar)" : "✋ Arrastar a imagem de fundo", "Ligue e arraste sobre o botão; a roda do mouse dá zoom", () => { bgPan = !bgPan; document.body.classList.toggle("ds-pan", bgPan); buildProps(); }, bgPan ? "primary" : ""));
          const art = mk("input"); art.type = "checkbox"; art.checked = !!o.bgimg.art;
          art.addEventListener("change", () => { o.bgimg.art = art.checked; setBgImg(e, o.bgimg); markDirty(); placeBar(); });
          st.appendChild(row("A imagem é o botão", art));
          st.appendChild(mk("p", "adm-small", "Ligado: a imagem vira o próprio botão/cartão (some a cor, a borda e a sombra originais) e continua clicável. Use as alças para ajustar o tamanho do botão e a aba Aparência para a cor do texto."));
        }
      }

      st.appendChild(row("Borda (px)", (() => { const i = numInput(e, "border-width", "px", { min: 0, max: 30, fromComputed: false }); i.addEventListener("input", () => { if (i.value !== "") setS(e, "border-style", e.style.borderStyle || "solid"); }); return i; })()));
      st.appendChild(row("Cor da borda", colorInput(e, "border-color")));
      st.appendChild(row("Estilo da borda", selInput([["", "Padrão"], ["solid", "Sólida"], ["dashed", "Tracejada"], ["dotted", "Pontilhada"], ["double", "Dupla"], ["none", "Nenhuma"]], e.style.borderStyle || "", v => setS(e, "border-style", v || null))));
      st.appendChild(mk("b", "adm-sub", "Cantos"));
      st.appendChild(radiusControl(e));
      st.appendChild(row("Sombra", selInput(SHADOWS, e.style.getPropertyValue("box-shadow") || "", v => setS(e, "box-shadow", v || null))));
      st.appendChild(row("Opacidade (%)", numInput(e, "opacity", "", { min: 0, max: 100, scale: 100, fromComputed: false })));
      st.appendChild(btn("Restaurar aparência original", "", () => { Object.keys((content.ops[id] || {}).s || {}).forEach(p => e.style.removeProperty(p)); if (content.ops[id]) delete content.ops[id].s; cleanOp(id); fixFree(); syncSize(e); buildProps(); markDirty(); placeBar(); }));
    }, true));

    // 3. 📝 Texto (mostrada se isTextLeaf(sel))
    if (isTextLeaf(e)) {
      box.appendChild(buildSection("📝 Texto", tx => {
        if (e.tagName === "BUTTON" && isLeaf(e)) {
          const i = mk("input"); i.type = "text"; i.value = leafText(e);
          i.addEventListener("input", () => {
            e.textContent = i.value; const oi = origInfo.get(id), v = esc(i.value), oo = op(id);
            oo.t = oi ? { h: oi.h, v } : { v }; markDirty(); placeBar();
          });
          tx.appendChild(row("Texto do botão", i));
        }
        tx.appendChild(row("Fonte", selInput([["", "Padrão"]].concat(FONTS.map(([l, v]) => [v, l])), e.style.fontFamily || "", v => setS(e, "font-family", v || null))));
        tx.appendChild(row("Tamanho da letra (px)", numInput(e, "font-size", "px", { min: 6, max: 200 })));
        tx.appendChild(row("Peso", selInput([["", "Padrão"], ["400", "Normal"], ["600", "Seminegrito"], ["700", "Negrito"], ["900", "Extra negrito"]], e.style.fontWeight || "", v => setS(e, "font-weight", v || null))));
        const al = mk("div", "adm-seg");
        [["left", "⇤", "Esquerda"], ["center", "↔", "Centro"], ["right", "⇥", "Direita"], ["justify", "≡", "Justificado"]].forEach(([v, t, ti]) => {
          const b = mk("button", e.style.textAlign === v ? "on" : "", t);
          b.type = "button"; b.title = ti;
          b.addEventListener("click", () => { setS(e, "text-align", e.style.textAlign === v ? null : v); buildProps(); });
          al.appendChild(b);
        });
        tx.appendChild(row("Alinhamento", al));
        tx.appendChild(row("Espaço entre letras (px)", numInput(e, "letter-spacing", "px", { min: -5, max: 20, step: 0.5, fromComputed: false })));
        tx.appendChild(row("Altura da linha", numInput(e, "line-height", "", { min: 0.8, max: 3, step: 0.1, fromComputed: false })));
        tx.appendChild(row("Transformação", selInput([["", "Padrão"], ["none", "Normal"], ["uppercase", "MAIÚSCULAS"], ["lowercase", "minúsculas"], ["capitalize", "Primeira Maiúscula"]], e.style.textTransform || "", v => setS(e, "text-transform", v || null))));
      }, true));
    }

    // 4. 🖼️ Imagem (mostrada se isSlot(sel) || hasImg(sel))
    const isImgEligible = e.tagName === "IMG" || isSlot(e) || hasImg(e) || (isLeaf(e) && !isTextLeaf(e) && !isAtomic(e) && !NOTEXT_TAGS.has(e.tagName));
    if (isImgEligible) {
      box.appendChild(imageSection(e, o, id));
    } else if (isLeaf(e) && !isAtomic(e) && e.matches("span,div") && leafText(e).trim().length <= 4) {
      box.appendChild(buildSection("🖼️ Imagem no lugar do ícone", s => {
        const r = mk("div", "adm-row");
        r.appendChild(btn("📷 Usar uma imagem", "", () => chooseImageFor(e))); s.appendChild(r);
      }, false));
    }

    // 5. 🎬 Animação (sempre mostrada)
    if (!isProtected(e)) {
      box.appendChild(buildSection("🎬 Animação", an => {
        an.appendChild(row("Efeito", selInput(ANIM_EFFECTS,
          o.animation && o.animation.effect || "", effect => {
            if (!effect) delete op(id).animation;
            else op(id).animation = Object.assign({ duration: 500, delay: 0 }, op(id).animation, { effect });
            cleanOp(id); applyAnimations(); markDirty(); buildProps();
          })));
        if (o.animation && o.animation.effect) {
          [["Duração (ms)", "duration", 100, 3000], ["Atraso (ms)", "delay", 0, 3000]].forEach(([title, prop, min, max]) => {
            const wrap = mk("span", "adm-rn");
            const input = mk("input"); input.type = "range"; input.min = min; input.max = max; input.step = 50;
            input.value = Math.max(min, Math.min(max, Number(o.animation[prop]) || (prop === "duration" ? 500 : 0)));
            const output = mk("em", "", input.value + "ms"); wrap.append(input, output);
            input.addEventListener("input", () => {
              op(id).animation[prop] = Number(input.value); output.textContent = input.value + "ms";
              applyAnimations(); markDirty();
            });
            an.appendChild(row(title, wrap));
          });
          const prevBtn = btn("▶ Pré-visualizar", "", () => {
            if (!sel) return;
            sel.style.animation = 'none';
            sel.offsetHeight;
            const a = (content.ops[sel.dataset.b] || {}).animation;
            if (a && a.effect) sel.style.animation = `ds-${a.effect} ${a.duration || 500}ms ease ${a.delay || 0}ms both`;
          });
          an.appendChild(prevBtn);
          an.appendChild(mk("p", "adm-small", "A animação respeita a preferência de movimento reduzido do dispositivo."));
        }
      }, true));
    }

    // 6. 📱 Mobile (sempre mostrada, fechada por padrão)
    if (!isProtected(e)) {
      box.appendChild(buildSection("📱 Mobile", mb => {
        const manual = !!o.mobile || !!o.hideMobile;
        mb.appendChild(mk("p", "adm-small", "Substitua dimensões e alinhamento automaticamente ajustados em telas de até 720px."));
        const hidden = mk("input"); hidden.type = "checkbox"; hidden.checked = !!o.hideMobile;
        hidden.addEventListener("change", () => { const settings = op(id); if (hidden.checked) settings.hideMobile = 1; else delete settings.hideMobile; cleanOp(id); applyResponsiveStyles(); markDirty(); });
        mb.appendChild(row("Ocultar em telas pequenas", hidden));

        mb.appendChild(row("Ajustes manuais", selInput([["auto", "Automático"], ["manual", "Manual"]], manual ? "manual" : "auto", value => {
          if (value === "manual") op(id).mobile = op(id).mobile || {};
          else { delete op(id).mobile; delete op(id).hideMobile; cleanOp(id); }
          applyResponsiveStyles(); markDirty(); buildProps();
        })));
        if (manual) {
          const mobileOptions = [
            ["width", "Largura", [["", "Automático"], ["100%", "100%"], ["90%", "90%"], ["80%", "80%"], ["75%", "75%"], ["50%", "50%"]]],
            ["font-size", "Tamanho do texto", [["", "Automático"], ["14px", "14px"], ["16px", "16px"], ["18px", "18px"], ["20px", "20px"], ["24px", "24px"], ["28px", "28px"]]],
            ["padding", "Espaço interno", [["", "Automático"], ["0px", "0px"], ["8px", "8px"], ["12px", "12px"], ["16px", "16px"], ["24px", "24px"], ["32px", "32px"]]],
            ["text-align", "Alinhamento", [["", "Automático"], ["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]]]
          ];
          mobileOptions.forEach(([prop, title, choices]) => {
            const value = o.mobile && o.mobile[prop] || "";
            mb.appendChild(row(title, selInput(choices, value, next => {
              const settings = op(id).mobile || (op(id).mobile = {});
              if (next) settings[prop] = next; else delete settings[prop];
              if (!Object.keys(settings).length) delete op(id).mobile;
              cleanOp(id); applyResponsiveStyles(); markDirty();
            })));
          });
        }
      }, false));
    }

    // 7. 🔗 Link (mostrada se aplicável)
    const hasLink = e.tagName === "A" || e.hasAttribute("data-go") || o.go || o.href || (e.matches(".ds-anchor") && e.dataset.added) || e.tagName === "BUTTON";
    if (hasLink) {
      box.appendChild(buildSection("🔗 Link", lk => {
        const curHref = op(id).href || e.getAttribute("href") || "";
        const [urlPart, flags] = curHref.split("||");
        const i = mk("input"); i.type = "text";
        i.placeholder = "https://… · #secao · mailto: · section:next";
        i.value = curHref;
        i.addEventListener("input", () => {
          if (safeHref(i.value) || i.value === "") {
            if (i.value) { setHref(e, i.value); op(id).href = i.value; }
            else { e.removeAttribute("href"); e.removeAttribute("target"); e.removeAttribute("rel"); delete op(id).href; }
            refreshYouTubeThumbnails(); markDirty();
          }
        });
        lk.appendChild(row("Link (destino)", i));

        const targetCb = mk("input"); targetCb.type = "checkbox";
        targetCb.checked = (e.getAttribute("target") === "_blank") || (flags && /\bblank\b/.test(flags));
        targetCb.addEventListener("change", () => {
          let raw = op(id).href || e.getAttribute("href") || "";
          let [u] = raw.split("||");
          if (targetCb.checked) {
            if (u) { raw = u + "||blank"; setHref(e, raw); op(id).href = raw; }
          } else {
            if (u) { raw = u; setHref(e, raw); op(id).href = raw; }
          }
          i.value = raw;
          markDirty();
        });
        lk.appendChild(row("Abrir em nova aba", targetCb));

        const curGo = op(id).go || e.getAttribute("data-go") || "";
        lk.appendChild(row("Leva para", selInput([["", "Nenhum"]].concat(PAGES().concat([["section:next", "→ Próxima seção"], ["section:previous", "← Seção anterior"], ["section:first", "Primeira seção"], ["section:last", "Última seção"], ["scrollpoint:next", "↓ Próxima âncora"], ["scrollpoint:previous", "↑ Âncora anterior"]])), curGo, v => {
          if (v) { e.setAttribute("data-go", v); op(id).go = v; }
          else { e.removeAttribute("data-go"); delete op(id).go; }
          markDirty();
        })));

        if (e.matches(".ds-anchor") && e.dataset.added) {
          const ai = mk("input"); ai.type = "text"; ai.value = e.id;
          ai.addEventListener("change", () => {
            const v = slug(ai.value);
            if (!/^[a-z][a-z0-9\-]{0,40}$/.test(v) || (document.getElementById(v) && v !== e.id)) { note("Nome inválido ou já usado."); ai.value = e.id; return; }
            e.id = v; const sp = content.add[id]; sp.attrs = sp.attrs || {}; sp.attrs.id = v; markDirty(); buildProps();
          });
          lk.appendChild(row("Nome da âncora", ai));
          lk.appendChild(mk("p", "adm-small", "Aponte botões e links para #" + e.id + " (ou scrollpoint:next, scrollpoint:previous…) e a página rola até aqui."));
        }
      }, true));
    }
  }

  /* ============================================================
     Histórico (desfazer / refazer)
     Guardamos o estado "original" dos itens ao carregar; para voltar a um
     estado antigo, restauramos os itens tocados e reaplicamos o conteúdo.
     ============================================================ */
  const orig = { el: new Map(), kids: new Map() };
  const hist = { undo: [], redo: [], last: "" };
  const RUNTIME_CLS = ["active", "open", "focus", "selected", "ready"];
  let commitTimer = null;
  function captureOrig() {
    $$("[data-b]").forEach(e => {
      const id = e.dataset.b;
      orig.el.set(id, { attrs: Array.from(e.attributes).map(a => [a.name, a.value]), html: isLeaf(e) ? e.innerHTML : null });
      if (dchildren(e).length) orig.kids.set(id, Array.from(e.childNodes));
    });
  }
  function restoreOriginals(ids) {
    $$("[data-added]").forEach(n => { nodes.delete(n.dataset.b); n.remove(); });
    ids.forEach(id => {
      const e = nodes.get(id), o = orig.el.get(id); if (!e || !o) return;
      if ($(":scope > .slot-img", e) || $(":scope > .slot-orig", e)) setImage(e, null);
      const live = RUNTIME_CLS.filter(c => e.classList.contains(c));      // estado vivo do script.js (página aberta, aba ativa…)
      const keep = new Map(o.attrs);
      Array.from(e.attributes).forEach(a => { if (!keep.has(a.name) && a.name !== "contenteditable" && a.name !== "spellcheck") e.removeAttribute(a.name); });
      keep.forEach((v, k) => { if (e.getAttribute(k) !== v) e.setAttribute(k, v); });
      RUNTIME_CLS.forEach(c => e.classList.toggle(c, live.includes(c)));
      if (o.html !== null && isLeaf(e) && e.innerHTML !== o.html) e.innerHTML = o.html;
    });
    ids.forEach(id => {
      const parent = nodes.get(id), kids = orig.kids.get(id); if (!parent || !kids) return;
      kids.forEach(k => { if (k.parentNode !== parent || k !== parent.childNodes[kids.indexOf(k)]) parent.appendChild(k); });
    });
  }
  function normContent(c) {
    c = c || {};
    ["vars", "bg", "ops", "order", "add", "pages", "site", "styles"].forEach(k => { if (!c[k] || typeof c[k] !== "object") c[k] = {}; });
    c.v = 2; return c;
  }
  function loadSnapshot(str, keepSel) {
    const selId = keepSel && sel ? sel.dataset.b : null;
    const old = content, nc = normContent(JSON.parse(str));
    const ids = new Set(["main"]);
    [old, nc].forEach(c => { Object.keys(c.ops).forEach(k => ids.add(k)); Object.keys(c.order).forEach(k => ids.add(k)); });
    orig.el.forEach((v, k) => { if (!ids.has(k) && (k === "main" || false)) ids.add(k); });
    select(null);
    restoreOriginals(ids);
    content = nc;
    applyAll();
    refreshEditable();
    refreshSiteFeatures();
    if (selId && nodes.get(selId) && nodes.get(selId).isConnected) select(nodes.get(selId));
    refreshAfterChange();
  }
  function refreshAfterChange() {
    fixFree(); updateStatus(); refreshTree(); refreshSections(); updateUndoButtons(); buildProps(); placeBar(); syncPreview();
  }
  function scheduleCommit() { clearTimeout(commitTimer); commitTimer = setTimeout(commit, 350); }
  function commit() {
    clearTimeout(commitTimer);
    const cur = JSON.stringify(content);
    if (cur === hist.last) return;
    hist.undo.push(hist.last); if (hist.undo.length > 100) hist.undo.shift();
    hist.redo = []; hist.last = cur; updateUndoButtons(); syncPreview();
  }
  function undo() {
    commit();
    if (!hist.undo.length) { note("Nada para desfazer."); return; }
    hist.redo.push(hist.last); hist.last = hist.undo.pop(); loadSnapshot(hist.last, true);
  }
  function redo() {
    commit();
    if (!hist.redo.length) { note("Nada para refazer."); return; }
    hist.undo.push(hist.last); hist.last = hist.redo.pop(); loadSnapshot(hist.last, true);
  }
  function updateUndoButtons() {
    if (!panel) return;
    const u = $("#adm-undo", panel), r = $("#adm-redo", panel);
    if (u) u.disabled = !hist.undo.length && JSON.stringify(content) === hist.last;
    if (r) r.disabled = !hist.redo.length;
  }

  /* ============================================================
     Pré-visualização (celular / tablet) — iframe com o conteúdo atual
     ============================================================ */
  let pv = null;
  function openPreview(mode) {
    closePreview();
    if (mode === "desktop") { setViewButtons("desktop"); return; }
    const wrap = mk("div", "adm-preview adm-pv-" + mode);
    const dev = mk("div", "adm-pv-dev");
    const fr = mk("iframe"); fr.title = "Pré-visualização";
    const previewUrl = new URL(location.href);
    previewUrl.search = "";
    previewUrl.searchParams.set("preview", "1");
    previewUrl.searchParams.set("preview-refresh", Date.now().toString(36));
    previewUrl.hash = currentPage();
    fr.src = previewUrl.href;
    dev.appendChild(fr);
    wrap.appendChild(mk("div", "adm-pv-label", { tablet: "Tablet · 820 px", mobile: "Celular · 390 px", "mobile-x": "Celular (expandido) · 390 px" }[mode] || ""));
    wrap.appendChild(dev);
    wrap.className += " side-" + ((panel && panel.dataset.side) || "right");
    document.body.appendChild(wrap);
    pv = { wrap, fr, mode, ready: false };
    setViewButtons(mode);
  }
  function closePreview() { if (pv) { pv.wrap.remove(); pv = null; } setViewButtons("desktop"); }
  function setViewButtons(mode) {
    if (!panel) return;
    $$("[data-view]", panel).forEach(b => {
      const active = b.dataset.view === mode;
      b.classList.toggle("on", active);
      if (b.matches(".adm-mobile-switch")) b.setAttribute("aria-checked", String(active));
    });
  }
  function syncPreview() {
    if (!pv || !pv.ready || !pv.fr.contentWindow) return;
    const pr = {}; previews.forEach((v, k) => { pr[k] = v; });
    const media = {}; mediaPreviews.forEach((v, k) => { media[k] = v; });
    pv.fr.contentWindow.postMessage({ ds: "content", content, previews: pr, mediaPreviews: media, page: currentPage() }, location.origin);
  }
  window.addEventListener("message", ev => {
    if (ev.origin !== location.origin || !ev.data) return;
    if (ev.data.ds === "ready" && pv && ev.source === pv.fr.contentWindow) { pv.ready = true; syncPreview(); }
    if (ev.data.ds === "content" && PREVIEW && ev.source === parent) {          // somos o iframe da prévia
      if (ev.data.previews) Object.entries(ev.data.previews).forEach(([k, v]) => { if (safePath(k) && typeof v === "string" && /^data:image\//.test(v)) previews.set(k, v); });
      if (ev.data.mediaPreviews) Object.entries(ev.data.mediaPreviews).forEach(([k, v]) => { if (safeAudioPath(k) && typeof v === "string" && /^blob:/.test(v)) mediaPreviews.set(k, v); });
      loadSnapshot(JSON.stringify(ev.data.content), false);
      if (ev.data.page && location.hash.slice(1) !== ev.data.page && !location.hash.slice(1).startsWith("x")) { location.hash = ev.data.page; }
    }
  });

  /* ============================================================
     Painel de elementos (árvore)
     ============================================================ */
  const treeOpen = new Set();
  let treeDrag = null;
  function pageTitle(id) { return (content.pages[id] && content.pages[id].title) || BASE_TITLES[id] || id; }
  const BASE_TITLES = { home: "Design System: início", fundamentos: "Fundamentos", identidade: "Identidade", ilustracao: "Ilustração", componentes: "Componentes", interacoes: "Interações", presskit: "Press Kit" };
  function moveNode(el, container, ref) {
    if (container === el || el.contains(container)) return false;
    const old = el.parentElement && el.parentElement.closest("[data-b]");
    if (ref) container.insertBefore(el, ref); else container.appendChild(el);
    if (old) recordOrder(old); recordOrder(container); fixFree(); markDirty(); refreshSiteFeatures(); return true;
  }
  function refreshTree() {
    if (!panel || curTab !== "tree") return;
    const box = $("#adm-tree", panel); if (!box) return;
    const scrollTop = box.parentElement.scrollTop;
    box.innerHTML = "";
    const anc = new Set(); for (let n = sel; n; n = n.parentElement && n.parentElement.closest("[data-b]")) anc.add(n);
    [["header[data-b]", 0], [".page.active", 0], ["footer[data-b]", 0]].forEach(([q]) => { const r = $(q); if (r) box.appendChild(treeRow(r, 0, anc)); });
    box.parentElement.scrollTop = scrollTop;
  }
  function treeRow(e, depth, anc) {
    const wrap = mk("div", "adm-tw");
    const kids = dchildren(e).filter(k => !k.matches(".slot-orig"));
    const open = treeOpen.has(e.dataset.b) || anc.has(e) && e !== sel || depth < 1;
    const hidden = !!(content.ops[e.dataset.b] || {}).hide;
    const row = mk("div", "adm-tr" + (e === sel ? " on" : "") + (hidden ? " off" : ""));
    row.style.paddingLeft = 4 + depth * 12 + "px";
    row.draggable = !isProtected(e);
    const caret = mk("button", "adm-caret", kids.length ? (open ? "▾" : "▸") : "·"); caret.type = "button";
    caret.addEventListener("click", ev => { ev.stopPropagation(); if (!kids.length) return; if (open) { treeOpen.delete(e.dataset.b); anc.delete(e); } else treeOpen.add(e.dataset.b); refreshTree(); });
    const name = mk("span", "adm-tn", esc(e.classList.contains("page") ? "Página: " + pageTitle(e.id) : label(e)));
    row.append(caret, name);
    if (!isProtected(e)) {
      const eye = btn(hidden ? "🙈" : "👁", hidden ? "Mostrar" : "Ocultar", () => {
        const o = op(e.dataset.b); if (o.hide) delete o.hide; else o.hide = 1; cleanOp(e.dataset.b);
        e.classList.toggle("ds-hidden", !!(content.ops[e.dataset.b] || {}).hide); markDirty(); refreshTree(); placeBar();
      }, "adm-ico");
      row.appendChild(eye);
    }
    row.addEventListener("click", () => { select(e, true); });
    row.addEventListener("dblclick", () => { showTab("item"); });
    row.addEventListener("dragstart", ev => { treeDrag = e; ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", e.dataset.b); });
    row.addEventListener("dragend", () => { treeDrag = null; $$(".adm-tr", panel).forEach(r => r.classList.remove("d-before", "d-after", "d-in")); });
    row.addEventListener("dragover", ev => {
      if (!treeDrag || treeDrag === e || treeDrag.contains(e)) return;
      ev.preventDefault();
      const r = row.getBoundingClientRect(), y = (ev.clientY - r.top) / r.height;
      const zone = isProtected(e) ? (e.classList.contains("page") ? "in" : null) : (y < 0.3 ? "before" : y > 0.7 && !(canContain(e) && kids.length && open) ? "after" : canContain(e) ? "in" : "after");
      $$(".adm-tr", panel).forEach(x => x.classList.remove("d-before", "d-after", "d-in"));
      if (zone) { row.classList.add("d-" + zone); row.dataset.zone = zone; } else delete row.dataset.zone;
    });
    row.addEventListener("drop", ev => {
      ev.preventDefault(); const zone = row.dataset.zone; if (!treeDrag || !zone) return;
      const d = treeDrag; treeDrag = null;
      let ok = false;
      if (zone === "in") ok = moveNode(d, e, null);
      else { const par = e.parentElement.closest("[data-b]"); if (par) ok = moveNode(d, par, zone === "before" ? e : nextData(e)); }
      if (ok) { treeOpen.add(e.dataset.b); refreshTree(); placeBar(); }
    });
    wrap.appendChild(row);
    if (open) kids.forEach(k => wrap.appendChild(treeRow(k, depth + 1, anc)));
    return wrap;
  }

  /* ============================================================
     Painel de seções (páginas do site)
     ============================================================ */
  function pageList() { return $$(".page"); }
  function navLinkOf(id) { return $('#nav a[data-nav="' + id + '"]'); }
  function uniquePageId(base) {
    let id = base || "secao", n = 2;
    while (document.getElementById(id) || content.pages[id]) id = (base || "secao") + "-" + n++;
    return id;
  }
  function newSection(title, from) {
    title = (title || "").trim(); if (!title) return;
    const id = uniquePageId(slug(title));
    const nav = $("#nav"), main = $("main");
    let spec;
    if (from) {
      spec = specOf(from); spec.cls = "page"; spec.attrs = Object.assign({}, spec.attrs);
    } else spec = { tag: "section", cls: "page", attrs: {}, children: [{ tag: "h1", t: esc(title) }, { tag: "p", t: "Conteúdo da nova seção. Clique para editar ou adicione blocos pela aba ＋." }] };
    spec.attrs.id = id;
    const page = spawn(spec, main, null);
    const link = spawn({ tag: "a", attrs: { href: "#" + id, "data-nav": id }, t: esc(title) }, nav, null);
    content.pages[id] = { title, nav: link.dataset.b, page: page.dataset.b };
    fixFree(); refreshEditable(); markDirty(); location.hash = id; refreshSections();
  }
  function deleteSection(id) {
    const meta = content.pages[id]; if (!meta || !meta.page) return;
    if (!confirm("Excluir a seção “" + pageTitle(id) + "” e tudo que está nela?")) return;
    const pe = nodes.get(meta.page), ne = nodes.get(meta.nav);
    if (currentPage() === id) location.hash = (content.site.home && document.getElementById(content.site.home)) ? content.site.home : "home";
    if (pe) removeAdded(pe); if (ne) removeAdded(ne);
    delete content.pages[id]; Object.keys(content.bg).forEach(k => { if (k === id) delete content.bg[k]; });
    markDirty(); refreshSections();
  }
  function refreshSections() {
    if (!panel || curTab !== "sections") return;
    const box = $("#adm-sections", panel); if (!box) return;
    box.innerHTML = "";
    const home = content.site.home || "home";
    pageList().forEach(p => {
      const id = p.id, meta = content.pages[id] || {}, added = !!meta.page, link = navLinkOf(id);
      const hidden = link ? !!(content.ops[link.dataset.b] || {}).hide : false;
      const r = mk("div", "adm-sec" + (id === currentPage() ? " on" : ""));
      r.appendChild(mk("div", "adm-sec-t", `<b>${esc(pageTitle(id))}</b><code>#${esc(id)}</code>${id === home ? '<em title="Página inicial do site">🏠</em>' : ""}`));
      const acts = mk("div", "adm-row");
      acts.appendChild(btn("Abrir", "Ir para esta seção", () => { location.hash = id; }));
      acts.appendChild(btn("✎", "Renomear (título e menu)", () => {
        const t = prompt("Novo nome da seção:", pageTitle(id)); if (!t || !t.trim()) return;
        content.pages[id] = Object.assign(content.pages[id] || {}, { title: t.trim() });
        if (link) { link.innerHTML = esc(t.trim()); onTextInput(link); }
        markDirty(); refreshSections(); refreshPageSelect();
      }));
      if (link) {
        acts.appendChild(btn(hidden ? "Mostrar no menu" : "Ocultar do menu", "", () => {
          const o = op(link.dataset.b); if (o.hide) delete o.hide; else o.hide = 1; cleanOp(link.dataset.b);
          link.classList.toggle("ds-hidden", !!(content.ops[link.dataset.b] || {}).hide); markDirty(); refreshSections();
        }));
        acts.appendChild(btn("◀", "Mover no menu para trás", () => { sel = sel; const prev = link.previousElementSibling; if (prev) { link.parentElement.insertBefore(link, prev); recordOrder($("#nav")); markDirty(); refreshSections(); } }));
        acts.appendChild(btn("▶", "Mover no menu para frente", () => { const nx = link.nextElementSibling; if (nx) { link.parentElement.insertBefore(link, nx.nextElementSibling); recordOrder($("#nav")); markDirty(); refreshSections(); } }));
      }
      acts.appendChild(btn("🏠", "Definir como página inicial do site", () => { content.site.home = id; markDirty(); refreshSections(); }));
      acts.appendChild(btn("⧉", "Duplicar seção", () => {
        if (p.querySelector("[id]") || p.querySelector(ATOMIC)) { alert("Esta seção contém itens interativos e não pode ser duplicada."); return; }
        const t = prompt("Nome da cópia:", pageTitle(id) + " (cópia)"); if (t) newSection(t, p);
      }));
      if (added) acts.appendChild(btn("🗑", "Excluir seção", () => deleteSection(id), "danger"));
      r.appendChild(acts); box.appendChild(r);
    });
    const add = mk("div", "adm-row");
    add.appendChild(btn("＋ Nova seção", "", () => { const t = prompt("Nome da nova seção (aparece no menu):", "Nova seção"); if (t) newSection(t); }, "primary"));
    box.appendChild(add);
    box.appendChild(mk("p", "adm-small", "Cada seção funciona como uma página do site (endereço #nome). A página inicial pode ser escolhida com 🏠. Seções originais não podem ser excluídas, apenas ocultadas do menu."));
  }
  /* pergunta em quais páginas aplicar uma ação de fundo: só esta, todas, ou uma lista */
  function askBgScope(title, apply, removing) {
    const cur = currentPage();
    const back = mk("div", "adm-backdrop"), box = mk("div", "adm-modal adm-scope");
    box.innerHTML = `<h3>${esc(title)}</h3>
      <label class="adm-radio"><input type="radio" name="adm-sc" value="one" checked> Só esta página (${esc(pageTitle(cur))})</label>
      <label class="adm-radio"><input type="radio" name="adm-sc" value="all"> Todas as páginas</label>
      <label class="adm-radio"><input type="radio" name="adm-sc" value="pick"> Escolher páginas…</label>
      <div class="adm-picklist" hidden>${PAGES().filter(([id]) => id !== cur).map(([id, l]) => `<label><input type="checkbox" value="${id}"> ${esc(l)}</label>`).join("")}</div>
      <div class="adm-row"><button type="button" class="primary" data-ok>${removing ? "Remover" : "Aplicar"}</button><button type="button" data-no>${removing ? "Só esta" : "Só esta página"}</button></div>`;
    back.appendChild(box); document.body.appendChild(back);
    const list = $(".adm-picklist", box);
    $$("input[name=adm-sc]", box).forEach(r => r.addEventListener("change", () => { list.hidden = r.value !== "pick" || !r.checked; }));
    const close = () => back.remove();
    $("[data-no]", box).addEventListener("click", close);
    $("[data-ok]", box).addEventListener("click", () => {
      const v = $("input[name=adm-sc]:checked", box).value;
      const ids = v === "all" ? PAGES().map(x => x[0]).filter(id => id !== cur) : v === "pick" ? $$(".adm-picklist input:checked", box).map(i => i.value) : [];
      close(); if (ids.length) apply(ids);
    });
  }
  function refreshPageSelect() {
    if (!panel) return; const g = $("#adm-goto", panel); if (!g) return;
    g.innerHTML = PAGES().map(([id, l]) => `<option value="${id}">${esc(l)}</option>`).join(""); g.value = currentPage();
  }

  /* ============================================================
     Atalhos de teclado (iguais aos do Carrd)
     ============================================================ */
  let clipSpec = null;
  function canClone(e) { return !(e.id || e.querySelector("[id]") || isAtomic(e) || e.querySelector(ATOMIC)); }
  function copyItem(e) {
    if (!e || isProtected(e)) return false;
    if (!canClone(e)) { note("Este item é interativo e não pode ser copiado."); return false; }
    clipSpec = specOf(e); note("Item copiado."); return true;
  }
  function pasteItem() {
    if (!clipSpec) return;
    let parent, ref = null;
    if (sel && !isProtected(sel)) { parent = sel.parentElement.closest("[data-b]"); ref = nextData(sel); }
    else parent = sel && canContain(sel) ? sel : ($(".page.active") || $(".page"));
    const n = spawn(JSON.parse(JSON.stringify(clipSpec)), parent, ref);
    fixFree(); refreshEditable(); select(n); markDirty();
  }
  function globalKeys(ev) {
    if (!editing || $(".adm-backdrop")) return false;
    const typing = ev.target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName);
    const mod = ev.ctrlKey || ev.metaKey, code = ev.code;
    if (ev.altKey && !mod) {
      const map = { KeyE: () => showTab("tree"), KeyS: () => showTab("sections"), KeyV: () => viewSite(),
        ArrowLeft: () => dockPanel("left"), ArrowRight: () => dockPanel("right") };
      if (map[code]) { ev.preventDefault(); map[code](); return true; }
      return false;
    }
    if (!mod) return false;
    if (code === "KeyS") { ev.preventDefault(); saveAll(); return true; }
    if (typing) return false;                                   // dentro de um campo, o navegador cuida do desfazer/copiar
    if (code === "KeyZ") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return true; }
    if (code === "KeyY") { ev.preventDefault(); redo(); return true; }
    if (window.getSelection && String(window.getSelection()).length && !ev.shiftKey) return false;
    if (code === "KeyC" && sel) { ev.preventDefault(); copyItem(sel); return true; }
    if (code === "KeyX" && sel) { ev.preventDefault(); if (copyItem(sel)) { if (sel.dataset.added) removeAdded(sel); else { op(sel.dataset.b).hide = 1; sel.classList.add("ds-hidden"); } select(null); markDirty(); } return true; }
    if (code === "KeyV") { ev.preventDefault(); pasteItem(); return true; }
    return false;
  }
  function viewSite() { window.open(location.href.split("#")[0].split("?")[0] + location.hash, "_blank"); }
  function previewSelectedAnimation() {
    const element = sel;
    const animation = element && (content.ops[element.dataset.b] || {}).animation;
    if (!element || !animation || !ANIM_KEYS.includes(animation.effect)) {
      note("Escolha um efeito em Animação antes de pré-visualizar.");
      return;
    }
    const duration = Math.max(100, Math.min(3000, Number(animation.duration) || 500));
    const delay = Math.max(0, Math.min(3000, Number(animation.delay) || 0));
    element.style.animation = "none";
    element.offsetWidth;
    requestAnimationFrame(() => {
      element.style.animation = `ds-${animation.effect} ${duration}ms ease ${delay}ms both`;
      setTimeout(() => { if (element.isConnected) element.style.animation = ""; }, duration + delay + 100);
    });
  }
  function playAnims() { if (window.DS_ANIM) window.DS_ANIM.play(); }

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
    Object.values(content.add).forEach(spec => {
      const source = spec && spec.attrs && spec.attrs.src;
      if (safeAssetPath(source)) u.add(source);
    });
    return u;
  }
  async function saveAll() {
    const status = $("#adm-status", panel), btn = $("#adm-save", panel); btn.disabled = true;
    try {
      const used = usedImages();
      const toSend = Array.from(pending.entries()).filter(([p]) => used.has(p));
      let n = 0;
      for (const [path, f] of toSend) { status.textContent = `Enviando arquivo ${++n}/${toSend.length}…`; await putFile(path, f.b64, "Admin: envia " + path); }
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
    session = sess; saved = JSON.parse(JSON.stringify(content)); hist.last = JSON.stringify(content);
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
    if (panel) { panel.classList.remove("min", "collapsed"); return; }
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
    const mainEl = $("main"); if (mainEl && !mainEl.dataset.b) mainEl.dataset.b = "main";
    captureOrig();
    $$("[data-b]").forEach(e => {
      nodes.set(e.dataset.b, e);
      if (isLeaf(e)) origInfo.set(e.dataset.b, { html: e.innerHTML, h: hash(e.innerHTML) });
    });
    try {
      const r = await fetch("content.json?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) content = migrate(await r.json(), legacyText, legacySlots);
    } catch (e) { /* sem content.json */ }
    applyAll();
    document.dispatchEvent(new CustomEvent("ds:content-applied"));
    if (timerTicker === null) timerTicker = window.setInterval(() => {
      Object.entries(content.ops).forEach(([id, item]) => {
        const element = nodes.get(id);
        if (element && element.matches(".ds-timer")) renderTimer(element, item.timer);
      });
    }, 1000);
    hist.last = JSON.stringify(content);
    const home = content.site && content.site.home;
    if (home && document.getElementById(home) && !location.hash && window.DS) { window.DS.setHome(home); location.replace("#" + home); }
    if (PREVIEW) {
      document.body.classList.add("ds-preview");
      window.parent.postMessage({ ds: "ready" }, location.origin);
      return;
    }
    $("#admin-link").addEventListener("click", ev => { ev.preventDefault(); openLogin(); });
    if (/[?&]admin\b/.test(location.search)) openLogin();
  }
  init();
})();
