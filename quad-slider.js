/* The four-cell segmented slider.

   One card travels between the cells: it is measured off the live cell boxes
   rather than assuming quarters, so the same code drives the four-across row
   and the 2x2 it folds into on a phone — and a diagonal move interpolates on
   both axes at once.

   The pointer only borrows the thumb. Hovering slides it onto the cell under
   the pointer and leaving the row returns it to the selected one, so the
   control previews a choice without committing to it. */
(function () {
  "use strict";

  var row = document.querySelector(".quad-row");
  if (!row) return;

  var thumb = row.querySelector(".quad-thumb");
  var label = row.querySelector(".quad-thumb-label");
  var cells = Array.prototype.slice.call(row.querySelectorAll(".quad-cell"));
  if (!thumb || !cells.length) return;

  var style = getComputedStyle(row);
  var inset = parseFloat(style.getPropertyValue("--thumb-inset")) || 0;
  var hold = (function (raw) {
    var ms = parseFloat(raw);
    if (!ms) return 2000;
    // Accept the token written either as 2000ms or as 2s.
    return /ms\s*$/.test(raw) ? ms : ms * 1000;
  })(style.getPropertyValue("--thumb-label-hold"));

  // The badge names the cell the frame has just landed on, then goes quiet. A
  // move that interrupts the hold restarts it rather than stacking a second.
  var holdTimer = null;

  function name(text) {
    if (!label) return;
    label.textContent = text;
    thumb.classList.add("is-named");
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () {
      thumb.classList.remove("is-named");
    }, hold);
  }

  // What a click committed to, versus what the pointer or keyboard is
  // currently previewing. The thumb always renders the latter.
  var selected = Math.max(0, cells.findIndex(function (cell) {
    return cell.getAttribute("aria-pressed") === "true";
  }));
  var shown = -1;

  function place(index, snap) {
    var cell = cells[index];
    if (!cell) return;

    if (snap) thumb.classList.add("is-snapping");

    row.style.setProperty(
      "--thumb-transform",
      "translate3d(" +
        (cell.offsetLeft + inset) +
        "px, " +
        (cell.offsetTop + inset) +
        "px, 0)"
    );
    thumb.style.width = cell.offsetWidth - inset * 2 + "px";
    thumb.style.height = cell.offsetHeight - inset * 2 + "px";

    if (snap) {
      // Flush the jump before the transition is handed back, so the next move
      // starts from the box just written rather than gliding out of the old one.
      void thumb.offsetWidth;
      thumb.classList.remove("is-snapping");
    }

    if (index !== shown) {
      cells.forEach(function (c, i) {
        c.classList.toggle("is-lit", i === index);
      });
      shown = index;
      name(cell.textContent.trim());
    }

    row.classList.add("is-ready");
  }

  function select(index) {
    selected = index;
    cells.forEach(function (cell, i) {
      cell.setAttribute("aria-pressed", i === index ? "true" : "false");
    });
    place(index);
  }

  place(selected, true);

  cells.forEach(function (cell, i) {
    cell.addEventListener("click", function () {
      select(i);
    });

    // Hover and keyboard focus both preview; only a click commits.
    cell.addEventListener("mouseenter", function () {
      place(i);
    });

    cell.addEventListener("focus", function () {
      place(i);
    });

    cell.addEventListener("blur", function () {
      if (!row.contains(document.activeElement)) place(selected);
    });

    // Arrow keys walk the row and take the selection with them, the way a
    // segmented control is expected to behave.
    cell.addEventListener("keydown", function (e) {
      var step =
        e.key === "ArrowRight" || e.key === "ArrowDown"
          ? 1
          : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
      if (!step) return;
      e.preventDefault();
      var next = (i + step + cells.length) % cells.length;
      select(next);
      cells[next].focus();
    });
  });

  row.addEventListener("mouseleave", function () {
    place(selected);
  });

  // Re-measure when the row reflows — chiefly the fold to 2x2, which moves
  // every cell at once.
  var reflow = function () {
    place(shown === -1 ? selected : shown, true);
  };

  if ("ResizeObserver" in window) {
    new ResizeObserver(reflow).observe(row);
  } else {
    window.addEventListener("resize", reflow);
  }
})();
