/* ==========================================================================
   ALEXO — Product Details page behaviour
   ========================================================================== */

(function () {
  "use strict";

  function slugify(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function renderProduct(product) {
  if (!product) {
    showUnavailable("This product could not be loaded.");
    return;
  }

  document.title = product.name + " — ALEXO";

  /* ---------------- Fill in static product info ---------------- */
  document.getElementById("productName").textContent = product.name;
  document.getElementById("breadcrumbProduct").textContent = product.name;
  document.getElementById("productPrice").textContent = window.ALEXO_formatMoney(product.price, product.currency);
  document.getElementById("installmentAmount").textContent = window.ALEXO_formatMoney(product.price / 4, product.currency);
  document.getElementById("productDesc").textContent = product.description;
  var ratingEl = document.querySelector(".product-info__rating");
  if (product.reviewCount > 0) {
    document.getElementById("productStars").textContent = "★★★★★";
    document.getElementById("reviewCountLink").textContent =
      product.rating + " (" + product.reviewCount + " Reviews)";
  } else if (ratingEl) {
    ratingEl.hidden = true;
  }
  var detailsIntro = document.querySelector('[data-panel="details"] > p');
  if (detailsIntro) detailsIntro.textContent = product.description;
  if (!product.reviews || product.reviews.length === 0) {
    var reviewSection = document.querySelector(".pdp-reviews");
    if (reviewSection) reviewSection.hidden = true;
  }

  var detailsListEl = document.getElementById("productDetailsList");
  if (detailsListEl && product.details) {
    product.details.forEach(function (line) {
      var li = document.createElement("li");
      li.textContent = line;
      detailsListEl.appendChild(li);
    });
  }
  var fabricNoteEl = document.getElementById("fabricNote");
  var careNoteEl = document.getElementById("careNote");
  var originNoteEl = document.getElementById("originNote");
  if (fabricNoteEl) fabricNoteEl.textContent = product.fabricNote || "";
  if (careNoteEl) careNoteEl.textContent = product.careNote || "";
  if (originNoteEl) originNoteEl.textContent = product.originNote || "";

  /* ---------------- Gallery ---------------- */
  var mainImage = document.getElementById("galleryMainImage");
  var thumbsEl = document.getElementById("galleryThumbs");
  var dotsEl = document.getElementById("galleryDots");
  var currentIndex = 0;

  function goToImage(index) {
    currentIndex = (index + product.images.length) % product.images.length;
    mainImage.src = product.images[currentIndex];
    mainImage.alt = product.name;

    thumbsEl.querySelectorAll("button").forEach(function (btn, i) {
      btn.classList.toggle("is-active", i === currentIndex);
    });
    dotsEl.querySelectorAll("button").forEach(function (btn, i) {
      btn.classList.toggle("is-active", i === currentIndex);
    });
  }

  product.images.forEach(function (src, index) {
    var thumb = document.createElement("button");
    thumb.setAttribute("aria-label", "View image " + (index + 1));
    thumb.innerHTML = '<img src="' + src + '" alt="">';
    thumb.addEventListener("click", function () { goToImage(index); });
    thumbsEl.appendChild(thumb);

    var dot = document.createElement("button");
    dot.setAttribute("aria-label", "Go to image " + (index + 1));
    dot.addEventListener("click", function () { goToImage(index); });
    dotsEl.appendChild(dot);
  });

  document.getElementById("galleryPrev").addEventListener("click", function () { goToImage(currentIndex - 1); });
  document.getElementById("galleryNext").addEventListener("click", function () { goToImage(currentIndex + 1); });

  if (product.images.length <= 1) {
    document.getElementById("galleryPrev").style.display = "none";
    document.getElementById("galleryNext").style.display = "none";
    thumbsEl.style.display = "none";
    dotsEl.style.display = "none";
  }

  goToImage(0);

  /* ---------------- Color selection ---------------- */
  var colorSelectEl = document.getElementById("colorSelect");
  var selectedColorLabel = document.getElementById("selectedColorLabel");

  product.colors.forEach(function (color, index) {
    var btn = document.createElement("button");
    btn.style.background = color.hex;
    btn.setAttribute("aria-label", color.name);
    if (index === 0) {
      btn.classList.add("is-active");
      selectedColorLabel.textContent = color.name;
    }
    btn.addEventListener("click", function () {
      colorSelectEl.querySelectorAll("button").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      selectedColorLabel.textContent = color.name;
      syncVariantSelection();
    });
    colorSelectEl.appendChild(btn);
  });

  /* ---------------- Size selection ---------------- */
  var sizeSelectEl = document.getElementById("sizeSelect");
  var selectedSizeLabel = document.getElementById("selectedSizeLabel");
  var defaultSizeIndex = typeof product.defaultSizeIndex === "number" ? product.defaultSizeIndex : 0;

  product.sizes.forEach(function (size, index) {
    var btn = document.createElement("button");
    btn.textContent = size;
    if (index === defaultSizeIndex) {
      btn.classList.add("is-active");
      selectedSizeLabel.textContent = size;
    }
    btn.addEventListener("click", function () {
      sizeSelectEl.querySelectorAll("button").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      selectedSizeLabel.textContent = size;
      syncVariantSelection();
    });
    sizeSelectEl.appendChild(btn);
  });

  if (product.variants && product.variants.length) {
    var firstVariant = product.variants[0];
    colorSelectEl.querySelectorAll("button").forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("aria-label") === firstVariant.color);
    });
    sizeSelectEl.querySelectorAll("button").forEach(function (button) {
      button.classList.toggle("is-active", button.textContent === firstVariant.size);
    });
    selectedColorLabel.textContent = firstVariant.color;
    selectedSizeLabel.textContent = firstVariant.size;
  }

  function selectedVariant() {
    return (product.variants || []).find(function (variant) {
      return variant.size === selectedSizeLabel.textContent &&
        variant.color === selectedColorLabel.textContent;
    }) || null;
  }

  function syncVariantSelection() {
    var variant = selectedVariant();
    var addButton = document.getElementById("addToBagBtn");
    if (product.variants && !variant) {
      addButton.disabled = true;
      return;
    }
    if (!variant) return;

    product.price = variant.price;
    product.currency = variant.currency;
    document.getElementById("productPrice").textContent =
      window.ALEXO_formatMoney(variant.price, variant.currency);
    document.getElementById("installmentAmount").textContent =
      window.ALEXO_formatMoney(variant.price / 4, variant.currency);
    qty = Math.max(1, Math.min(qty, variant.stock));
    qtyValueEl.textContent = qty;
    addButton.disabled = variant.stock < 1;
  }

  /* ---------------- Quantity stepper ---------------- */
  var qtyValueEl = document.getElementById("qtyValue");
  var qty = 1;

  document.getElementById("qtyMinus").addEventListener("click", function () {
    if (qty > 1) { qty -= 1; qtyValueEl.textContent = qty; }
  });
  document.getElementById("qtyPlus").addEventListener("click", function () {
    var variant = selectedVariant();
    var limit = variant ? Math.min(20, variant.stock) : 10;
    if (qty < limit) { qty += 1; qtyValueEl.textContent = qty; }
  });
  syncVariantSelection();

  /* ---------------- Wishlist (info-panel button + on-image heart stay in sync) ---------------- */
  var wishlistBtn = document.getElementById("wishlistBtn");
  var galleryWishlistBtn = document.getElementById("galleryWishlistBtn");

  function currentWishlistId() {
    return product.id || product.sku || slugify(product.name);
  }
  function syncWishlistButtons(isActive) {
    wishlistBtn.classList.toggle("is-active", isActive);
    wishlistBtn.setAttribute("aria-pressed", String(isActive));
    galleryWishlistBtn.classList.toggle("is-active", isActive);
    galleryWishlistBtn.setAttribute("aria-pressed", String(isActive));
  }

  function handleWishlistClick() {
    if (!window.ALEXO_WishlistService) return;
    var selectedColorBtn = colorSelectEl.querySelector("button.is-active");
    var selectedSizeBtn = sizeSelectEl.querySelector("button.is-active");
    var result = window.ALEXO_WishlistService.toggleWishlist({
      id: currentWishlistId(),
      name: product.name,
      price: product.price,
      wasPrice: product.compareAtPrice || null,
      image: product.images[0],
      colors: [selectedColorBtn ? selectedColorBtn.style.background : product.colors[0].hex],
      color: selectedColorBtn ? selectedColorBtn.getAttribute("aria-label") : product.colors[0].name,
      size: selectedSizeBtn ? selectedSizeBtn.textContent : product.sizes[0],
      inStock: true
    });
    syncWishlistButtons(result.isNowSaved);
    if (window.ALEXO_refreshWishlistCount) window.ALEXO_refreshWishlistCount();
  }

  wishlistBtn.addEventListener("click", handleWishlistClick);
  galleryWishlistBtn.addEventListener("click", handleWishlistClick);

  // Reflect saved state for the default color/size on load.
  if (window.ALEXO_WishlistService) {
    syncWishlistButtons(window.ALEXO_WishlistService.isInWishlist(currentWishlistId()));
  }

  /* ---------------- Add to Bag: real cart persistence via the data service ---------------- */
  var addToBagBtn = document.getElementById("addToBagBtn");
  addToBagBtn.addEventListener("click", function () {
    var selectedColorBtn = colorSelectEl.querySelector("button.is-active");
    var selectedSizeBtn = sizeSelectEl.querySelector("button.is-active");
    var colorName = selectedColorLabel.textContent;
    var colorHex = selectedColorBtn ? selectedColorBtn.style.background : "#1a1a1a";
    var sizeName = selectedSizeBtn ? selectedSizeBtn.textContent : product.sizes[0];

    window.ALEXO_CartService.addToCart({
      id: product.id || product.sku || slugify(product.name),
      productSku: product.sku || "",
      variantSku: (selectedVariant() || {}).variantSku || "",
      name: product.name,
      price: product.price,
      currency: product.currency || "NGN",
      image: product.images[0],
      color: colorName,
      colorHex: colorHex,
      size: sizeName,
      qty: qty
    });

    if (window.ALEXO_refreshBagCount) window.ALEXO_refreshBagCount();

    var span = addToBagBtn.querySelector("span");
    var original = span.textContent;
    span.textContent = "Added ✓";
    addToBagBtn.disabled = true;
    setTimeout(function () {
      span.textContent = original;
      addToBagBtn.disabled = false;
    }, 1600);
  });

  /* ---------------- Tabs (desktop) / Accordion (mobile) ---------------- */
  var tabButtons = document.querySelectorAll(".pdp-tabs__btn");
  var tabPanels = document.querySelectorAll(".pdp-tabs__panel");
  var mobileQuery = window.matchMedia("(max-width: 860px)");

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-tab");
      var targetPanel = document.querySelector('.pdp-tabs__panel[data-panel="' + target + '"]');

      if (mobileQuery.matches) {
        // Accordion: toggle independently, others unaffected.
        var isOpen = btn.classList.toggle("is-active");
        targetPanel.classList.toggle("is-active", isOpen);
      } else {
        // Tabs: exclusive selection.
        tabButtons.forEach(function (b) { b.classList.remove("is-active"); });
        tabPanels.forEach(function (p) { p.classList.remove("is-active"); });
        btn.classList.add("is-active");
        targetPanel.classList.add("is-active");
      }
    });
  });

  /* ---------------- Size guide modal ---------------- */
  var sizeGuideModal = document.getElementById("sizeGuideModal");
  var sizeGuideBackdrop = document.getElementById("sizeGuideBackdrop");

  function openSizeGuide() {
    sizeGuideModal.classList.add("is-open");
    sizeGuideBackdrop.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeSizeGuide() {
    sizeGuideModal.classList.remove("is-open");
    sizeGuideBackdrop.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  document.getElementById("openSizeGuide").addEventListener("click", openSizeGuide);
  document.getElementById("closeSizeGuide").addEventListener("click", closeSizeGuide);
  sizeGuideBackdrop.addEventListener("click", closeSizeGuide);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSizeGuide();
  });

  /* ---------------- Reviews ---------------- */
  var pdpReviewsGrid = document.getElementById("pdpReviewsGrid");

  if (pdpReviewsGrid && product.reviews && product.reviews.length) {
    product.reviews.forEach(function (review) {
      var card = document.createElement("article");
      card.className = "pdp-review-card";
      card.innerHTML =
        '<span class="stars" aria-hidden="true">' + "★".repeat(review.rating) + "</span>" +
        "<p>" + review.quote + "</p>" +
        "<span>— " + review.name + "</span>";
      pdpReviewsGrid.appendChild(card);
    });
  }

  }

  function showUnavailable(message) {
    var title = document.getElementById("productName");
    var description = document.getElementById("productDesc");
    var addToBag = document.getElementById("addToBagBtn");
    if (title) title.textContent = "Product unavailable";
    if (description) description.textContent = message;
    if (addToBag) addToBag.disabled = true;
  }

  function fromCatalog(item) {
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      price: item.price,
      currency: item.currency,
      compareAtPrice: item.compareAtPrice,
      description: item.description,
      images: item.images,
      colors: item.colors,
      sizes: item.sizes,
      variants: item.variants,
      details: [],
      reviews: [],
      defaultSizeIndex: 0
    };
  }

  var api = window.ALEXO_StorefrontApi;
  if (api && api.isConfigured()) {
    api.getCatalog().then(function (catalog) {
      var params = new URLSearchParams(window.location.search);
      var requestedId = params.get("id");
      var requestedName = params.get("p");
      var item = catalog.find(function (candidate) {
        return requestedId
          ? candidate.id === requestedId || candidate.sku === requestedId
          : requestedName
            ? candidate.name === requestedName
            : false;
      });
      if (!item) {
        showUnavailable("This item is not available in the current live catalog.");
        return;
      }
      renderProduct(fromCatalog(item));
    }).catch(function (error) {
      console.error("Could not load live product:", error);
      showUnavailable("The product could not be loaded. Please try again later.");
    });
  } else {
    var catalog = window.ALEXO_PRODUCTS || [];
    var params = new URLSearchParams(window.location.search);
    var requestedId = params.get("id");
    var requestedName = params.get("p");
    var match = requestedId || requestedName
      ? catalog.find(function (item) {
          var id = item.id || slugify(item.name);
          return requestedId ? id === requestedId : item.name === requestedName;
        })
      : catalog[0];
    if (!match) {
      showUnavailable("This sample item could not be found.");
      return;
    }

    var product = Object.assign({}, match, {
      images: match.images && match.images.length ? match.images : [match.image],
      colors: (match.colors || []).map(function (color, index) {
        return typeof color === "object"
          ? color
          : { name: (match.colorNames && match.colorNames[index]) || "Color " + (index + 1), hex: color };
      }),
      sizes: match.sizes || [],
      details: match.details || [],
      reviews: match.reviews || [],
      reviewCount: match.reviewCount || (match.reviews || []).length,
      defaultSizeIndex: Number.isInteger(match.defaultSizeIndex) ? match.defaultSizeIndex : 0
    });
    renderProduct(product);
  }

})();