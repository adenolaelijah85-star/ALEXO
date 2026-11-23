(function () {
  "use strict";

  var config = window.ALEXO_BACKEND_CONFIG || {};
  window.ALEXO_checkoutEnabled = false;

  function isConfigured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || "") &&
      typeof config.supabaseAnonKey === "string" &&
      config.supabaseAnonKey.length > 20;
  }

  if (!isConfigured() && document.body) {
    var previewNotice = document.createElement("aside");
    previewNotice.className = "storefront-status-banner";
    previewNotice.setAttribute("role", "status");
    previewNotice.textContent =
      "Preview mode: products are sample data. Live payments and order tracking are disabled until setup is complete.";
    document.body.insertBefore(previewNotice, document.body.firstChild);
  }

  function requireConfig() {
    if (!isConfigured()) {
      throw new Error("The storefront backend has not been configured.");
    }
  }

  function headers() {
    requireConfig();
    return {
      apikey: config.supabaseAnonKey,
      Authorization: "Bearer " + config.supabaseAnonKey,
      "Content-Type": "application/json"
    };
  }

  function readResponse(response) {
    return response.text().then(function (text) {
      var payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(payload.error || "The store service could not complete the request.");
      }
      return payload;
    });
  }

  function invoke(name, payload) {
    requireConfig();
    return fetch(config.supabaseUrl + "/functions/v1/" + name, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload)
    }).then(readResponse);
  }

  function toMajorUnits(minorUnits, currency) {
    var digits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency
    }).resolvedOptions().maximumFractionDigits;
    return Number(minorUnits) / Math.pow(10, digits);
  }

  function getCatalog() {
    requireConfig();
    var url = config.supabaseUrl +
      "/rest/v1/storefront_catalog?select=id,sku,name,description,category,brand,gender,is_featured,is_new,variants,images&order=name.asc";
    return fetch(url, { headers: headers() }).then(readResponse).then(function (rows) {
      if (!Array.isArray(rows)) throw new Error("The product catalog response is invalid.");
      return rows.map(function (row) {
        var variants = (row.variants || []).map(function (variant) {
          return {
            variantSku: variant.sku,
            size: variant.size,
            color: variant.color,
            colorHex: variant.colorHex,
            currency: variant.currency,
            priceMinor: Number(variant.priceMinor),
            compareAtPriceMinor: variant.compareAtPriceMinor == null ? null : Number(variant.compareAtPriceMinor),
            price: toMajorUnits(variant.priceMinor, variant.currency),
            compareAtPrice: variant.compareAtPriceMinor == null
              ? null
              : toMajorUnits(variant.compareAtPriceMinor, variant.currency),
            stock: Number(variant.stock)
          };
        });
        var images = (row.images || []).map(function (image) { return image.url; }).filter(Boolean);
        var available = variants.filter(function (variant) { return variant.stock > 0; });
        var prices = available.map(function (variant) { return variant.price; });
        var currencies = available.map(function (variant) { return variant.currency; });
        var colors = [];
        available.forEach(function (variant) {
          if (!colors.some(function (color) { return color.hex === variant.colorHex; })) {
            colors.push({ name: variant.color, hex: variant.colorHex });
          }
        });
        return {
          id: row.id,
          sku: row.sku,
          name: row.name,
          description: row.description,
          category: row.category,
          brand: row.brand || "",
          gender: row.gender,
          featured: Boolean(row.is_featured),
          newArrival: Boolean(row.is_new),
          onSale: available.some(function (variant) {
            return variant.compareAtPriceMinor != null &&
              variant.compareAtPriceMinor > variant.priceMinor;
          }),
          image: images[0] || "",
          images: images,
          variants: available,
          colors: colors,
          colorNames: colors.map(function (color) { return color.name; }),
          sizes: Array.from(new Set(available.map(function (variant) { return variant.size; }))),
          stock: available.reduce(function (sum, variant) { return sum + variant.stock; }, 0),
          currency: currencies[0] || "NGN",
          price: prices.length ? Math.min.apply(Math, prices) : 0,
          salePrice: prices.length ? Math.min.apply(Math, prices) : 0,
          compareAtPrice: available.reduce(function (max, variant) {
            return Math.max(max, variant.compareAtPrice || 0);
          }, 0) || null
        };
      }).filter(function (product) {
        return product.stock > 0 && product.images.length > 0;
      });
    });
  }

  function getPublicSettings() {
    requireConfig();
    var url = config.supabaseUrl +
      "/rest/v1/storefront_public_settings?select=store_name,support_email,country,privacy_url,terms_url,shipping_policy_url,returns_policy_url,social_urls,checkout_enabled";
    return fetch(url, { headers: headers() }).then(readResponse);
  }

  function secureUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function setLinkVisibility(link, visible) {
    link.hidden = !visible;
    if (visible) link.removeAttribute("aria-disabled");
    else link.setAttribute("aria-disabled", "true");
    if (link.parentElement && link.parentElement.tagName === "LI") {
      link.parentElement.hidden = !visible;
    }
  }

  function updateFooterVisibility() {
    document.querySelectorAll(".site-footer__social").forEach(function (group) {
      group.hidden = !group.querySelector("a:not([hidden])");
    });
    document.querySelectorAll("[data-dynamic-links]").forEach(function (group) {
      group.hidden = !group.querySelector("a[href]:not([hidden])");
    });
  }

  function applyCheckoutAvailability(settings) {
    var enabled = Boolean(settings && settings.checkout_enabled === true);
    window.ALEXO_checkoutEnabled = enabled;
    document.querySelectorAll("[data-checkout-enabled-text][data-checkout-disabled-text]").forEach(function (element) {
      element.textContent = enabled
        ? element.getAttribute("data-checkout-enabled-text")
        : element.getAttribute("data-checkout-disabled-text");
    });
    window.dispatchEvent(new CustomEvent("alexo:checkout-availability", {
      detail: { enabled: enabled }
    }));
  }

  function applyPublicSettings(settings) {
    document.querySelectorAll("[data-policy]").forEach(function (link) {
      var url = secureUrl(settings[link.getAttribute("data-policy")]);
      if (url) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        setLinkVisibility(link, true);
      } else {
        setLinkVisibility(link, false);
      }
    });
    document.querySelectorAll("[data-social]").forEach(function (link) {
      var social = settings.social_urls || {};
      var url = secureUrl(social[link.getAttribute("data-social")]);
      if (url) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        setLinkVisibility(link, true);
      } else {
        setLinkVisibility(link, false);
      }
    });
    document.querySelectorAll("[data-store-email]").forEach(function (link) {
      var email = String(settings.support_email || "");
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        link.href = "mailto:" + email;
        link.textContent = email;
        setLinkVisibility(link, true);
      } else {
        setLinkVisibility(link, false);
      }
    });
    document.querySelectorAll("[data-store-contact-placeholder]").forEach(function (element) {
      element.hidden = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(settings.support_email || ""));
    });
    document.querySelectorAll("[data-store-name]").forEach(function (element) {
      element.textContent = settings.store_name || "";
    });
    document.querySelectorAll("[data-store-country]").forEach(function (element) {
      element.textContent = settings.country || "";
      element.hidden = !settings.country;
    });
    updateFooterVisibility();
  }

  window.ALEXO_StorefrontApi = {
    isConfigured: isConfigured,
    getCatalog: getCatalog,
    getPublicSettings: getPublicSettings,
    getShippingMethods: function () {
      requireConfig();
      var url = config.supabaseUrl +
        "/rest/v1/store_shipping_methods?select=code,label,description,currency,price_minor&is_active=eq.true&order=price_minor.asc";
      return fetch(url, { headers: headers() }).then(readResponse);
    },
    createPayment: function (payload) {
      return invoke("create-payment", payload);
    },
    verifyPayment: function (payload) {
      return invoke("verify-payment", payload);
    },
    trackOrder: function (payload) {
      return invoke("track-order", payload);
    }
  };

  document.querySelectorAll('a[href="#"]').forEach(function (link) {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    if (link.hasAttribute("data-policy") || link.hasAttribute("data-social") ||
        link.hasAttribute("data-store-email")) {
      setLinkVisibility(link, false);
    }
  });
  updateFooterVisibility();

  if (isConfigured()) {
    getPublicSettings().then(function (rows) {
      var settings = Array.isArray(rows) ? rows[0] : null;
      if (settings) applyPublicSettings(settings);
      applyCheckoutAvailability(settings);
      if (!settings || !settings.checkout_enabled) {
        var setupNotice = document.createElement("aside");
        setupNotice.className = "storefront-status-banner";
        setupNotice.setAttribute("role", "status");
        setupNotice.textContent =
          "The live backend is connected, but checkout is closed until verified products, delivery, contact details, and policies are configured.";
        document.body.insertBefore(setupNotice, document.body.firstChild);
      }
    }).catch(function (error) {
      applyCheckoutAvailability(null);
      console.error("Could not load storefront settings:", error);
    });
  } else {
    applyCheckoutAvailability(null);
  }
})();
