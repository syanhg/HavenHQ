// Two small jobs, and neither of them is worth a framework.
//
// One: the list on the left has to say where you are. Two: on a narrow screen
// that list is folded away and needs a way back.

(function () {
  var nav = document.getElementById('docs-nav');
  var toggle = document.querySelector('.docs-toggle');
  if (!nav) return;

  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  var sections = links
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  // ---- where you are -------------------------------------------------------

  var current = null;

  function mark(el) {
    if (el === current) return;
    if (current) current.classList.remove('on');
    current = el;
    if (current) current.classList.add('on');
  }

  // The heading nearest the top of the window that has not gone past it.
  //
  // An IntersectionObserver was the obvious tool and is the wrong one here: a
  // section taller than the viewport intersects nothing at all once you are in
  // the middle of it, so the sidebar goes blank exactly where somebody is
  // reading. Measuring is cheap, correct at every section length, and this
  // page is nine of them.
  function spy() {
    var line = 140; // roughly where the eye is, under the fixed wordmark
    var found = 0;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= line) found = i;
      else break;
    }
    // At the very bottom the last section may never reach the line — nothing
    // below it can scroll further — so the end of the page means the end of
    // the list, whatever the arithmetic says.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      found = sections.length - 1;
    }
    mark(links[found]);
  }

  var waiting = false;
  function onScroll() {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(function () { waiting = false; spy(); });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  spy();

  // ---- the fold, on a narrow screen ---------------------------------------

  var narrow = window.matchMedia('(max-width: 900px)');

  function fold() {
    if (!toggle) return;
    var hide = narrow.matches;
    nav.hidden = hide;
    toggle.setAttribute('aria-expanded', hide ? 'false' : 'true');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.hidden;
      nav.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Picking something is the end of using the list, so it closes behind you.
    nav.addEventListener('click', function (e) {
      if (narrow.matches && e.target.closest('a[href^="#"]')) fold();
    });

    fold();
    // Crossing the breakpoint with the list folded away would otherwise leave
    // a wide screen with no sidebar at all.
    if (narrow.addEventListener) narrow.addEventListener('change', fold);
    else narrow.addListener(fold);
  }
})();
