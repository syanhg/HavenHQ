/* Figma-style frame selection on hover.

   One overlay is reused for every band: hovering a [data-frame] element moves
   the ring onto it and prints the frame's name in the badge below. The overlay
   is positioned in document coordinates on <body>, so it rides the page as it
   scrolls and is never clipped by main's overflow. */
(function () {
  "use strict";

  // Pointer-driven affordance: skip it entirely on touch, where there is no
  // hover state to read and the ring would only flash on tap.
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (!document.querySelector("[data-frame]")) return;

  var box = document.createElement("div");
  box.className = "frame-select";
  box.setAttribute("aria-hidden", "true");

  ["nw", "ne", "sw", "se"].forEach(function (corner) {
    var handle = document.createElement("span");
    handle.className = "frame-handle frame-handle-" + corner;
    box.appendChild(handle);
  });

  var label = document.createElement("span");
  label.className = "frame-label";
  box.appendChild(label);
  document.body.appendChild(box);

  var active = null;

  function place(el) {
    var r = el.getBoundingClientRect();
    box.style.left = r.left + window.scrollX + "px";
    box.style.top = r.top + window.scrollY + "px";
    box.style.width = r.width + "px";
    box.style.height = r.height + "px";
  }

  // The ring glides between neighbouring frames, but arrives without travel:
  // sliding in from wherever it was last would read as a stray object.
  function show(el) {
    if (el === active) return;
    var arriving = active === null;
    active = el;

    label.textContent = el.getAttribute("data-frame");
    if (arriving) box.classList.add("is-snapping");
    place(el);
    if (arriving) {
      void box.offsetWidth;
      box.classList.remove("is-snapping");
    }
    box.classList.add("is-active");

    if (ro) {
      ro.disconnect();
      ro.observe(el);
    }
  }

  function hide() {
    if (!active) return;
    active = null;
    box.classList.remove("is-active");
    if (ro) ro.disconnect();
  }

  // Follows a frame that resizes under the ring — chiefly the FAQ, whose panel
  // animates its height open and shut.
  var ro =
    "ResizeObserver" in window
      ? new ResizeObserver(function () {
          if (active) place(active);
        })
      : null;

  document.addEventListener("mouseover", function (e) {
    var el = e.target.closest ? e.target.closest("[data-frame]") : null;
    if (el) show(el);
    else hide();
  });

  document.documentElement.addEventListener("mouseleave", hide);

  window.addEventListener("resize", function () {
    if (active) place(active);
  });
})();
