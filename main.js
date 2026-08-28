/* Hero reveal: title words drift out of a soft blur, one overlapping the next,
   the topbar fades in alongside them, and the description, pill and hero shot
   follow on the same curve. */
(function () {
  var title = document.querySelector('.hero-title');
  if (!title) return;

  var WORD_MS = 85;   // stagger between words (each word animates far longer, so they overlap)
  var LINE_GAP = 120; // extra breath between the two lines
  var elapsed = 0;

  Array.prototype.forEach.call(title.querySelectorAll('.line'), function (line) {
    var words = line.textContent.trim().split(/\s+/);

    line.textContent = '';

    words.forEach(function (word, i) {
      if (i > 0) line.appendChild(document.createTextNode(' '));

      var span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      span.style.setProperty('--d', elapsed + 'ms');
      line.appendChild(span);

      elapsed += WORD_MS;
    });

    elapsed += LINE_GAP;
  });

  title.classList.add('is-typing');

  // will-change holds a compositor layer per word; drop it once the words have
  // landed so the page isn't carrying them for the rest of the session
  title.addEventListener('animationend', function (e) {
    if (e.target.classList.contains('word')) e.target.style.willChange = 'auto';
  });

  // the two fixed texts, not the bar: a transformed ancestor would become the
  // containing block for anything fixed inside it and break the pinning
  Array.prototype.forEach.call(
    document.querySelectorAll('.topbar .wordmark, .topbar .nav-link'),
    function (el) {
      el.style.setProperty('--d', '0ms');
      el.classList.add('reveal');
    }
  );

  ['.hero-desc', '.access', '.shot', '.section-title', '.features'].forEach(function (selector, i) {
    var el = document.querySelector(selector);
    if (!el) return;
    el.style.setProperty('--d', elapsed + i * 130 + 'ms');
    el.classList.add('reveal');
  });
})();



/* Hero shot: cross-fades on its own every few seconds; a click jumps ahead
   and restarts the timer. */
(function () {
  var shot = document.querySelector('.shot');
  if (!shot) return;

  var imgs = Array.prototype.slice.call(shot.querySelectorAll('.shot-img'));
  if (imgs.length < 2) return;

  var INTERVAL = 5000;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var index = 0;
  var timer = null;

  function show(next) {
    index = (next + imgs.length) % imgs.length;

    imgs.forEach(function (img, i) {
      img.classList.toggle('is-active', i === index);
    });
  }

  function play() {
    if (reduced || timer !== null) return;
    timer = setInterval(function () { show(index + 1); }, INTERVAL);
  }

  function pause() {
    clearInterval(timer);
    timer = null;
  }

  shot.addEventListener('click', function () {
    show(index + 1);
    pause();
    play(); // a manual jump gets a full interval before the next auto-advance
  });

  // don't let a backgrounded tab queue up a burst of slides
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
    else play();
  });

  show(0);
  play();
})();

/* Two cursors drifting around the second feature box, one of them now and then
   dragging a selection out.

   The arrow path, the palette and the tag markup are the Canvas repo's own
   (cursor.html, from client/ui/arrow.js and client/styles.css) — the arrow's
   corners are rounded in the geometry so the tip stays exactly where the cursor
   reports it. Only the motion here is new. */
