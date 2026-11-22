/* ==========================================================================
   ALEXO — Cart page
   Cart state is read/written through window.ALEXO_CartService (js/data-service.js)
   rather than localStorage directly, so swapping in a real backend later only
   requires changing that one service file — this page never touches storage itself.
   The cart starts empty and never inserts sample items.
   ========================================================================== */

(function () {
  "use strict";

  function slugify(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  var FREE_SHIPPING_THRESHOLD = 100;
  var STANDARD_SHIPPING = 8;
  var VALID_PROMO = { code: "ALEXO30", discount: 30 };
  var cartService = window.ALEXO_CartService;

  var state = {
    items: [],
    discount: 0,
    promoApplied: false
  };

  var existingCart = cartService.getCart();
  state.items = existingCart;

  /* ---------------- DOM refs ---------------- */

  var cartHeading = document.getElementById("cartHeading");
  var shippingProgress = document.getElementById("shippingProgress");
  var cartLayout = document.getElementById("cartLayout");
  var cartEmpty = document.getElementById("cartEmpty");
  var cartItemsList = document.getElementById("cartItemsList");
  var subtotalLabel = document.getElementById("subtotalLabel");
  var subtotalValue = document.getElementById("subtotalValue");
  var shippingValue = document.getElementById("shippingValue");
  var discountRow = document.getElementById("discountRow");
  var discountValue = document.getElementById("discountValue");
  var totalValue = document.getElementById("totalValue");
  var promoForm = document.getElementById("promoForm");
  var promoInput = document.getElementById("promoInput");
  var promoMessage = document.getElementById("promoMessage");
  var checkoutBtn = document.getElementById("checkoutBtn");

  /* ---------------- Rendering ---------------- */

  function formatMoney(n) {
    return window.ALEXO_formatMoney(n);
  }

  function itemCount() {
    return state.items.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function subtotal() {
    return state.items.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  }

  function createIcon(path, strokeWidth) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", strokeWidth);
    var pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("d", path);
    svg.appendChild(pathElement);
    return svg;
  }

  function createActionButton(action, label, iconPath, strokeWidth) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "cart-item__action";
    button.setAttribute("data-action", action);
    button.appendChild(createIcon(iconPath, strokeWidth));
    button.appendChild(document.createTextNode(label));
    return button;
  }

  function createCartItem(item) {
    var row = document.createElement("div");
    row.className = "cart-item";

    var main = document.createElement("div");
    main.className = "cart-item__main";
    var imageWrap = document.createElement("div");
    imageWrap.className = "cart-item__image";
    var image = document.createElement("img");
    image.src = item.image || "";
    image.alt = item.name || "";
    imageWrap.appendChild(image);

    var info = document.createElement("div");
    info.className = "cart-item__info";
    var name = document.createElement("h3");
    name.textContent = item.name || "";
    var colorMeta = document.createElement("div");
    colorMeta.className = "cart-item__meta";
    var swatch = document.createElement("span");
    swatch.className = "cart-item__swatch";
    swatch.style.backgroundColor = /^#[\da-f]{3,8}$/i.test(item.colorHex || "")
      ? item.colorHex
      : "#1a1a1a";
    colorMeta.append(swatch, document.createTextNode(" Color: " + (item.color || "")));

    var sizeMeta = document.createElement("div");
    sizeMeta.className = "cart-item__meta";
    sizeMeta.textContent = "Size: " + (item.size || "");

    var stepper = document.createElement("div");
    stepper.className = "cart-item__stepper quantity-stepper";
    var decrease = document.createElement("button");
    decrease.type = "button";
    decrease.setAttribute("data-action", "decrease");
    decrease.setAttribute("aria-label", "Decrease quantity");
    decrease.textContent = "−";
    var quantity = document.createElement("span");
    quantity.textContent = String(item.qty);
    var increase = document.createElement("button");
    increase.type = "button";
    increase.setAttribute("data-action", "increase");
    increase.setAttribute("aria-label", "Increase quantity");
    increase.textContent = "+";
    stepper.append(decrease, quantity, increase);

    var mobileFooter = document.createElement("div");
    mobileFooter.className = "cart-item__mobile-footer";
    var mobilePrice = document.createElement("span");
    mobilePrice.className = "cart-item__mobile-price";
    mobilePrice.textContent = formatMoney(item.price * item.qty);
    mobileFooter.appendChild(mobilePrice);

    var actions = document.createElement("div");
    actions.className = "cart-item__actions";
    actions.append(
      createActionButton("remove", "Remove", "M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7", "1.6"),
      createActionButton("wishlist", "Move to Wishlist", "M12 20s-7-4.35-9.5-8.5C.7 8.1 2.3 4.5 6 4.5c2 0 3.3 1 4.5 2.5 1.2-1.5 2.5-2.5 4.5-2.5 3.7 0 5.3 3.6 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5z", "1.6")
    );
    info.append(name, colorMeta, sizeMeta, stepper, mobileFooter, actions);
    main.append(imageWrap, info);

    var mobileWishlist = document.createElement("button");
    mobileWishlist.type = "button";
    mobileWishlist.className = "cart-item__wishlist-mobile";
    mobileWishlist.setAttribute("data-action", "wishlist");
    mobileWishlist.setAttribute("aria-label", "Move " + (item.name || "item") + " to wishlist");
    mobileWishlist.appendChild(createIcon("M12 20s-7-4.35-9.5-8.5C.7 8.1 2.3 4.5 6 4.5c2 0 3.3 1 4.5 2.5 1.2-1.5 2.5-2.5 4.5-2.5 3.7 0 5.3 3.6 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5z", "1.8"));

    var price = document.createElement("span");
    price.className = "cart-item__price";
    price.textContent = formatMoney(item.price);
    var total = document.createElement("span");
    total.className = "cart-item__total";
    total.textContent = formatMoney(item.price * item.qty);
    row.append(main, mobileWishlist, price, total);
    return row;
  }

  function render() {
    var count = itemCount();
    var sub = subtotal();
    var qualifiesForFreeShipping = sub >= FREE_SHIPPING_THRESHOLD;
    var shippingCost = state.items.length === 0 ? 0 : (qualifiesForFreeShipping ? 0 : STANDARD_SHIPPING);
    var total = sub - state.discount + shippingCost;

    /* Heading + free-shipping message (never contradictory) */
    cartHeading.textContent = "Your Shopping Bag" + (count ? " (" + count + ")" : "");
    if (window.ALEXO_refreshBagCount) window.ALEXO_refreshBagCount();

    if (state.items.length === 0) {
      shippingProgress.textContent = "";
      shippingProgress.className = "";
    } else if (qualifiesForFreeShipping) {
      shippingProgress.textContent = "You qualify for FREE shipping.";
      shippingProgress.className = "is-qualified";
    } else {
      var remaining = FREE_SHIPPING_THRESHOLD - sub;
      shippingProgress.replaceChildren(
        document.createTextNode("You are "),
        document.createElement("strong"),
        document.createTextNode(" away from free shipping.")
      );
      shippingProgress.querySelector("strong").textContent = formatMoney(remaining);
      shippingProgress.className = "";
    }

    /* Empty state */
    if (state.items.length === 0) {
      cartLayout.hidden = true;
      cartEmpty.hidden = false;
      return;
    }
    cartLayout.hidden = false;
    cartEmpty.hidden = true;

    /* Item rows */
    cartItemsList.replaceChildren();
    state.items.forEach(function (item) {
      var row = createCartItem(item);

      row.querySelector('[data-action="increase"]').addEventListener("click", function () {
        updateQty(item.id, item.qty + 1);
      });
      row.querySelector('[data-action="decrease"]').addEventListener("click", function () {
        updateQty(item.id, item.qty - 1);
      });
      row.querySelector('[data-action="remove"]').addEventListener("click", function () {
        removeItem(item.id);
      });
      row.querySelectorAll('[data-action="wishlist"]').forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (window.ALEXO_WishlistService) {
            window.ALEXO_WishlistService.addToWishlist({
              id: slugify(item.name), // product-level, matching every other wishlist entry point
              name: item.name,
              price: item.price,
              image: item.image,
              colors: [item.colorHex],
              color: item.color,
              size: item.size,
              inStock: true
            });
            if (window.ALEXO_refreshWishlistCount) window.ALEXO_refreshWishlistCount();
          }
          removeItem(item.id);
        });
      });

      cartItemsList.appendChild(row);
    });

    /* Summary */
    subtotalLabel.textContent = "Subtotal (" + count + (count === 1 ? " item)" : " items)");
    subtotalValue.textContent = formatMoney(sub);
    shippingValue.textContent = shippingCost === 0 ? "FREE" : formatMoney(shippingCost);
    if (state.discount > 0) {
      discountRow.hidden = false;
      discountValue.textContent = "-" + formatMoney(state.discount);
    } else {
      discountRow.hidden = true;
    }
    totalValue.textContent = formatMoney(Math.max(total, 0));
  }

  /* ---------------- Mutations ---------------- */

  function updateQty(id, newQty) {
    state.items = cartService.updateCartItemQty(id, newQty);
    render();
  }

  function removeItem(id) {
    state.items = cartService.removeFromCart(id);
    render();
  }

  /* ---------------- Promo code ---------------- */

  promoForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var entered = promoInput.value.trim().toUpperCase();

    if (!entered) return;

    if (entered === VALID_PROMO.code) {
      state.discount = VALID_PROMO.discount;
      promoMessage.textContent = "Promo code applied — " + formatMoney(VALID_PROMO.discount) + " off.";
      promoMessage.className = "promo-message is-success";
    } else {
      state.discount = 0;
      promoMessage.textContent = "That code isn't valid.";
      promoMessage.className = "promo-message is-error";
    }
    render();
  });

  /* ---------------- Checkout ---------------- */

  checkoutBtn.addEventListener("click", function () {
    window.location.href = "checkout.html";
  });

  render();

})();