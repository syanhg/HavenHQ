/* The planting list.

   Each species fills the box of the element that anchors it and stands on that
   box's bottom edge — which, on this page, is always one of the hairlines that
   rule the layout. The rules are the ground; everything grows off them.

   A species receives a plot:

     w, h     the buffer, in CSS pixels
     ground   the y of the ground line inside it
     q(y, fn) queue one drawing op, tagged with the y it happens at

   Ops are drained lowest-first, so a plant grows up out of the ground instead
   of appearing all at once. */

/* ---------- masks ------------------------------------------------------- */

/* Every trimmed form is an inside-test. A shear cuts a straight line, but a
   hand-held shear wanders, so each edge carries a little noise. */

function rectMask(x0, y0, x1, y1, ragged = 0, seed = 0) {
  return (x, y) => {
    if (x < x0 || x > x1) return false;
    const top = y0 + (noise(x * 0.012, seed) - 0.5) * 2 * ragged;
    return y >= top && y <= y1;
  };
}

function coneMask(cx, baseY, halfW, topY, ragged = 0, seed = 0) {
  const hgt = baseY - topY;
  return (x, y) => {
    if (y > baseY || y < topY) return false;
    const t = (baseY - y) / hgt;                    // 0 at the base, 1 at the tip
    const wAt = halfW * Math.pow(1 - t, 0.82) + (noise(y * 0.02, seed) - 0.5) * 2 * ragged;
    return Math.abs(x - cx) <= wAt;
  };
}

function lobesMask(lobes, ragged = 0, seed = 0) {
  return (x, y) => {
    for (const l of lobes) {
      const r = l.r + (noise(x * 0.02, y * 0.02, seed) - 0.5) * 2 * ragged;
      if ((x - l.x) ** 2 + (y - l.y) ** 2 <= r * r) return true;
    }
    return false;
  };
}

