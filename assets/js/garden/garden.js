/* The garden.

   One canvas is fixed behind the whole page. Every plant is anchored to a real
   element — the plant fills that element's box and stands on its bottom edge —
   so the planting reflows with the layout instead of being positioned twice.

   Each plant is drawn once into its own buffer, a few milliseconds at a time,
   lowest ink first, so it grows up out of the ground as it comes into view.
   After that the buffer is blitted in horizontal strips with a per-strip
   offset, which is what the breeze is: a stipple cloud can be sheared and no
   one sees a seam, because there are no continuous edges to break. */

const GROW_BUDGET = 7;      // ms per frame spent drawing
const STRIPS = 15;          // horizontal slices used to sway a plant
const MOTES = 14;           // seeds adrift on the page

const INK = {
  bark: new Ink(30, 12, 30),   // sumi, barely warm
  edge: new Ink(30, 12, 48),
  stem: new Ink(118, 11, 40),
  leaf: new Ink(128, 10, 46),  // a moss so muted the page still reads as black on white
  dust: new Ink(40, 8, 82)
};

let _plants = [];
let _growing = [];          // plants with ink still to lay down, in the order they came into view
let _motes = [];
let _still = false;         // prefers-reduced-motion: draw it all, then hold
let _pointer = { x: -1e5, y: -1e5, on: false };
let _lastScroll = -1;
let _dirty = true;
let _canvas;

/* ---------- setup ------------------------------------------------------- */

function setup() {
  _canvas = createCanvas(windowWidth, windowHeight);
  _canvas.parent("garden");
  _canvas.elt.className = "garden-canvas";
  _canvas.elt.setAttribute("aria-hidden", "true");
  pixelDensity(min(2, displayDensity()));
  colorMode(HSB);
  noStroke();

  _still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  DENSITY = constrain(0.95 - (windowWidth * windowHeight) / 4600000, 0.55, 0.9);

  seedMotes();

  /* The wordmark is cut from the page's own type, so it cannot be measured
     until the face it is set in has actually arrived. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(plant);
  else plant();
}

function windowResized() {
  const widthChanged = width !== windowWidth;
  resizeCanvas(windowWidth, windowHeight);
  seedMotes();
  /* Height alone changes on a phone every time the address bar slides away —
     re-cutting every plant for that would be a lot of work to look identical. */
  if (widthChanged) plant();
  else { measure(); _dirty = true; }
}

/* ---------- planting ---------------------------------------------------- */

function plant() {
  /* The empty boxes a plant is anchored to are only worth their space once
     something is going to grow in them, and the wordmark only steps back to
     transparent once there is a hedge to replace it. */
  document.documentElement.classList.add("has-garden");

  for (const old of _plants) old.buf.remove();
  _plants = [];
  _growing = [];

  document.querySelectorAll("[data-plant]").forEach((el) => {
    const species = el.dataset.plant;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;

    const pad = Math.round(Math.max(12, r.height * 0.3));
    const bw = Math.ceil(r.width) + pad * 2;
    const bh = Math.ceil(r.height) + pad;

    const buf = createGraphics(bw, bh);
    buf.pixelDensity(pixelDensity());
    buf.colorMode(HSB);
    buf.noStroke();
    buf.clear();

    const p = {
      el, species, buf, bw, bh, pad,
      dpr: pixelDensity(),
      ops: [],
      grown: false,
      started: false,
      x: 0, y: 0,
      manual: el.dataset.grow === "manual",
      phase: random(TWO_PI),
      speed: random(0.00042, 0.00072),
      amp: _still ? 0 : (el.dataset.sway ? parseFloat(el.dataset.sway) : 1) * random(1.6, 3.0),
      lean: 0
    };

    cut(p);
    _plants.push(p);
  });

  measure();
  watch();
  _dirty = true;
}

/* Work out a plant's ops. Nothing is drawn yet — the ops are sorted so the
   lowest ink is laid down first and the plant grows upward. */
function cut(p) {
  const ops = [];
  const q = (y, fn) => ops.push({ y, fn });

  const plot = {
    w: p.bw - p.pad * 2,
    h: p.bh - p.pad,
    ground: p.bh - p.pad * 0.5,
    q: (y, fn) => q(y, fn),
    ink: INK,
    el: p.el
  };

  /* Species draw in their own plot's coordinates; the pad is added here so a
     canopy or an escaped sprig can spill past the anchor box. */
  const shift = (fn) => () => { p.buf.push(); p.buf.translate(p.pad, 0); fn(); p.buf.pop(); };

  useBuffer(p.buf);
  if (p.species === "wordmark") cutWordmark(plot, p);
  else if (FLORA[p.species]) FLORA[p.species](plot);
  else return;

  ops.sort((a, b) => b.y - a.y);
  p.ops = ops.map((o) => shift(o.fn));
}

/* The wordmark is a hedge clipped into the shape of the word. It is cut from
   the h1's own font at its own size, so it stays the page's type — the letters
   are just grown instead of set. */
