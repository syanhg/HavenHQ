/* The drawing engine.

   Nothing here calls stroke() or fills a shape. Every form on the page is a
   cloud of small circles, the way a hand builds tone with a pen — which is
   also what lets a plant sway later: a bitmap of dots can be sheared in strips
   and no one sees the seams, because there are no continuous edges to break.

   All of it draws into _g, the buffer of whichever plant is being grown.
   garden.js sets that before it drains a plant's ops. */

const SQUASH = 0.26;                              // how far a ring flattens in perspective
const LIGHT  = { x: -0.55, y: -0.62, z: 0.56 };   // light from the upper left

let _g = null;          // the buffer currently being drawn into
let DENSITY = 0.85;     // global dot density, tuned to the viewport

function useBuffer(g) { _g = g; }

/* ---------- trimmed forms ----------------------------------------------- */

/* A distance field over a mask, built once per form.

   sampler(x, y) -> true when the point is inside the form. The field is
   sampled coarsely and then chamfered outward, which buys three things at
   once: the inside test, the depth from the edge (so dots can crowd the trim
   line), and the gradient (so the form can be lit without knowing what shape
   it is). A hedge, a cone, a canopy and the letters of the wordmark all go
   through here. */
function buildField(sampler, box, cell) {
  const w = max(1, ceil((box.x1 - box.x0) / cell));
  const h = max(1, ceil((box.y1 - box.y0) / cell));
  const d = new Float32Array(w * h);
  const BIG = 1e6;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = box.x0 + (i + 0.5) * cell;
      const y = box.y0 + (j + 0.5) * cell;
      d[j * w + i] = sampler(x, y) ? BIG : 0;
    }
  }

  /* Two-pass chamfer: distance, in cells, from the nearest outside cell. */
  const D1 = 1, D2 = 1.4142;
  const at = (i, j) => (i < 0 || j < 0 || i >= w || j >= h) ? 0 : d[j * w + i];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (d[j * w + i] === 0) continue;
      d[j * w + i] = Math.min(d[j * w + i],
        at(i - 1, j) + D1, at(i, j - 1) + D1,
        at(i - 1, j - 1) + D2, at(i + 1, j - 1) + D2);
    }
  }
  for (let j = h - 1; j >= 0; j--) {
    for (let i = w - 1; i >= 0; i--) {
      if (d[j * w + i] === 0) continue;
      d[j * w + i] = Math.min(d[j * w + i],
        at(i + 1, j) + D1, at(i, j + 1) + D1,
        at(i + 1, j + 1) + D2, at(i - 1, j + 1) + D2);
    }
  }
  for (let k = 0; k < d.length; k++) d[k] = Math.min(d[k], BIG) * cell;

  const depth = (x, y) => {
    const i = constrain(floor((x - box.x0) / cell), 0, w - 1);
    const j = constrain(floor((y - box.y0) / cell), 0, h - 1);
    return d[j * w + i];
  };

  return { w, h, cell, box, depth };
}

/* Dots scattered through a field: crowded at the trim line, shaded from the
   upper left, thinning into a flat mid-tone across the face. */
