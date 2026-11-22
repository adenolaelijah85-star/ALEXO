/* ==========================================================================
   ALEXO — Stage 1 behaviour
   Covers: sticky header compact state, mobile nav toggle.
   Later stages (products.js, cart.js, wishlist.js, search.js, filters.js,
   auth.js) plug into this same app.js entry point.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------- Sticky header compact state ---------------- */
  var header = document.getElementById("siteHeader");

  function updateHeaderState() {
    if (!header) return;
    if (window.scrollY > 12) {
      header.classList.add("is-compact");
    } else {
      header.classList.remove("is-compact");
    }
    document.documentElement.style.setProperty(
      "--mobile-nav-top",
      Math.max(0, header.getBoundingClientRect().bottom) + "px"
    );
  }
  updateHeaderState();
  window.addEventListener("scroll", updateHeaderState, { passive: true });

  var headerOffsetObserver = null;
  function observeElementsBeforeHeader() {
    if (!header || !headerOffsetObserver) return;
    for (var element = header; element && element !== document.body; element = element.parentElement) {
      for (var sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        headerOffsetObserver.observe(sibling);
      }
    }
  }

  if (header && "ResizeObserver" in window) {
    headerOffsetObserver = new ResizeObserver(updateHeaderState);
    observeElementsBeforeHeader();
  }

  if (header && "MutationObserver" in window && document.body) {
    var headerFlowObserver = new MutationObserver(function () {
      observeElementsBeforeHeader();
      updateHeaderState();
    });
    headerFlowObserver.observe(document.body, { childList: true });
  }

  /* ---------------- Mobile nav toggle ---------------- */
  var navToggle = document.getElementById("navToggle");
  var primaryNav = document.getElementById("primaryNav");

  if (navToggle && primaryNav) {
    function closeMobileNav() {
      primaryNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open menu");
      document.body.style.overflow = "";
    }

    navToggle.addEventListener("click", function () {
      updateHeaderState();
      var isOpen = primaryNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    primaryNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMobileNav);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && primaryNav.classList.contains("is-open")) {
        closeMobileNav();
        navToggle.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) closeMobileNav();
      updateHeaderState();
    });
  }

  /* ---------------- Header bag + wishlist counts (shared across every page) ---------------- */
  function refreshBagCount() {
    var count = window.ALEXO_CartService ? window.ALEXO_CartService.getCartCount() : 0;
    document.querySelectorAll(".bag-count").forEach(function (el) {
      el.textContent = count;
      el.setAttribute("data-zero", count === 0 ? "true" : "false");
    });
    document.querySelectorAll(".icon-btn--bag").forEach(function (el) {
      el.setAttribute("aria-label", count ? "Bag, " + count + (count === 1 ? " item" : " items") : "Bag, empty");
    });
  }
  function refreshWishlistCount() {
    var count = window.ALEXO_WishlistService ? window.ALEXO_WishlistService.getWishlistCount() : 0;
    document.querySelectorAll(".wishlist-count").forEach(function (el) {
      el.textContent = count;
      el.setAttribute("data-zero", count === 0 ? "true" : "false");
    });
  }
  window.ALEXO_refreshBagCount = refreshBagCount;
  window.ALEXO_refreshWishlistCount = refreshWishlistCount;
  refreshBagCount();
  refreshWishlistCount();

  /* ---------------- Product card rendering (shared: Home + Shop) ---------------- */
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function revealPageSections() {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) return;

    var sections = document.querySelectorAll(
      ".page > section:not(.hero):not(.best-collection):not(.reviews):not(.own-your-style):not([hidden]), " +
      "main > section:not(.hero):not(.best-collection):not(.reviews):not(.own-your-style):not([hidden]), " +
      "main > .checkout-layout:not([hidden])"
    );
    if (!sections.length) return;

    var observer = new IntersectionObserver(function (entries, currentObserver) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });

    sections.forEach(function (section) {
      section.setAttribute("data-motion-reveal", "");
      observer.observe(section);
    });
  }

  revealPageSections();

  var quickAddDialog = document.getElementById("quickAddDialog");
  var quickAddTitle = document.getElementById("quickAddTitle");
  var quickAddSizes = document.getElementById("quickAddSizes");
  var quickAddColors = document.getElementById("quickAddColors");
  var quickAddSelectedSize = document.getElementById("quickAddSelectedSize");
  var quickAddSelectedColor = document.getElementById("quickAddSelectedColor");
  var quickAddPrice = document.getElementById("quickAddPrice");
  var quickAddStatus = document.getElementById("quickAddStatus");
  var quickAddSubmit = document.getElementById("quickAddSubmit");
  var activeQuickAddProduct = null;
  var activeQuickAddOptions = [];
  var selectedQuickAddSize = "";
  var selectedQuickAddColor = "";

  function getQuickAddOptions(product) {
    if (Array.isArray(product.variants) && product.variants.length) {
      return product.variants.filter(function (variant) {
        return Number(variant.stock) > 0;
      }).map(function (variant) {
        return {
          variantSku: variant.variantSku || "",
          size: variant.size || "One Size",
          color: variant.color || "Default",
          colorHex: variant.colorHex || "#1a1a1a",
          price: Number(variant.price),
          currency: variant.currency || product.currency || "NGN"
        };
      });
    }

    if (product.stock != null && Number(product.stock) < 1) return [];

    var sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ["One Size"];
    var colors = Array.isArray(product.colors) && product.colors.length
      ? product.colors.map(function (color, index) {
        var colorName = typeof color === "object" ? color.name : color;
        var colorHex = typeof color === "object" ? color.hex : color;
        if (!colorName || /^#[0-9a-f]{3,8}$/i.test(colorName)) colorName = "Color " + (index + 1);
        return { name: colorName, hex: colorHex || "#1a1a1a" };
      })
      : [{ name: "Default", hex: "#1a1a1a" }];
    var price = Number(product.salePrice != null ? product.salePrice : product.price);

    return sizes.reduce(function (options, size) {
      colors.forEach(function (color) {
        options.push({
          variantSku: "",
          size: size,
          color: color.name,
          colorHex: color.hex,
          price: price,
          currency: product.currency || "NGN"
        });
      });
      return options;
    }, []);
  }

  function getSelectedQuickAddOption() {
    if (!selectedQuickAddSize || !selectedQuickAddColor) return null;
    return activeQuickAddOptions.find(function (option) {
      return option.size === selectedQuickAddSize && option.color === selectedQuickAddColor;
    }) || null;
  }

  function hasQuickAddOption(size, color) {
    return activeQuickAddOptions.some(function (option) {
      return option.size === size && option.color === color;
    });
  }

  function updateQuickAddChoices() {
    quickAddSelectedSize.textContent = selectedQuickAddSize || "Choose a size";
    quickAddSelectedColor.textContent = selectedQuickAddColor || "Choose a color";

    quickAddSizes.querySelectorAll("button").forEach(function (button) {
      var isSelected = button.dataset.quickAddSize === selectedQuickAddSize;
      button.setAttribute("aria-pressed", String(isSelected));
      button.classList.toggle("is-selected", isSelected);
    });

    quickAddColors.querySelectorAll("button").forEach(function (button) {
      var color = button.dataset.quickAddColor;
      var isSelected = color === selectedQuickAddColor;
      button.disabled = Boolean(selectedQuickAddSize) &&
        !hasQuickAddOption(selectedQuickAddSize, color);
      button.setAttribute("aria-pressed", String(isSelected));
      button.classList.toggle("is-selected", isSelected);
    });

    var option = getSelectedQuickAddOption();
    quickAddSubmit.disabled = !option;
    quickAddPrice.textContent = option
      ? "Price: " + window.ALEXO_formatMoney(option.price, option.currency)
      : activeQuickAddOptions.length
        ? "Choose a size and color to see the price."
        : "Price unavailable.";
  }

  if (quickAddDialog && quickAddSizes && quickAddColors && quickAddSubmit) {

    document.getElementById("quickAddClose").addEventListener("click", function () {
      quickAddDialog.close();
    });

    quickAddDialog.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        quickAddDialog.close();
      }
    });

    quickAddDialog.addEventListener("click", function (event) {
      if (event.target === quickAddDialog) quickAddDialog.close();
    });

    quickAddSubmit.addEventListener("click", function () {
      var option = getSelectedQuickAddOption();
      if (!activeQuickAddProduct || !option) {
        quickAddStatus.textContent = "Choose a size and color before adding this item.";
        return;
      }
      if (!window.ALEXO_CartService) {
        quickAddStatus.textContent = "The bag is unavailable right now. Please try again.";
        return;
      }

      window.ALEXO_CartService.addToCart({
        id: activeQuickAddProduct.id || activeQuickAddProduct.sku || slugify(activeQuickAddProduct.name),
        productSku: activeQuickAddProduct.sku || "",
        variantSku: option.variantSku,
        name: activeQuickAddProduct.name,
        price: option.price,
        currency: option.currency,
        image: activeQuickAddProduct.image || (activeQuickAddProduct.images && activeQuickAddProduct.images[0]) || "",
        color: option.color,
        colorHex: option.colorHex,
        size: option.size,
        qty: 1
      });

      if (window.ALEXO_refreshBagCount) window.ALEXO_refreshBagCount();
      selectedQuickAddSize = "";
      selectedQuickAddColor = "";
      updateQuickAddChoices();
      quickAddStatus.textContent = activeQuickAddProduct.name + " added to your bag.";
    });
  }

  function openQuickAdd(product) {
    activeQuickAddProduct = product;
    activeQuickAddOptions = getQuickAddOptions(product);
    quickAddTitle.textContent = product.name || "Add to Bag";
    quickAddStatus.textContent = "";
    selectedQuickAddSize = "";
    selectedQuickAddColor = "";
    quickAddSizes.replaceChildren();
    quickAddColors.replaceChildren();

    Array.from(new Set(activeQuickAddOptions.map(function (option) {
      return option.size;
    }))).forEach(function (size) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "quick-add-dialog__size-choice";
      button.dataset.quickAddSize = size;
      button.textContent = size;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", function () {
        selectedQuickAddSize = size;
        if (selectedQuickAddColor && !hasQuickAddOption(size, selectedQuickAddColor)) {
          selectedQuickAddColor = "";
        }
        quickAddStatus.textContent = "";
        updateQuickAddChoices();
      });
      quickAddSizes.appendChild(button);
    });

    var colors = [];
    activeQuickAddOptions.forEach(function (option) {
      if (!colors.some(function (color) { return color.name === option.color; })) {
        colors.push({ name: option.color, hex: option.colorHex });
      }
    });
    colors.forEach(function (color) {
      var button = document.createElement("button");
      var swatch = document.createElement("span");
      button.type = "button";
      button.className = "quick-add-dialog__color-choice";
      button.dataset.quickAddColor = color.name;
      button.setAttribute("aria-label", "Choose color " + color.name);
      button.setAttribute("aria-pressed", "false");
      swatch.className = "quick-add-dialog__swatch";
      swatch.setAttribute("aria-hidden", "true");
      swatch.style.backgroundColor = color.hex || "#1a1a1a";
      button.appendChild(swatch);
      button.appendChild(document.createTextNode(color.name));
      button.addEventListener("click", function () {
        selectedQuickAddColor = color.name;
        if (selectedQuickAddSize && !hasQuickAddOption(selectedQuickAddSize, color.name)) {
          selectedQuickAddSize = "";
        }
        quickAddStatus.textContent = "";
        updateQuickAddChoices();
      });
      quickAddColors.appendChild(button);
    });

    updateQuickAddChoices();
    if (!activeQuickAddOptions.length) {
      quickAddStatus.textContent = "This product is currently unavailable.";
    }
    quickAddDialog.showModal();
  }

  function renderProductsInto(gridEl, products) {
    var frag = document.createDocumentFragment();

    products.forEach(function (product) {
      var card = document.createElement("article");
      card.className = "product-card";

      var productId = product.id || slugify(product.name);
      var href = "product.html?id=" + encodeURIComponent(productId);
      var wishlistId = product.id || product.sku || slugify(product.name);
      var savedAlready = window.ALEXO_WishlistService && window.ALEXO_WishlistService.isInWishlist(wishlistId);
      var productName = String(product.name || "Product");
      var currentPrice = product.salePrice != null ? product.salePrice : product.price;
      var hasDiscount = Number(product.compareAtPrice) > Number(currentPrice);
      var isSale = Boolean(product.onSale || hasDiscount);

      var link = document.createElement("a");
      link.className = "product-card__link";
      link.href = href;
      link.setAttribute("aria-label", "View " + productName);

      var imageWrap = document.createElement("div");
      imageWrap.className = "product-card__image-wrap";
      var image = document.createElement("img");
      image.src = product.image || (product.images && product.images[0]) || "";
      image.alt = productName;
      image.loading = "lazy";
      imageWrap.appendChild(image);

      var badgeText = isSale ? "Sale" : product.newArrival ? "New" : "";
      if (badgeText) {
        var badge = document.createElement("span");
        badge.className = "product-card__badge" + (isSale ? " product-card__badge--sale" : " product-card__badge--new");
        badge.textContent = badgeText;
        imageWrap.appendChild(badge);
      }

      var cardBody = document.createElement("div");
      cardBody.className = "product-card__body";
      var productCopy = document.createElement("div");
      productCopy.className = "product-card__copy";
      var productMeta = [product.brand, product.category].filter(Boolean).join(" · ");
      if (productMeta) {
        var meta = document.createElement("p");
        meta.className = "product-card__meta";
        meta.textContent = productMeta;
        productCopy.appendChild(meta);
      }

      var name = document.createElement("p");
      name.className = "product-card__name";
      name.textContent = productName;
      productCopy.appendChild(name);

      var priceRow = document.createElement("div");
      priceRow.className = "product-card__price-row";
      var price = document.createElement("span");
      price.className = "product-card__price" + (hasDiscount ? " product-card__price--sale" : "");
      price.textContent = window.ALEXO_formatMoney(Number(currentPrice), product.currency);
      priceRow.appendChild(price);
      if (hasDiscount) {
        var comparePrice = document.createElement("s");
        comparePrice.className = "product-card__compare-price";
        comparePrice.textContent = window.ALEXO_formatMoney(Number(product.compareAtPrice), product.currency);
        priceRow.appendChild(comparePrice);
      }
      productCopy.appendChild(priceRow);
      cardBody.appendChild(productCopy);

      var swatches = document.createElement("div");
      swatches.className = "product-card__swatches";
      (Array.isArray(product.colors) ? product.colors : []).slice(0, 4).forEach(function (color) {
        var hex = typeof color === "string" ? color : color && color.hex;
        if (!hex) return;
        var swatch = document.createElement("span");
        swatch.style.backgroundColor = hex;
        swatch.setAttribute("aria-hidden", "true");
        swatches.appendChild(swatch);
      });
      cardBody.appendChild(swatches);

      link.appendChild(imageWrap);
      link.appendChild(cardBody);

      var wishlistBtn = document.createElement("button");
      wishlistBtn.type = "button";
      wishlistBtn.className = "product-card__wishlist" + (savedAlready ? " is-active" : "");
      wishlistBtn.setAttribute("aria-label", (savedAlready ? "Remove " : "Add ") + productName + " to wishlist");
      wishlistBtn.setAttribute("aria-pressed", String(Boolean(savedAlready)));
      wishlistBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
          '<path d="M12 20s-7-4.35-9.5-8.5C.7 8.1 2.3 4.5 6 4.5c2 0 3.3 1 4.5 2.5 1.2-1.5 2.5-2.5 4.5-2.5 3.7 0 5.3 3.6 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5z"/>' +
        "</svg>";

      card.appendChild(link);
      card.appendChild(wishlistBtn);

      if (gridEl.id === "shopProductGrid" && quickAddDialog) {
        var quickAddButton = document.createElement("button");
        quickAddButton.type = "button";
        quickAddButton.className = "btn btn--dark product-card__quick-add";
        quickAddButton.textContent = "Add to Bag";
        quickAddButton.setAttribute("aria-haspopup", "dialog");
        quickAddButton.setAttribute("aria-label", "Add " + productName + " to bag");
        if (!getQuickAddOptions(product).length) {
          quickAddButton.disabled = true;
          quickAddButton.textContent = "Sold Out";
          quickAddButton.setAttribute("aria-label", productName + " is sold out");
        }
        quickAddButton.addEventListener("click", function () {
          openQuickAdd(product);
        });
        card.appendChild(quickAddButton);
      }

      wishlistBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (!window.ALEXO_WishlistService) return;
        var result = window.ALEXO_WishlistService.toggleWishlist({
          id: wishlistId,
          name: productName,
          price: product.price,
          wasPrice: product.compareAtPrice || null,
          image: product.image,
          colors: product.colors.map(function (color) {
            return typeof color === "string" ? color : color.hex;
          }),
          size: null,
          inStock: true
        });
        wishlistBtn.classList.toggle("is-active", result.isNowSaved);
        wishlistBtn.setAttribute("aria-pressed", String(result.isNowSaved));
        wishlistBtn.setAttribute("aria-label", (result.isNowSaved ? "Remove " : "Add ") + product.name + " to wishlist");
        if (window.ALEXO_refreshWishlistCount) window.ALEXO_refreshWishlistCount();
      });

      frag.appendChild(card);
    });

    gridEl.appendChild(frag);
    revealCards(gridEl, ".product-card");
  }

  window.ALEXO_RenderProducts = renderProductsInto;

  function renderHomeCatalog(products) {
    var gridEl = document.getElementById("productGrid");
    if (!gridEl) return;
    var activeFilter = document.querySelector("[data-home-filter].is-active");
    var filter = activeFilter ? activeFilter.getAttribute("data-home-filter") : "featured";
    var sort = document.getElementById("homeSort");
    var sortValue = sort ? sort.value : "featured";
    var term = (new URLSearchParams(window.location.search).get("search") || "").trim().toLowerCase();
    var filtered = products.filter(function (product) {
      if (filter === "men" || filter === "women") {
        if (product.gender !== filter) return false;
      } else if (filter === "new" && !product.newArrival) {
        return false;
      } else if (filter === "sale" && !product.onSale) {
        return false;
      } else if (filter === "featured" && !product.featured) {
        return false;
      }
      if (term) {
        var text = [product.name, product.category, product.brand, product.description]
          .filter(Boolean).join(" ").toLowerCase();
        if (text.indexOf(term) === -1) return false;
      }
      return true;
    });

    if (sortValue === "newest") {
      filtered.sort(function (a, b) { return Number(Boolean(b.newArrival)) - Number(Boolean(a.newArrival)); });
    } else if (sortValue === "price-asc") {
      filtered.sort(function (a, b) { return a.price - b.price; });
    } else if (sortValue === "price-desc") {
      filtered.sort(function (a, b) { return b.price - a.price; });
    } else {
      filtered.sort(function (a, b) { return Number(Boolean(b.featured)) - Number(Boolean(a.featured)); });
    }

    gridEl.replaceChildren();
    renderProductsInto(gridEl, filtered);
    var count = document.querySelector(".best-collection__meta .results-count");
    if (count) count.textContent = filtered.length + " product" + (filtered.length === 1 ? "" : "s");
    if (!filtered.length) {
      var empty = document.createElement("p");
      empty.className = "shop-empty-state";
      empty.textContent = "No products match this selection yet.";
      gridEl.appendChild(empty);
    }
  }

  function slugify(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function revealCards(containerEl, selector) {
    var cards = containerEl.querySelectorAll(selector);

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      cards.forEach(function (card) { card.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          obs.unobserve(entry.target);
          var index = Array.prototype.indexOf.call(cards, entry.target);
          setTimeout(function () {
            entry.target.classList.add("is-visible");
          }, (index % 4) * 90);
        }
      });
    }, { threshold: 0.15 });

    cards.forEach(function (card) { observer.observe(card); });
  }

  document.querySelectorAll("[data-product-grid]").forEach(function (gridEl) {
    var sourceName = gridEl.getAttribute("data-product-source") || "ALEXO_PRODUCTS";
    var api = window.ALEXO_StorefrontApi;
    if (api && api.isConfigured()) {
      if (gridEl.id === "shopProductGrid") return;
      gridEl.textContent = "Loading products…";
      api.getCatalog().then(function (catalog) {
        window.ALEXO_PRODUCTS = catalog;
        if (gridEl.id === "productGrid") {
          window.ALEXO_CurrentCatalog = catalog;
          renderHomeCatalog(catalog);
          return;
        }
        var search = new URLSearchParams(window.location.search).get("search");
        var list = catalog;
        if (search) {
          var term = search.trim().toLowerCase();
          list = list.filter(function (product) {
            return [
              product.name, product.category, product.brand, product.description, product.gender
            ].filter(Boolean).join(" ").toLowerCase().indexOf(term) !== -1;
          });
        }
        var limit = parseInt(gridEl.getAttribute("data-limit"), 10);
        gridEl.replaceChildren();
        renderProductsInto(gridEl, limit ? list.slice(0, limit) : list);
      }).catch(function (error) {
        gridEl.textContent = "The live catalog could not be loaded.";
        console.error("Could not load live catalog:", error);
      });
      return;
    }

    var source = window[sourceName];
    if (source) {
      if (gridEl.id === "productGrid") {
        window.ALEXO_CurrentCatalog = source;
        renderHomeCatalog(source);
        return;
      }
      var search = new URLSearchParams(window.location.search).get("search");
      if (search) {
        var term = search.trim().toLowerCase();
        source = source.filter(function (product) {
          var searchableText = [
            product.name,
            product.category,
            product.subcategory,
            product.brand,
            product.description
          ].filter(Boolean).join(" ").toLowerCase();
          return searchableText.indexOf(term) !== -1;
        });
      }
      var limit = parseInt(gridEl.getAttribute("data-limit"), 10);
      var list = limit ? source.slice(0, limit) : source;
      renderProductsInto(gridEl, list);
    }
  });

  /* ---------------- Home catalog filters and sorting ---------------- */
  var filterButtons = document.querySelectorAll("[data-home-filter]");
  filterButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterButtons.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      renderHomeCatalog(window.ALEXO_CurrentCatalog || []);
    });
  });
  var homeSort = document.getElementById("homeSort");
  if (homeSort) homeSort.addEventListener("change", function () {
    renderHomeCatalog(window.ALEXO_CurrentCatalog || []);
  });

  /* ---------------- Trending Now ---------------- */
  var trendingEl = document.getElementById("trendingScroller");

  function renderTrending(products) {
    if (!trendingEl) return;
    trendingEl.replaceChildren();
    var trendFrag = document.createDocumentFragment();

    products.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "trend-card";
      var link = document.createElement("a");
      link.href = "product.html?id=" + encodeURIComponent(item.id || item.sku || slugify(item.name));
      link.className = "trend-card__link";
      var imageWrap = document.createElement("div");
      imageWrap.className = "trend-card__image";
      var image = document.createElement("img");
      image.src = item.image;
      image.alt = item.name;
      image.loading = "lazy";
      imageWrap.appendChild(image);
      var name = document.createElement("p");
      name.className = "trend-card__name";
      name.textContent = item.name;
      var price = document.createElement("p");
      price.className = "trend-card__price";
      price.textContent = window.ALEXO_formatMoney(item.price, item.currency);
      link.append(imageWrap, name, price);

      var wishlistId = item.id || item.sku || slugify(item.name);
      var saved = window.ALEXO_WishlistService && window.ALEXO_WishlistService.isInWishlist(wishlistId);
      var wishlist = document.createElement("button");
      wishlist.type = "button";
      wishlist.className = "trend-card__wishlist";
      wishlist.setAttribute("aria-label", (saved ? "Remove " : "Add ") + item.name + " to wishlist");
      wishlist.setAttribute("aria-pressed", String(Boolean(saved)));
      wishlist.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<path d="M12 20s-7-4.35-9.5-8.5C.7 8.1 2.3 4.5 6 4.5c2 0 3.3 1 4.5 2.5 1.2-1.5 2.5-2.5 4.5-2.5 3.7 0 5.3 3.6 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5z"/>' +
        "</svg>";
      wishlist.addEventListener("click", function () {
        if (!window.ALEXO_WishlistService) return;
        var result = window.ALEXO_WishlistService.toggleWishlist({
          id: wishlistId,
          name: item.name,
          price: item.price,
          image: item.image,
          colors: (item.colors || []).map(function (color) {
            return typeof color === "string" ? color : color.hex;
          })
        });
        wishlist.setAttribute("aria-pressed", String(result.isNowSaved));
        wishlist.setAttribute("aria-label", (result.isNowSaved ? "Remove " : "Add ") + item.name + " to wishlist");
        if (window.ALEXO_refreshWishlistCount) window.ALEXO_refreshWishlistCount();
      });
      card.append(link, wishlist);
      trendFrag.appendChild(card);
    });

    trendingEl.appendChild(trendFrag);
  }

  if (trendingEl) {
    if (window.ALEXO_StorefrontApi && window.ALEXO_StorefrontApi.isConfigured()) {
      window.ALEXO_StorefrontApi.getCatalog().then(function (products) {
        renderTrending(products.slice(0, 5));
      }).catch(function (error) {
        trendingEl.textContent = "Trending products could not be loaded.";
        console.error("Could not load live trending products:", error);
      });
    } else {
      renderTrending((window.ALEXO_PRODUCTS || []).slice(0, 5));
    }
  }

  /* ---------------- Lookbook ---------------- */
  var lookbookEl = document.getElementById("lookbookScroller");

  if (lookbookEl && window.ALEXO_LOOKBOOK) {
    var lookFrag = document.createDocumentFragment();

    window.ALEXO_LOOKBOOK.forEach(function (item) {
      var card = document.createElement("a");
      card.href = "collections.html";
      card.className = "lookbook-card";
      card.innerHTML =
        '<img src="' + item.image + '" alt="' + item.caption + '" loading="lazy">' +
        '<span class="lookbook-card__caption">' + item.caption + "</span>";
      lookFrag.appendChild(card);
    });

    lookbookEl.appendChild(lookFrag);
  }

  /* ---------------- Customer Reviews ---------------- */
  var reviewsGridEl = document.getElementById("reviewsGrid");

  if (reviewsGridEl && window.ALEXO_REVIEWS && window.ALEXO_REVIEWS.length &&
      !(window.ALEXO_StorefrontApi && window.ALEXO_StorefrontApi.isConfigured())) {
    var reviewFrag = document.createDocumentFragment();

    window.ALEXO_REVIEWS.forEach(function (review) {
      var card = document.createElement("article");
      card.className = "review-card";
      card.innerHTML =
        '<div class="review-card__stars" aria-hidden="true">★★★★★</div>' +
        '<p class="review-card__quote">"' + review.quote + '"</p>' +
        '<p class="review-card__name">— ' + review.name + "</p>";
      reviewFrag.appendChild(card);
    });

    reviewsGridEl.appendChild(reviewFrag);

    var reviewCards = reviewsGridEl.querySelectorAll(".review-card");
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      reviewCards.forEach(function (c) { c.classList.add("is-visible"); });
    } else {
      var reviewObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            obs.unobserve(entry.target);
            var i = Array.prototype.indexOf.call(reviewCards, entry.target);
            setTimeout(function () { entry.target.classList.add("is-visible"); }, i * 90);
          }
        });
      }, { threshold: 0.2 });
      reviewCards.forEach(function (c) { reviewObserver.observe(c); });
    }
  } else if (reviewsGridEl && reviewsGridEl.closest(".reviews")) {
    reviewsGridEl.closest(".reviews").hidden = true;
  }

  /* ---------------- Own Your Style: subtle zoom on enter viewport ---------------- */
  var ownYourStyleEl = document.querySelector(".own-your-style");

  if (ownYourStyleEl) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      ownYourStyleEl.classList.add("is-visible");
    } else {
      var oysObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      oysObserver.observe(ownYourStyleEl);
    }
  }


})();