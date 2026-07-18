(() => {
  "use strict";

  /* ---------------------------------------------------------
     STATE
  --------------------------------------------------------- */
  let DATA = null;                 // parsed items.json
  let itemsById = {};
  let activeCategory = "All";
  let searchTerm = "";
  let currentDetailId = null;
  const BASKET_KEY = "ck_basket_v1";
  let basket = loadBasket();       // { [itemId]: qty }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------------------------------------------------
     PERSISTENCE
  --------------------------------------------------------- */
  function loadBasket() {
    try {
      const raw = localStorage.getItem(BASKET_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function saveBasket() {
    try { localStorage.setItem(BASKET_KEY, JSON.stringify(basket)); } catch (e) { /* ignore */ }
  }
  function basketCount() {
    return Object.values(basket).reduce((a, b) => a + b, 0);
  }

  /* ---------------------------------------------------------
     DATA LOADING
  --------------------------------------------------------- */
  async function loadData() {
    const res = await fetch("items.json");
    DATA = await res.json();
    DATA.items.forEach(it => { itemsById[it.id] = it; });
  }

  /* ---------------------------------------------------------
     ROUTING (hash-based so the device Back button works)
     #/list  #/item/<id>  #/basket  #/about
  --------------------------------------------------------- */
  function go(hash, replace = false) {
    if (replace) location.replace("#" + hash);
    else location.hash = hash;
  }

  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, "");
    if (h.startsWith("item/")) return { view: "detail", id: h.slice(5) };
    if (h === "basket") return { view: "basket" };
    if (h === "about") return { view: "about" };
    return { view: "list" };
  }

  let activeViewName = null;      // currently-shown view, for transition bookkeeping
  let viewTransitionTimer = null;

  function renderRoute() {
    const route = currentRoute();
    if (route.view === "detail") {
      currentDetailId = route.id;
      renderDetail(route.id);       // render content before it animates in
    }
    if (route.view === "basket") renderBasket();
    showView(route.view);
    setActiveNav(route.view === "detail" ? "list" : route.view);
  }

  function viewEl(name) { return $(`.view[data-view="${name}"]`); }

  function showView(view) {
    $("#bottomNav").style.display = (view === "detail") ? "none" : "flex";

    if (activeViewName === view) return;
    const newEl = viewEl(view);
    const oldEl = activeViewName ? viewEl(activeViewName) : null;
    if (!newEl) return;

    // If a previous transition is still finishing, snap it to completion first.
    if (viewTransitionTimer) { clearTimeout(viewTransitionTimer); viewTransitionTimer = null; }
    $$(".view").forEach(v => { if (v !== newEl && v !== oldEl) v.hidden = true; });

    const isDrillNav = (view === "detail" || activeViewName === "detail");
    const goingForward = view === "detail"; // list -> detail counts as "forward"

    newEl.hidden = false;
    newEl.style.transition = "none";
    newEl.style.opacity = isDrillNav ? "1" : "0";
    newEl.style.transform = isDrillNav ? (goingForward ? "translateX(100%)" : "translateX(-24%)") : "translateX(0)";
    if (oldEl) {
      oldEl.classList.add("is-leaving");
      oldEl.style.transition = "none";
      oldEl.style.transform = "translateX(0)";
      oldEl.style.opacity = "1";
    }
    // Force layout so the browser registers the "from" state before we animate to the "to" state.
    // eslint-disable-next-line no-unused-expressions
    newEl.offsetHeight;

    requestAnimationFrame(() => {
      newEl.style.transition = "";
      newEl.style.transform = "translateX(0)";
      newEl.style.opacity = "1";
      if (oldEl) {
        oldEl.style.transition = "";
        if (isDrillNav) {
          oldEl.style.transform = goingForward ? "translateX(-24%)" : "translateX(100%)";
          oldEl.style.opacity = "1";
        } else {
          oldEl.style.transform = "translateX(0)";
          oldEl.style.opacity = "0";
        }
      }
    });

    viewTransitionTimer = setTimeout(() => {
      if (oldEl) {
        oldEl.hidden = true;
        oldEl.classList.remove("is-leaving");
        oldEl.style.transform = "";
        oldEl.style.opacity = "";
      }
      newEl.style.transform = "";
      newEl.style.opacity = "";
      viewTransitionTimer = null;
    }, 300);

    activeViewName = view;
    window.scrollTo(0, 0);
  }

  function setActiveNav(view) {
    $$(".nav-btn").forEach(btn => btn.classList.toggle("is-active", btn.dataset.nav === view));
  }

  /* ---------------------------------------------------------
     RENDER: CATEGORY CHIPS
  --------------------------------------------------------- */
  function renderChips() {
    const row = $("#chipRow");
    row.innerHTML = "";
    DATA.categories.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = "chip" + (cat === activeCategory ? " is-active" : "");
      btn.textContent = cat;
      btn.setAttribute("role", "tab");
      btn.addEventListener("click", () => {
        activeCategory = cat;
        renderChips();
        renderList();
      });
      row.appendChild(btn);
    });
  }

  /* ---------------------------------------------------------
     RENDER: ITEM LIST
  --------------------------------------------------------- */
  function filteredItems() {
    return DATA.items.filter(it => {
      const catOk = activeCategory === "All" || it.category === activeCategory;
      const term = searchTerm.trim().toLowerCase();
      const searchOk = !term || it.name.toLowerCase().includes(term) || it.shortDescription.toLowerCase().includes(term);
      return catOk && searchOk;
    });
  }

  function renderList() {
    const list = $("#itemList");
    const items = filteredItems();
    list.innerHTML = "";
    $("#emptyState").hidden = items.length > 0;

    items.forEach(it => {
      const card = document.createElement("button");
      card.className = "item-card";
      card.type = "button";
      const qty = basket[it.id] || 0;
      card.innerHTML = `
        <div class="item-thumb"><img src="${it.image}" alt="" loading="lazy"></div>
        <div class="item-info">
          <p class="item-name">${escapeHtml(it.name)}</p>
          <p class="item-desc">${escapeHtml(it.shortDescription)}</p>
          <p class="item-price">${DATA.currency}${it.price}</p>
        </div>
        <button class="item-add ${qty > 0 ? "in-basket" : ""}" data-add="${it.id}" aria-label="Add ${escapeHtml(it.name)} to basket">
          ${qty > 0 ? qty : "+"}
        </button>
      `;
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-add]")) return; // handled separately
        go("item/" + it.id);
      });
      list.appendChild(card);
    });

    $$("[data-add]", list).forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToBasket(btn.dataset.add, 1);
        renderList();
        updateBadges();
      });
    });
  }

  /* ---------------------------------------------------------
     RENDER: DETAIL
  --------------------------------------------------------- */
  function renderDetail(id) {
    const it = itemsById[id];
    const wrap = $("#detailContent");
    if (!it) {
      wrap.innerHTML = `<p style="padding:24px;">Item not found.</p>`;
      return;
    }
    const qty = basket[id] || 0;
    wrap.innerHTML = `
      <div class="detail-hero"><img src="${it.image}" alt="${escapeHtml(it.name)}"></div>
      <div class="detail-body">
        <div class="detail-title-row">
          <h2>${escapeHtml(it.name)}</h2>
          <span class="detail-price">${DATA.currency}${it.price}</span>
        </div>
        <p class="detail-desc">${escapeHtml(it.description)}</p>
        <div class="detail-section">
          <h4>Ingredients</h4>
          <p>${escapeHtml(it.ingredients)}</p>
        </div>
        <div class="detail-section">
          <h4>Allergens</h4>
          <p>${escapeHtml(it.allergens)}</p>
        </div>
      </div>
      <div class="detail-footer">
        <div class="qty-stepper">
          <button type="button" id="detailMinus" aria-label="Decrease quantity">−</button>
          <span id="detailQty">${qty > 0 ? qty : 1}</span>
          <button type="button" id="detailPlus" aria-label="Increase quantity">+</button>
        </div>
        <button type="button" class="btn btn-primary btn-full" id="detailAddBtn">
          ${qty > 0 ? "Update Basket" : "Add to Basket"}
        </button>
      </div>
    `;

    let localQty = qty > 0 ? qty : 1;
    const qtyEl = $("#detailQty");
    $("#detailMinus").addEventListener("click", () => {
      localQty = Math.max(1, localQty - 1);
      qtyEl.textContent = localQty;
    });
    $("#detailPlus").addEventListener("click", () => {
      localQty = Math.min(20, localQty + 1);
      qtyEl.textContent = localQty;
    });
    $("#detailAddBtn").addEventListener("click", () => {
      setBasketQty(id, localQty);
      updateBadges();
      showToast(`${it.name} added to basket`);
      go("list");
    });
  }

  /* ---------------------------------------------------------
     BASKET LOGIC
  --------------------------------------------------------- */
  function addToBasket(id, delta) {
    const next = (basket[id] || 0) + delta;
    setBasketQty(id, next);
  }
  function setBasketQty(id, qty) {
    if (qty <= 0) delete basket[id];
    else basket[id] = qty;
    saveBasket();
  }

  function renderBasket() {
    const wrap = $("#basketList");
    const ids = Object.keys(basket);
    wrap.innerHTML = "";
    $("#emptyBasket").hidden = ids.length > 0;
    $("#basketSummary").hidden = ids.length === 0;

    let subtotal = 0;
    ids.forEach(id => {
      const it = itemsById[id];
      if (!it) return;
      const qty = basket[id];
      subtotal += it.price * qty;
      const row = document.createElement("div");
      row.className = "basket-row";
      row.innerHTML = `
        <div class="basket-thumb"><img src="${it.image}" alt=""></div>
        <div class="basket-info">
          <p class="basket-name">${escapeHtml(it.name)}</p>
          <p class="basket-price">${DATA.currency}${it.price}</p>
        </div>
        <div class="basket-stepper">
          <button type="button" data-dec="${id}" aria-label="Decrease ${escapeHtml(it.name)} quantity">−</button>
          <span>${qty}</span>
          <button type="button" data-inc="${id}" aria-label="Increase ${escapeHtml(it.name)} quantity">+</button>
        </div>
      `;
      wrap.appendChild(row);
    });

    $$("[data-inc]", wrap).forEach(b => b.addEventListener("click", () => { addToBasket(b.dataset.inc, 1); renderBasket(); updateBadges(); }));
    $$("[data-dec]", wrap).forEach(b => b.addEventListener("click", () => { addToBasket(b.dataset.dec, -1); renderBasket(); updateBadges(); }));

    const delivery = ids.length ? DATA.deliveryCharge : 0;
    $("#sumSubtotal").textContent = DATA.currency + subtotal;
    $("#sumDelivery").textContent = DATA.currency + delivery;
    $("#sumTotal").textContent = DATA.currency + (subtotal + delivery);
  }

  function updateBadges() {
    const count = basketCount();
    [$("#badgeList"), $("#badgeDetail"), $("#badgeNav")].forEach(el => {
      if (!el) return;
      el.hidden = count === 0;
      el.textContent = count;
    });
  }

  /* ---------------------------------------------------------
     SHARE TEXT + SHEET
  --------------------------------------------------------- */
  function buildOrderSummary() {
    const ids = Object.keys(basket);
    let subtotal = 0;
    const lines = ids.map(id => {
      const it = itemsById[id];
      const qty = basket[id];
      subtotal += it.price * qty;
      return `• ${it.name} x${qty}  ${DATA.currency}${it.price * qty}`;
    });
    const delivery = ids.length ? DATA.deliveryCharge : 0;
    const total = subtotal + delivery;
    return [
      `Hi! Please find my order from ${DATA.kitchenName} 😊`,
      "",
      "Order Summary",
      ...lines,
      "",
      `Subtotal  ${DATA.currency}${subtotal}`,
      `Delivery Charges  ${DATA.currency}${delivery}`,
      `Total  ${DATA.currency}${total}`,
      "",
      "Please confirm my order.",
      "Thank you! 🙏"
    ].join("\n");
  }

  function openShareSheet() {
    if (basketCount() === 0) return;
    $("#shareOverlay").hidden = false;
  }
  function closeShareSheet() { $("#shareOverlay").hidden = true; }

  async function handleShare(channel) {
    const text = buildOrderSummary();
    closeShareSheet();

    if (channel === "whatsapp") {
      const phone = (DATA.shareContacts && DATA.shareContacts.whatsapp) || "";
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
      return;
    }
    if (channel === "sms") {
      window.location.href = `sms:?body=${encodeURIComponent(text)}`;
      return;
    }
    if (channel === "email") {
      const subject = encodeURIComponent(`My Order — ${DATA.kitchenName}`);
      const to = (DATA.shareContacts && DATA.shareContacts.email) || "";
      window.location.href = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(text)}`;
      return;
    }
    if (channel === "more") {
      if (navigator.share) {
        try {
          await navigator.share({ title: DATA.kitchenName, text });
          return;
        } catch (e) { /* user cancelled or unsupported — fall back below */ }
      }
      try {
        await navigator.clipboard.writeText(text);
        showToast("Order copied to clipboard");
      } catch (e) {
        showToast("Could not copy — please try WhatsApp, SMS or Email");
      }
    }
  }

  /* ---------------------------------------------------------
     TOAST
  --------------------------------------------------------- */
  let toastTimer = null;
  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------------------------------------------------------
     HELPERS
  --------------------------------------------------------- */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[s]));
  }

  /* ---------------------------------------------------------
     EVENT WIRING
  --------------------------------------------------------- */
  function wireEvents() {
    $("#searchInput").addEventListener("input", (e) => {
      searchTerm = e.target.value;
      renderList();
    });

    $("#cartBtnList").addEventListener("click", () => go("basket"));
    $("#cartBtnDetail").addEventListener("click", () => go("basket"));
    $("#backFromDetail").addEventListener("click", () => history.back());
    $("#backFromBasket").addEventListener("click", () => history.back());
    $("#browseFromEmpty").addEventListener("click", () => go("list"));

    $("#clearBasketBtn").addEventListener("click", () => {
      if (basketCount() === 0) return;
      if (confirm("Remove all items from your basket?")) {
        basket = {};
        saveBasket();
        renderBasket();
        updateBadges();
      }
    });

    $$(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => go(btn.dataset.nav));
    });

    $("#shareBasketBtn").addEventListener("click", openShareSheet);
    $("#shareCancel").addEventListener("click", closeShareSheet);
    $("#shareOverlay").addEventListener("click", (e) => { if (e.target === $("#shareOverlay")) closeShareSheet(); });
    $("#shareWhatsapp").addEventListener("click", () => handleShare("whatsapp"));
    $("#shareSms").addEventListener("click", () => handleShare("sms"));
    $("#shareEmail").addEventListener("click", () => handleShare("email"));
    $("#shareMore").addEventListener("click", () => handleShare("more"));

    $("#menuBtn").addEventListener("click", () => go("about"));

    window.addEventListener("hashchange", renderRoute);
  }

  /* ---------------------------------------------------------
     PWA: INSTALL PROMPT (first-open banner)
  --------------------------------------------------------- */
  let deferredInstallPrompt = null;
  const INSTALL_DISMISS_KEY = "ck_install_dismissed_v1";
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  function maybeShowInstallBanner() {
    if (isStandalone()) return;                    // already installed
    if (localStorage.getItem(INSTALL_DISMISS_KEY)) return; // user dismissed before

    if (isIos()) {
      // iOS has no beforeinstallprompt — show manual instructions on first visit.
      $("#installCopySub").textContent = "Tap the Share icon, then \u201cAdd to Home Screen\u201d.";
      $("#installNowBtn").textContent = "Got it";
      $("#installBanner").hidden = false;
      $("#installBtnAbout").hidden = false;
      $("#installBtnAbout").textContent = "How to add to Home Screen (iOS)";
      return;
    }
    // Android/desktop Chrome: wait for the real prompt event.
    if (deferredInstallPrompt) {
      $("#installBanner").hidden = false;
    }
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    $("#installBtnAbout").hidden = false;
    if (!localStorage.getItem(INSTALL_DISMISS_KEY) && !isStandalone()) {
      $("#installBanner").hidden = false;
    }
  });

  window.addEventListener("appinstalled", () => {
    $("#installBanner").hidden = true;
    $("#installBtnAbout").hidden = true;
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
  });

  function wireInstallEvents() {
    $("#installDismissBtn").addEventListener("click", () => {
      $("#installBanner").hidden = true;
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    });

    $("#installNowBtn").addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        $("#installBanner").hidden = true;
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice && choice.outcome !== "accepted") {
          // Allow the banner to reappear on a future visit if they said no.
          localStorage.removeItem(INSTALL_DISMISS_KEY);
        } else {
          localStorage.setItem(INSTALL_DISMISS_KEY, "1");
        }
      } else {
        // iOS manual-instructions path
        $("#installBanner").hidden = true;
        localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      }
    });

    $("#installBtnAbout").addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice && choice.outcome === "accepted") localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      } else if (isIos()) {
        showToast("Tap the Share icon, then \u201cAdd to Home Screen\u201d");
      }
    });
  }

  /* ---------------------------------------------------------
     SERVICE WORKER
  --------------------------------------------------------- */
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(() => { /* ignore */ });
      });
    }
  }

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */
  async function init() {
    await loadData();
    renderChips();
    renderList();
    updateBadges();
    wireEvents();
    wireInstallEvents();
    registerServiceWorker();
    renderRoute();
    setTimeout(maybeShowInstallBanner, 1200); // small delay so it doesn't feel jarring on first open
  }

  document.addEventListener("DOMContentLoaded", init);
})();
