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
    ".headline, .cta-row, .video-band, .pricing, .faq";
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

  /* ---- Smooth FAQ accordion (grid-rows animation on top of <details>) ----
     The panel wrapper animates grid-template-rows 0fr <-> 1fr, which is
     content-height agnostic and never leaves a stuck lock behind. We keep the
     native <details> open during a collapse so its content stays rendered
     until the animation finishes. */
  faqItems.forEach(function (item) {
    var summary = item.querySelector(".faq-q");
    var panel = item.querySelector(".faq-a");
    if (!summary || !panel) return;

    // Keep classes in sync with any external toggle (keyboard, etc.).
    item.classList.toggle("is-open", item.open);

    summary.addEventListener("click", function (e) {
      e.preventDefault();

      if (item.open) {
        // Collapse: animate to 0fr, then drop the native open state at the end.
        item.classList.remove("is-open");
        panel.addEventListener("transitionend", function onEnd(ev) {
          if (ev.target !== panel || ev.propertyName !== "grid-template-rows")
            return;
          panel.removeEventListener("transitionend", onEnd);
          if (!item.classList.contains("is-open")) item.open = false;
        });
      } else {
        // Expand: render immediately, then animate open on the next frame.
        item.open = true;
        requestAnimationFrame(function () {
          item.classList.add("is-open");
        });
      }
    });
  });
})();
