(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var faqItems = Array.prototype.slice.call(document.querySelectorAll(".faq-item"));

  // Gate the collapsible FAQ styling on JS so answers stay visible without it.
  if (faqItems.length) docEl.classList.add("js-faq");

  // If the user prefers reduced motion or IntersectionObserver is unavailable,
  // drop the hiding hook so all content is shown immediately and native
  // <details> handles the FAQ (kept in sync for the chevron).
  if (reduce || !("IntersectionObserver" in window)) {
    docEl.classList.remove("js-motion");
    faqItems.forEach(function (item) {
      item.addEventListener("toggle", function () {
        item.classList.toggle("is-open", item.open);
      });
    });
    return;
  }

  /* ---- Scroll reveal: fade + rise as elements enter the viewport ---- */
  var selector =
    ".hero-tagline, .headline, .cta-row, .slot-band, .pricing, .faq";
  var els = Array.prototype.slice.call(document.querySelectorAll(selector));

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );

  // Give the elements already on the first screen a gentle cascade.
  var vh = window.innerHeight;
  var stagger = 0;
  els.forEach(function (el) {
    if (el.getBoundingClientRect().top < vh * 0.92) {
      el.style.transitionDelay = (stagger * 0.09).toFixed(2) + "s";
      stagger += 1;
    }
    io.observe(el);
  });

  /* ---- Smooth FAQ accordion ----
     The panel's height is animated in pixels rather than through
     grid-template-rows: fr units interpolate on their own curve, so the panel
     did not actually travel on the easing it was given. Measuring the height
     each time also means a toggle can be interrupted at any point — the next
     one starts from wherever the panel currently is and reverses from there.

     The native <details> is held open for the whole of a collapse so its
     content stays rendered until the animation lands. */
  var faqStyle = getComputedStyle(docEl);
  var faqDuration = (function (raw) {
    var ms = parseFloat(raw);
    if (!ms) return 340;
    // Accept the token written either as 340ms or as 0.34s.
    return /ms\s*$/.test(raw) ? ms : ms * 1000;
  })(faqStyle.getPropertyValue("--faq-duration"));
  var faqEase =
    faqStyle.getPropertyValue("--faq-ease").trim() ||
    "cubic-bezier(0.32, 0.72, 0, 1)";
  var canAnimate = typeof Element.prototype.animate === "function";

  faqItems.forEach(function (item) {
    var summary = item.querySelector(".faq-q");
    var panel = item.querySelector(".faq-a");
    if (!summary || !panel) return;

    // Keep classes in sync with any external toggle (keyboard, etc.).
    item.classList.toggle("is-open", item.open);

    var anim = null;

    summary.addEventListener("click", function (e) {
      e.preventDefault();

      var opening = !item.classList.contains("is-open");

      if (!canAnimate) {
        item.open = opening;
        item.classList.toggle("is-open", opening);
        return;
      }

      // Read the live height first: mid-flight this is the animated value.
      var from = panel.getBoundingClientRect().height;
      if (anim) anim.cancel();

      // Render the content for both directions, then let CSS settle to the
      // natural height so it can be measured.
      item.open = true;
      item.classList.toggle("is-open", opening);
      var to = opening ? panel.getBoundingClientRect().height : 0;

      anim = panel.animate(
        [{ height: from + "px" }, { height: to + "px" }],
        { duration: faqDuration, easing: faqEase }
      );

      anim.onfinish = function () {
        anim = null;
        // No fill is kept, so the panel falls back to its CSS height: auto
        // when open, and to nothing at all once <details> closes.
        if (!opening) item.open = false;
      };
    });
  });
})();
