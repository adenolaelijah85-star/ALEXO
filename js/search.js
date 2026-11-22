/* =========================================================
   ALEXO — Search
   ========================================================= */
(function () {
  "use strict";

  var overlay = document.getElementById("searchOverlay");
  var closeBtn = document.getElementById("searchClose");
  var form = document.getElementById("alexSearchForm");
  var input = document.getElementById("alexSearchInput");
  var list = document.getElementById("searchSuggestionsList");
  var count = document.getElementById("searchSuggestionCount");
  if (!overlay || !form || !input || !list) return;

  var products = Array.isArray(window.ALEXO_PRODUCTS) ? window.ALEXO_PRODUCTS : [];

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char];
    });
  }

  function productText(product) {
    return [product.name, product.category, product.subcategory, product.brand, product.description]
      .filter(Boolean).join(" ").toLowerCase();
  }

  function getId(product) {
    if (product.id) return product.id;
    return String(product.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function render(query) {
    var term = String(query || "").trim().toLowerCase();
    var results = term ? products.filter(function (product) { return productText(product).indexOf(term) !== -1; }).slice(0, 8) : products.slice(0, 8);
    list.innerHTML = "";
    if (count) count.textContent = term ? results.length + " match" + (results.length === 1 ? "" : "es") : "Popular products";

    if (!results.length) {
      list.innerHTML = '<div class="search-empty"><strong>No products found.</strong><br>Try another product, category, or brand.</div>';
      return;
    }

    results.forEach(function (product) {
      var article = document.createElement("article");
      article.className = "search-result";
      var image = product.image || (product.images && product.images[0]) || "";
      var price = product.salePrice || product.price || 0;
      article.innerHTML =
        '<a href="product.html?id=' + encodeURIComponent(getId(product)) + '">' +
          '<div class="search-result__image"><img src="' + escapeHTML(image) + '" alt="' + escapeHTML(product.name) + '" loading="lazy"></div>' +
          '<p class="search-result__name">' + escapeHTML(product.name) + '</p>' +
          '<p class="search-result__meta">' + window.ALEXO_formatMoney(Number(price), product.currency) + '</p>' +
        '</a>';
      list.appendChild(article);
    });
  }

  function openSearch() {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    render(input.value);
    window.setTimeout(function () { input.focus(); }, 30);
  }

  function closeSearch() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-action='open-search']").forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      openSearch();
    });
  });

  if (closeBtn) closeBtn.addEventListener("click", closeSearch);
  overlay.addEventListener("click", function (event) { if (event.target === overlay) closeSearch(); });
  input.addEventListener("input", function () { render(input.value); });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var query = input.value.trim();
    if (query) window.location.href = "shop.html?search=" + encodeURIComponent(query);
  });

  document.querySelectorAll("[data-search-term]").forEach(function (button) {
    button.addEventListener("click", function () {
      input.value = button.getAttribute("data-search-term") || "";
      render(input.value);
      input.focus();
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) closeSearch();
  });

  render("");
  if (window.ALEXO_StorefrontApi && window.ALEXO_StorefrontApi.isConfigured()) {
    list.textContent = "Loading products…";
    window.ALEXO_StorefrontApi.getCatalog().then(function (catalog) {
      products = catalog;
      render(input.value);
    }).catch(function (error) {
      list.textContent = "The live catalog could not be loaded.";
      console.error("Could not load catalog suggestions:", error);
    });
  }
})();
