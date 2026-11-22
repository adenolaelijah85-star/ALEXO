(function () {
  "use strict";

  var form = document.getElementById("trackOrderForm");
  var status = document.getElementById("trackOrderStatus");
  var result = document.getElementById("trackOrderResult");

  function showMessage(text, isError) {
    status.textContent = text;
    status.classList.toggle("is-error", Boolean(isError));
    status.classList.toggle("is-success", Boolean(text) && !isError);
  }

  function addText(parent, tag, text, className) {
    var element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  function renderOrder(order) {
    var fractionDigits = new Intl.NumberFormat("en", {
      style: "currency",
      currency: order.currency
    }).resolvedOptions().maximumFractionDigits;
    result.replaceChildren();
    addText(result, "h2", "Order " + order.orderNumber);
    addText(result, "p", "Status: " + order.status.replace(/_/g, " "));
    addText(result, "p", "Payment: " + order.paymentStatus);
    addText(result, "p", "Placed " + new Date(order.createdAt).toLocaleDateString());
    addText(result, "p", "Total: " + new Intl.NumberFormat("en", {
      style: "currency",
      currency: order.currency
    }).format(Number(order.totalMinor) / Math.pow(10, fractionDigits)));

    var items = document.createElement("ul");
    (order.items || []).forEach(function (item) {
      addText(items, "li", item.name + " — " + item.color + ", size " + item.size + " × " + item.quantity);
    });
    result.appendChild(items);
    result.hidden = false;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    result.hidden = true;
    result.replaceChildren();
    showMessage("", false);

    if (!window.ALEXO_StorefrontApi.isConfigured()) {
      showMessage("Order tracking is not configured until the Supabase project is connected.", true);
      return;
    }

    var button = form.querySelector("button[type='submit']");
    button.disabled = true;
    window.ALEXO_StorefrontApi.trackOrder({
      orderNumber: document.getElementById("orderNumber").value.trim(),
      email: document.getElementById("orderEmail").value.trim()
    }).then(function (response) {
      if (!response.order) throw new Error("No order matched those details.");
      renderOrder(response.order);
      showMessage("", false);
    }).catch(function (error) {
      showMessage(error.message, true);
    }).finally(function () {
      button.disabled = false;
    });
  });
})();
