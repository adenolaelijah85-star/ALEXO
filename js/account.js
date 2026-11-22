(function () {
  "use strict";

  var auth = window.ALEXO_Auth;
  var accountLayout = document.getElementById("accountLayout");
  var accountStatus = document.getElementById("accountStatus");

  function showAccountError(error) {
    accountStatus.hidden = false;
    accountStatus.textContent = "Account request failed: " +
      (error && error.message ? error.message : "Please try again.");
  }

  if (!auth || !auth.isConfigured()) {
    showAccountError(new Error("Supabase authentication is not configured."));
    return;
  }

  auth.getUser().then(function (user) {
    if (!user) {
      window.location.replace("login.html?next=account.html");
      return;
    }
    return auth.loadAccountData(user).then(function (data) {
      accountLayout.hidden = false;
      accountStatus.hidden = true;
      initializeAccount(user, data);
    });
  }).catch(showAccountError);

  function initializeAccount(user, accountData) {
  var accountService = window.ALEXO_AccountService;
  var wishlistService = window.ALEXO_WishlistService;
  var profile = accountData.profile;
  var addresses = accountData.addresses;
  var orders = [];

  function reportDataError(error) {
    accountStatus.hidden = false;
    accountStatus.textContent = "Could not save your account details: " +
      (error && error.message ? error.message : "Please try again.");
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  /* ---------------- Panel switching ---------------- */
  var navItems = document.querySelectorAll(".account-nav__item[data-panel]");
  var panels = document.querySelectorAll(".account-panel");
  var mobileSelect = document.getElementById("accountNavMobile");

  function showPanel(name) {
    navItems.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-panel") === name);
    });
    panels.forEach(function (panel) {
      panel.classList.toggle("is-active", panel.getAttribute("data-panel") === name);
    });
    if (mobileSelect) mobileSelect.value = name;
  }

  document.querySelectorAll("[data-panel-link]").forEach(function (link) {
    link.addEventListener("click", function () {
      var panel = link.getAttribute("data-panel-link");
      if (panel) showPanel(panel);
    });
  });

  navItems.forEach(function (btn) {
    btn.addEventListener("click", function () {
      showPanel(btn.getAttribute("data-panel"));
    });
  });
  if (mobileSelect) {
    mobileSelect.addEventListener("change", function () {
      showPanel(mobileSelect.value);
    });
  }

  /* ---------------- Dashboard ---------------- */
  function formatMoney(n) { return window.ALEXO_formatMoney(n); }
  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function renderOrderTracker(order) {
    var stages = accountService.getOrderStages();
    var steps = stages.map(function (stage, i) {
      var isComplete = i <= order.stageIndex;
      return (
        '<div class="order-tracker__step' + (isComplete ? " is-complete" : "") +
        (i === order.stageIndex ? " is-active" : "") + '">' +
          '<div class="order-tracker__dot">' + (isComplete ? "✓" : i + 1) + "</div>" +
          '<div class="order-tracker__label">' + stage + "</div>" +
        "</div>"
      );
    }).join("");
    return '<div class="order-tracker">' + steps + "</div>";
  }

  function renderOrderCard(order) {
    var itemsImgs = order.items.map(function (item) {
      return '<img src="' + item.image + '" alt="' + item.name + '">';
    }).join("");

    return (
      '<div class="order-card" data-order-id="' + order.id + '">' +
        '<div class="order-card__head">' +
          "<div>" +
            "<h3>Order #" + order.id + "</h3>" +
            "<span>Placed " + formatDate(order.date) + "</span>" +
          "</div>" +
          '<div class="order-card__total">' + formatMoney(order.total) + "</div>" +
        "</div>" +
        '<div class="order-card__items">' + itemsImgs + "</div>" +
        renderOrderTracker(order) +
      "</div>"
    );
  }

  function bindOrderCards(container) {
    if (!container) return;
    container.querySelectorAll(".order-card").forEach(function (card) {
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      function openOrder() {
        renderOrderDetail(accountService.getOrderById(card.getAttribute("data-order-id")));
      }
      card.addEventListener("click", openOrder);
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openOrder();
        }
      });
    });
  }

  function renderDashboard() {
    var sidebarFirstName = document.getElementById("sidebarFirstName");
    var sidebarEmail = document.getElementById("sidebarEmail");
    var sidebarAvatar = document.getElementById("sidebarAvatar");
    var profileCardName = document.getElementById("profileCardName");
    var profileCardEmail = document.getElementById("profileCardEmail");
    var profileCardPhone = document.getElementById("profileCardPhone");
    var profileCardAvatar = document.getElementById("profileCardAvatar");

    if (sidebarFirstName) sidebarFirstName.textContent = profile.firstName;
    if (sidebarEmail) sidebarEmail.textContent = profile.email;
    if (sidebarAvatar) {
      sidebarAvatar.src = profile.avatar;
      sidebarAvatar.alt = profile.firstName + " " + profile.lastName;
      sidebarAvatar.hidden = !profile.avatar;
    }
    if (profileCardName) profileCardName.textContent = profile.firstName + " " + profile.lastName;
    if (profileCardEmail) profileCardEmail.textContent = profile.email;
    if (profileCardPhone) profileCardPhone.textContent = profile.phone;
    if (profileCardAvatar) {
      profileCardAvatar.src = profile.avatar;
      profileCardAvatar.alt = profile.firstName + " " + profile.lastName;
      profileCardAvatar.hidden = !profile.avatar;
    }
    var creditEl = document.getElementById("statCredit");
    if (creditEl) creditEl.textContent = formatMoney(Number(profile.accountCredit) || 0);
    if (creditEl && creditEl.closest(".account-stat")) creditEl.closest(".account-stat").hidden = true;

    var wishlistCount = wishlistService ? wishlistService.getWishlistCount() : 0;

    document.getElementById("statOrders").textContent = orders.length;
    document.getElementById("statWishlist").textContent = wishlistCount;
    document.getElementById("statAddresses").textContent = addresses.length;

    var recentEl = document.getElementById("recentOrders");
    if (recentEl) {
      recentEl.innerHTML = orders.length ? renderOrderCard(orders[0]) : "<p>No order history is linked to this account yet.</p>";
      bindOrderCards(recentEl);
    }
  }

  /* ---------------- Orders panel ---------------- */
  var activeOrderFilter = "all";

  function renderOrders() {
    var filteredOrders = activeOrderFilter === "all"
      ? orders
      : orders.filter(function (order) { return order.status === activeOrderFilter; });
    var listEl = document.getElementById("ordersTable");
    if (listEl) {
      listEl.innerHTML = filteredOrders.length
        ? filteredOrders.map(renderOrderCard).join("")
        : "<p>Order history is not linked to customer accounts yet.</p>";
      bindOrderCards(listEl);
    }
    var paginationEl = document.getElementById("ordersPagination");
    if (paginationEl) {
      paginationEl.textContent = filteredOrders.length
        ? "Showing " + filteredOrders.length + " of " + orders.length + " orders"
        : "Showing 0 of " + orders.length + " orders";
    }
  }

  document.querySelectorAll("#orderFilterTabs [data-filter]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      activeOrderFilter = tab.getAttribute("data-filter") || "all";
      document.querySelectorAll("#orderFilterTabs [data-filter]").forEach(function (item) {
        item.classList.toggle("is-active", item === tab);
      });
      renderOrders();
    });
  });

  function renderOrderDetail(order) {
    if (!order) {
      showPanel("orders");
      return;
    }
    document.getElementById("orderDetailId").textContent = "Order #" + order.id;
    document.getElementById("orderDetailMeta").textContent =
      "Placed " + formatDate(order.date) + " • " + order.items.length + " item" + (order.items.length === 1 ? "" : "s");
    var statusEl = document.getElementById("orderDetailStatus");
    statusEl.textContent = order.status;
    statusEl.className = "status-badge status-badge--" + order.status.toLowerCase();
    document.getElementById("orderDetailTracker").innerHTML = renderOrderTracker(order);
    document.getElementById("orderDetailItems").innerHTML = order.items.map(function (item) {
      return '<div class="order-detail-item">' +
        '<img src="' + item.image + '" alt="' + item.name + '">' +
        '<div><strong>' + item.name + '</strong><span>' + item.color + " · Size " + item.size + " · Qty " + item.qty + "</span></div>" +
        '<strong>' + formatMoney(item.price * item.qty) + "</strong>" +
      "</div>";
    }).join("");
    document.getElementById("orderSummaryRows").innerHTML =
      '<div><span>Subtotal</span><strong>' + formatMoney(order.subtotal) + "</strong></div>" +
      '<div><span>Shipping</span><strong>' + formatMoney(order.shipping) + "</strong></div>" +
      '<div><span>Discount</span><strong>-' + formatMoney(order.discount) + "</strong></div>" +
      '<div class="order-summary-total"><span>Total</span><strong>' + formatMoney(order.total) + "</strong></div>";
    var address = order.shippingAddress;
    document.getElementById("orderShippingAddress").innerHTML = address
      ? address.firstName + " " + address.lastName + "<br>" + address.address + "<br>" +
        address.city + ", " + address.state + " " + address.zip + "<br>" + address.country
      : "No shipping address available.";
    document.getElementById("orderPaymentStatus").textContent = order.paymentStatus || "Payment information unavailable.";
    showPanel("orderDetail");
  }

  /* ---------------- Addresses panel ---------------- */
  var addressForm = document.getElementById("addressForm");
  var addAddressBtn = document.getElementById("addAddressBtn");
  var cancelAddressBtn = document.getElementById("cancelAddressBtn");

  function renderAddresses() {
    var listEl = document.getElementById("addressesList");

    listEl.innerHTML = addresses.length ? addresses.map(function (addr) {
      return (
        '<div class="address-card">' +
          "<div>" +
            '<div class="address-card__label">' + escapeHTML(addr.label) +
              (addr.isDefault ? '<span class="address-card__default">Default</span>' : "") +
            "</div>" +
            '<div class="address-card__body">' +
              escapeHTML(addr.firstName) + " " + escapeHTML(addr.lastName) + "<br>" +
              escapeHTML(addr.address) + "<br>" +
              escapeHTML(addr.city) + ", " + escapeHTML(addr.state) + " " + escapeHTML(addr.zip) + "<br>" +
              escapeHTML(addr.country) +
            "</div>" +
          "</div>" +
          (addr.isDefault ? "" : '<button class="address-card__remove" data-id="' + escapeHTML(addr.id) + '">Remove</button>') +
        "</div>"
      );
    }).join("") : "<p>No saved addresses yet.</p>";

    listEl.querySelectorAll(".address-card__remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var nextAddresses = addresses.filter(function (address) {
          return String(address.id) !== btn.getAttribute("data-id");
        });
        auth.saveAddresses(user, profile, nextAddresses).then(function () {
          addresses = nextAddresses;
          renderAddresses();
          renderDashboard();
        }).catch(reportDataError);
      });
    });
  }

  addAddressBtn.addEventListener("click", function () {
    addressForm.hidden = false;
    addAddressBtn.hidden = true;
  });
  cancelAddressBtn.addEventListener("click", function () {
    addressForm.hidden = true;
    addAddressBtn.hidden = false;
    addressForm.reset();
  });

  addressForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var nextAddresses = addresses.slice();
    nextAddresses.push({
      id: "addr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      label: document.getElementById("addrLabel").value || "Address",
      isDefault: false,
      firstName: document.getElementById("addrFirstName").value,
      lastName: document.getElementById("addrLastName").value,
      address: document.getElementById("addrStreet").value,
      city: document.getElementById("addrCity").value,
      state: document.getElementById("addrState").value,
      zip: document.getElementById("addrZip").value,
      country: document.getElementById("addrCountry").value
    });
    auth.saveAddresses(user, profile, nextAddresses).then(function () {
      addresses = nextAddresses;
      addressForm.reset();
      addressForm.hidden = true;
      addAddressBtn.hidden = false;
      renderAddresses();
      renderDashboard();
    }).catch(reportDataError);
  });

  /* ---------------- Profile panel ---------------- */
  var profileForm = document.getElementById("profileForm");
  var profileMessage = document.getElementById("profileMessage");

  function fillProfileForm() {
    document.getElementById("profFirstName").value = profile.firstName;
    document.getElementById("profLastName").value = profile.lastName;
    document.getElementById("profEmail").value = profile.email;
    document.getElementById("profPhone").value = profile.phone;
  }

  profileForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var nextProfile = {
      firstName: document.getElementById("profFirstName").value,
      lastName: document.getElementById("profLastName").value,
      phone: document.getElementById("profPhone").value
    };
    auth.saveProfile(user, nextProfile, addresses).then(function (savedProfile) {
      profile = savedProfile;
      profileMessage.textContent = "Profile saved to your account.";
      profileMessage.className = "account-form__message is-success";
      renderDashboard();
      setTimeout(function () { profileMessage.textContent = ""; }, 2500);
    }).catch(function (error) {
      profileMessage.textContent = error.message || "Profile could not be saved.";
      profileMessage.className = "account-form__message";
    });
  });

  /* ---------------- Password panel ---------------- */
  var passwordForm = document.getElementById("passwordForm");
  var passwordMessage = document.getElementById("passwordMessage");

  if (passwordForm) {
    passwordForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var newPassword = document.getElementById("newPassword").value;
      if (newPassword !== document.getElementById("confirmPassword").value) {
        passwordMessage.textContent = "The passwords do not match.";
        passwordMessage.className = "account-form__message";
        return;
      }
      auth.updatePassword(newPassword).then(function () {
        passwordForm.reset();
        passwordMessage.textContent = "Password updated.";
        passwordMessage.className = "account-form__message is-success";
      }).catch(function (error) {
        passwordMessage.textContent = error.message || "Password could not be updated.";
        passwordMessage.className = "account-form__message";
      });
    });
  }

  /* ---------------- Logout ---------------- */
  var logoutButton = document.getElementById("logoutBtn");
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      logoutButton.disabled = true;
      auth.signOut().then(function () {
        window.location.replace("login.html");
      }).catch(function (error) {
        logoutButton.disabled = false;
        reportDataError(error);
      });
    });
  }

  /* ---------------- Init ---------------- */
  renderDashboard();
  renderOrders();
  renderAddresses();
  fillProfileForm();

  }

})();