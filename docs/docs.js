// Three small jobs on a page that is otherwise only words: finding something,
// saying which section you are in, and the fold on a narrow screen.

(function () {
  var side = document.querySelector('.docs-side');
  if (!side) return;

  // ---- finding something --------------------------------------------------

  var find = side.querySelector('.docs-find');
  var input = side.querySelector('.df-input');
  var out = side.querySelector('.df-out');

  var rows = null;   // the index, once somebody has asked for it
  var asked = false;
  var hits = [];
  var at = -1;

  // Fetched on the first keystroke rather than on load. It is a few kilobytes
  // nobody who came here to read a page ever needs, and by the time a query is
  // two characters long it has arrived.
  function load() {
    if (asked) return;
    asked = true;
    fetch('/docs/search.json')
      .then(function (r) { return r.json(); })
      .then(function (j) { rows = j; run(); })
      .catch(function () { rows = []; run(); });
  }

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  // Words that appear in every section and therefore separate none of them.
  // Without this, "how do i share" ranks on "do" and "i" landing in three
  // hundred sentences, and the page about sharing loses to whichever section
  // is longest.
  var NOISE = /^(a|an|the|is|are|was|be|to|in|on|of|for|from|at|by|with|and|or|it|its|this|that|i|my|me|we|you|your|can|do|does|how|what|when|where|which|who|why|there|here|get|got)$/;

  /**
   * The words of the query worth searching on.
   *
   * Splitting on whitespace rather than matching the string whole is what makes
   * "attach codex" find the Codex paragraph under "Bring your own agent": a
   * person types the two words they remember, in whichever order they remember
   * them.
   */
  var termsOf = function (q) {
    var all = q.toLowerCase().split(/[^a-z0-9#/@.]+/).filter(Boolean);
    var keep = all.filter(function (w) { return w.length > 1 && !NOISE.test(w); });
    // "how to" and nothing else is still a query somebody typed. Better to
    // answer it badly than to answer it with silence.
    return keep.length ? keep : all;
  };

  var count = function (hay, w) {
    var n = 0, i = hay.indexOf(w);
    while (i > -1 && n < 4) { n++; i = hay.indexOf(w, i + w.length); }
    return n;
  };

  /**
   * How well one section answers a query.
   *
   * Every word landing used to be the rule, and it threw away the useful half
   * of real queries: "invite someone" found nothing, because no one section
   * contains both. So a partial match still ranks, and the count of words that
   * landed multiplies the total, which keeps a section matching all of them
   * above one matching a single word well.
   */
  function score(row, terms) {
    var t = row.t.toLowerCase();
    var p = row.p.toLowerCase();
    var k = (row.k || '').toLowerCase();
    var x = row.x.toLowerCase();
    var got = 0, n = 0;

    for (var i = 0; i < terms.length; i++) {
      var w = terms[i], s = 0;
      // A heading beats a keyword, a keyword beats the page name, and all of
      // them beat the body, so "plan" puts Plans above the four paragraphs
      // that merely mention one. A heading that STARTS with the word beats one
      // that only contains it.
      if (t.indexOf(w) === 0) s = 14;
      else if (t.indexOf(w) > -1) s = 9;
      else if (k.indexOf(w) > -1) s = 7;
      else if (p.indexOf(w) > -1) s = 4;
      // In the body, twice is a better sign than once, up to a point past
      // which it is only a long section.
      else s = count(x, w);

      if (s) { got++; n += s; }
    }

    return got ? n * got : 0;
  }

  /** The line the first term is on, so a hit shows the sentence you asked for. */
  function excerpt(row, terms) {
    var x = row.x;
    var i = x.toLowerCase().indexOf(terms[0]);
    if (i < 0) return x.slice(0, 150);
    var from = Math.max(0, i - 40);
    // Back up to a word boundary, so an excerpt never opens mid-word.
    if (from > 0) {
      var sp = x.indexOf(' ', from);
      if (sp > -1 && sp < i) from = sp + 1;
    }
    return (from > 0 ? '…' : '') + x.slice(from, from + 170);
  }

  function hilite(text, terms) {
    var safe = esc(text);
    for (var i = 0; i < terms.length; i++) {
      var w = terms[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (w) safe = safe.replace(new RegExp('(' + w + ')', 'ig'), '<em>$1</em>');
    }
    return safe;
  }

  function close() {
    out.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    at = -1;
  }

  function mark(i) {
    var all = out.querySelectorAll('.df-hit');
    if (!all.length) return;
    if (at > -1 && all[at]) all[at].classList.remove('on');
    at = (i + all.length) % all.length;
    all[at].classList.add('on');
    all[at].scrollIntoView({ block: 'nearest' });
  }

  function run() {
    var q = input.value.trim();
    find.classList.toggle('has', !!q);

    // One character is normally too little to search on, but the two gestures
    // this whole guide is about are one character each. "@" and "/" are real
    // queries here.
    if (!q) return close();
    if (rows === null) return load();

    var terms = termsOf(q);
    hits = rows
      .map(function (r) { return { r: r, n: score(r, terms) }; })
      .filter(function (h) { return h.n > 0; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 8)
      .map(function (h) { return h.r; });

    if (!hits.length) {
      out.innerHTML = '<p class="df-none">Nothing for &ldquo;' + esc(q) + '&rdquo;.</p>';
    } else {
      out.innerHTML = hits.map(function (r) {
        return '<a class="df-hit" href="' + esc(r.u) + '">'
             + '<i>' + esc(r.p) + '</i>'
             + '<b>' + hilite(r.t, terms) + '</b>'
             + '<span>' + hilite(excerpt(r, terms), terms) + '</span></a>';
      }).join('');
    }

    at = -1;
    out.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  input.addEventListener('input', run);
  input.addEventListener('focus', load);

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      // First press dismisses the list, second empties the field. Somebody who
      // wanted the results gone rarely wanted the query gone with them.
      if (!out.hidden) close();
      else { input.value = ''; find.classList.remove('has'); input.blur(); }
      return;
    }
    if (out.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); mark(at + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mark(at - 1); }
    else if (e.key === 'Enter') {
      var all = out.querySelectorAll('.df-hit');
      var go = all[at > -1 ? at : 0];
      if (go) { e.preventDefault(); window.location.href = go.getAttribute('href'); }
    }
  });

  document.addEventListener('click', function (e) {
    if (!find.contains(e.target)) close();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  // ---- which section you are in -------------------------------------------

  var subs = Array.prototype.slice.call(side.querySelectorAll('.dn-sub'));
  var heads = subs
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  var lit = null;

  function spy() {
    if (!heads.length) return;
    var line = 140; // roughly where the eye is, under the fixed wordmark
    var i = 0;
    for (var n = 0; n < heads.length; n++) {
      if (heads[n].getBoundingClientRect().top <= line) i = n;
      else break;
    }
    // A section taller than the window is one an IntersectionObserver stops
    // seeing halfway through, which blanks the list exactly where somebody is
    // reading. Measuring is cheap and correct at every length.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
      i = heads.length - 1;
    }
    if (subs[i] === lit) return;
    if (lit) lit.classList.remove('on');
    lit = subs[i];
    lit.classList.add('on');
  }

  var waiting = false;
  window.addEventListener('scroll', function () {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(function () { waiting = false; spy(); });
  }, { passive: true });
  window.addEventListener('resize', spy);
  spy();

  // ---- the fold, on a narrow screen ---------------------------------------

  var nav = document.getElementById('docs-nav');
  var toggle = side.querySelector('.docs-toggle');
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
      if (narrow.matches && e.target.closest('.dn-sub')) fold();
    });

    fold();
    // Crossing the breakpoint with the list folded away would otherwise leave a
    // wide screen with no sidebar at all.
    if (narrow.addEventListener) narrow.addEventListener('change', fold);
    else narrow.addListener(fold);
  }
})();