function stippleForm(field, col, count, opt = {}) {
  /* A form can be filled a band at a time — that is how a hedge grows in from
     the ground rather than appearing all at once. */
  const box = opt.region || field.box;
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
  const full = field.box;
  const rim = opt.rim || max(2.5, min(full.x1 - full.x0, full.y1 - full.y0) * 0.14);
  const g = opt.layer || _g;
  const jit = field.cell * 0.5;

  let placed = 0, guard = count * 14;
  while (placed < count && guard-- > 0) {
    const x = box.x0 + random(bw);
    const y = box.y0 + random(bh);
    const dp = field.depth(x, y);
    if (dp <= 0) continue;

    /* Rim-first: most of the ink lands within the trim line, which is what
       makes a clipped edge read as clipped rather than as a soft mass. A form
       whose strokes are barely wider than the rim — the wordmark — asks for
       less of this, or it hollows out. */
    const thin = opt.thin === undefined ? 0.35 : opt.thin;
    const edgy = constrain(1 - dp / rim, 0, 1);
    if (edgy < 0.25 && random() < thin) continue;
    placed++;

    /* The outward normal is the downhill direction of the field. */
    const e = field.cell;
    const gx = field.depth(x + e, y) - field.depth(x - e, y);
    const gy = field.depth(x, y + e) - field.depth(x, y - e);
    const gl = Math.hypot(gx, gy) || 1;
    const nx = -gx / gl, ny = -gy / gl;

    const lit = (nx * LIGHT.x + ny * LIGHT.y) * edgy + LIGHT.z * (1 - edgy) * 0.5;
    const c = col.wobble(7, 12, 8);
    g.fill(c.h, c.s, constrain(c.b + lit * 26, 0, 100), c.a);
    g.circle(x + random(-jit, jit), y + random(-jit, jit),
             edgy > 0.55 ? random(0.6, 1.9) : random(0.7, 2.5));
  }
}

/* ---------- bodies of revolution ---------------------------------------- */

/* One ring around a stem or trunk. The major axis runs across the path, the
   minor axis along it, so a tube reads as round rather than as a flat band. */
function stippleRing(cx, cy, r, angDeg, col, thickness, opt = {}) {
  const rad = radians(angDeg);
  const ax = { x: Math.sin(rad), y: -Math.cos(rad) };
  const px = { x: Math.cos(rad), y: Math.sin(rad) };
  const r2 = Math.max(0.7, r * SQUASH);
  const g = opt.layer || _g;

  const circ = TWO_PI * Math.sqrt((r * r + r2 * r2) / 2);
  const count = Math.max(6, Math.floor(circ * DENSITY * (opt.density || 1)));
  const a0 = random(360);
  const gap = opt.gap || 0;
  const jit = opt.jitter === undefined ? 0.55 : opt.jitter;
  const lit = px.x * LIGHT.x + px.y * LIGHT.y;

  for (let i = 0; i < count; i++) {
    const t = i / count;
    if (gap > 0 && t > 1 - gap) continue;

    const a = radians(a0 + 360 * t);
    const s = Math.sin(a), c = Math.cos(a);

    const x = cx + px.x * r * s + ax.x * r2 * -c + random(-jit, jit);
    const y = cy + px.y * r * s + ax.y * r2 * -c + random(-jit, jit);

    const diff = constrain(lit * s + LIGHT.z * c, -1, 1);
    const size = noise(cx * 0.03, cy * 0.03, a * 3) * thickness + 1.1;

    g.fill(col.h, col.s, constrain(col.b + diff * 19, 0, 100), col.a);
    g.circle(x, y, size);
  }
}

/* Speckle piled along a silhouette — the rim facing away from the light
   collects the most ink, which is where a stem stops being a cylinder and
   starts being a drawing. */
function stippleContour(cx, cy, r, angDeg, col, count, opt = {}) {
  const rad = radians(angDeg);
  const ax = { x: Math.sin(rad), y: -Math.cos(rad) };
  const px = { x: Math.cos(rad), y: Math.sin(rad) };
  const r2 = Math.max(0.7, r * SQUASH);
  const g = opt.layer || _g;

  const shadowSide = (px.x * LIGHT.x + px.y * LIGHT.y) > 0 ? -1 : 1;

  for (let i = 0; i < count; i++) {
    const side = random() < 0.66 ? shadowSide : -shadowSide;
    const off = 80 * random(random(random()));
    const a = radians(side * 90 + (random() < 0.5 ? off : -off));
    const s = Math.sin(a), c = Math.cos(a);

    const x = cx + px.x * r * s + ax.x * r2 * -c + random(-0.8, 0.8);
    const y = cy + px.y * r * s + ax.y * r2 * -c + random(-0.8, 0.8);

    g.fill(col.h, col.s, col.b, col.a);
    g.circle(x, y, noise(x * 0.4, y * 0.4) * 1.6 + 0.7);
  }
}