(function () {
  var mini = document.querySelector('.mini');
  if (!mini) return;

  var marquee = mini.querySelector('.mini-marquee');

  // the colours anything with a cursor is allowed to be
  var PALETTE = [
    { hex: '#7D8BFF', hue: 234 }, // soffo, and reserved for it
    { hex: '#FF6A0E', hue: 23 }
  ];

  var D = 'M2.88 1.47 L14.06 7.46 Q16 8.5 13.9 9.15 L11.03 10.03 Q9.5 10.5 8.83 11.95 '
    + 'L7.3 15.27 Q6.5 17 5.99 15.17 L2.27 1.96 Q2 1 2.88 1.47 Z';

  var ARROW =
    '<svg class="arrow" width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">'
    + '<path class="arrow-halo" d="' + D + '"/>'
    + '<path class="arrow-fill" d="' + D + '"/>'
    + '</svg>';

  function cursor(name, swatch) {
    var el = document.createElement('div');
    el.className = 'cursor';
    el.innerHTML = ARROW + '<span class="tag"></span>';
    el.style.setProperty('--hue', swatch.hue);
    el.style.setProperty('--agent', swatch.hex);
    el.querySelector('.tag').textContent = name;
    return el;
  }

  // the arrow's tip sits at (2,1) inside its 18-unit box drawn at 16px, so the
  // element is offset by that much to put the tip on the reported point
  var TIP_X = 16 * 2 / 18;
  var TIP_Y = 16 * 1 / 18;

  var PAD = 10;
  var TAG_W = 78;   // room the name tag needs to the right of the tip
  var TAG_H = 34;

  var w = 0, h = 0;

  // the two blocks the cursors work over, and where they sit in the box
  var blocks = Array.prototype.map.call(mini.querySelectorAll('.dm'), function (el) {
    return { el: el, x: 0, y: 0, w: 0, h: 0 };
  });

  function measure() {
    w = mini.clientWidth;
    h = mini.clientHeight;

    blocks.forEach(function (b) {
      b.w = b.el.offsetWidth;
      b.h = b.el.offsetHeight;
      // they sit at 50%/50% and are pulled back by half their own size, which
      // offsetLeft/offsetTop know nothing about
      b.x = b.el.offsetLeft - b.w / 2;
      b.y = b.el.offsetTop - b.h / 2;
    });
  }

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function spotX() { return rand(PAD, Math.max(PAD + 1, w - TAG_W)); }
  function spotY() { return rand(PAD, Math.max(PAD + 1, h - TAG_H)); }

  var actors = [
    { el: cursor('soffo', PALETTE[0]), ease: 0.055, selects: true },
    { el: cursor('Claude Code', PALETTE[1]), ease: 0.04, selects: false }
  ];

  actors.forEach(function (a) {
    mini.appendChild(a.el);
    a.phase = 'wander';
    a.wait = 0;
  });

  function place(a) {
    a.el.style.transform = 'translate(' + (a.x - TIP_X) + 'px, ' + (a.y - TIP_Y) + 'px)';
  }

  function drawMarquee(a) {
    var x = Math.min(a.dragX, a.x);
    var y = Math.min(a.dragY, a.y);
    var bw = Math.abs(a.x - a.dragX);
    var bh = Math.abs(a.y - a.dragY);

    marquee.style.display = 'block';
    marquee.style.left = x + 'px';
    marquee.style.top = y + 'px';
    marquee.style.width = bw + 'px';
    marquee.style.height = bh + 'px';

    // anything the box touches is spoken for while the drag is open
    blocks.forEach(function (b) {
      var hit = b.el.classList.contains('is-in')
        && x < b.x + b.w && x + bw > b.x && y < b.y + b.h && y + bh > b.y;
      b.el.classList.toggle('is-sel', hit);
    });
  }

  // whichever block is currently on the canvas, if any
  function onCanvas() {
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].el.classList.contains('is-in')) return blocks[i];
    }
    return null;
  }

  var SEL_M = 7; // how far outside the block the selection is pulled

  function clearSelection() {
    blocks.forEach(function (b) { b.el.classList.remove('is-sel'); });
  }

  /* The blocks arrive one at a time, sit while the cursors work over them, then
     clear and the cycle starts again. Timed off the same clock the cursors run
     on rather than setTimeout, so it stops when they stop — an off-screen box
     shouldn't be halfway through a cycle when it comes back. */
  var CYCLE = [
    { at: 500, run: function () { blocks[0].el.classList.add('is-in'); } },
    { at: 6000, run: function () { blocks[0].el.classList.remove('is-in'); clearSelection(); } },
    { at: 6700, run: function () { blocks[1].el.classList.add('is-in'); } },
    { at: 12200, run: function () { blocks[1].el.classList.remove('is-in'); clearSelection(); } },
    { at: 13000, run: null } // wrap
  ];

  var seqT = 0, seqI = 0;

  function sequence(dt) {
    seqT += dt;
    while (seqI < CYCLE.length && seqT >= CYCLE[seqI].at) {
      if (CYCLE[seqI].run) CYCLE[seqI].run();
      else { seqT = 0; seqI = -1; clearSelection(); }
      seqI++;
    }
  }

  function press(a) {
    a.el.classList.add('pressing');
    setTimeout(function () { a.el.classList.remove('pressing'); }, 170);
  }

  function retarget(a) {
    a.tx = spotX();
    a.ty = spotY();
  }

  var last = 0;

  function step(now) {
    var dt = last ? Math.min(now - last, 60) : 16;
    last = now;

    sequence(dt);

    actors.forEach(function (a) {
      // frame-rate independent easing toward the current target
      var k = 1 - Math.pow(1 - a.ease, dt / 16.667);
      a.x += (a.tx - a.x) * k;
      a.y += (a.ty - a.y) * k;
      place(a);

      var arrived = Math.abs(a.tx - a.x) < 1.5 && Math.abs(a.ty - a.y) < 1.5;

      if (a.phase === 'drag') {
        if (arrived) {
          // land exactly on the far corner, so the box is the block's size
          a.x = a.tx;
          a.y = a.ty;
          place(a);
          drawMarquee(a);
          press(a);
          a.phase = 'hold';
          a.wait = 900;
          return;
        }
        drawMarquee(a);
        return;
      }

      a.wait -= dt;
      if (a.wait > 0 || !arrived) return;

      if (a.phase === 'hold') {
        marquee.style.display = 'none';
        clearSelection();
        a.phase = 'wander';
        a.wait = rand(1200, 2200);
        retarget(a);
        return;
      }

      if (a.phase === 'toStart') {
        // the block may have swapped out while the cursor was on its way
        var b = a.target;
        if (!b || !b.el.classList.contains('is-in')) {
          a.phase = 'wander';
          a.wait = rand(250, 900);
          retarget(a);
          return;
        }

        // press on the block's top-left corner and pull the box open to the
        // opposite one, so the selection comes out the size of the block
        press(a);
        a.dragX = b.x - SEL_M;
        a.dragY = b.y - SEL_M;
        a.x = a.dragX;
        a.y = a.dragY;
        a.tx = b.x + b.w + SEL_M;
        a.ty = b.y + b.h + SEL_M;
        a.phase = 'drag';
        return;
      }

      // wandering: every few hops the selector goes and selects whatever is on
      // the canvas instead
      if (a.selects && Math.random() < 0.45) {
        var block = onCanvas();
        if (block) {
          a.target = block;
          a.phase = 'toStart';
          a.tx = block.x - SEL_M;
          a.ty = block.y - SEL_M;
          return;
        }
      }

      a.wait = rand(250, 900);
      retarget(a);
    });

    raf = requestAnimationFrame(step);
  }

  var raf = null;

  function play() {
    if (raf === null) { last = 0; raf = requestAnimationFrame(step); }
  }

  function pause() {
    cancelAnimationFrame(raf);
    raf = null;
  }

  measure();
  actors.forEach(function (a) {
    a.x = spotX();
    a.y = spotY();
    retarget(a);
    place(a);
  });

  // resize fires in bursts and measure() reads layout, so coalesce to one
  // read per frame rather than one per event
  var pendingMeasure = false;
  window.addEventListener('resize', function () {
    if (pendingMeasure) return;
    pendingMeasure = true;
    requestAnimationFrame(function () {
      pendingMeasure = false;
      measure();
    });
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // only run while the box is actually on screen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) play();
      else pause();
    }, { threshold: 0 }).observe(mini);
  } else {
    play();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
    else if (raf === null) play();
  });
})();

