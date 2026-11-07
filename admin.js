/* ============================================================
   Painel Admin — edição visual + salvamento no GitHub
   - Textos e imagens editáveis direto na página
   - A "senha" protege o token do GitHub (criptografado neste navegador)
   - Quem não tem o token NÃO consegue salvar nada
   ============================================================ */
(function () {
  "use strict";

  const TEXT_SEL = "h1,h2,h3,h4,p,li,figcaption,th,td,.callout,.vn-name,.legend span,.aff,.card strong,.gate-card strong";
  const SLOT_SEL = ".img-slot,.logo-placeholder,.logo-box";
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
  const ALLOWED = new Set(["B", "STRONG", "I", "EM", "BR", "CODE", "KBD", "SMALL", "A", "SPAN"]);
  const VAULT_KEY = "ds_admin_vault";

  const $ = (s, r) => (r || document).querySelector(s);
  const hash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const slug = n => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
  const safePath = p => typeof p === "string" && /^imgs\/[A-Za-z0-9_\-./]+$/.test(p) && !p.includes("..");
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ---------- estado ---------- */
  let content = { text: {}, images: {}, vars: {}, bg: {} };
  let saved = null;                       // cópia do que está no GitHub
  const textEls = new Map();              // key -> {el, orig, h}
  const slotEls = new Map();              // key -> {el, orig, h, page}
  const pending = new Map();              // path -> {b64, mime}
  const previews = new Map();             // path -> dataURL
  const cleanVars = {};                   // valores originais do CSS
  let editing = false, dirty = false;
  let session = null;                     // {token, owner, repo, branch}
  let panel = null, bgStyle = null;

  /* ---------- sanitizador ---------- */
  function sanitize(html) {
    const d = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
    (function walk(node) {
      Array.from(node.childNodes).forEach(c => {
        if (c.nodeType !== 1) return;
        if (c.tagName === "SCRIPT" || c.tagName === "STYLE") { c.remove(); return; }
        walk(c);
        if (ALLOWED.has(c.tagName)) {
          Array.from(c.attributes).forEach(a => {
            const keep = c.tagName === "A" && a.name === "href" && /^(https?:|#|mailto:)/i.test(a.value);
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

  /* ---------- indexação dos elementos editáveis ---------- */
  function indexElements() {
    document.querySelectorAll(".page").forEach(page => {
      let ti = 0, si = 0;
      page.querySelectorAll(TEXT_SEL).forEach(e => {
        if (e.closest(SLOT_SEL)) return;
        const key = page.id + ":" + (ti++);
        const orig = e.innerHTML;
        textEls.set(key, { el: e, orig, h: hash(orig) });
      });
      page.querySelectorAll(SLOT_SEL).forEach(e => {
        const key = page.id + ":" + (si++);
        const orig = e.innerHTML;
        slotEls.set(key, { el: e, orig, h: hash(orig), page: page.id });
      });
    });
  }

  /* ---------- aplicar conteúdo ---------- */
  function renderSlot(key) {
    const s = slotEls.get(key); if (!s) return;
    const e = s.el;
    const data = content.images[key];
    Array.from(e.querySelectorAll(".slot-tools")).forEach(t => t.remove());
    if (data && safePath(data.path) && data.h === s.h) {
      const src = previews.get(data.path) || data.path;
      e.innerHTML = "";
      const img = el("img"); img.src = src; img.alt = ""; img.loading = "lazy";
      e.appendChild(img);
      e.classList.add("has-img");
    } else {
      e.innerHTML = s.orig;
      e.classList.remove("has-img");
    }
    if (editing) addSlotTools(key);
  }
  function applyText() {
    textEls.forEach((t, key) => {
      const d = content.text[key];
      t.el.innerHTML = (d && d.h === t.h) ? sanitize(d.v) : t.orig;
    });
  }
  function applyVars() {
    Object.entries(cleanVars).forEach(([k, v]) => document.documentElement.style.setProperty(k, content.vars[k] || v));
    window.DS && window.DS.renderSwatches();
  }
  function applyBg() {
    if (!bgStyle) { bgStyle = el("style"); document.head.appendChild(bgStyle); }
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
    applyText();
    slotEls.forEach((_, k) => renderSlot(k));
    applyVars();
    applyBg();
  }

  /* ---------- marcar alterações ---------- */
  function markDirty() { dirty = true; updatePanelStatus(); }
  function countChanges() {
    return pending.size + (JSON.stringify(content) !== JSON.stringify(saved) ? 1 : 0);
  }

  /* ---------- edição de texto ---------- */
  function onTextInput(key) {
    const t = textEls.get(key);
    const v = sanitize(t.el.innerHTML);
    if (v === t.orig) delete content.text[key]; else content.text[key] = { h: t.h, v };
    markDirty();
  }

  /* ---------- upload de imagem ---------- */
  const fileInput = el("input"); fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.hidden = true;
  let fileCb = null;
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0]; fileInput.value = "";
    if (!f || !fileCb) return;
    if (f.size > 20 * 1024 * 1024) { alert("Imagem acima de 20 MB. Reduza o arquivo antes de enviar."); return; }
    const r = new FileReader();
    r.onload = () => {
      const url = r.result;
      fileCb({ name: f.name, url, b64: url.split(",")[1], mime: f.type });
    };
    r.readAsDataURL(f);
  });
  document.body.appendChild(fileInput);
  function pickImage(cb) { fileCb = cb; fileInput.click(); }

  function addSlotTools(key) {
    const s = slotEls.get(key);
    const tools = el("div", "slot-tools");
    tools.contentEditable = "false";
    const up = el("button", "", "📷 " + (content.images[key] ? "Trocar" : "Enviar imagem"));
    up.type = "button";
    up.addEventListener("click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      pickImage(f => {
        const ext = (f.name.match(/\.[a-z0-9]+$/i) || [".png"])[0].toLowerCase();
        const base = slug(f.name.replace(/\.[^.]+$/, "")) || "imagem";
        const path = `imgs/${s.page}/${base}${ext}`;
        pending.set(path, { b64: f.b64, mime: f.mime });
        previews.set(path, f.url);
        content.images[key] = { path, h: s.h };
        renderSlot(key); markDirty();
      });
    });
    tools.appendChild(up);
    if (content.images[key]) {
      const rm = el("button", "danger", "✕");
      rm.type = "button"; rm.title = "Remover imagem";
      rm.addEventListener("click", ev => {
        ev.preventDefault(); ev.stopPropagation();
        delete content.images[key]; renderSlot(key); markDirty();
      });
      tools.appendChild(rm);
    }
    s.el.appendChild(tools);
  }

  /* ---------- modo de edição ---------- */
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle("editing", on);
    textEls.forEach((t, key) => {
      if (on) {
        t.el.contentEditable = "true"; t.el.spellcheck = false;
        if (!t.bound) {
          t.bound = true;
          t.el.addEventListener("input", () => editing && onTextInput(key));
          t.el.addEventListener("paste", ev => {
            if (!editing) return;
            ev.preventDefault();
            document.execCommand("insertText", false, (ev.clipboardData || window.clipboardData).getData("text/plain"));
          });
          t.el.addEventListener("keydown", ev => { if (editing && ev.key === " ") ev.stopPropagation(); });
        }
      } else t.el.removeAttribute("contenteditable");
    });
    slotEls.forEach((_, key) => renderSlot(key));
  }
  // durante a edição, os cartões não navegam (para poder clicar no texto)
  document.addEventListener("click", ev => {
    if (editing && ev.target.closest("[data-go]")) { ev.stopImmediatePropagation(); ev.preventDefault(); }
  }, true);
  window.addEventListener("beforeunload", ev => { if (editing && countChanges() > 0) { ev.preventDefault(); ev.returnValue = ""; } });

  /* ---------- cripto (senha protege o token) ---------- */
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base,
      { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encryptVault(pass, payload) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pass, salt);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload)));
    return { salt: b64e(salt), iv: b64e(iv), data: b64e(data) };
  }
  async function decryptVault(pass, v) {
    const key = await deriveKey(pass, b64d(v.salt));
    const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(v.iv) }, key, b64d(v.data));
    return JSON.parse(dec.decode(buf));
  }
  const readVault = () => { try { return JSON.parse(localStorage.getItem(VAULT_KEY)); } catch (e) { return null; } };

  /* ---------- API do GitHub ---------- */
  async function gh(method, url, body) {
    const r = await fetch("https://api.github.com" + url, {
      method,
      headers: { Authorization: "Bearer " + session.token, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
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
  const utf8b64 = str => b64e(enc.encode(str));

  async function saveAll() {
    const status = $("#adm-status");
    const btn = $("#adm-save"); btn.disabled = true;
    try {
      const files = Array.from(pending.entries());
      // só envia imagens que ainda estão em uso
      const used = new Set([...Object.values(content.images).map(i => i.path), ...Object.values(content.bg).map(b => b.path)]);
      const toSend = files.filter(([p]) => used.has(p));
      let n = 0;
      for (const [path, f] of toSend) {
        status.textContent = `Enviando imagem ${++n}/${toSend.length}…`;
        await putFile(path, f.b64, "Admin: envia " + path);
      }
      status.textContent = "Salvando textos e ajustes…";
      content.vars = Object.fromEntries(Object.entries(content.vars).filter(([k, v]) => cleanVars[k] !== v));
      await putFile("content.json", utf8b64(JSON.stringify(content, null, 2) + "\n"), "Admin: atualiza conteúdo");
      toSend.forEach(([p]) => pending.delete(p));
      saved = JSON.parse(JSON.stringify(content)); dirty = false;
      status.textContent = "✔ Salvo! O site publica em 1 a 2 minutos.";
    } catch (e) {
      status.textContent = "✖ " + e.message;
    }
    btn.disabled = false; updatePanelStatus(true);
  }

  /* ---------- painel (card) ---------- */
  function currentPage() { return document.body.dataset.page || "gate"; }

  function buildPanel() {
    panel = el("aside", "adm-panel");
    panel.innerHTML = `
      <div class="adm-head"><b>🛠 Painel Admin</b><button type="button" id="adm-min" title="Minimizar">–</button></div>
      <div class="adm-body">
        <p class="adm-tip">Clique em qualquer <b>texto</b> para editar. Clique nas caixas de <b>imagem</b> para enviar ou trocar. Use o menu do topo para trocar de página.</p>
        <details open><summary>Fundo desta página</summary>
          <div class="adm-row"><button type="button" id="adm-bg-up">📷 Escolher imagem</button><button type="button" id="adm-bg-rm" class="danger">Remover</button></div>
          <label class="adm-lbl">Escurecer fundo <input type="range" id="adm-dim" min="0" max="90" value="0"><span id="adm-dim-v">0%</span></label>
        </details>
        <details><summary>Cores do site</summary><div class="adm-colors" id="adm-colors"></div>
          <button type="button" id="adm-colors-reset" class="danger">Restaurar cores originais</button></details>
        <div id="adm-changes" class="adm-changes"></div>
        <div id="adm-status" class="adm-status"></div>
        <div class="adm-row">
          <button type="button" id="adm-save" class="primary">💾 Salvar no GitHub</button>
          <button type="button" id="adm-discard">Descartar</button>
        </div>
        <button type="button" id="adm-exit" class="adm-exit">Sair do modo admin</button>
      </div>`;
    document.body.appendChild(panel);

    // cores
    const box = $("#adm-colors", panel);
    VARS.forEach(([k, label]) => {
      const row = el("label", "adm-color", `<span>${label}</span>`);
      const inp = el("input"); inp.type = "color"; inp.dataset.var = k;
      inp.value = content.vars[k] || cleanVars[k] || "#000000";
      inp.addEventListener("input", () => { content.vars[k] = inp.value; applyVars(); markDirty(); });
      row.appendChild(inp); box.appendChild(row);
    });
    $("#adm-colors-reset", panel).addEventListener("click", () => {
      content.vars = {}; applyVars(); syncColorInputs(); markDirty();
    });

    // fundo
    $("#adm-bg-up", panel).addEventListener("click", () => pickImage(f => {
      const page = currentPage();
      const ext = (f.name.match(/\.[a-z0-9]+$/i) || [".jpg"])[0].toLowerCase();
      const path = `imgs/fundos/${page}-${slug(f.name.replace(/\.[^.]+$/, "")) || "fundo"}${ext}`;
      pending.set(path, { b64: f.b64, mime: f.mime }); previews.set(path, f.url);
      content.bg[page] = { path, dim: (content.bg[page] && content.bg[page].dim) || 0 };
      applyBg(); syncBgControls(); markDirty();
    }));
    $("#adm-bg-rm", panel).addEventListener("click", () => { delete content.bg[currentPage()]; applyBg(); syncBgControls(); markDirty(); });
    $("#adm-dim", panel).addEventListener("input", e => {
      const b = content.bg[currentPage()]; if (!b) return;
      b.dim = e.target.value / 100; $("#adm-dim-v", panel).textContent = e.target.value + "%"; applyBg(); markDirty();
    });

    $("#adm-min", panel).addEventListener("click", () => panel.classList.toggle("min"));
    $("#adm-save", panel).addEventListener("click", saveAll);
    $("#adm-discard", panel).addEventListener("click", () => {
      if (!confirm("Descartar todas as alterações não salvas?")) return;
      content = JSON.parse(JSON.stringify(saved)); pending.clear(); previews.clear();
      applyAll(); setEditing(true); syncColorInputs(); syncBgControls(); dirty = false;
      $("#adm-status", panel).textContent = "Alterações descartadas."; updatePanelStatus(true);
    });
    $("#adm-exit", panel).addEventListener("click", () => {
      if (countChanges() > 0 && !confirm("Há alterações não salvas. Sair mesmo assim?")) return;
      content = JSON.parse(JSON.stringify(saved)); pending.clear(); previews.clear();
      applyAll(); setEditing(false); panel.remove(); panel = null; session = null;
      $("#admin-link").textContent = "Admin";
    });
    syncBgControls(); updatePanelStatus(true);
  }
  function syncColorInputs() {
    panel.querySelectorAll(".adm-color input").forEach(i => { i.value = content.vars[i.dataset.var] || cleanVars[i.dataset.var] || "#000000"; });
  }
  function syncBgControls() {
    if (!panel) return;
    const b = content.bg[currentPage()];
    $("#adm-dim", panel).value = b ? Math.round((b.dim || 0) * 100) : 0;
    $("#adm-dim-v", panel).textContent = $("#adm-dim", panel).value + "%";
    $("#adm-dim", panel).disabled = !b; $("#adm-bg-rm", panel).disabled = !b;
  }
  function updatePanelStatus(clear) {
    if (!panel) return;
    const n = countChanges();
    $("#adm-changes", panel).textContent = n ? `${n} alteração(ões) não salva(s)` : "Tudo salvo.";
    if (!clear && !$("#adm-status", panel).textContent.startsWith("Enviando")) $("#adm-status", panel).textContent = "";
  }
  window.addEventListener("hashchange", () => setTimeout(syncBgControls, 0));

  /* ---------- login / configuração ---------- */
  function guessRepo() {
    const h = location.hostname;
    if (!h.endsWith(".github.io")) return "";
    const owner = h.split(".")[0];
    const seg = location.pathname.split("/").filter(Boolean)[0];
    const repo = seg && !/\.(html?|json)$/i.test(seg) ? seg : h;
    return owner + "/" + repo;
  }
  function modal(html) {
    const bd = el("div", "adm-backdrop");
    const m = el("div", "adm-modal", html);
    bd.appendChild(m); document.body.appendChild(bd);
    bd.addEventListener("mousedown", ev => { if (ev.target === bd) bd.remove(); });
    return { bd, m, close: () => bd.remove() };
  }
  async function enterAdmin(sess) {
    session = sess;
    saved = JSON.parse(JSON.stringify(content));
    buildPanel(); setEditing(true);
    $("#admin-link").textContent = "Admin (ativo)";
  }
  function openLogin() {
    if (panel) { panel.classList.remove("min"); return; }
    const vault = readVault();
    if (vault) {
      const { m, close } = modal(`
        <h3>Entrar no painel</h3>
        <p class="adm-small">Repositório: <code>${vault.owner}/${vault.repo}</code></p>
        <form id="f"><input type="password" id="pw" placeholder="Sua senha do admin" autocomplete="current-password" required autofocus>
        <div class="adm-err" id="err"></div>
        <button class="primary" type="submit">Entrar</button></form>
        <a href="#" id="reset" class="adm-small">Esqueci a senha / reconfigurar</a>`);
      $("#f", m).addEventListener("submit", async ev => {
        ev.preventDefault(); const err = $("#err", m); err.textContent = "Verificando…";
        try {
          let p;
          try { p = await decryptVault($("#pw", m).value, vault.v); } catch (e) { throw new Error("Senha incorreta."); }
          const s = await verifyToken(p.token, vault.owner, vault.repo);
          close(); enterAdmin(s);
        } catch (e) { err.textContent = e.message; }
      });
      $("#reset", m).addEventListener("click", ev => {
        ev.preventDefault();
        if (confirm("Isso apaga o token salvo neste navegador. Você precisará colar o token do GitHub de novo. Continuar?")) {
          localStorage.removeItem(VAULT_KEY); close(); openLogin();
        }
      });
    } else {
      const { m, close } = modal(`
        <h3>Configurar o painel (1ª vez)</h3>
        <form id="f">
          <label>Repositório (dono/nome)<input id="repo" value="${guessRepo()}" placeholder="seuusuario/seurepositorio" required></label>
          <label>Token do GitHub<input id="tok" type="password" placeholder="github_pat_…" autocomplete="off" required></label>
          <label>Crie uma senha para o admin<input id="pw" type="password" minlength="6" placeholder="mínimo 6 caracteres" autocomplete="new-password" required></label>
          <p class="adm-small">O token fica criptografado só neste navegador e é protegido pela sua senha. Nas próximas vezes você digita apenas a senha.</p>
          <div class="adm-err" id="err"></div>
          <button class="primary" type="submit">Configurar e entrar</button>
        </form>`);
      $("#f", m).addEventListener("submit", async ev => {
        ev.preventDefault(); const err = $("#err", m); err.textContent = "Verificando…";
        try {
          const [owner, repo] = $("#repo", m).value.trim().replace(/^https?:\/\/github\.com\//, "").split("/");
          if (!owner || !repo) throw new Error("Use o formato dono/repositório.");
          const token = $("#tok", m).value.trim();
          const s = await verifyToken(token, owner, repo);
          const v = await encryptVault($("#pw", m).value, { token });
          localStorage.setItem(VAULT_KEY, JSON.stringify({ owner, repo, v }));
          close(); enterAdmin(s);
        } catch (e) { err.textContent = e.message; }
      });
    }
  }

  /* ---------- inicialização ---------- */
  async function init() {
    VARS.forEach(([k]) => { cleanVars[k] = getComputedStyle(document.documentElement).getPropertyValue(k).trim(); });
    indexElements();
    try {
      const r = await fetch("content.json?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        content = { text: j.text || {}, images: j.images || {}, vars: j.vars || {}, bg: j.bg || {} };
      }
    } catch (e) { /* sem content.json: usa o padrão */ }
    applyAll();
    $("#admin-link").addEventListener("click", ev => { ev.preventDefault(); openLogin(); });
    if (/[?&]admin\b/.test(location.search)) openLogin();
  }
  init();
})();
