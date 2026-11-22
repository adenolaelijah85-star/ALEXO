  (function () {
    "use strict";

    /* Local browser storage is used for preview-only profile and address forms. */

  window.ALEXO_formatMoney = function (amount, currency) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN"
    }).format(Number(amount) || 0);
  };

  var PROFILE_KEY = "alexoProfile";
  var ADDRESSES_KEY = "alexoAddresses";
  var ORDERS_KEY = "alexoOrders";

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error("Storage read failed for " + key + ":", e);
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Storage write failed for " + key + ":", e);
    }
  }

  function defaultProfile() {
    return {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      avatar: "",
      accountCredit: 0
    };
  }

  function getProfile() {
    return readJSON(PROFILE_KEY, defaultProfile());
  }
  function saveProfile(profile) {
    var existing = getProfile();
    var merged = Object.assign({}, existing, profile);
    writeJSON(PROFILE_KEY, merged);
    return merged;
  }

  function defaultAddresses() {
    return [];
  }

  function getAddresses() {
    return readJSON(ADDRESSES_KEY, defaultAddresses());
  }
  function addAddress(address) {
    var addresses = getAddresses();
    address.id = "addr-" + Date.now();
    addresses.push(address);
    writeJSON(ADDRESSES_KEY, addresses);
    return addresses;
  }
  function removeAddress(id) {
    var addresses = getAddresses().filter(function (a) { return a.id !== id; });
    writeJSON(ADDRESSES_KEY, addresses);
    return addresses;
  }

  // Progression stages for the visual tracker. "Cancelled" is a separate
  // terminal status, not a stage in this progression.
  var ORDER_STAGES = ["Order Placed", "Processing", "Shipped", "Delivered"];

  function getOrders() {
    return readJSON(ORDERS_KEY, []);
  }
  function getOrderById(id) {
    return getOrders().find(function (o) { return o.id === id; }) || null;
  }
  function getOrderStages() {
    return ORDER_STAGES;
  }

  function createCartService() {
    var STORAGE_KEY = "alexoCart";

    function readCart() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error("Storage read failed for cart:", e);
        return [];
      }
    }

    function writeCart(items) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error("Storage write failed for cart:", e);
      }
    }

    function normalizedItem(item) {
      var id = item.id || String(item.name || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      var size = item.size || "M";
      var color = item.color || "Default";
      var qty = Number(item.qty) || 1;
      return {
        id: id + "-" + String(size).toLowerCase() + "-" + String(color).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        productSku: item.productSku || item.sku || "",
        variantSku: item.variantSku || "",
        name: item.name,
        price: Number(item.price) || 0,
        currency: item.currency || "NGN",
        image: item.image || "",
        color: color,
        colorHex: item.colorHex || "#1a1a1a",
        size: size,
        qty: qty > 0 ? qty : 1
      };
    }

    function getCart() {
      return readCart();
    }

    function setCart(items) {
      var normalized = (items || []).map(normalizedItem);
      writeCart(normalized);
      return normalized;
    }

    function clearCart() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error("Storage clear failed for cart:", e);
      }
      return [];
    }

    function addToCart(item) {
      var cart = readCart();
      var nextItem = normalizedItem(item);
      var existingIndex = cart.findIndex(function (entry) {
        return entry.id === nextItem.id;
      });

      if (existingIndex >= 0) {
        cart[existingIndex].qty += nextItem.qty;
      } else {
        cart.push(nextItem);
      }

      writeCart(cart);
      return cart;
    }

    function removeFromCart(id) {
      var cart = readCart().filter(function (entry) {
        return entry.id !== id;
      });
      writeCart(cart);
      return cart;
    }

    function updateCartItemQty(id, newQty) {
      var cart = readCart();
      var next = Math.max(0, Number(newQty) || 0);
      var updated = cart
        .map(function (entry) {
          if (entry.id !== id) return entry;
          if (next <= 0) return null;
          return Object.assign({}, entry, { qty: next });
        })
        .filter(Boolean);

      writeCart(updated);
      return updated;
    }

    function getCartCount() {
      return readCart().reduce(function (sum, item) {
        return sum + (Number(item.qty) || 0);
      }, 0);
    }

    return {
      getCart: getCart,
      setCart: setCart,
      clearCart: clearCart,
      addToCart: addToCart,
      removeFromCart: removeFromCart,
      updateCartItemQty: updateCartItemQty,
      getCartCount: getCartCount
    };
  }

  function createWishlistService() {
    var STORAGE_KEY = "alexoWishlist";

    function readWishlist() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error("Storage read failed for wishlist:", e);
        return [];
      }
    }

    function writeWishlist(items) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error("Storage write failed for wishlist:", e);
      }
    }

    function normalizeItem(item) {
      return {
        id: item.id || String(item.name || "wishlist-item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        name: item.name,
        price: Number(item.price) || 0,
        wasPrice: item.wasPrice != null ? Number(item.wasPrice) : null,
        image: item.image || "",
        colors: Array.isArray(item.colors) && item.colors.length ? item.colors : [item.colorHex || "#1a1a1a"],
        color: item.color || "",
        size: item.size || null,
        inStock: item.inStock !== false
      };
    }

    function getWishlist() {
      return readWishlist();
    }

    function addToWishlist(item) {
      var list = readWishlist();
      var nextItem = normalizeItem(item);
      var exists = list.some(function (entry) { return entry.id === nextItem.id; });
      if (!exists) {
        list.push(nextItem);
        writeWishlist(list);
      }
      return list;
    }

    function removeFromWishlist(id) {
      var list = readWishlist().filter(function (entry) { return entry.id !== id; });
      writeWishlist(list);
      return list;
    }

    function toggleWishlist(item) {
      var list = readWishlist();
      var nextItem = normalizeItem(item);
      var isSaved = list.some(function (entry) { return entry.id === nextItem.id; });
      var changed = isSaved ? list.filter(function (entry) { return entry.id !== nextItem.id; }) : list.concat([nextItem]);
      writeWishlist(changed);
      return { isNowSaved: !isSaved, list: changed };
    }

    function isInWishlist(id) {
      return readWishlist().some(function (entry) { return entry.id === id; });
    }

    function getWishlistCount() {
      return readWishlist().length;
    }

    return {
      getWishlist: getWishlist,
      addToWishlist: addToWishlist,
      removeFromWishlist: removeFromWishlist,
      toggleWishlist: toggleWishlist,
      isInWishlist: isInWishlist,
      getWishlistCount: getWishlistCount
    };
  }

  window.ALEXO_AccountService = {
    getProfile: getProfile,
    saveProfile: saveProfile,
    getAddresses: getAddresses,
    addAddress: addAddress,
    removeAddress: removeAddress,
    getOrders: getOrders,
    getOrderById: getOrderById,
    getOrderStages: getOrderStages
  };

  window.ALEXO_CartService = createCartService();
  window.ALEXO_WishlistService = createWishlistService();
})();
