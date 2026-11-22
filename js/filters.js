/* ==========================================================================
   ALEXO — Product filtering
   Phase 2.3: category, size, color, price + brand filters.
   Works on desktop sidebar and mobile bottom sheet from one filter state.
   ========================================================================== */

(function () {
  "use strict";

  var grid = document.getElementById("shopProductGrid");
  if (!grid) return;

  var sourceName = grid.getAttribute("data-product-source") || "ALEXO_PRODUCTS";
  var api = window.ALEXO_StorefrontApi;
  if (api && api.isConfigured()) {
    grid.textContent = "Loading products…";
    api.getCatalog().then(initialize).catch(function (error) {
      grid.textContent = "The live catalog could not be loaded. Please try again later.";
      console.error("Could not load live catalog:", error);
    });
    return;
  }
  initialize(window[sourceName] || []);

  function initialize(products) {
  var params = new URLSearchParams(window.location.search);
  var searchTerm = (params.get("search") || "").trim().toLowerCase();
  var filterParam = params.get("filter");
  var categoryParam = params.get("category") || (filterParam === "new" || filterParam === "sale" ? filterParam : "all");
  var sortParam = params.get("sort") || "featured";
  var supportedSorts = ["featured", "newest", "price-asc", "price-desc"];

  var state = {
    category: categoryParam,
    sort: supportedSorts.indexOf(sortParam) === -1 ? "featured" : sortParam,
    sizes: [],
    colors: [],
    brands: [],
    minPrice: null,
    maxPrice: null
  };

  var PRICE_MIN = 0;
  var PRICE_MAX = 200;

  function norm(value) {
    return String(value || "").trim().toLowerCase();
  }

  function productPrice(product) {
    var sale = Number(product.salePrice);
    var price = Number(product.price);
    return Number.isFinite(sale) && sale > 0 ? sale : price;
  }

  function productSearchText(product) {
    return [
      product.name, product.category, product.subcategory, product.brand,
      product.description, product.gender
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function getProductColors(product) {
    var colors = Array.isArray(product.colors) ? product.colors : [];
    return colors.map(function (color) {
      if (typeof color === "object") return norm(color.name);
      return norm(color);
    });
  }

  function colorMatches(product, wanted) {
    var colors = getProductColors(product);
    var hexMap = {
      "#1a1a1a": "black", "#5b5b5b": "grey", "#8a8a8a": "grey",
      "#9a9a9a": "grey", "#ffffff": "white", "#efece6": "white",
      "#c9bfa5": "tan", "#a68a68": "tan", "#4a6fd1": "blue",
      "#3b4a5a": "blue", "#5b6674": "blue", "#a9b7c5": "blue",
      "#e893b8": "pink", "#7a1f2b": "red", "#4f9d63": "green"
    };
    return colors.some(function (color) {
      var label = hexMap[color] || color;
      return label === wanted || color === wanted;
    });
  }

  function categoryMatches(product) {
    if (!state.category || state.category === "all") return true;
    var wanted = norm(state.category);

    if (wanted === "men" || wanted === "women") {
      return norm(product.gender) === wanted;
    }
    if (wanted === "new") return product.newArrival === true;
    if (wanted === "sale") return product.onSale === true;

    return [product.category, product.subcategory].some(function (value) {
      return norm(value) === wanted;
    });
  }

  function filterProducts() {
    return products.filter(function (product) {
      if (searchTerm && productSearchText(product).indexOf(searchTerm) === -1) return false;
      if (!categoryMatches(product)) return false;

      if (state.sizes.length) {
        var sizes = (product.sizes || []).map(norm);
        if (!state.sizes.some(function (size) { return sizes.indexOf(size) !== -1; })) return false;
      }

      if (state.colors.length) {
        if (!state.colors.some(function (color) { return colorMatches(product, color); })) return false;
      }

      if (state.brands.length) {
        if (state.brands.indexOf(norm(product.brand)) === -1) return false;
      }

      var price = productPrice(product);
      if (state.minPrice !== null && price < state.minPrice) return false;
      if (state.maxPrice !== null && price > state.maxPrice) return false;

      return true;
    });
  }

  function render() {
    var results = sortProducts(filterProducts());
    grid.innerHTML = "";

    if (window.ALEXO_RenderProducts) {
      window.ALEXO_RenderProducts(grid, results);
    }

    function sortProducts(items) {
      var sorted = items.slice();
      if (state.sort === "newest") {
        sorted.sort(function (a, b) { return Number(Boolean(b.newArrival)) - Number(Boolean(a.newArrival)); });
      } else if (state.sort === "price-asc") {
        sorted.sort(function (a, b) { return productPrice(a) - productPrice(b); });
      } else if (state.sort === "price-desc") {
        sorted.sort(function (a, b) { return productPrice(b) - productPrice(a); });
      } else {
        sorted.sort(function (a, b) { return Number(Boolean(b.featured)) - Number(Boolean(a.featured)); });
      }
      return sorted;
    }

    updateMeta(results.length);
    updateFilterCount();
    updateURL();
    updateEmptyState(results.length);
  }

  function updateMeta(count) {
    var countEl = document.querySelector(".results-count");
    if (countEl) {
      countEl.textContent = "Showing " + (count ? "1–" + count : "0") + " of " + count + " results";
    }

    var heading = document.querySelector(".shop-heading__title p");
    if (heading) {
      if (searchTerm) {
        heading.textContent = count + " result" + (count === 1 ? "" : "s") + " for \"" + searchTerm + "\"";
      } else {
        heading.textContent = count + " result" + (count === 1 ? "" : "s") + " available";
      }
    }
  }

  function updateEmptyState(count) {
    var old = document.getElementById("shopEmptyState");
    if (old) old.remove();
    if (count) return;

    var empty = document.createElement("div");
    empty.id = "shopEmptyState";
    empty.className = "shop-empty-state";
    empty.innerHTML = "<h2>No products found</h2><p>Try changing your filters or searching for another style.</p><button type=\"button\" class=\"btn btn--outline\" id=\"emptyClearFilters\">Clear filters</button>";
    grid.appendChild(empty);
    document.getElementById("emptyClearFilters").addEventListener("click", clearAll);
  }

  function updateFilterCount() {
    var count = state.sizes.length + state.colors.length + state.brands.length;
    if (state.category !== "all") count += 1;
    if (state.minPrice !== null || state.maxPrice !== null) count += 1;

    document.querySelectorAll("[data-open-sheet='filterSheet']").forEach(function (btn) {
      var base = btn.getAttribute("data-base-label") || "Filter";
      btn.setAttribute("data-base-label", base);
      btn.textContent = count ? base + " (" + count + ")" : base;
    });
  }

  function updateURL() {
    var url = new URL(window.location.href);
    if (state.category === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", state.category);
    if (url.searchParams.get("filter") === "new" || url.searchParams.get("filter") === "sale") {
      url.searchParams.delete("filter");
    }
    if (state.sort === "featured") url.searchParams.delete("sort");
    else url.searchParams.set("sort", state.sort);
    window.history.replaceState({}, "", url.toString());
  }

  function setCategory(value) {
    state.category = norm(value) || "all";
    syncControls();
    render();
  }

  function setupCategoryControls() {
    document.querySelectorAll("input[name='category'], input[name='category-m']").forEach(function (input) {
      var label = input.closest("label");
      if (!label) return;
      var text = label.textContent.trim();
      var value = text === "All Categories" ? "all" : text === "New In" ? "new" : norm(text);
      input.setAttribute("data-filter-category", value);
      input.checked = value === state.category || (state.category === "all" && value === "all");
      input.addEventListener("change", function () {
        if (input.checked) setCategory(value);
      });
    });
  }

  function setupMultiControls() {
    document.querySelectorAll(".size-pills button").forEach(function (btn) {
      var value = norm(btn.textContent);
      btn.setAttribute("data-filter-size", value);
      btn.addEventListener("click", function () {
        btn.classList.toggle("is-active");
        var active = [];
        document.querySelectorAll(".size-pills button.is-active").forEach(function (b) { active.push(b.getAttribute("data-filter-size")); });
        state.sizes = Array.from(new Set(active));
        syncDuplicateControls(".size-pills button", "data-filter-size", state.sizes);
        render();
      });
    });

    document.querySelectorAll(".color-swatch-list button").forEach(function (btn) {
      var value = colorNameFromButton(btn);
      btn.setAttribute("data-filter-color", value);
      btn.addEventListener("click", function () {
        btn.classList.toggle("is-active");
        var active = [];
        document.querySelectorAll(".color-swatch-list button.is-active").forEach(function (b) { active.push(b.getAttribute("data-filter-color")); });
        state.colors = Array.from(new Set(active));
        syncDuplicateControls(".color-swatch-list button", "data-filter-color", state.colors);
        render();
      });
    });

    document.querySelectorAll(".filter-checkbox-list input").forEach(function (input) {
      var label = input.closest("label");
      var value = label ? norm(label.textContent) : "";
      input.setAttribute("data-filter-brand", value);
      input.addEventListener("change", function () {
        var active = [];
        document.querySelectorAll(".filter-checkbox-list input:checked").forEach(function (i) { active.push(i.getAttribute("data-filter-brand")); });
        state.brands = Array.from(new Set(active));
        syncDuplicateControls(".filter-checkbox-list input", "data-filter-brand", state.brands);
        render();
      });
    });
  }

  function colorNameFromButton(btn) {
    var aria = norm(btn.getAttribute("aria-label"));
    if (aria) return aria;
    return "color";
  }

  function syncDuplicateControls(selector, attr, activeValues) {
    document.querySelectorAll(selector).forEach(function (el) {
      var active = activeValues.indexOf(el.getAttribute(attr)) !== -1;
      el.classList.toggle("is-active", active);
      if (el.tagName === "INPUT") el.checked = active;
    });
  }

  function setupPriceControls() {
    document.querySelectorAll(".price-min-input").forEach(function (input) {
      input.min = PRICE_MIN; input.max = PRICE_MAX; input.value = state.minPrice === null ? PRICE_MIN : state.minPrice;
      input.addEventListener("input", function () {
        var value = Number(input.value);
        state.minPrice = Math.min(value, state.maxPrice === null ? PRICE_MAX : state.maxPrice);
        syncPriceInputs(); render();
      });
    });

    document.querySelectorAll(".price-max-input").forEach(function (input) {
      input.min = PRICE_MIN; input.max = PRICE_MAX; input.value = state.maxPrice === null ? PRICE_MAX : state.maxPrice;
      input.addEventListener("input", function () {
        var value = Number(input.value);
        state.maxPrice = Math.max(value, state.minPrice === null ? PRICE_MIN : state.minPrice);
        syncPriceInputs(); render();
      });
    });

    syncPriceInputs();
  }

  function syncPriceInputs() {
    var min = state.minPrice === null ? PRICE_MIN : state.minPrice;
    var max = state.maxPrice === null ? PRICE_MAX : state.maxPrice;
    document.querySelectorAll(".price-min-input").forEach(function (i) { i.value = min; });
    document.querySelectorAll(".price-max-input").forEach(function (i) { i.value = max; });
    document.querySelectorAll(".price-min-value").forEach(function (el) { el.textContent = window.ALEXO_formatMoney(min); });
    document.querySelectorAll(".price-max-value").forEach(function (el) { el.textContent = window.ALEXO_formatMoney(max); });
  }

  function syncControls() {
    document.querySelectorAll("input[data-filter-category]").forEach(function (input) {
      input.checked = input.getAttribute("data-filter-category") === state.category;
    });
    syncDuplicateControls(".size-pills button", "data-filter-size", state.sizes);
    syncDuplicateControls(".color-swatch-list button", "data-filter-color", state.colors);
    syncDuplicateControls(".filter-checkbox-list input", "data-filter-brand", state.brands);
    document.querySelectorAll("input[name='sort']").forEach(function (input) {
      input.checked = input.value === state.sort;
    });
    syncPriceInputs();
  }

  function clearAll() {
    state.category = "all";
    state.sizes = [];
    state.colors = [];
    state.brands = [];
    state.minPrice = null;
    state.maxPrice = null;
    state.sort = "featured";
    searchTerm = "";
    var url = new URL(window.location.href);
    url.searchParams.delete("category");
    url.searchParams.delete("filter");
    url.searchParams.delete("sort");
    url.searchParams.delete("search");
    window.history.replaceState({}, "", url.toString());
    syncControls();
    render();
  }

  document.querySelectorAll(".filter-clear").forEach(function (btn) { btn.addEventListener("click", clearAll); });
  var clearBtn = document.getElementById("clearFiltersBtn");
  if (clearBtn) clearBtn.addEventListener("click", clearAll);

  document.querySelectorAll("input[name='sort']").forEach(function (input) {
    input.addEventListener("change", function () {
      if (!input.checked || supportedSorts.indexOf(input.value) === -1) return;
      state.sort = input.value;
      render();
    });
  });

  setupCategoryControls();
  setupMultiControls();
  setupPriceControls();

  /* Keep the existing bottom-sheet behaviour, but make Apply simply close it. */
  var backdrop = document.getElementById("sheetBackdrop");
  var openTriggers = document.querySelectorAll("[data-open-sheet]");
  var closeTriggers = document.querySelectorAll("[data-close-sheet]");
  var activeSheet = null;

  function openSheet(id) {
    var sheet = document.getElementById(id);
    if (!sheet) return;
    activeSheet = sheet;
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.offsetHeight;
      backdrop.classList.add("is-visible");
    }
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeActiveSheet() {
    if (!activeSheet) return;
    activeSheet.classList.remove("is-open");
    activeSheet.setAttribute("aria-hidden", "true");
    if (backdrop) {
      backdrop.classList.remove("is-visible");
      setTimeout(function () { backdrop.hidden = true; }, 320);
    }
    document.body.style.overflow = "";
    activeSheet = null;
  }

  openTriggers.forEach(function (btn) { btn.addEventListener("click", function () { openSheet(btn.getAttribute("data-open-sheet")); }); });
  closeTriggers.forEach(function (btn) { btn.addEventListener("click", closeActiveSheet); });
  if (backdrop) backdrop.addEventListener("click", closeActiveSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeActiveSheet(); });

  document.querySelectorAll(".filter-accordion__trigger").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      var section = trigger.closest(".filter-accordion");
      if (section) section.classList.toggle("is-open");
    });
  });

  render();
  }
})();
