(function () {
  var fallbackByPage = {
    "index.html": "shop.html",
    "shop.html": "index.html",
    "product.html": "shop.html",
    "collections.html": "shop.html",
    "cart.html": "shop.html",
    "checkout.html": "cart.html",
    "wishlist.html": "shop.html",
    "account.html": "shop.html",
    "orders.html": "account.html",
    "login.html": "shop.html",
    "admin.html": "shop.html"
  };
  var pageName = window.location.pathname.split("/").pop().toLowerCase();
  var fallback = fallbackByPage[pageName] || "index.html";

  document.querySelectorAll("h1").forEach(function (heading) {
    var link = document.createElement("a");
    var icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    var label = document.createElement("span");

    link.className = "page-back-link";
    link.href = fallback;
    link.setAttribute("aria-label", "Go back");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "1.7");
    icon.setAttribute("aria-hidden", "true");
    path.setAttribute("d", "M19 12H5m7 7-7-7 7-7");
    icon.appendChild(path);
    label.textContent = "Back";
    link.appendChild(icon);
    link.appendChild(label);

    link.addEventListener("click", function (event) {
      if (window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    });

    heading.parentNode.insertBefore(link, heading);
  });
})();