/* The loading mark's write cycle.

   From the Canvas repo's ui/loading-mark.js, unchanged in substance: the four
   durations are read off the document element, the path is measured with
   getTotalLength(), and the @keyframes are built at runtime because the easing
   has to apply to each leg independently — eased in and out of both the write
   and the unwrite, dead still through the holds — and that needs the real path
   length in px, which only the browser knows. */
(function () {
  var box = document.querySelector('.loading-mark');
  if (!box) return;

  var path = box.querySelector('.mark');
  var root = document.documentElement;

  function ms(name) {
    return parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
  }

  var len = path.getTotalLength();
  root.style.setProperty('--len', len.toFixed(2));

  var draw = ms('--draw'),
      erase = ms('--erase'),
      holdFull = ms('--hold-full'),
      holdEmpty = ms('--hold-empty');

  var total = draw + erase + holdFull + holdEmpty;
  root.style.setProperty('--cycle', total + 'ms');

  // percentage stops for one full write -> hold -> unwrite -> hold cycle
  function p(t) { return (t / total * 100).toFixed(4) + '%'; }

  var ease = 'cubic-bezier(.62, 0, .38, 1)';
  var kf =
    '@keyframes write {'
    + '  0%      { stroke-dashoffset: ' + len + 'px; animation-timing-function: ' + ease + '; }'
    + '  ' + p(draw) + ' { stroke-dashoffset: 0px; animation-timing-function: linear; }'
    + '  ' + p(draw + holdFull) + ' { stroke-dashoffset: 0px; animation-timing-function: ' + ease + '; }'
    + '  ' + p(draw + holdFull + erase) + ' { stroke-dashoffset: ' + len + 'px; animation-timing-function: linear; }'
    + '  100%    { stroke-dashoffset: ' + len + 'px; }'
    + '}';

  var style = document.createElement('style');
  style.id = 'kf';
  style.textContent = kf;
  document.head.appendChild(style);

  box.classList.add('ready');
})();

