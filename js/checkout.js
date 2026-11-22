(function () {
  "use strict";

  var cartService = window.ALEXO_CartService;
  var api = window.ALEXO_StorefrontApi;
  var state = { shippingMinor: 0, shippingCurrency: "NGN", shippingMethod: "" };
  var summaryItemCount = document.getElementById("summaryItemCount");
  var summaryItems = document.getElementById("summaryItems");
  var summarySubtotal = document.getElementById("summarySubtotal");
  var summaryShipping = document.getElementById("summaryShipping");
  var summaryTotal = document.getElementById("summaryTotal");
  var checkoutLayout = document.querySelector(".checkout-layout");
  var confirmation = document.getElementById("orderConfirmation");
  var confirmationMessage = document.getElementById("orderConfirmationMessage");
  var message = document.getElementById("checkoutMessage");
  var placeOrderButton = document.getElementById("placeOrderBtn");
  var deliveryOptions = document.getElementById("deliveryOptions");

  function formatCurrency(minor, currency) {
    var code = currency || "NGN";
    var fractionDigits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code
    }).resolvedOptions().maximumFractionDigits;
    return formatMajor(Number(minor) / Math.pow(10, fractionDigits), code);
  }

  function formatMajor(amount, currency) {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "NGN"
    }).format(Number(amount));
  }

  function setMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("is-error", Boolean(isError));
    message.classList.toggle("is-success", Boolean(text) && !isError);
  }

  function renderSummary() {
    var items = cartService.getCart();
    var count = items.reduce(function (sum, item) { return sum + item.qty; }, 0);
    var subtotal = items.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
    var currency = items[0] && items[0].currency || state.shippingCurrency;

    summaryItemCount.textContent = "(" + count + (count === 1 ? " Item)" : " Items)");
    summaryItems.replaceChildren();
    items.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "summary-item";
      var imageWrap = document.createElement("div");
      imageWrap.className = "summary-item__image";
      var image = document.createElement("img");
      image.src = item.image;
      image.alt = item.name;
      imageWrap.appendChild(image);

      var info = document.createElement("div");
      info.className = "summary-item__info";
      var name = document.createElement("h3");
      name.textContent = item.name;
      var options = document.createElement("span");
      options.textContent = item.color + " / " + item.size;
      var quantity = document.createElement("span");
      quantity.textContent = "Qty: " + item.qty;
      info.append(name, options, quantity);

      var price = document.createElement("div");
      price.className = "summary-item__price";
      price.textContent = formatMajor(item.price * item.qty, item.currency || currency);
      row.append(imageWrap, info, price);
      summaryItems.appendChild(row);
    });

    summarySubtotal.textContent = formatMajor(subtotal, currency);
    summaryShipping.textContent = state.shippingMethod
      ? formatCurrency(state.shippingMinor, state.shippingCurrency)
      : "Choose delivery";
    var shippingMajor = state.shippingMinor /
      Math.pow(10, new Intl.NumberFormat("en", {
        style: "currency",
        currency: state.shippingCurrency
      }).resolvedOptions().maximumFractionDigits);
    summaryTotal.textContent = formatMajor(subtotal + shippingMajor, currency);
    updateButtonState();
  }

  function updateButtonState() {
    var items = cartService.getCart();
    var hasVariantIds = items.length > 0 && items.every(function (item) {
      return item.variantSku && Number.isInteger(Number(item.qty)) && Number(item.qty) > 0;
    });
    placeOrderButton.disabled = !api.isConfigured() || !state.shippingMethod || !hasVariantIds;
  }

  function loadShippingMethods() {
    if (!api.isConfigured()) {
      deliveryOptions.textContent = "Live delivery and payment are not configured yet.";
      setMessage("Checkout is unavailable until Supabase is configured and real product variants are imported.", true);
      return Promise.resolve();
    }

    return api.getShippingMethods().then(function (methods) {
      deliveryOptions.replaceChildren();
      if (!Array.isArray(methods) || methods.length === 0) {
        deliveryOptions.textContent = "No delivery methods are available yet.";
        setMessage("Checkout is unavailable until the store configures a delivery method.", true);
        return;
      }

      methods.forEach(function (method, index) {
        var label = document.createElement("label");
        label.className = "delivery-option" + (index === 0 ? " is-selected" : "");
        var input = document.createElement("input");
        input.type = "radio";
        input.name = "delivery";
        input.value = method.code;
        input.checked = index === 0;
        var dot = document.createElement("span");
        dot.className = "delivery-option__radio";
        var details = document.createElement("span");
        details.className = "delivery-option__info";
        var title = document.createElement("strong");
        title.textContent = method.label;
        var description = document.createElement("span");
        description.textContent = method.description || "";
        details.append(title, description);
        var price = document.createElement("span");
        price.className = "delivery-option__price";
        price.textContent = formatCurrency(method.price_minor, method.currency);
        label.append(input, dot, details, price);
        deliveryOptions.appendChild(label);

        input.addEventListener("change", function () {
          deliveryOptions.querySelectorAll(".delivery-option").forEach(function (option) {
            option.classList.toggle("is-selected", option === label);
          });
          state.shippingMinor = Number(method.price_minor);
          state.shippingCurrency = method.currency;
          state.shippingMethod = method.code;
          setMessage("", false);
          renderSummary();
        });
      });

      var selected = methods[0];
      state.shippingMinor = Number(selected.price_minor);
      state.shippingCurrency = selected.currency;
      state.shippingMethod = selected.code;
      renderSummary();
    }).catch(function (error) {
      deliveryOptions.textContent = "Delivery options could not be loaded.";
      setMessage(error.message, true);
    });
  }

  document.querySelectorAll(".checkout-section:not(.checkout-section--static) > .checkout-section__head").forEach(function (head) {
    head.addEventListener("click", function () {
      head.parentElement.classList.toggle("is-open");
    });
  });

  function checkoutDetails() {
    var firstName = document.getElementById("firstName");
    var lastName = document.getElementById("lastName");
    var email = document.getElementById("email");
    var phone = document.getElementById("phone");
    var address = document.getElementById("address");
    var city = document.getElementById("city");
    var country = document.getElementById("country");
    var required = [email, firstName, lastName, phone, address, city, country];
    var invalid = required.find(function (field) {
      return !field.value.trim() || !field.checkValidity();
    });
    if (invalid) {
      invalid.reportValidity();
      return null;
    }

    return {
      customer: {
        name: firstName.value.trim() + " " + lastName.value.trim(),
        email: email.value.trim(),
        phone: phone.value.trim()
      },
      address: {
        address: address.value.trim(),
        city: city.value.trim(),
        state: document.getElementById("state").value.trim(),
        postalCode: document.getElementById("zip").value.trim(),
        country: country.value.trim()
      },
      shippingMethod: state.shippingMethod,
      items: cartService.getCart().map(function (item) {
        return { variantSku: item.variantSku, quantity: item.qty };
      })
    };
  }

  placeOrderButton.addEventListener("click", function () {
    var payload = checkoutDetails();
    if (!payload) return;
    if (payload.items.some(function (item) { return !item.variantSku; })) {
      setMessage("Your bag contains a sample item. Refresh the catalog after live inventory is connected.", true);
      return;
    }

    placeOrderButton.disabled = true;
    placeOrderButton.querySelector("span").textContent = "Connecting to Paystack…";
    setMessage("", false);
    api.createPayment(payload).then(function (result) {
      if (!result.authorizationUrl || !result.reference || !result.accessToken) {
        throw new Error("The payment service returned an incomplete response.");
      }
      sessionStorage.setItem("alexoCheckout:" + result.reference, result.accessToken);
      window.location.assign(result.authorizationUrl);
    }).catch(function (error) {
      setMessage(error.message, true);
      placeOrderButton.querySelector("span").textContent = "Continue to Paystack";
      updateButtonState();
    });
  });

  function verifyPaymentReturn() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "return") return;
    var reference = params.get("reference") || params.get("trxref") || "";
    var token = reference && (
      sessionStorage.getItem("alexoCheckout:" + reference) ||
      sessionStorage.getItem("adelixCheckout:" + reference)
    );
    if (!reference || !token) {
      setMessage("We could not verify this payment from this browser session. Keep your payment reference and contact the store.", true);
      return;
    }

    placeOrderButton.disabled = true;
    setMessage("Verifying payment with Paystack…", false);
    api.verifyPayment({ reference: reference, accessToken: token }).then(function (result) {
      if (result.status !== "paid" && result.status !== "payment_review") {
        setMessage(result.message || "Payment has not been confirmed yet. You can try verification again shortly.", true);
        placeOrderButton.disabled = false;
        return;
      }
      cartService.clearCart();
      if (window.ALEXO_refreshBagCount) window.ALEXO_refreshBagCount();
      checkoutLayout.hidden = true;
      document.querySelector(".return-to-cart").hidden = true;
      confirmationMessage.textContent = result.status === "payment_review"
        ? "Payment verified. Your order number is " + result.orderNumber + ". The payment arrived after the stock hold expired, so fulfillment needs review."
        : "Payment verified. Your order number is " + result.orderNumber + ".";
      confirmation.hidden = false;
      sessionStorage.removeItem("alexoCheckout:" + reference);
      sessionStorage.removeItem("adelixCheckout:" + reference);
    }).catch(function (error) {
      setMessage(error.message, true);
      placeOrderButton.disabled = false;
    });
  }

  renderSummary();
  loadShippingMethods().then(verifyPaymentReturn);
})();
