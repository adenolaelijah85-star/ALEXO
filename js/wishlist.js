/* ==========================================================================
   ALEXO — Wishlist page
   -----------------------------------------------------------------------
   Reads/writes through window.ALEXO_WishlistService (js/data-service.js)
   only — never localStorage directly — same pattern as the Cart page, so
   swapping in a real backend later means changing that one service file.

   Cards reuse the exact .product-card component (image, wishlist heart,
   swatches, hover-zoom, scroll-reveal animation) from Shop/Best Collection —
   see css/wishlist.css for the small additions layered on top (color
   label, availability line, Add to Bag, Remove).
   ========================================================================== */

(function () {
  "use strict";

  var wishlistService = window.ALEXO_WishlistService;
  var cartService = window.ALEXO_CartService;
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var heading = document.querySelector(".wishlist-heading");
  var itemCountEl = document.getElementById("wishlistItemCount");
  var emptyState = document.getElementById("wishlistEmpty");
  var layout = document.getElementById("wishlistLayout");
  var grid = document.getElementById("wishlistGrid");

  function formatMoney(n) { return window.ALEXO_formatMoney(n); }

  function render() {
    var items = wishlistService.getWishlist();

    itemCountEl.textContent = items.length + (items.length === 1 ? " Item" : " Items");

    if (items.length === 0) {
      layout.hidden = true;
      emptyState.hidden = false;
      return;
    }
    layout.hidden = false;
    emptyState.hidden = true;

    grid.innerHTML = "";
    items.forEach(function (item) {
      grid.appendChild(buildCard(item));
    });

    revealCards();
  }

  function buildCard(item) {
    var card = document.createElement("article");
    card.className = "product-card product-card--wishlist";

    var swatches = (item.colors || [])
      .map(function (c) { return '<span style="background:' + c + '"></span>'; })
      .join("");

    var priceRow = item.wasPrice
      ? formatMoney(item.price) + ' <span class="product-card__price-was">' + formatMoney(item.wasPrice) + "</span>"
      : formatMoney(item.price);

    var availability = item.inStock
      ? '<span class="in-stock">In Stock</span>'
      : '<span class="out-of-stock">Out of Stock</span>';

    var href = "product.html?id=" + encodeURIComponent(item.id || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));

    card.innerHTML =
      '<a class="product-card__link" href="' + href + '" aria-label="View ' + item.name + '">' +
        '<div class="product-card__image-wrap">' +
          '<img src="' + item.image + '" alt="' + item.name + '" loading="lazy">' +
        "</div>" +
      "</a>" +
      '<button class="product-card__wishlist is-active" aria-label="Remove ' + item.name + ' from wishlist" aria-pressed="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
          '<path d="M12 20s-7-4.35-9.5-8.5C.7 8.1 2.3 4.5 6 4.5c2 0 3.3 1 4.5 2.5 1.2-1.5 2.5-2.5 4.5-2.5 3.7 0 5.3 3.6 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5z"/>' +
        "</svg>" +
      "</button>" +
      '<div class="product-card__body">' +
        '<p class="product-card__name">' + item.name + "</p>" +
        (item.color ? '<p class="product-card__color-label">Color: ' + item.color + "</p>" : "") +
        '<p class="product-card__price-row">' + priceRow + "</p>" +
        '<div class="product-card__swatches">' + swatches + "</div>" +
        '<p class="product-card__availability">' +
          (item.size ? "Size: " + item.size + " | " : "") + availability +
        "</p>" +
        '<button class="btn btn--dark btn--block" data-action="add-to-bag"><span>Add to Bag</span></button>' +
        '<button class="product-card__remove" data-action="remove">Remove</button>' +
      "</div>";

    // Heart on the image toggles removal, with a small pop animation.
    var heartBtn = card.querySelector(".product-card__wishlist");
    heartBtn.addEventListener("click", function () {
      animateRemoval(card, function () {
        wishlistService.removeFromWishlist(item.id);
        if (window.ALEXO_refreshWishlistCount) window.ALEXO_refreshWishlistCount();
        render();
      });
    });

    card.querySelector('[data-action="remove"]').addEventListener("click", function () {
      animateRemoval(card, function () {
        wishlistService.removeFromWishlist(item.id);
        if (window.ALEXO_refreshWishlistCount) window.ALEXO_refreshWishlistCount();
        render();
      });
    });

    card.querySelector('[data-action="add-to-bag"]').addEventListener("click", function (e) {
      var btn = e.currentTarget;
      if (!cartService) return;

      cartService.addToCart({
        name: item.name,
        price: item.price,
        image: item.image,
        color: item.colors && item.colors[0] ? item.colors[0] : "",
        colorHex: item.colors && item.colors[0] ? item.colors[0] : "#1a1a1a",
        size: item.size || "M",
        qty: 1
      });
      if (window.ALEXO_refreshBagCount) window.ALEXO_refreshBagCount();

      var span = btn.querySelector("span");
      var original = span.textContent;
      span.textContent = "Added ✓";
      btn.disabled = true;
      setTimeout(function () {
        span.textContent = original;
        btn.disabled = false;
      }, 1400);
    });

    return card;
  }

  function animateRemoval(card, done) {
    if (prefersReducedMotion) { done(); return; }
    card.classList.add("is-removing");
    setTimeout(done, 220);
  }

  function revealCards() {
    var cards = grid.querySelectorAll(".product-card");

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      cards.forEach(function (c) { c.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          obs.unobserve(entry.target);
          var index = Array.prototype.indexOf.call(cards, entry.target);
          setTimeout(function () { entry.target.classList.add("is-visible"); }, (index % 4) * 90);
        }
      });
    }, { threshold: 0.15 });

    cards.forEach(function (c) { observer.observe(c); });
  }

  render();

})();