/* The feature row's CSS animations run only while the row is on screen. */
(function () {
  var features = document.querySelector('.features');
  if (!features) return;

  if (!('IntersectionObserver' in window)) {
    features.classList.add('is-onscreen');
    return;
  }

  new IntersectionObserver(function (entries) {
    features.classList.toggle('is-onscreen', entries[0].isIntersecting);
  }, { threshold: 0 }).observe(features);
})();

/* FAQ open and close.

   <details> gives the semantics and the keyboard behaviour for free but snaps
   between states, so the toggle is intercepted and the height animated off the
   real measured height instead: opening sets `open` first and grows from zero,
   closing runs the same animation backwards and only drops `open` when it
   finishes. Either one can be interrupted mid-flight — the running animation is
   cancelled and the next starts from wherever the box actually is, so a fast
   double click never leaves a half-open box behind. */
(function () {
  var items = document.querySelectorAll('.faq-item');
  if (!items.length) return;

  var MS = 380;
  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  Array.prototype.forEach.call(items, function (item) {
    var summary = item.querySelector('summary');
    var body = item.querySelector('.faq-body');
    var anim = null;

    function run(from, to, opening) {
      if (anim) anim.cancel();

      anim = body.animate(
        { height: [from + 'px', to + 'px'], opacity: [opening ? 0 : 1, opening ? 1 : 0] },
        { duration: MS, easing: EASE }
      );

      anim.onfinish = function () {
        anim = null;
        body.style.height = '';
        body.style.opacity = '';
        if (!opening) item.open = false;
      };
    }

    summary.addEventListener('click', function (e) {
      e.preventDefault();

      if (reduced) {
        item.open = !item.open;
        return;
      }

      // whatever height the box is at right now, mid-animation or at rest
      var current = body.getBoundingClientRect().height;

      if (item.open) {
        run(current, 0, false);
        return;
      }

      // open it first: a closed <details> does not lay its content out, so
      // there is no height to measure until it is
      item.open = true;
      run(current, body.scrollHeight, true);
    });
  });
})();

/* The chapter list in the left margin: which section you are in, and a way to
   jump between them. It stays out of the way over the hero and over the closing
   CTA — a page-position index is only useful while there is page above and
   below you — and it reads position off measured offsets rather than an
   observer, because "the section you are in" is the last heading you passed,
   not whichever box happens to be intersecting. */
(function () {
  var nav = document.querySelector('.chapters');
  if (!nav) return;

  var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
  var cta = document.querySelector('.cta');

  var marks = links.map(function (link) {
    var id = link.getAttribute('href').slice(1);
    return { link: link, el: id === 'top' ? null : document.getElementById(id), top: 0 };
  }).filter(function (m) { return m.el || m.link.hasAttribute('data-top'); });

  if (marks.length < 2) return;

  var ctaTop = 0;
  var showFrom = 0;

  // the column is 1100px centred; the nav is 96px wide sitting 20px off the
  // edge, so it needs that much clear margin plus a little air
  function hasRoom() {
    return (window.innerWidth - 1100) / 2 >= 128;
  }

  function measure() {
    nav.classList.toggle('has-room', hasRoom());

    marks.forEach(function (m) {
      m.top = m.el ? m.el.getBoundingClientRect().top + window.scrollY : 0;
    });
    ctaTop = cta ? cta.getBoundingClientRect().top + window.scrollY : Infinity;
    // it turns up once the first real section is within a screen of the top
    showFrom = Math.max(0, (marks[1].top || 0) - window.innerHeight);
  }

  var here = null;

  function update() {
    var y = window.scrollY;
    var mid = y + window.innerHeight * 0.4;

    nav.classList.toggle('is-shown', y > showFrom && y + window.innerHeight * 0.5 < ctaTop);

    var found = marks[0];
    for (var i = 1; i < marks.length; i++) {
      if (marks[i].top <= mid) found = marks[i];
    }

    if (found === here) return;
    if (here) here.link.classList.remove('is-here');
    found.link.classList.add('is-here');
    here = found;
  }

  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      update();
    });
  }

  // "Intro" is the top of the page, which is not an element
  links.forEach(function (link) {
    if (!link.hasAttribute('data-top')) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  measure();
  update();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); update(); });

  // images landing below the fold move every offset under them
  window.addEventListener('load', function () { measure(); update(); });
})();