function boxOf(lobes, pad) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const l of lobes) {
    x0 = Math.min(x0, l.x - l.r); x1 = Math.max(x1, l.x + l.r);
    y0 = Math.min(y0, l.y - l.r); y1 = Math.max(y1, l.y + l.r);
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/* Fill a form band by band, bottom-up, so it grows in rather than lands. */
function growForm(q, field, col, perPx2, slices, opt = {}) {
  const b = field.box;
  const h = (b.y1 - b.y0) / slices;
  for (let i = slices - 1; i >= 0; i--) {
    const y0 = b.y0 + i * h;
    const region = { x0: b.x0, y0, x1: b.x1, y1: y0 + h };
    const n = int((region.x1 - region.x0) * h * perPx2);
    if (n < 1) continue;
    q(y0 + h, () => stippleForm(field, col, n, Object.assign({ region }, opt)));
  }
}

/* Queue a tube — a stem, a trunk, a bough. */
function growTube(q, ctrl, ink, opt = {}) {
  const path = buildPath(ctrl, { ease: opt.ease, step: opt.step || 3.0, wob: opt.wob || 0.5 });
  for (const s of path) {
    q(s.y, () => {
      const th = constrain(s.r * 0.34, 2.0, 10);
      stippleRing(s.x, s.y, s.r, s.a, ink.bark.wobble(7, 9, 9), th,
                  { gap: random() < 0.08 ? random(0.02, 0.09) : 0 });
      stippleContour(s.x, s.y, s.r, s.a, ink.edge.wobble(7, 10, 11),
                     int(constrain(s.r * 0.9, 4, 20)));
    });
  }
}

/* ---------- species ----------------------------------------------------- */

const FLORA = {

  /* A low box hedge running the width of the plot. The one plant on the page
     that is pure geometry: it is what a rule looks like once it is alive. */
  hedge(s) {
    const { q, ink, ground } = s;
    const hh = s.h * random(0.72, 0.9);
    const top = ground - hh;
    const field = buildField(rectMask(0, top, s.w, ground, hh * 0.06, random(999)),
                             { x0: -2, y0: top - hh * 0.12, x1: s.w + 2, y1: ground + 2 },
                             max(1.6, hh / 26));

    growForm(q, field, ink.leaf, 0.34, max(4, int(hh / 9)));

    /* A trim is only ever nearly perfect. A few sprigs got away. */
    const sprigs = int(random(3, 7));
    for (let i = 0; i < sprigs; i++) {
      const x = random(s.w * 0.06, s.w * 0.94);
      q(top, () => stippleBranch(x, top + random(0, hh * 0.2), random(-26, 26),
                                 hh * random(0.3, 0.62), 1,
                                 max(0.8, hh * 0.026), ink.stem));
    }
  },

  /* A conical topiary. Two of these flank the CTA and read as a gate. */
  cone(s) {
    const { q, ink, ground } = s;
    const baseY = ground;
    const topY = ground - s.h * random(0.92, 1.0);
    /* A clipped cone is a squat, deliberate thing. Let it run any narrower and
       it stops reading as topiary and starts reading as a conifer. */
    const halfW = min(s.w * 0.5, (baseY - topY) * 0.44);

    const field = buildField(coneMask(s.w / 2, baseY, halfW, topY, halfW * 0.07, random(999)),
                             { x0: s.w / 2 - halfW - 3, y0: topY - 3, x1: s.w / 2 + halfW + 3, y1: baseY + 3 },
                             max(1.5, halfW / 16));
    growForm(q, field, ink.leaf, 0.4, max(5, int((baseY - topY) / 10)));
  },

  /* A standard: one clipped sphere on a bare stem. */
  ball(s) {
    const { q, ink, ground } = s;
    const r = min(s.w * 0.42, s.h * 0.34);
    const cy = ground - s.h + r;

    growTube(q, [[s.w / 2, ground, max(1.5, r * 0.16)],
                 [s.w / 2 + random(-2, 2), (ground + cy) / 2, max(1.3, r * 0.13)],
                 [s.w / 2, cy + r * 0.5, max(1.1, r * 0.11)]], ink);

    const lobes = [{ x: s.w / 2, y: cy, r }];
    const field = buildField(lobesMask(lobes, r * 0.05, random(999)), boxOf(lobes, 3), max(1.5, r / 15));
    growForm(q, field, ink.leaf, 0.42, max(5, int(r / 5)));
  },

  /* A clipped shrub — several lobes cut back to one mass. */
  /* A clipped shrub: several lobes cut back until they read as one mass, not
     as a row of little trees. They overlap on purpose. */
  shrub(s) {
    const { q, ink, ground } = s;
    const n = 3;
    const cx = s.w / 2;
    const crown = min(s.w * 0.3, s.h * 0.5);
    const spread = min(s.w * 0.4, crown * 0.95);   // heavy overlap: one mass, not a row
    const lobes = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;      // -1 at the shoulders
      const fall = 1 - Math.abs(t) * 0.3;                 // the dome falls away
      lobes.push({ x: cx + t * spread + random(-2, 2),
                   y: ground - s.h * 0.46 + (1 - fall) * crown * 0.8,
                   r: crown * fall * random(0.94, 1.06) });
    }
    const rad = Math.max(...lobes.map(l => l.r));
    const low = Math.max(...lobes.map(l => l.y + l.r * 0.6));
    growTube(q, [[cx, ground, max(1.3, rad * 0.15)], [cx, low, max(1.1, rad * 0.12)]], ink, { ease: false });

    const field = buildField(lobesMask(lobes, rad * 0.06, random(999)), boxOf(lobes, 3), max(1.1, rad / 22));
    growForm(q, field, ink.leaf, 0.44, max(5, int(s.h / 10)));
  },

  /* A standard tree: a real branch structure, then a canopy clipped over it.
     The largest drawing on the page, and the only one allowed to be tall. */
  tree(s) {
    const { q, ink, ground } = s;
    /* The canopy has to fit above the trunk inside the plot, so the trunk only
       gets the lower part of the box and the crown takes the rest. */
    const h = s.h * random(0.86, 0.96);
    const fork = ground - h * 0.46;
    const cx = s.w / 2;
    const lean = random(-0.05, 0.05);

    /* A real tapered trunk, not a line of beads. */
    growTube(q, [[cx, ground, max(1.8, h * 0.030)],
                 [cx + h * lean * 0.4, (ground + fork) / 2, max(1.4, h * 0.022)],
                 [cx + h * lean, fork, max(1.0, h * 0.013)]], ink, { wob: 0.6 });

    const limbs = getStick(cx + h * lean, fork, random(-6, 6) + lean * 60, h * 0.26, 2);
    const bySeg = limbs.slice().sort((a, b) => b.y1 - a.y1);
    for (const nd of bySeg) q(nd.y1, () => stippleNodes([nd], max(0.8, h * 0.010), ink.bark));

    const tips = limbs.filter((n) => n.depth <= 0);
    const crown = min(s.w * 0.28, h * 0.24);
    const lobes = tips.map((n) => ({ x: n.x2, y: n.y2, r: crown * random(0.8, 1.05) }));
    if (lobes.length < 2) lobes.push({ x: cx, y: fork - crown * 0.6, r: crown });

    const rad = Math.max(...lobes.map((l) => l.r));
    const field = buildField(lobesMask(lobes, rad * 0.09, random(999)), boxOf(lobes, 4), max(1.2, rad / 20));
    growForm(q, field, ink.leaf, 0.34, max(6, int(h / 12)));
  },

  /* A seedling: one stem, two leaves. Marks a question that has been opened. */
  sprout(s) {
    const { q, ink, ground } = s;
    const h = s.h * random(0.78, 0.96);
    const lean = random(-0.18, 0.18);
    const tip = { x: s.w / 2 + h * lean, y: ground - h };

    q(ground, () => {
      const path = buildPath([[s.w / 2, ground, 0], [s.w / 2 + h * lean * 0.3, ground - h * 0.55, 0], [tip.x, tip.y, 0]],
                             { ease: false, step: 2.0, wob: 0.4 });
      stippleStroke(path, ink.stem, max(0.7, h * 0.035));
    });

    const lr = h * random(0.3, 0.4);
    q(tip.y, () => {
      stipplePatch(tip.x - lr * 0.62, tip.y + lr * 0.24, lr, lr * 0.42, -22, ink.leaf, int(lr * 7));
      stipplePatch(tip.x + lr * 0.62, tip.y + lr * 0.1, lr * 0.9, lr * 0.4, 20, ink.leaf, int(lr * 6));
    });
  },

  /* A tuft of grass. Nothing but blades — used where a plot needs weight at
     the ground line and nothing more. */
  grass(s) {
    const { q, ink, ground } = s;
    const blades = int(random(5, 9));
    for (let i = 0; i < blades; i++) {
      const x = s.w * random(0.1, 0.9);
      const h = s.h * random(0.45, 1.0);
      const lean = random(-0.4, 0.4);
      q(ground - h * 0.5, () => {
        const path = buildPath([[x, ground, 0], [x + h * lean * 0.4, ground - h * 0.6, 0], [x + h * lean, ground - h, 0]],
                               { ease: false, step: 2.2, wob: 0.35 });
        stippleStroke(path, ink.stem, max(0.6, s.h * 0.016));
      });
    }
  }
};
