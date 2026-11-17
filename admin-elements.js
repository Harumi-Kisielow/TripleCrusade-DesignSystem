(function (global) {
  "use strict";

  const iconPaths = {
    sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    bolt: '<path d="M13 2 4 13h6l-1 9 11-13h-7l1-7Z"/>',
    shield: '<path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    x: '<path d="M4 4 20 20M20 4 4 20"/>',
    youtube: '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="m10 9 5 3-5 3V9Z"/>',
    discord: '<path d="M7 7c3-2 7-2 10 0l2 11c-2 1-3 1.5-5 2l-.8-1.5M7 7 5 18c2 1 3 1.5 5 2l.8-1.5M7 7 5 5c1-.7 2-1 3-1l1 2m8 1 2-2c-1-.7-2-1-3-1l-1 2"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>',
    tiktok: '<path d="M14 4v11a4 4 0 1 1-4-4"/><path d="M14 4c1 3 3 4 6 4"/>',
    facebook: '<path d="M14 21v-8h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.5C17.3 1.2 16.3 1 15 1c-4 0-5.5 2.4-5.5 5.5V9H7v4h2.5v8"/>',
    twitch: '<path d="M4 3h18v13l-5 5h-4l-3 3v-3H5V6l-1 1V3Z"/><path d="M11 8v5m5-5v5"/>',
    steam: '<circle cx="12" cy="12" r="10"/><circle cx="15.5" cy="8.5" r="3"/><circle cx="8" cy="15.5" r="2"/><path d="m9.8 14 3.2-3.2M6.2 14.7l-4-1.5"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>'
  };

  const iconNames = {
    sparkles: "Brilhos", star: "Estrela", bolt: "Raio", shield: "Escudo", arrow: "Seta",
    plus: "Mais", check: "Confirmar", instagram: "Instagram", x: "X / Twitter",
    youtube: "YouTube", discord: "Discord", tiktok: "TikTok", facebook: "Facebook",
    twitch: "Twitch", steam: "Steam", globe: "Web", mail: "E-mail"
  };

  const categories = [
    { title: "Texto e conteúdo", types: ["text", "title", "list", "table", "callout"] },
    { title: "Mídia", types: ["image", "gallery", "video", "audio", "animation"] },
    { title: "Ações e ícones", types: ["button", "icon", "timer", "anchor"] },
    { title: "Layout", types: ["box", "cols2", "cols3", "cols4", "hero", "divider", "space", "swatch"] }
  ];

  const labels = {
    text: "Texto", title: "Título", list: "Lista", table: "Tabela", callout: "Destaque",
    image: "Imagem", gallery: "Galeria", video: "Vídeo / YouTube", audio: "Áudio",
    animation: "GIF", button: "Botão / link", icon: "Ícone / rede social",
    timer: "Contagem regressiva", anchor: "Âncora", box: "Caixa", cols2: "2 colunas",
    cols3: "3 colunas", cols4: "4 colunas", hero: "Imagem + texto",
    divider: "Divisor", space: "Espaço", swatch: "Caixa de cor"
  };

  function renderIcon(element, options) {
    const config = options && typeof options === "object" ? options : {};
    const name = Object.prototype.hasOwnProperty.call(iconPaths, config.name) ? config.name : "sparkles";
    const color = /^#[0-9a-f]{6}$/i.test(config.color || "") ? config.color : "";
    const hover = /^#[0-9a-f]{6}$/i.test(config.hover || "") ? config.hover : "";
    element.classList.add("ds-icon");
    element.classList.toggle("ds-icon-outline", config.outline === true);
    if (color) element.style.color = color;
    else element.style.removeProperty("color");
    if (hover) element.style.setProperty("--ds-icon-hover", hover);
    else element.style.removeProperty("--ds-icon-hover");
    element.setAttribute("aria-label", iconNames[name]);
    element.title = iconNames[name];
    const stroke = config.outline === true ? "2.4" : "1.7";
    element.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`;
  }

  function createPresets(uniqueAnchor, makeColumns) {
    const box = () => ({ tag: "div", cls: "ds-box", children: [{ tag: "p", t: "Texto da caixa" }] });
    const imageSlot = n => ({ tag: "div", cls: "img-slot ds-gallery-slot", t: "Imagem " + n, s: { "min-height": "160px" } });
    return {
      text: () => ({ tag: "p", t: "Novo texto. Clique para editar." }),
      title: () => ({ tag: "h2", t: "Novo título" }),
      image: () => ({ tag: "div", cls: "img-slot", t: "Clique em 📷 para enviar a imagem", s: { "min-height": "180px" } }),
      animation: () => ({ tag: "div", cls: "img-slot ds-animation", t: "Envie um GIF animado para mostrar a animação", s: { "min-height": "180px" } }),
      divider: () => ({ tag: "hr", cls: "ds-divider" }),
      list: () => ({ tag: "ul", cls: "ds-list", children: [
        { tag: "li", t: "Primeiro item da lista" },
        { tag: "li", t: "Segundo item da lista" },
        { tag: "li", t: "Terceiro item da lista" }
      ] }),
      table: () => ({ tag: "table", cls: "tbl ds-table", children: [{ tag: "tbody", children: [
        { tag: "tr", children: [{ tag: "th", t: "Título" }, { tag: "th", t: "Descrição" }] },
        { tag: "tr", children: [{ tag: "td", t: "Item 1" }, { tag: "td", t: "Descrição do item" }] },
        { tag: "tr", children: [{ tag: "td", t: "Item 2" }, { tag: "td", t: "Descrição do item" }] }
      ] }] }),
      gallery: () => ({ tag: "div", cls: "ds-gallery", children: [imageSlot(1), imageSlot(2), imageSlot(3)] }),
      callout: () => ({ tag: "div", cls: "callout", children: [{ tag: "p", t: "Destaque ou observação importante." }] }),
      video: () => ({ tag: "div", cls: "ds-video-block", children: [
        { tag: "div", cls: "img-slot ds-video-poster", t: "Miniatura do YouTube (adicione o link)", s: { "aspect-ratio": "16 / 9", "min-height": "180px" } },
        { tag: "a", cls: "ds-video-link", attrs: { href: "#" }, t: "Assistir no YouTube" }
      ] }),
      audio: () => ({ tag: "audio", cls: "ds-audio", attrs: { controls: "controls", preload: "metadata" } }),
      button: () => ({ tag: "a", cls: "btn btn-primary", attrs: { href: "#" }, t: "Botão" }),
      box,
      cols: () => makeColumns(2),
      cols2: () => makeColumns(2),
      cols3: () => makeColumns(3),
      cols4: () => makeColumns(4),
      hero: () => ({ tag: "div", cls: "ds-box ds-hero", s: { "min-height": "280px" }, children: [{ tag: "h2", t: "Título sobre a imagem", s: { position: "absolute", left: "8%", top: "38%", color: "#ffffff", margin: "0" } }] }),
      space: () => ({ tag: "div", cls: "ds-space" }),
      icon: () => ({ tag: "a", cls: "ds-icon", attrs: {}, icon: { name: "sparkles" } }),
      timer: () => ({ tag: "div", cls: "ds-timer", t: "" }),
      anchor: () => ({ tag: "div", cls: "ds-anchor", attrs: { id: uniqueAnchor() } }),
      swatch: () => ({ tag: "div", cls: "swatch", sw: { label: "Nova cor", hex: "#8a8a8a" } })
    };
  }

  global.TCEditorElements = { categories, labels, iconNames, renderIcon, createPresets };
})(window);
