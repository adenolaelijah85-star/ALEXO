(function () {
  var slider = document.querySelector("[data-campaign-slider]");
  if (!slider) return;

  var track = slider.querySelector("[data-campaign-track]");
  var slides = Array.prototype.slice.call(track.children);
  var dotsContainer = slider.querySelector("[data-campaign-dots]");
  var previousButton = slider.querySelector("[data-campaign-prev]");
  var nextButton = slider.querySelector("[data-campaign-next]");
  var toggleButton = slider.querySelector("[data-campaign-toggle]");
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var activeIndex = 0;
  var autoplayTimer = null;
  var autoplayPaused = prefersReducedMotion;

  function setActiveSlide(index) {
    activeIndex = (index + slides.length) % slides.length;
    track.style.transform = "translateX(-" + (activeIndex * 100) + "%)";

    slides.forEach(function (slide, slideIndex) {
      var isActive = slideIndex === activeIndex;
      slide.setAttribute("aria-hidden", String(!isActive));
      slide.toggleAttribute("inert", !isActive);
      dotsContainer.children[slideIndex].setAttribute("aria-current", String(isActive));
    });
  }

  function stopAutoplay() {
    if (autoplayTimer !== null) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function updateAutoplayControl() {
    toggleButton.textContent = autoplayPaused ? "Play" : "Pause";
    toggleButton.setAttribute("aria-label", autoplayPaused ? "Start automatic campaign rotation" : "Pause automatic campaign rotation");
  }

  function startAutoplay() {
    if (autoplayPaused || document.hidden || autoplayTimer !== null) return;

    autoplayTimer = window.setInterval(function () {
      setActiveSlide(activeIndex + 1);
    }, 6000);
  }

  slides.forEach(function (_, index) {
    var dot = document.createElement("button");
    dot.type = "button";
    dot.className = "shop-campaign-slider__dot";
    dot.setAttribute("aria-label", "Go to campaign " + (index + 1));
    dot.addEventListener("click", function () {
      setActiveSlide(index);
    });
    dotsContainer.appendChild(dot);
  });

  previousButton.addEventListener("click", function () {
    setActiveSlide(activeIndex - 1);
  });
  nextButton.addEventListener("click", function () {
    setActiveSlide(activeIndex + 1);
  });

  toggleButton.addEventListener("click", function () {
    autoplayPaused = !autoplayPaused;
    updateAutoplayControl();
    if (autoplayPaused) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });

  updateAutoplayControl();
  setActiveSlide(0);
  startAutoplay();
})();