function cutWordmark(plot, p) {
  const el = p.el;
  const cs = getComputedStyle(el);
  const word = (el.dataset.word || el.textContent || "").trim();
  if (!word) return;

  /* Canvas2D takes no font-feature settings, so a serif face is free to fuse
     "ff" into a single glyph — and a hedge grown from that ligature reads as a
     different word. Neither letter-spacing nor a zero-width non-joiner stops
     it, so each letter is measured and set on its own: two fillText calls
     cannot form a ligature between them. Tracking is applied by hand for the
     same reason. */
  const chars = word.split("");
  const probe = document.createElement("canvas").getContext("2d");
  const trackEm = (parseFloat(cs.letterSpacing) || 0) / (parseFloat(cs.fontSize) || 1);

  let size = 200;
  const setFont = (px) => {
    probe.letterSpacing = "0px";
    probe.font = `${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`;
  };
  const layout = () => {
    const adv = chars.map((ch) => probe.measureText(ch).width);
    const total = adv.reduce((a, b) => a + b, 0) + trackEm * size * (chars.length - 1);
    return { adv, total };
  };

  setFont(size);
  size *= (plot.w * 0.98) / (layout().total || 1);
  setFont(size);
  const { adv, total: inkW } = layout();

  let asc = 0, desc = 0;
  for (const ch of chars) {
    const cm = probe.measureText(ch);
    asc = max(asc, cm.actualBoundingBoxAscent);
    desc = max(desc, cm.actualBoundingBoxDescent);
  }
  const inkH = max(1, asc + desc);

  /* Sit the letters on the ground line, descenders below it — a hedge grows
     out of the soil, it does not hover over it. */
  const baseline = plot.ground - desc * 0.55;
  const left = (plot.w - inkW) / 2;
  const top = baseline - asc;

  const scale = pixelDensity();
  const mc = document.createElement("canvas");
  mc.width = max(1, ceil(plot.w * scale));
  mc.height = max(1, ceil((plot.h + p.pad) * scale));
  const mx = mc.getContext("2d");
  mx.scale(scale, scale);
  mx.fillStyle = "#000";
  mx.textBaseline = "alphabetic";
  mx.textAlign = "left";
  mx.letterSpacing = "0px";
  mx.font = probe.font;

  let pen = left;
  for (let i = 0; i < chars.length; i++) {
    mx.fillText(chars[i], pen, baseline);
    pen += adv[i] + trackEm * size;
  }

  const data = mx.getImageData(0, 0, mc.width, mc.height).data;
  const sampler = (x, y) => {
    const px = (x * scale) | 0, py = (y * scale) | 0;
    if (px < 0 || py < 0 || px >= mc.width || py >= mc.height) return false;
    return data[(py * mc.width + px) * 4 + 3] > 128;
  };

  /* The field has to resolve a serif crossbar, which at this size is still
     only a few pixels of ink — sampled any coarser and the word grows up
     reading as something else. */
  const field = buildField(sampler,
    { x0: left - 6, y0: top - 6, x1: left + inkW + 6, y1: baseline + desc + 6 },
    max(0.9, inkH / 150));

  growForm(plot.q, field, INK.leaf, 0.5, max(8, int(inkH / 7)),
           { rim: max(2, inkH * 0.025), thin: 0.12 });

  /* The sprigs that got away from the shears. They are what keeps the
     wordmark a plant rather than a logo. */
  const sprigs = int(random(3, 6));
  for (let i = 0; i < sprigs; i++) {
    const sx = left + random(inkW);
    /* Walk down the column until the letter starts, so the sprig leaves the
       clipped surface rather than floating above it. */
    let sy = -1;
    for (let y = top; y < baseline; y += 2) {
      if (sampler(sx, y)) { sy = y; break; }
    }
    if (sy < 0 || sy > top + inkH * 0.55) continue;
    const len = inkH * random(0.07, 0.15);
    plot.q(sy, () => stippleBranch(sx, sy + 2, random(-34, 34), len, 1,
                                   max(0.7, inkH * 0.009), INK.stem));
  }
}

/* ---------- layout ------------------------------------------------------ */

function measure() {
  const sy = window.scrollY;
  for (const p of _plants) locate(p, sy);
}

/* A plant is pinned to the bottom edge of its anchor, which is the ground it
   stands on. That edge moves more often than it looks: a bed slides up as it
   is revealed, a row pushes everything below it down, a face finishes loading
   and the whole column reflows. So the plants in view are re-pinned every
   frame rather than cached — a handful of reads, none of which dirty layout,
   and the alternative is a garden that floats a few pixels off its own soil. */
function locate(p, sy) {
  const r = p.el.getBoundingClientRect();
  p.x = r.left - p.pad;
  p.y = r.top + sy + r.height - (p.bh - p.pad * 0.5);
}

let _io = null;

