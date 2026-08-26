/* Small maths and colour helpers shared by every plant.

   Colour is carried in HSB because the ink is mixed by hand: a stroke of moss
   is never one flat value, it is a value plus a wobble, so no two dots in a
   leaf are quite the same green. */

class Ink {
  constructor(h, s, b, a = 1.0) { this.h = h; this.s = s; this.b = b; this.a = a; }

  copy() { return new Ink(this.h, this.s, this.b, this.a); }

  /* A hand never mixes the same ink twice. */
  wobble(hD = 8, sD = 10, bD = 8) {
    const c = this.copy();
    c.h = hueWrap(c.h + random(-0.5 * hD, 0.5 * hD));
    c.s = constrain(c.s + random(-0.5 * sD, 0.5 * sD), 0, 100);
    c.b = constrain(c.b + random(-0.5 * bD, 0.5 * bD), 0, 100);
    return c;
  }
}

function hueWrap(h) { return (h % 360 + 360) % 360; }

/* Degrees, 0 = up, clockwise — the convention every part definition uses. */
function angleOf(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
}

function catmullPt(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    y: 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
  };
}

/* Control points -> a densely sampled path. The radius between two control
   points is interpolated through a randomly picked easing curve, so a stem
   swells and tapers the way a drawn one does rather than linearly. */
function buildPath(ctrl, opt = {}) {
  const step = opt.step || 3.0;
  const n = ctrl.length;
  const wob = opt.wob === undefined ? 1.1 : opt.wob;
  const nz = random(10000);

  const curves = [];
  let out = random() < 0.5;
  for (let i = 0; i < n - 1; i++) {
    if (opt.ease === false) curves.push(x => x);
    else curves.push(out ? curvesOut[int(random(curvesOut.length))] : curvesIn[int(random(curvesIn.length))]);
    out = !out;
  }

  const pts = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[min(n - 1, i + 2)];
    const steps = max(2, ceil(dist(p1[0], p1[1], p2[0], p2[1]) / step));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const p = catmullPt(p0, p1, p2, p3, t);
      const rt = constrain(curves[i](t), 0, 1);
      pts.push({ x: p.x, y: p.y, r: max(0.5, lerp(p1[2], p2[2], rt)) });
    }
  }
  const last = ctrl[n - 1];
  pts.push({ x: last[0], y: last[1], r: max(0.5, last[2]) });

  /* Nothing drawn by hand is ever quite on its line. */
  for (let i = 0; i < pts.length; i++) {
    pts[i].x += (noise(i * 0.07, nz) - 0.5) * 2 * wob;
    pts[i].y += (noise(i * 0.07, nz + 90) - 0.5) * 2 * wob;
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[max(0, i - 1)], b = pts[min(pts.length - 1, i + 1)];
    pts[i].a = angleOf(a.x, a.y, b.x, b.y);
  }
  return pts;
}

/* Recursive branching sticks — trunks, twigs, the sprigs that escape a trim. */
function getStick(_x, _y, _dir, _length, _depth) {
  const toX = _x + _length * sin(radians(_dir));
  const toY = _y + _length * -cos(radians(_dir));

  const nodes = [{ x1: _x, y1: _y, x2: toX, y2: toY, dir: _dir, depth: _depth }];
  if (_depth <= 0) return nodes;

  if (random() < 0.58) {
    let leftMin = 0.6, rightMin = 0.6;
    if (random() < 0.5) leftMin = 0.2; else rightMin = 0.2;
    const l = getStick(toX, toY, _dir + random(-38, -10), _length * random(leftMin, 0.9), _depth - 1);
    const r = getStick(toX, toY, _dir + random(10, 38), _length * random(rightMin, 0.9), _depth - 1);
    for (const nd of l) nodes.push(nd);
    for (const nd of r) nodes.push(nd);
  } else {
    const s = getStick(toX, toY, _dir + random(-22, 22), _length * random(0.62, 0.94), _depth - 1);
    for (const nd of s) nodes.push(nd);
  }
  return nodes;
}
