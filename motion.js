(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var faqItems = Array.prototype.slice.call(document.querySelectorAll(".faq-item"));

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
    ".headline, .placeholder-box, .cta-row, .tagline-row, .picture-frame," +
    " .pricing, .faq";
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

  /* ---- Smooth FAQ accordion (animated height on top of <details>) ---- */
  faqItems.forEach(function (item) {
    var summary = item.querySelector(".faq-q");
    var panel = item.querySelector(".faq-a");
    if (!summary || !panel) return;

    summary.addEventListener("click", function (e) {
      e.preventDefault();
      if (item.dataset.animating) return;
      item.dataset.animating = "1";

      if (item.open) {
        // Collapse: flip the chevron now, animate height to 0, then unset open.
        item.classList.remove("is-open");
        panel.style.maxHeight = panel.scrollHeight + "px";
        requestAnimationFrame(function () {
          panel.style.maxHeight = "0px";
        });
        panel.addEventListener("transitionend", function onEnd(ev) {
          if (ev.propertyName !== "max-height") return;
          panel.removeEventListener("transitionend", onEnd);
          item.open = false;
          panel.style.maxHeight = "";
          delete item.dataset.animating;
        });
      } else {
        // Expand: render + flip the chevron, then grow to the natural height.
        item.open = true;
        item.classList.add("is-open");
        panel.style.maxHeight = "0px";
        requestAnimationFrame(function () {
          panel.style.maxHeight = panel.scrollHeight + "px";
        });
        panel.addEventListener("transitionend", function onEnd(ev) {
          if (ev.propertyName !== "max-height") return;
          panel.removeEventListener("transitionend", onEnd);
          panel.style.maxHeight = "";
          delete item.dataset.animating;
        });
      }
    });
  });
})();
