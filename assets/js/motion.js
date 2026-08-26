/* Reveals, and the rows.

   Two things talk to the garden from here: opening a row plants its seedling,
   and any change in the height of the page tells the canvas to re-measure,
   because a plant is anchored to an element's box and that box has moved. */
(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rows = Array.prototype.slice.call(document.querySelectorAll(".row"));

  var reflow = function () {
    window.dispatchEvent(new CustomEvent("garden:reflow"));
  };
  var grow = function (el) {
    if (el) window.dispatchEvent(new CustomEvent("garden:grow", { detail: { el: el } }));
  };

  /* Collapsible rows are a JS affordance: without it the answers are simply
     open, and <details> handles the toggle on its own. */
  if (rows.length) docEl.classList.add("js-rows");

  if (reduce || !("IntersectionObserver" in window)) {
    docEl.classList.remove("js-motion");
    rows.forEach(function (row) {
      row.addEventListener("toggle", function () {
        row.classList.toggle("is-open", row.open);
        if (row.open) grow(row.querySelector(".marker"));
        reflow();
      });
    });
    return;
  }

  /* ---- reveal ---------------------------------------------------------- */
  var els = Array.prototype.slice.call(
    document.querySelectorAll(".tagline, .gate, .rows, .plots, .close-line")
  );

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });

  var vh = window.innerHeight;
  var stagger = 0;
  els.forEach(function (el) {
    if (el.getBoundingClientRect().top < vh * 0.92) {
      el.style.transitionDelay = (stagger * 0.1).toFixed(2) + "s";
      stagger += 1;
    }
    io.observe(el);
  });

  /* ---- rows ------------------------------------------------------------
     The panel's height is animated in pixels rather than through
     grid-template-rows, whose fr units interpolate on their own curve instead
     of the one they are given. Measuring live also means a toggle can be
     interrupted: the next one starts from wherever the panel currently is. */
  var style = getComputedStyle(docEl);
  var duration = (function (raw) {
    var ms = parseFloat(raw);
    if (!ms) return 380;
    return /ms\s*$/.test(raw) ? ms : ms * 1000;
  })(style.getPropertyValue("--row-duration"));
  var ease = style.getPropertyValue("--ease").trim() || "cubic-bezier(0.32, 0.72, 0, 1)";
  var canAnimate = typeof Element.prototype.animate === "function";

  rows.forEach(function (row) {
    var summary = row.querySelector(".row-q");
    var panel = row.querySelector(".row-a");
    var marker = row.querySelector(".marker");
    if (!summary || !panel) return;

    row.classList.toggle("is-open", row.open);
    var anim = null;

    summary.addEventListener("click", function (e) {
      e.preventDefault();
      var opening = !row.classList.contains("is-open");

      if (opening) grow(marker);

      if (!canAnimate) {
        row.open = opening;
        row.classList.toggle("is-open", opening);
        reflow();
        return;
      }

      var from = panel.getBoundingClientRect().height;
      if (anim) anim.cancel();

      /* Render for both directions, then let CSS settle to the natural height
         so it can be measured. <details> is held open through a collapse so
         its content is still there when the animation lands. */
      row.open = true;
      row.classList.toggle("is-open", opening);
      var to = opening ? panel.getBoundingClientRect().height : 0;

      anim = panel.animate(
        [{ height: from + "px" }, { height: to + "px" }],
        { duration: duration, easing: ease }
      );

      /* The rest of the page slides while this runs, and every plant below is
         anchored to something that is moving. */
      var tick = setInterval(reflow, 40);
      anim.onfinish = function () {
        clearInterval(tick);
        anim = null;
        if (!opening) row.open = false;
        reflow();
      };
    });
  });
})();