/* Request access: the pill opens a small form in place.

   The panel is absolutely positioned, so opening one never moves the page —
   it drops below the pill in the hero and rises above it in the closing CTA,
   where there is nothing below to drop into. Height is animated off the real
   measured height, the same way the FAQ boxes are.

   Set ENDPOINT to a URL that accepts a JSON POST to actually collect these.
   Until then the form validates, reports back, and goes no further — it never
   pretends to have sent something it has not. */
(function () {
  var ENDPOINT = '';

  var widgets = document.querySelectorAll('.access');
  if (!widgets.length) return;

  var MS = 320;
  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var scrim = document.querySelector('.scrim');
  var open = null; // only one of them is ever open

  function dim(on) {
    if (scrim) scrim.classList.toggle('is-on', on);
  }

  Array.prototype.forEach.call(widgets, function (widget) {
    var pill = widget.querySelector('.pill');
    var panel = widget.querySelector('.access-panel');
    var form = widget.querySelector('.access-form');
    var note = widget.querySelector('.access-note');
    var anim = null;

    function height() {
      return panel.getBoundingClientRect().height;
    }

    function run(from, to, opening) {
      if (anim) anim.cancel();

      anim = panel.animate(
        { height: [from + 'px', to + 'px'], opacity: [opening ? 0 : 1, opening ? 1 : 0] },
        { duration: MS, easing: EASE }
      );

      anim.onfinish = function () {
        anim = null;
        panel.style.height = '';
        panel.style.opacity = '';
        if (!opening) panel.hidden = true;
      };
    }

    function show() {
      if (open && open !== api) open.hide();

      var from = panel.hidden ? 0 : height();
      panel.hidden = false;
      pill.setAttribute('aria-expanded', 'true');
      open = api;
      dim(true);

      if (reduced) return focusFirst();

      run(from, panel.scrollHeight, true);
      focusFirst();
    }

    function hide() {
      if (panel.hidden) return;

      pill.setAttribute('aria-expanded', 'false');
      if (open === api) open = null;
      if (!open) dim(false);

      if (reduced) {
        panel.hidden = true;
        return;
      }
      run(height(), 0, false);
    }

    function focusFirst() {
      var first = form.querySelector('input');
      if (first) first.focus({ preventScroll: true });
    }

    var api = { hide: hide, widget: widget };

    pill.addEventListener('click', function () {
      if (panel.hidden || pill.getAttribute('aria-expanded') === 'false') show();
      else hide();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var email = form.elements.email;
      var name = form.elements.name;
      var bad = null;

      [email, name].forEach(function (field) {
        var ok = field.value.trim() && (field.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(field.value.trim()));
        field.classList.toggle('is-bad', !ok);
        if (!ok && !bad) bad = field;
      });

      if (bad) {
        note.textContent = bad === email ? 'A working email, please.' : 'Your name, please.';
        bad.focus();
        return;
      }

      var payload = {
        email: email.value.trim(),
        name: name.value.trim(),
        organization: form.elements.organization.value.trim()
      };

      if (!ENDPOINT) {
        note.textContent = 'Thanks — nothing is wired up to receive this yet.';
        return;
      }

      note.textContent = 'Sending…';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        form.reset();
        note.textContent = 'Thanks — we will be in touch.';
      }).catch(function () {
        note.textContent = 'That did not send. Try again in a moment.';
      });
    });
  });

  // a click anywhere else, or Escape, puts it away
  document.addEventListener('click', function (e) {
    if (open && !open.widget.contains(e.target)) open.hide();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) {
      var w = open.widget;
      open.hide();
      w.querySelector('.pill').focus();
    }
  });
})();