/* ---------- leaves, stems, scatter -------------------------------------- */

/* A flat patch: one leaf, one frond, one blade. Half the dots crowd the rim,
   the rest fill the middle. */
function stipplePatch(cx, cy, rx, ry, angDeg, col, count, opt = {}) {
  const rad = radians(angDeg);
  const ca = Math.cos(rad), sa = Math.sin(rad);
  const g = opt.layer || _g;

  for (let i = 0; i < count; i++) {
    const a = random(TWO_PI);
    const rr = random() < 0.42
      ? constrain(1 - Math.abs(randomGaussian(0, 0.11)), 0, 1)
      : Math.sqrt(random());

    const lx = rx * rr * Math.cos(a);
    const ly = ry * rr * Math.sin(a);
    const x = cx + lx * ca - ly * sa;
    const y = cy + lx * sa + ly * ca;

    const c = col.wobble(8, 12, 12);
    g.fill(c.h, c.s, constrain(c.b + (1 - rr) * 10, 0, 100), c.a);
    g.circle(x, y, rr > 0.86 ? random(0.6, 1.8) : random(0.6, 2.4));
  }
}

/* A drawn line: dots walking a path. */
function stippleStroke(pts, col, weight, opt = {}) {
  const g = opt.layer || _g;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const n = int(random(1, 3));
    for (let k = 0; k < n; k++) {
      const c = col.wobble(6, 10, 14);
      g.fill(c.h, c.s, c.b, c.a);
      g.circle(p.x + random(-weight, weight), p.y + random(-weight, weight),
               noise(p.x * 0.2, p.y * 0.2) * weight + 0.8);
    }
  }
}

/* A branching stick, drawn as dots — trunks, twigs, escaped sprigs. */
function stippleBranch(x, y, dir, len, depth, thickness, col, opt = {}) {
  const nodes = getStick(x, y, dir, len / (depth + 1), depth);
  stippleNodes(nodes, thickness, col, opt);
  return nodes;
}

/* The same, for a stick whose nodes were worked out in advance — a tree needs
   to know where its branches end before it can decide where the canopy goes. */
function stippleNodes(nodes, thickness, col, opt = {}) {
  const g = opt.layer || _g;
  for (const nd of nodes) {
    const w = nd.depth <= 1 ? thickness * 0.6 : thickness;
    const dotCount = dist(nd.x1, nd.y1, nd.x2, nd.y2) * 0.9;
    for (let i = 0; i < dotCount; i++) {
      const t = i / dotCount;
      let nx = lerp(nd.x1, nd.x2, t);
      let ny = lerp(nd.y1, nd.y2, t);
      const normal = radians(angleOf(nd.x1, nd.y1, nd.x2, nd.y2) + 90);
      nx += Math.sin(normal) * (noise(nx * 0.1, ny * 0.1, 666) - 0.5) * w * 1.6;
      ny -= Math.cos(normal) * (noise(nx * 0.1, ny * 0.1, 999) - 0.5) * w * 1.6;

      const c = col.wobble(6, 10, 14);
      g.fill(c.h, c.s, c.b, c.a);
      g.circle(nx, ny, noise(nx * 0.6, ny * 0.6) * w + w * 0.55);
    }
  }
}

/* Loose scatter — berries, seed heads, the dust at a ground line. */
function stippleScatter(cx, cy, r, count, col, sizeMin, sizeMax, opt = {}) {
  const g = opt.layer || _g;
  for (let i = 0; i < count; i++) {
    const a = random(TWO_PI);
    const rr = r * Math.sqrt(random());
    const c = col.wobble(6, 12, 12);
    g.fill(c.h, c.s, c.b, c.a);
    g.circle(cx + rr * Math.cos(a), cy + rr * Math.sin(a), random(sizeMin, sizeMax));
  }
}