function watch() {
  if (_io) _io.disconnect();
  if (!("IntersectionObserver" in window)) { _plants.forEach(start); return; }
  /* Most plants go in as the reader reaches them. A few wait to be asked —
     the seedling beside a question is not planted until the answer is. */
  const auto = _plants.filter((p) => !p.manual);
  _io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const p = _plants.find((q) => q.el === e.target);
      if (p) start(p);
      _io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
  auto.forEach((p) => _io.observe(p.el));
}

function start(p) {
  if (p.started) return;
  p.started = true;
  _growing.push(p);
}

/* ---------- the loop ---------------------------------------------------- */

function draw() {
  if (document.hidden) return;

  const sy = window.scrollY;
  if (sy !== _lastScroll) { measure(); _lastScroll = sy; _dirty = true; }

  /* With motion turned down there is nothing to animate: hold the last frame
     until something actually moves. */
  if (_still && !_dirty && !_growing.length) return;
  _dirty = false;

  clear();

  /* Lay down ink, one plant at a time, in the order the reader met them. */
  /* Turned down, a plant is never seen part-drawn: the ink still goes down
     over several frames so the page never blocks, but nothing is shown until
     the plant is finished. */
  const budget = _still ? GROW_BUDGET * 3 : GROW_BUDGET;
  const t0 = millis();
  while (_growing.length && millis() - t0 < budget) {
    const p = _growing[0];
    useBuffer(p.buf);
    if (p.ops.length) p.ops.shift()();
    else { p.grown = true; _growing.shift(); _dirty = true; }
  }

  const t = millis();
  for (const p of _plants) {
    if (!p.started) continue;
    if (_still && !p.grown) continue;
    if (p.y - sy > height + 200 || p.y - sy + p.bh < -200) continue;
    locate(p, sy);
    const top = p.y - sy;
    if (top > height + 40 || top + p.bh < -40) continue;
    lean(p, sy);
    blit(p, sy, t);
  }

  if (!_still) drawMotes(t);
}

/* A plant nods towards the pointer when it passes — a nod, not a bend. */
function lean(p, sy) {
  let want = 0;
  if (_pointer.on && !_still) {
    const cx = p.x + p.bw / 2;
    const cy = p.y - sy + p.bh / 2;
    const dx = _pointer.x - cx;
    const dy = _pointer.y - cy;
    const d = Math.hypot(dx, dy);
    const reach = p.bw * 1.2 + 140;
    if (d < reach) want = constrain(dx / reach, -1, 1) * 4.5 * (1 - d / reach);
  }
  p.lean += (want - p.lean) * 0.07;
}

function blit(p, sy, t) {
  const ctx = drawingContext;
  const dpr = p.dpr;
  const devH = Math.round(p.bh * dpr);
  const devW = Math.round(p.bw * dpr);
  const step = Math.ceil(devH / STRIPS);
  const dx = p.x;
  const dy = p.y - sy;

  for (let d = 0; d < devH; d += step) {
    const dh = Math.min(step, devH - d);
    const mid = (d + dh / 2) / devH;
    const high = Math.pow(1 - mid, 1.7);          // the top of a plant travels, the base does not
    const off = p.amp * high * Math.sin(t * p.speed + p.phase + (1 - mid) * 1.2)
              + p.lean * high;
    ctx.drawImage(p.buf.elt, 0, d, devW, dh,
                  dx + off, dy + d / dpr, p.bw, dh / dpr + 0.5);
  }
}

/* ---------- seeds adrift ------------------------------------------------ */

function seedMotes() {
  _motes = [];
  for (let i = 0; i < MOTES; i++) {
    _motes.push({
      x: random(windowWidth), y: random(windowHeight),
      vx: random(0.06, 0.22) * (random() < 0.5 ? -1 : 1),
      vy: random(-0.09, -0.02),
      r: random(0.8, 2.0),
      w: random(TWO_PI)
    });
  }
}

function drawMotes(t) {
  for (const m of _motes) {
    m.x += m.vx + Math.sin(t * 0.0009 + m.w) * 0.16;
    m.y += m.vy;
    if (m.y < -8) { m.y = height + 8; m.x = random(width); }
    if (m.x < -8) m.x = width + 8;
    if (m.x > width + 8) m.x = -8;
    fill(INK.dust.h, INK.dust.s, INK.dust.b, 0.5);
    circle(m.x, m.y, m.r);
  }
}

/* ---------- pointer ----------------------------------------------------- */

function mouseMoved()   { _pointer.x = mouseX; _pointer.y = mouseY; _pointer.on = true; }
function mouseDragged() { mouseMoved(); }

document.addEventListener("mouseleave", () => { _pointer.on = false; });

/* A row that opens or closes changes where everything under it sits. */
window.addEventListener("garden:reflow", () => { measure(); _dirty = true; });

/* Asked for by name: a question was opened, so its seedling goes in. Once
   planted it stays, whether or not the answer is closed again — the garden
   keeps what the reader put in it. */
window.addEventListener("garden:grow", (e) => {
  const el = e.detail && e.detail.el;
  if (!el) return;
  const p = _plants.find((q) => q.el === el);
  if (p) { measure(); start(p); }
});
