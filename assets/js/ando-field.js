/* Ando field — the stroke-drawn architecture the page is built around.

   Nothing here is a vector stroke. Every edge, seam and branch is a run of
   small dots, each nudged off the line by value noise and sized by it, so a
   drawn line has grain the way a pencil line does. The technique is lifted
   from newyellow's "Zen Pots" (openprocessing.org/sketch/2036000): a
   recursive splitter that grows a stick into branches, then paints each
   segment as a jittered dot run. Same material, different subject — concrete
   planes, a slit of light, and one tree, which is a Tadao Ando courtyard cut
   down to the fewest marks that still read as a building.

   Two compositions share the engine:
     court — the full scene, the page's centrepiece
     seam  — a single course of formwork panels, used as a rule between bands

   Both draw themselves once, stroke by stroke, when they scroll into view. */
(function (global) {
  "use strict";

  var COURT_RATIO = 0.62;
  var SEAM_RATIO = 0.15;

  /* How many frames a full reveal is spread over. The dot budget per frame is
     derived from it, so a dense composition and a sparse one take the same
     time to land. */
  var REVEAL_FRAMES = 190;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y, seed) {
    var r = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return r - Math.floor(r);
  }

  /* Value noise: the grain both the jitter and the dot size are read from, so
     a line's wobble and its weight thicken together instead of fighting. */
  function noise2(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf);
    var v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    var c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /* One drawn line, as dots. */
  function dotRun(x1, y1, x2, y2, o) {
    o = o || {};
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var density = o.density == null ? 1.3 : o.density;
    var count = Math.max(2, Math.round(len * density));
    var nx = -dy / len, ny = dx / len;
    var weight = o.weight == null ? 0.55 : o.weight;
    var jitter = o.jitter == null ? 0.5 : o.jitter;
    var alpha = o.alpha == null ? 0.34 : o.alpha;
    var seed = o.seed || 1;

    var dots = new Array(count);
    for (var i = 0; i < count; i++) {
      var t = i / (count - 1);
      var x = x1 + dx * t;
      var y = y1 + dy * t;
      var off = (noise2(x * 0.11, y * 0.11, seed) - 0.5) * 2 * jitter;
      x += nx * off;
      y += ny * off;
      var grain = noise2(x * 0.5, y * 0.5, seed + 31);
      dots[i] = {
        x: x,
        y: y,
        r: weight * (0.55 + grain * 0.9),
        a: Math.min(1, alpha * (0.5 + grain * 0.8))
      };
    }
    return dots;
  }

  /* The form-tie holes left in fair-faced concrete — six to a panel, three
     across and two down. On an Ando wall they are the only ornament there is,
     so they carry more weight here than the seams that frame them. */
  function panelHoles(x, y, w, h, seed) {
    var xs = [0.2, 0.5, 0.8];
    var ys = [0.3, 0.7];
    var dots = [];
    for (var r = 0; r < ys.length; r++) {
      for (var c = 0; c < xs.length; c++) {
        var hx = x + xs[c] * w;
        var hy = y + ys[r] * h;
        var g = noise2(hx * 0.3, hy * 0.3, seed);
        dots.push({ x: hx, y: hy, r: 1.1 + g * 0.75, a: 0.26 + g * 0.2 });
      }
    }
    return dots;
  }

  /* The branch splitter from the sketch, kept close to the original: a segment
     either forks into two that lean apart, or carries on with a wobble, and
     each child is shorter than its parent. One side of a fork is allowed to
     come out much shorter than the other, which is what keeps the tree from
     growing up symmetrical.

     What is added here is a trunk. Left to itself the splitter wanders from
     the first segment on and the tree comes out as a bent stick; holding the
     two lowest lengths near vertical and forbidding them to fork gives the
     crown something to stand on. */
  function growBranch(x, y, dir, length, depth, rand, out) {
    var toX = x + length * Math.sin(dir * Math.PI / 180);
    var toY = y - length * Math.cos(dir * Math.PI / 180);
    out.push({ x1: x, y1: y, x2: toX, y2: toY, depth: depth });

    if (depth <= 0) return;

    var trunk = depth >= 6;
    var spread = depth > 3 ? 22 : 34;

    if (!trunk && rand() < (depth > 2 ? 0.82 : 0.55)) {
      var leftMin = 0.62, rightMin = 0.62;
      if (rand() < 0.5) leftMin = 0.24;
      else rightMin = 0.24;

      growBranch(toX, toY, dir - lerp(0.35 * spread, spread, rand()),
        length * lerp(leftMin, 0.92, rand()), depth - 1, rand, out);
      growBranch(toX, toY, dir + lerp(0.35 * spread, spread, rand()),
        length * lerp(rightMin, 0.92, rand()), depth - 1, rand, out);
    } else {
      var wobble = trunk ? 4 : 16;
      growBranch(toX, toY, dir + lerp(-wobble, wobble, rand()),
        length * lerp(trunk ? 0.86 : 0.62, 0.94, rand()), depth - 1, rand, out);
    }
  }

  function readVar(name, fallback) {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  }

  function AndoField(host, opts) {
    opts = opts || {};
    this.host = host;
    this.variant = opts.variant === "seam" ? "seam" : "court";
    this.seed = opts.seed || 1846;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "ando-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d");
    host.appendChild(this.canvas);

    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.paper = readVar("--bg", "#ffffff");
    this.ink = readVar("--ink-rgb", "24, 23, 21");

    this.ops = [];
    this.op = 0;
    this.cursor = 0;
    this.budget = 60;
    this.raf = 0;
    this.started = false;
    this.done = false;

    this.resize();
  }

  AndoField.prototype.resize = function () {
    var w = this.host.getBoundingClientRect().width;
    if (!w) return;

    var h = Math.round(w * (this.variant === "seam" ? SEAM_RATIO : COURT_RATIO));
    this.w = w;
    this.h = h;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);

    this.canvas.style.width = Math.round(w) + "px";
    this.canvas.style.height = h + "px";
    this.canvas.width = Math.ceil(w * this.dpr);
    this.canvas.height = Math.ceil(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.host.style.height = h + "px";

    this.build();

    // A drawing that had already landed is rebuilt whole rather than replayed;
    // a reveal caught mid-flight simply starts its stroke order again.
    if (this.done || this.reduced) this.finish();
    else if (this.started) this.play();
  };

  AndoField.prototype.build = function () {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.ops = this.variant === "seam" ? this.composeSeam() : this.composeCourt();
    this.op = 0;
    this.cursor = 0;

    var total = 0;
    for (var i = 0; i < this.ops.length; i++) {
      if (this.ops[i].k === "dots") total += this.ops[i].d.length;
    }
    this.budget = Math.max(20, Math.ceil(total / REVEAL_FRAMES));
  };

  AndoField.prototype.composeCourt = function () {
    var W = this.w, H = this.h;
    var ink = this.ink, paper = this.paper;
    var rand = mulberry32(this.seed);
    var ops = [];
    var sd = 1;

    function tone(a) {
      return "rgba(" + ink + ", " + a + ")";
    }
    function line(x1, y1, x2, y2, o) {
      o = o || {};
      o.seed = sd++;
      ops.push({ k: "dots", d: dotRun(x1, y1, x2, y2, o) });
    }

    var ground = 0.78 * H;

    // The tall plane, and the nearer, lower one that laps in front of it. Two
    // overlapping planes and a horizon is the whole of the depth here.
    var A = { x0: 0.05 * W, x1: 0.60 * W, y0: 0.08 * H, y1: ground };
    var B = { x0: 0.50 * W, x1: 0.965 * W, y0: 0.40 * H, y1: ground };

    var slitW = Math.max(4, 0.021 * W);
    var slitX = 0.385 * W;

    var edge = { alpha: 0.4, weight: 0.62, jitter: 0.55, density: 1.35 };
    var seam = { alpha: 0.2, weight: 0.42, jitter: 0.4, density: 1.15 };

    /* ---- floor, and the light the slit throws across it ---- */
    ops.push({ k: "rect", x: 0, y: ground, w: W, h: H - ground, c: tone(0.05) });
    ops.push({
      k: "poly",
      p: [
        [slitX - slitW / 2, ground],
        [slitX + slitW / 2, ground],
        [slitX + 0.34 * W, H],
        [slitX + 0.06 * W, H]
      ],
      c: paper
    });

    /* ---- the tall plane ---- */
    ops.push({ k: "rect", x: A.x0, y: A.y0, w: A.x1 - A.x0, h: A.y1 - A.y0, c: tone(0.038) });
    line(A.x0, A.y0, A.x1, A.y0, Object.assign({}, edge));
    line(A.x0, A.y0, A.x0, A.y1, Object.assign({}, edge));
    line(A.x1, A.y0, A.x1, A.y1, Object.assign({}, edge));

    var aCols = 3, aRows = 4;
    var apw = (A.x1 - A.x0) / aCols;
    var aph = (A.y1 - A.y0) / aRows;
    var i, j;
    for (i = 1; i < aCols; i++) {
      line(A.x0 + i * apw, A.y0, A.x0 + i * apw, A.y1, Object.assign({}, seam));
    }
    for (j = 1; j < aRows; j++) {
      line(A.x0, A.y0 + j * aph, A.x1, A.y0 + j * aph, Object.assign({}, seam));
    }
    for (j = 0; j < aRows; j++) {
      for (i = 0; i < aCols; i++) {
        ops.push({
          k: "dots",
          d: panelHoles(A.x0 + i * apw, A.y0 + j * aph, apw, aph, sd++)
        });
      }
    }

    /* ---- the slit: paper cut back through the wall, so it reads as the one
       bright thing in the drawing ---- */
    ops.push({
      k: "rect",
      x: slitX - slitW / 2,
      y: A.y0 + 0.02 * H,
      w: slitW,
      h: ground - A.y0 - 0.02 * H,
      c: paper
    });
    line(slitX - slitW / 2, A.y0 + 0.02 * H, slitX - slitW / 2, ground,
      { alpha: 0.42, weight: 0.55, jitter: 0.3, density: 1.35 });
    line(slitX + slitW / 2, A.y0 + 0.02 * H, slitX + slitW / 2, ground,
      { alpha: 0.42, weight: 0.55, jitter: 0.3, density: 1.35 });

    /* ---- the near plane, which occludes rather than overlaps: it lays down
       paper first, then its own slightly deeper tone ---- */
    ops.push({ k: "rect", x: B.x0, y: B.y0, w: B.x1 - B.x0, h: B.y1 - B.y0, c: paper });
    ops.push({ k: "rect", x: B.x0, y: B.y0, w: B.x1 - B.x0, h: B.y1 - B.y0, c: tone(0.065) });
    line(B.x0, B.y0, B.x1, B.y0, Object.assign({}, edge));
    line(B.x0, B.y0, B.x0, B.y1, Object.assign({}, edge));

    var bCols = 2, bRows = 2;
    var bpw = (B.x1 - B.x0) / bCols;
    var bph = (B.y1 - B.y0) / bRows;
    for (i = 1; i < bCols; i++) {
      line(B.x0 + i * bpw, B.y0, B.x0 + i * bpw, B.y1, Object.assign({}, seam));
    }
    for (j = 1; j < bRows; j++) {
      line(B.x0, B.y0 + j * bph, B.x1, B.y0 + j * bph, Object.assign({}, seam));
    }
    for (j = 0; j < bRows; j++) {
      for (i = 0; i < bCols; i++) {
        ops.push({
          k: "dots",
          d: panelHoles(B.x0 + i * bpw, B.y0 + j * bph, bpw, bph, sd++)
        });
      }
    }

    /* ---- the horizon, laid over both planes so it lands as one stroke ---- */
    line(0, ground, W, ground, { alpha: 0.36, weight: 0.6, jitter: 0.5, density: 1.3 });

    /* ---- one tree ---- */
    var treeX = 0.775 * W;
    var branches = [];
    growBranch(treeX, ground, -4, 0.132 * H, 7, rand, branches);

    // Grown depth by depth rather than limb by limb, so the reveal reads as a
    // tree filling out instead of one arm at a time.
    branches.sort(function (a, b) {
      return b.depth - a.depth;
    });

    /* The shadow it pools at its own foot. An offset copy of the branches cast
       on the wall behind was the obvious move and the wrong one — it read as a
       double exposure rather than as light. */
    for (i = 0; i < 7; i++) {
      var sy = ground + 1.5 + i * 1.7;
      line(treeX - 0.014 * W, sy, treeX + 0.115 * W * (1 - i / 9), sy, {
        alpha: 0.11 * (1 - i / 8),
        weight: 0.5,
        jitter: 0.7,
        density: 0.85
      });
    }

    var b, thickness;

    for (i = 0; i < branches.length; i++) {
      b = branches[i];
      thickness = 0.55 + b.depth * 0.38;
      ops.push({
        k: "dots",
        d: dotRun(b.x1, b.y1, b.x2, b.y2, {
          alpha: 0.46,
          weight: thickness * 0.44,
          jitter: thickness * 0.5,
          density: 2,
          seed: sd++
        })
      });

      // Leaves, only out at the thin ends: the sketch's scattered flower dots,
      // which do more to make the thing read as a tree than the branches do.
      if (b.depth <= 3) {
        var leaves = Math.floor(rand() * 7);
        var buds = [];
        for (j = 0; j < leaves; j++) {
          var t = rand();
          buds.push({
            x: lerp(b.x1, b.x2, t) + (rand() - 0.5) * 0.04 * W,
            y: lerp(b.y1, b.y2, t) + (rand() - 0.5) * 0.04 * W,
            r: 0.4 + rand() * 1.5,
            a: 0.14 + rand() * 0.26
          });
        }
        if (buds.length) ops.push({ k: "dots", d: buds });
      }
    }

    return ops;
  };

  /* A single course of formwork, run edge to edge: the same wall as the court
     drawing, seen too close to be a building. One panel is left as paper, so
     the course has somewhere for the eye to stop. */
  AndoField.prototype.composeSeam = function () {
    var W = this.w, H = this.h;
    var ink = this.ink;
    var ops = [];
    var sd = 400;

    function tone(a) {
      return "rgba(" + ink + ", " + a + ")";
    }
    function line(x1, y1, x2, y2, o) {
      o.seed = sd++;
      ops.push({ k: "dots", d: dotRun(x1, y1, x2, y2, o) });
    }

    var top = 0.14 * H;
    var bottom = 0.86 * H;
    var cols = 6;
    var pw = W / cols;
    var voidCol = 3;
    var i;

    for (i = 0; i < cols; i++) {
      if (i === voidCol) continue;
      ops.push({ k: "rect", x: i * pw, y: top, w: pw, h: bottom - top, c: tone(0.05) });
    }

    line(0, top, W, top, { alpha: 0.32, weight: 0.55, jitter: 0.45, density: 1.3 });
    line(0, bottom, W, bottom, { alpha: 0.32, weight: 0.55, jitter: 0.45, density: 1.3 });

    for (i = 1; i < cols; i++) {
      line(i * pw, top, i * pw, bottom, {
        alpha: 0.2, weight: 0.42, jitter: 0.35, density: 1.15
      });
    }

    for (i = 0; i < cols; i++) {
      if (i === voidCol) continue;
      ops.push({ k: "dots", d: panelHoles(i * pw, top, pw, bottom - top, sd++) });
    }

    return ops;
  };

  AndoField.prototype.paint = function (op, from, to) {
    var ctx = this.ctx;

    if (op.k === "rect") {
      ctx.globalAlpha = 1;
      ctx.fillStyle = op.c;
      ctx.fillRect(op.x, op.y, op.w, op.h);
      return;
    }

    if (op.k === "poly") {
      ctx.globalAlpha = 1;
      ctx.fillStyle = op.c;
      ctx.beginPath();
      ctx.moveTo(op.p[0][0], op.p[0][1]);
      for (var p = 1; p < op.p.length; p++) ctx.lineTo(op.p[p][0], op.p[p][1]);
      ctx.closePath();
      ctx.fill();
      return;
    }

    ctx.fillStyle = "rgb(" + this.ink + ")";
    for (var i = from; i < to; i++) {
      var d = op.d[i];
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  AndoField.prototype.frame = function () {
    var left = this.budget;

    while (left > 0 && this.op < this.ops.length) {
      var op = this.ops[this.op];

      if (op.k !== "dots") {
        this.paint(op);
        this.op++;
        this.cursor = 0;
        continue;
      }

      var take = Math.min(left, op.d.length - this.cursor);
      this.paint(op, this.cursor, this.cursor + take);
      this.cursor += take;
      left -= take;

      if (this.cursor >= op.d.length) {
        this.op++;
        this.cursor = 0;
      }
    }

    if (this.op >= this.ops.length) {
      this.done = true;
      this.raf = 0;
      return;
    }

    this.raf = requestAnimationFrame(this.frame.bind(this));
  };

  AndoField.prototype.play = function () {
    this.started = true;
    if (this.reduced) {
      this.finish();
      return;
    }
    this.op = 0;
    this.cursor = 0;
    this.ctx.clearRect(0, 0, this.w, this.h);
    if (!this.raf) this.raf = requestAnimationFrame(this.frame.bind(this));
  };

  AndoField.prototype.finish = function () {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.ctx.clearRect(0, 0, this.w, this.h);
    for (var i = 0; i < this.ops.length; i++) {
      var op = this.ops[i];
      this.paint(op, 0, op.k === "dots" ? op.d.length : 0);
    }
    this.started = true;
    this.done = true;
  };

  /* Held back until the drawing is on screen — it is worth watching land, and
     nobody would see it happen above the fold of a section they scrolled past. */
  AndoField.prototype.revealOnView = function () {
    var self = this;
    if (!("IntersectionObserver" in window)) {
      this.finish();
      return this;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.disconnect();
          self.play();
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(this.host);
    return this;
  };

  global.AndoField = AndoField;
})(window);
