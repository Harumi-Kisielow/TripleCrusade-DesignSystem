/* ============================================================
   Triple Crusade — Design System: navegação, cores e demos
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 1. Navegação vertical por seções ---------- */
  const nav = document.getElementById("nav");
  const burger = document.getElementById("burger");
  const pagesNow = () => Array.from(document.querySelectorAll(".page"));
  const PAGE_ORDER = ["home", "fundamentos", "identidade", "ilustracao", "interacoes", "componentes", "presskit"];
  let HOME = "home";

  function orderPages() {
    const main = document.querySelector("main");
    if (!main) return;
    const rank = id => {
      const index = PAGE_ORDER.indexOf(id);
      return index < 0 ? PAGE_ORDER.length : index;
    };
    const ordered = pagesNow().sort((a, b) => rank(a.id) - rank(b.id));
    ordered.forEach((page, index) => {
      if (main.children[index] !== page) main.insertBefore(page, main.children[index] || null);
    });
  }
  orderPages();
  document.body.classList.add("tc-page-mode");

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollTo = element => requestAnimationFrame(() => {
    if (element && element.isConnected) element.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  });

  function setCurrentPage(id) {
    const pages = pagesNow();
    if (!pages.some(p => p.id === id)) return;
    const changed = document.body.dataset.page !== id;
    document.body.dataset.page = id;
    pages.forEach(p => p.classList.toggle("active", p.id === id));
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === id));
    if (changed) document.dispatchEvent(new CustomEvent("ds:page", { detail: id }));
  }

  function show(id, keepScroll) {
    const pages = pagesNow();
    if (!pages.some(p => p.id === id)) id = pages.some(p => p.id === HOME) ? HOME : (pages[0] && pages[0].id);
    setCurrentPage(id);
    buildSectionRail();
    if (nav) nav.classList.remove("open");
    if (burger) burger.setAttribute("aria-expanded", "false");
    if (!keepScroll) window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function route() {
    let h = ""; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { h = location.hash.slice(1); }
    if (!h) {
      show(HOME, true);
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      return;
    }
    if (pagesNow().some(p => p.id === h)) {
      show(h, false);
      return;
    }
    const t = h && document.getElementById(h);
    if (t && t.closest(".page")) {
      const pg = t.closest(".page");
      if (!pg.classList.contains("active")) show(pg.id, true);
      scrollTo(t);
      return;
    }
    show(h, false);
  }
  window.addEventListener("hashchange", route);

  function pageName(page) {
    const navLabel = document.querySelector(`[data-nav="${page.id}"]`);
    if (navLabel) return navLabel.textContent.trim();
    const heading = page.querySelector("h1");
    return heading ? heading.textContent.trim() : page.id;
  }

  function buildSectionRail() {
    pagesNow().forEach(page => {
      Array.from(page.querySelectorAll(":scope > h2, :scope > h3"))
        .forEach((heading, index) => headingId(page, heading, index));
    });
    let rail = document.getElementById("tc-section-rail");
    if (!rail) {
      rail = document.createElement("aside");
      rail.id = "tc-section-rail";
      rail.className = "tc-section-rail";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "tc-section-rail-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", "tc-section-rail-links");
      toggle.textContent = "☷";
      toggle.addEventListener("click", () => {
        const open = rail.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", (open ? "Fechar tópicos de " : "Abrir tópicos de ") + toggle.dataset.pageName);
      });
      const links = document.createElement("nav");
      links.id = "tc-section-rail-links";
      links.className = "tc-section-rail-links";
      links.setAttribute("aria-label", "Tópicos da página");
      links.addEventListener("click", event => {
        if (!event.target.closest("a")) return;
        rail.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir tópicos de " + toggle.dataset.pageName);
      });
      rail.addEventListener("keydown", event => {
        if (event.key !== "Escape" || !rail.classList.contains("is-open")) return;
        rail.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir tópicos de " + toggle.dataset.pageName);
        toggle.focus();
      });
      rail.append(toggle, links);
      const header = document.querySelector(".topbar");
      if (header && header.parentNode) header.parentNode.insertBefore(rail, header.nextSibling);
    }
    const page = document.querySelector(".page.active") || document.getElementById(HOME);
    const links = rail.querySelector(".tc-section-rail-links");
    const toggle = rail.querySelector(".tc-section-rail-toggle");
    if (!page || !links || !toggle) return;
    links.replaceChildren();
    rail.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.dataset.pageName = pageName(page);
    toggle.setAttribute("aria-label", "Abrir tópicos de " + toggle.dataset.pageName);
    rail.setAttribute("aria-label", "Navegação em " + pageName(page));
    let headings = Array.from(page.querySelectorAll(":scope > h2, :scope > h3"));
    if (!headings.length) headings = [page];
    headings.forEach((heading, index) => {
      const link = document.createElement("a");
      const targetId = heading === page ? page.id : headingId(page, heading, index);
      link.href = "#" + targetId;
      link.dataset.tcSection = targetId;
      const label = heading === page ? pageName(page) : heading.textContent.trim();
      link.setAttribute("aria-label", label);
      const number = document.createElement("span");
      number.className = "tc-section-rail-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("span");
      name.className = "tc-section-rail-name";
      name.textContent = label;
      link.append(number, name);
      links.appendChild(link);
    });
    updateSectionRail();
  }

  function buildScrollProgress() {
    if (document.querySelector(".tc-scroll-progress")) return;
    const progress = document.createElement("div");
    progress.className = "tc-scroll-progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "Progresso de leitura");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", "0");
    document.body.appendChild(progress);
  }

  function headingId(page, heading, index) {
    if (heading.id) return heading.id;
    const base = (page.id + "-" + heading.textContent)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || page.id + "-topico";
    let id = base, suffix = index + 1;
    while (document.getElementById(id)) id = base + "-" + suffix++;
    heading.id = id;
    return id;
  }

  function updateSectionRail() {
    const page = document.querySelector(".page.active");
    const rail = document.getElementById("tc-section-rail");
    if (!page || !rail) return;
    const point = window.innerHeight * 0.34;
    const links = Array.from(rail.querySelectorAll("[data-tc-section]"));
    let active = links[0];
    links.forEach(link => {
      const target = document.getElementById(link.dataset.tcSection);
      if (target && target.getBoundingClientRect().top <= point) active = link;
    });
    links.forEach(link => {
      if (link === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function addCarousel(container, label, showCount = true) {
    if (container.dataset.tcCarousel) {
      const existingControls = container.tcCarouselControls;
      if (existingControls && existingControls.parentNode === container.parentNode) {
        container.parentNode.insertBefore(existingControls, container);
        existingControls.classList.toggle("tc-carousel-controls--selectable", !showCount);
      }
      if (container.tcCarouselCount) container.tcCarouselCount.hidden = !showCount;
      if (container.tcCarouselRefresh) container.tcCarouselRefresh();
      return;
    }
    container.dataset.tcCarousel = "true";
    container.classList.add("tc-carousel");
    container.tabIndex = 0;
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", label);
    const controls = document.createElement("div");
    controls.className = "tc-carousel-controls";
    if (!showCount) controls.classList.add("tc-carousel-controls--selectable");
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Controles: " + label);
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "tc-carousel-button";
    previous.setAttribute("aria-label", "Anterior: " + label);
    previous.textContent = "←";
    const count = showCount ? document.createElement("span") : null;
    if (count) {
      count.className = "tc-carousel-count";
      count.setAttribute("aria-live", "polite");
    }
    const next = document.createElement("button");
    next.type = "button";
    next.className = "tc-carousel-button";
    next.setAttribute("aria-label", "Próximo: " + label);
    next.textContent = "→";
    controls.append(previous);
    if (count) controls.append(count);
    controls.append(next);
    container.parentNode.insertBefore(controls, container);
    container.tcCarouselControls = controls;
    container.tcCarouselCount = count;

    let items = [];
    const update = () => {
      items = Array.from(container.children).filter(item => !item.classList.contains("ds-hidden"));
      if (!items.length) {
        if (count) count.textContent = "00 / 00";
        previous.disabled = true;
        next.disabled = true;
        return;
      }
      const active = items.reduce((best, item, i) =>
        Math.abs(item.getBoundingClientRect().left - container.getBoundingClientRect().left) <
        Math.abs(items[best].getBoundingClientRect().left - container.getBoundingClientRect().left) ? i : best, 0);
      previous.disabled = active <= 0;
      next.disabled = active >= items.length - 1;
      if (count) count.textContent = String(active + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
    };
    const move = direction => {
      if (!items.length) return;
      const current = items.reduce((best, item, i) =>
        Math.abs(item.getBoundingClientRect().left - container.getBoundingClientRect().left) <
        Math.abs(items[best].getBoundingClientRect().left - container.getBoundingClientRect().left) ? i : best, 0);
      const target = items[Math.max(0, Math.min(items.length - 1, current + direction))];
      const delta = target.getBoundingClientRect().left - container.getBoundingClientRect().left;
      container.scrollTo({ left: container.scrollLeft + delta, behavior: reducedMotion() ? "auto" : "smooth" });
    };
    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));
    container.addEventListener("scroll", update, { passive: true });
    container.querySelectorAll("img").forEach(image => image.addEventListener("load", update, { once: true }));
    container.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      }
    });
    container.tcCarouselRefresh = update;
    window.addEventListener("resize", update);
    update();
  }

  function buildCarousels() {
    pagesNow().forEach(page => {
      page.querySelectorAll(".img-grid:not(.tc-scene-gallery), .pk-shots").forEach((container, index) => {
        const asset = container.closest(".pk-asset");
        let heading = asset && asset.querySelector(":scope > h3");
        let previous = container.previousElementSibling;
        while (!heading && previous) {
          if (previous.matches("h2, h3")) heading = previous;
          else heading = previous.querySelector && previous.querySelector("h2, h3");
          previous = previous.previousElementSibling;
        }
        const label = heading ? heading.textContent.trim() : pageName(page) + " · galeria " + (index + 1);
        addCarousel(container, label);
      });
    });
  }

  function buildCharacterCarousel() {
    const page = document.getElementById("ilustracao");
    const heading = page && page.querySelector('[data-b="b188"]');
    if (!heading) return;
    const existing = page.querySelector(".tc-character-stage");
    if (existing) {
      if (heading.nextElementSibling !== existing) heading.after(existing);
      if (existing.tcCharacterRefresh) existing.tcCharacterRefresh();
      return;
    }
    const characters = [
      { id: "chizuru", name: "Chizuru", image: "imgs/personagens/chizuru.png" },
      { id: "axel", name: "Axel", image: "imgs/personagens/axel.png" },
      { id: "harry", name: "Harry", image: "imgs/personagens/harry.png" }
    ];
    const stage = document.createElement("section");
    stage.className = "tc-character-stage";
    stage.setAttribute("aria-label", "Protagonistas (rotas)");
    stage.tabIndex = 0;
    const visual = document.createElement("div");
    visual.className = "tc-character-visual";
    const image = document.createElement("img");
    image.className = "tc-character-image";
    image.src = characters[0].image;
    image.alt = characters[0].name;
    visual.appendChild(image);
    const details = document.createElement("div");
    details.className = "tc-character-details";
    const eyebrow = document.createElement("p");
    eyebrow.className = "tc-character-role";
    eyebrow.textContent = "Protagonistas (rotas)";
    const name = document.createElement("h4");
    name.className = "tc-character-name";
    name.setAttribute("aria-live", "polite");
    name.textContent = characters[0].name;
    const description = document.createElement("p");
    description.className = "tc-character-description";
    description.dataset.b = "tc-character-description";
    description.textContent = "A escolha do protagonista define a rota narrativa.";
    const controls = document.createElement("div");
    controls.className = "tc-character-controls";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "tc-character-arrow";
    previous.setAttribute("aria-label", "Personagem anterior");
    previous.textContent = "←";
    const counter = document.createElement("span");
    counter.className = "tc-character-counter";
    counter.setAttribute("aria-live", "polite");
    counter.textContent = "01 / 03";
    const next = document.createElement("button");
    next.type = "button";
    next.className = "tc-character-arrow";
    next.setAttribute("aria-label", "Próximo personagem");
    next.textContent = "→";
    controls.append(previous, counter, next);
    const tabs = document.createElement("div");
    tabs.className = "tc-character-tabs";
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Selecionar protagonista");
    const selectors = characters.map((character, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tc-character-tab";
      button.setAttribute("aria-label", character.name);
      button.setAttribute("aria-pressed", String(index === 0));
      const thumb = document.createElement("img");
      thumb.dataset.b = "tc-character-image-" + character.id;
      thumb.src = character.image;
      thumb.alt = "";
      thumb.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.dataset.b = "tc-character-name-" + character.id;
      label.textContent = character.name;
      button.append(thumb, label);
      button.addEventListener("click", () => select(index));
      tabs.appendChild(button);
      return button;
    });
    details.append(eyebrow, name, description, controls, tabs);
    stage.append(visual, details);
    heading.after(stage);
    let active = 0;
    function currentCharacter(index) {
      const button = selectors[index];
      const thumb = button.querySelector("img");
      const label = button.querySelector("span");
      return {
        image: thumb.currentSrc || thumb.src,
        name: label.textContent.trim() || "Personagem " + (index + 1)
      };
    }
    function select(index) {
      active = (index + characters.length) % characters.length;
      const character = currentCharacter(active);
      stage.classList.add("is-changing");
      window.setTimeout(() => {
        image.src = character.image;
        image.alt = character.name;
        name.textContent = character.name;
        counter.textContent = String(active + 1).padStart(2, "0") + " / " + String(characters.length).padStart(2, "0");
        selectors.forEach((button, i) => {
          button.setAttribute("aria-label", currentCharacter(i).name);
          button.setAttribute("aria-pressed", String(i === active));
        });
        requestAnimationFrame(() => stage.classList.remove("is-changing"));
      }, reducedMotion() ? 0 : 140);
    }
    stage.tcCharacterRefresh = () => select(active);
    previous.addEventListener("click", () => select(active - 1));
    next.addEventListener("click", () => select(active + 1));
    stage.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        select(active + (event.key === "ArrowRight" ? 1 : -1));
      }
    });
    select(0);
  }

  function buildHomeCardsCarousel() {
    const track = document.querySelector("#home .cards[data-b='b39']");
    if (!track) return;
    const slides = Array.from(track.children).filter(item => item.matches(".card, .gate-card"));
    if (!slides.length) return;
    slides.forEach(slide => slide.classList.add("tc-home-card-slide"));
    const originalBackgrounds = new Map(slides.map(item => [
      item,
      item.style.backgroundImage || getComputedStyle(item).backgroundImage
    ]));
    track.classList.add("tc-home-cards-carousel");
    track.setAttribute("role", "region");
    track.setAttribute("aria-label", "Seções do guia");

    let controls = track.querySelector(":scope > .tc-home-card-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "tc-home-card-controls";
      controls.setAttribute("role", "group");
      controls.setAttribute("aria-label", "Navegar pelas seções");
      const previous = document.createElement("button");
      previous.type = "button";
      previous.className = "tc-home-card-arrow";
      previous.setAttribute("aria-label", "Seção anterior");
      previous.textContent = "←";
      const tabs = document.createElement("div");
      tabs.className = "tc-home-card-tabs";
      tabs.setAttribute("role", "group");
      tabs.setAttribute("aria-label", "Selecionar seção");
      const next = document.createElement("button");
      next.type = "button";
      next.className = "tc-home-card-arrow";
      next.setAttribute("aria-label", "Próxima seção");
      next.textContent = "→";
      controls.append(previous, tabs, next);
      track.insertBefore(controls, slides[0]);
    }

    const previous = controls.querySelector(".tc-home-card-arrow:first-child");
    const next = controls.querySelector(".tc-home-card-arrow:last-child");
    const tabs = controls.querySelector(".tc-home-card-tabs");
    if (!previous || !next || !tabs) return;
    if (!controls.dataset.ready) {
      slides.forEach((slide, index) => {
        const title = slide.querySelector("h2, h3");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tc-home-card-tab";
        button.textContent = title ? title.textContent.trim() : "Seção";
        button.addEventListener("click", () => select(index));
        tabs.appendChild(button);
      });
      previous.addEventListener("click", () => select(active - 1));
      next.addEventListener("click", () => select(active + 1));
      track.addEventListener("keydown", event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          select(active + (event.key === "ArrowRight" ? 1 : -1));
        }
      });
      controls.dataset.ready = "true";
    }

    slides.forEach(slide => {
      const art = slide.style.backgroundImage || originalBackgrounds.get(slide);
      if (art && art !== "none") slide.style.setProperty("--tc-home-card-art", art);
      const size = slide.style.backgroundSize || getComputedStyle(slide).backgroundSize;
      const position = slide.style.backgroundPosition || getComputedStyle(slide).backgroundPosition;
      slide.style.setProperty("--tc-home-card-art-size", size || "cover");
      slide.style.setProperty("--tc-home-card-art-position", position || "center");
    });

    let active = Number(track.dataset.tcHomeIndex) || 0;
    let changeTimer = 0;
    function select(index) {
      const selectedIndex = (index + slides.length) % slides.length;
      const changed = selectedIndex !== active || !slides[selectedIndex].classList.contains("is-active");
      active = selectedIndex;
      track.dataset.tcHomeIndex = String(active);
      slides.forEach((slide, i) => {
        const selected = i === active;
        slide.classList.toggle("is-active", selected);
        slide.classList.toggle("tc-revealed", selected);
        slide.setAttribute("aria-hidden", String(!selected));
        tabs.children[i].setAttribute("aria-pressed", String(selected));
      });
      if (!changed) return;
      track.classList.add("is-changing");
      window.clearTimeout(changeTimer);
      changeTimer = window.setTimeout(() => requestAnimationFrame(() => track.classList.remove("is-changing")), reducedMotion() ? 0 : 120);
    }
    active = Math.min(active, slides.length - 1);
    select(active);
  }

  function buildSceneCarousel() {
    const page = document.getElementById("ilustracao");
    const gallery = page && page.querySelector('[data-b="b173"]');
    const heading = page && page.querySelector('[data-b="b177"]');
    const documents = page && page.querySelector('[data-b="b178"]');
    if (!gallery || !heading || !documents) return;

    gallery.classList.add("tc-scene-stage");
    if (heading.parentElement !== gallery) gallery.appendChild(heading);
    if (documents.parentElement !== gallery) gallery.appendChild(documents);
    documents.classList.add("tc-scene-docs");
    const slides = Array.from(gallery.querySelectorAll(":scope > .img-slot"));
    const articles = Array.from(documents.querySelectorAll(":scope > .doc"));
    slides.forEach(slide => slide.classList.add("tc-scene-slide"));
    gallery.tabIndex = 0;
    gallery.setAttribute("role", "region");
    gallery.setAttribute("aria-label", "Concept art de cenários");
    if (gallery.dataset.tcSceneCarousel) {
      gallery.querySelectorAll(".tc-scene-tab").forEach((button, index) => {
        const title = articles[index] && articles[index].querySelector("h4");
        button.textContent = title ? title.textContent.trim() : "Cenário " + (index + 1);
      });
      return;
    }

    if (!slides.length || !articles.length || slides.length !== articles.length) return;
    const controls = document.createElement("div");
    controls.className = "tc-scene-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Navegação de cenários");
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "tc-carousel-button";
    previous.setAttribute("aria-label", "Cenário anterior");
    previous.textContent = "←";
    const count = document.createElement("span");
    count.className = "tc-carousel-count";
    count.setAttribute("aria-live", "polite");
    const next = document.createElement("button");
    next.type = "button";
    next.className = "tc-carousel-button";
    next.setAttribute("aria-label", "Próximo cenário");
    next.textContent = "→";
    controls.append(previous, count, next);
    const selectors = document.createElement("div");
    selectors.className = "tc-scene-tabs";
    selectors.setAttribute("role", "group");
    selectors.setAttribute("aria-label", "Selecionar cenário");
    const buttons = articles.map((article, index) => {
      const title = article.querySelector("h4");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tc-scene-tab";
      button.textContent = title ? title.textContent.trim() : "Cenário " + (index + 1);
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => select(index));
      selectors.appendChild(button);
      return button;
    });
    gallery.append(controls, selectors);
    let active = 0;
    function select(index) {
      active = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        slide.classList.toggle("is-active", i === active);
        slide.setAttribute("aria-hidden", String(i !== active));
        if (i === active) slide.classList.add("tc-revealed");
      });
      articles.forEach((article, i) => {
        article.classList.toggle("is-active", i === active);
        article.setAttribute("aria-hidden", String(i !== active));
        if (i === active) article.classList.add("tc-revealed");
      });
      buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === active)));
      count.textContent = String(active + 1).padStart(2, "0") + " / " + String(slides.length).padStart(2, "0");
      previous.disabled = active === 0;
      next.disabled = active === slides.length - 1;
    }
    previous.addEventListener("click", () => select(active - 1));
    next.addEventListener("click", () => select(active + 1));
    gallery.addEventListener("keydown", event => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        select(active + (event.key === "ArrowRight" ? 1 : -1));
      }
    });
    gallery.dataset.tcSceneCarousel = "true";
    select(0);
  }

  function buildComponentCarousels() {
    const component = document.getElementById("componentes");
    if (!component) return;
    const elementIcons = component.querySelector('[data-b="b278"]');
    const elementLabels = component.querySelector('[data-b="nmw9bf3b8dn99"]');
    const statusIcons = component.querySelector('[data-b="nmw9bf9btt611"]');
    const statusLabels = component.querySelector('[data-b="nmw9bb9kt6zzy"]');
    if (elementLabels) elementLabels.classList.add("tc-carousel-source-labels");
    if (statusLabels) statusLabels.classList.add("tc-carousel-source-labels");

    const groups = [
      [component.querySelector(".party-row"), "Cartões de personagens"],
      [elementIcons, "Elementos"],
      [component.querySelector(".affinity-row"), "Afinidades"],
      [statusIcons, "Status"]
    ];
    groups.forEach(([container, label]) => {
      if (!container) return;
      addCarousel(container, label, false);
      const items = Array.from(container.children).filter(item => !item.classList.contains("ds-hidden"));
      if (!items.length) {
        if (container.tcCarouselSelectorGroup) container.tcCarouselSelectorGroup.remove();
        container.tcCarouselSelectorGroup = null;
        container.tcCarouselItems = [];
        container.tcCarouselSelectors = [];
        container.tcCarouselSync = null;
        container.dataset.tcSelectable = "";
        return;
      }
      if (container.dataset.tcSelectable) {
        const sameItems = container.tcCarouselItems &&
          container.tcCarouselItems.length === items.length &&
          container.tcCarouselItems.every((item, index) => item === items[index]);
        if (sameItems) {
          if (container.tcCarouselSync) container.tcCarouselSync();
          return;
        }
        if (container.tcCarouselSelectorGroup) container.tcCarouselSelectorGroup.remove();
      }

      container.dataset.tcSelectable = "true";
      const controls = container.tcCarouselControls;
      const selectorGroup = document.createElement("div");
      container.tcCarouselSelectorGroup = selectorGroup;
      selectorGroup.className = "tc-carousel-selectors";
      selectorGroup.setAttribute("role", "group");
      selectorGroup.setAttribute("aria-label", "Selecionar " + label.toLowerCase());
      const selectors = items.map((item, index) => {
        const caption = item.querySelector(".tc-component-item-name") || item.querySelector(".pc-name") || item.querySelector(".affinity-name");
        const itemLabel = caption ? caption.textContent.trim() : item.getAttribute("aria-label") || item.textContent.trim();
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tc-carousel-selector";
        button.textContent = itemLabel.split(":")[0].trim();
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => moveTo(index));
        selectorGroup.appendChild(button);
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute("aria-pressed", "false");
        return button;
      });
      container.tcCarouselItems = items.slice();
      const next = controls.querySelector(".tc-carousel-button:last-child");
      controls.insertBefore(selectorGroup, next);
      container.tcCarouselSelectors = selectors;
      function currentIndex() {
        return items.reduce((best, item, i) =>
          Math.abs(item.getBoundingClientRect().left - container.getBoundingClientRect().left) <
          Math.abs(items[best].getBoundingClientRect().left - container.getBoundingClientRect().left) ? i : best, 0);
      }
      function sync() {
        const active = currentIndex();
        items.forEach((item, i) => {
          const selected = i === active;
          item.classList.toggle("is-selected", selected);
          item.setAttribute("aria-pressed", String(selected));
          selectors[i].setAttribute("aria-pressed", String(selected));
        });
      }
      function moveTo(index) {
        const currentItems = container.tcCarouselItems || items;
        const item = currentItems[Math.max(0, Math.min(currentItems.length - 1, index))];
        if (!item) return;
        const delta = item.getBoundingClientRect().left - container.getBoundingClientRect().left;
        container.scrollTo({ left: container.scrollLeft + delta, behavior: reducedMotion() ? "auto" : "smooth" });
      }
      container.tcCarouselMoveTo = moveTo;
      if (!container.tcCarouselItemEvents) {
        container.addEventListener("click", event => {
          const item = event.target.closest("[data-b]");
          if (!item || item.parentElement !== container) return;
          const index = item && (container.tcCarouselItems || []).indexOf(item);
          if (index >= 0) container.tcCarouselMoveTo(index);
        });
        container.addEventListener("keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const item = event.target.closest("[data-b]");
          if (!item || item.parentElement !== container) return;
          const index = item && (container.tcCarouselItems || []).indexOf(item);
          if (index < 0) return;
          event.preventDefault();
          container.tcCarouselMoveTo(index);
        });
        container.addEventListener("scroll", () => {
          if (container.tcCarouselSync) container.tcCarouselSync();
        }, { passive: true });
        container.tcCarouselItemEvents = true;
      }
      container.tcCarouselSync = sync;
      sync();
    });

    [[elementIcons, elementLabels], [statusIcons, statusLabels]].forEach(([icons, labels]) => {
      if (!icons || !labels) return;
      Array.from(icons.children).forEach((item, index) => {
        const source = labels.children[index];
        const text = source && source.textContent.trim();
        if (!text) return;
        let caption = item.querySelector(".tc-component-item-copy");
        if (!caption) {
          caption = document.createElement("span");
          caption.className = "tc-component-item-copy";
          item.appendChild(caption);
        }
        let name = caption.querySelector(".tc-component-item-name");
        if (!name) {
          name = document.createElement("strong");
          name.className = "tc-component-item-name";
          caption.appendChild(name);
        }
        name.textContent = text.split(":")[0].trim();
        let description = caption.querySelector(".tc-component-item-description");
        const detail = text.includes(":") ? text.slice(text.indexOf(":") + 1).trim() : "";
        if (detail) {
          if (!description) {
            description = document.createElement("span");
            description.className = "tc-component-item-description";
            caption.appendChild(description);
          }
          description.textContent = detail;
        } else if (description) description.remove();
        item.setAttribute("aria-label", text);
        item.setAttribute("title", text);
      });
      if (icons.tcCarouselSelectors) {
        Array.from(icons.tcCarouselSelectors).forEach((button, index) => {
          const item = icons.children[index];
          const name = item && item.querySelector(".tc-component-item-name");
          if (name) button.textContent = name.textContent;
        });
      }
    });
  }

  function setupReveals() {
    if (reducedMotion() || !("IntersectionObserver" in window)) return;
    const targets = document.querySelectorAll(
      ".page > h1, .page > .lead, .page > .hero, .page > .cards, .page > .img-slot, .page > h2, " +
      ".page .doc, .page .card, .page .pk-member, .page .pk-asset, .page .img-slot, .page .callout, .page .swatch, " +
      ".tc-character-stage, .tc-home-cards-carousel, .tc-scene-stage"
    );
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("tc-revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    targets.forEach(target => {
      if (target.classList.contains("tc-reveal")) return;
      target.classList.add("tc-reveal");
      observer.observe(target);
    });
  }

  function enhanceSite() {
    orderPages();
    buildSectionRail();
    buildScrollProgress();
    buildHomeCardsCarousel();
    buildSceneCarousel();
    buildCarousels();
    buildCharacterCarousel();
    buildComponentCarousels();
    setupReveals();
    syncScrollState();
  }

  let scrollFrame = 0;
  function syncScrollState() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.round(Math.max(0, Math.min(1, window.scrollY / maxScroll)) * 100);
      const progressBar = document.querySelector(".tc-scroll-progress");
      if (progressBar) {
        progressBar.style.setProperty("--tc-scroll-progress", progress / 100);
        progressBar.setAttribute("aria-valuenow", String(progress));
      }
      const current = document.querySelector(".page.active");
      if (current) {
        updateSectionRail();
      }
      const hero = current && current.querySelector(".hero");
      if (hero && !reducedMotion()) {
        const rect = hero.getBoundingClientRect();
        const offset = Math.max(-18, Math.min(18, (rect.top - window.innerHeight * 0.3) * -0.035));
        hero.style.setProperty("--tc-parallax-y", offset.toFixed(1) + "px");
      }
    });
  }
  window.addEventListener("scroll", syncScrollState, { passive: true });
  window.addEventListener("resize", syncScrollState, { passive: true });
  buildSectionRail();
  buildScrollProgress();
  buildHomeCardsCarousel();
  buildSceneCarousel();
  buildCarousels();
  buildCharacterCarousel();
  buildComponentCarousels();
  setupReveals();
  document.addEventListener("ds:content-applied", enhanceSite);
  document.addEventListener("ds:content-updated", enhanceSite);
  if ("MutationObserver" in window) {
    const main = document.querySelector("main");
    if (main) {
      let enhanceTimer = 0;
      new MutationObserver(() => {
        clearTimeout(enhanceTimer);
        enhanceTimer = setTimeout(enhanceSite, 80);
      }).observe(main, { childList: true });
    }
  }

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
  if (burger && nav) burger.addEventListener("click", () => {
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
    let hex = (el.dataset.hex || rootStyle.getPropertyValue(el.dataset.var || "")).trim();
    if (/^#[0-9a-f]{3}$/i.test(hex)) hex = "#" + [...hex.slice(1)].map(c => c + c).join("");
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    el.style.background = hex;
    el.style.color = readableText(hex);
    el.innerHTML = `<b>${el.dataset.label}</b>${hex.toUpperCase()}<br>${toRgb(hex)}`;
    el.title = "Clique para copiar";
    el.onclick = () => {
      if (document.body.classList.contains("editing")) return;
      navigator.clipboard && navigator.clipboard.writeText(hex.toUpperCase()).catch(() => {});
      const old = el.innerHTML;
      el.innerHTML = "<b>Copiado!</b>" + hex.toUpperCase();
      setTimeout(() => (el.innerHTML = old), 900);
    };
  });
  }
  renderSwatches();
  window.DS = { renderSwatches, show, route, special, setHome: id => { HOME = id; } };

  /* ---------- 2.1 Zoom spotlight de imagens ---------- */
  const spotlight = document.createElement("div");
  spotlight.className = "ds-spotlight";
  spotlight.hidden = true;
  spotlight.setAttribute("role", "dialog");
  spotlight.setAttribute("aria-modal", "true");
  spotlight.setAttribute("aria-label", "Imagem ampliada");
  const spotlightClose = document.createElement("button");
  spotlightClose.className = "ds-spotlight-close";
  spotlightClose.type = "button";
  spotlightClose.setAttribute("aria-label", "Fechar imagem ampliada");
  spotlightClose.textContent = "×";
  const spotlightImage = document.createElement("img");
  spotlightImage.className = "ds-spotlight-image";
  spotlight.append(spotlightImage, spotlightClose);
  document.body.appendChild(spotlight);
  let spotlightTrigger = null, spotlightTimer = 0;

  function closeSpotlight() {
    if (spotlight.hidden || spotlight.classList.contains("is-closing")) return;
    spotlight.classList.remove("is-open");
    spotlight.classList.add("is-closing");
    document.body.classList.remove("ds-spotlight-open");
    if (spotlightTrigger && spotlightTrigger.isConnected) spotlightTrigger.focus();
    spotlightTrigger = null;
    window.clearTimeout(spotlightTimer);
    spotlightTimer = window.setTimeout(() => {
      if (!spotlight.classList.contains("is-closing")) return;
      spotlight.hidden = true;
      spotlight.classList.remove("is-closing");
      spotlightImage.removeAttribute("src");
    }, reducedMotion() ? 0 : 220);
  }
  function openSpotlight(image) {
    window.clearTimeout(spotlightTimer);
    spotlightTrigger = image;
    spotlightImage.src = image.currentSrc || image.src;
    spotlightImage.alt = image.alt;
    spotlight.classList.remove("is-closing", "is-open");
    spotlight.hidden = false;
    void spotlight.offsetWidth;
    spotlight.classList.add("is-open");
    document.body.classList.add("ds-spotlight-open");
    spotlightClose.focus();
  }
  spotlightClose.addEventListener("click", closeSpotlight);
  document.addEventListener("click", event => {
    const image = event.target.closest && event.target.closest(".slot-img[data-spotlight='true'],img[data-spotlight='true']");
    if (!image || document.body.classList.contains("editing")) return;
    event.preventDefault();
    openSpotlight(image);
  });
  document.addEventListener("keydown", event => {
    if (!spotlight.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSpotlight();
      } else if (event.key === "Tab") {
        event.preventDefault();
        spotlightClose.focus();
      }
      return;
    }
    const image = event.target.closest && event.target.closest(".slot-img[data-spotlight='true'],img[data-spotlight='true']");
    if (image && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openSpotlight(image);
    }
  });

  /* ---------- 3. Menus de pedra: foco ao clicar ---------- */
  function focusGroup(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.querySelectorAll("button").forEach(b => {
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => {
        c.querySelectorAll("button").forEach(x => {
          x.classList.remove("focus", "active");
          x.setAttribute("aria-pressed", "false");
        });
        b.classList.add(c.id === "demo-tabs" ? "active" : "focus");
        b.setAttribute("aria-pressed", "true");
      });
    });

    const elementIcons = document.querySelector('#componentes [data-b="b278"]');
    const elementLabels = document.querySelector('#componentes [data-b="nmw9bf3b8dn99"]');
    const statusIcons = document.querySelector('#componentes [data-b="nmw9bf9btt611"]');
    const statusLabels = document.querySelector('#componentes [data-b="nmw9bb9kt6zzy"]');
    [[elementIcons, elementLabels], [statusIcons, statusLabels]].forEach(([icons, labels]) => {
      if (!icons || !labels) return;
      Array.from(icons.children).forEach((item, index) => {
        const label = labels.children[index];
        if (!label) return;
        const text = label.textContent.trim();
        if (text) {
          item.setAttribute("aria-label", text);
          item.setAttribute("title", text);
        }
      });
    });
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
