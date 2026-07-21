const TAU = Math.PI * 2;

const ROWS = [
  {
    word: "haven",
    font: (px) => `600 ${px}px ui-sans-serif, system-ui, Arial, sans-serif`,
    letterTrack: -0.02,
    fillFrac: 0.92,
    bright: false,
  },
];

const REST = "oklch(0.64 0.006 263)";
const BRAND_HUE = 263;
const GLOW_LCH = "0.42 0.07 263";
const SPARK = "70,100,180";

const MAXSZ = 0.9;
const SPEED = 0.02;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (x, e0, e1) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
function hash(x, y) {
  const r = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return r - Math.floor(r);
}

const HUE_STEPS = 24;
const ALPHA_STEPS = 6;

class TileField {
  constructor(host, _opts = {}) {
    this.host = host;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "tile-field-canvas";
    this.ctx = this.canvas.getContext("2d");
    this.host.appendChild(this.canvas);

    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = 0;
    this.viewH = 0;
    this.cell = 10;
    this.time = 0;

    this.n = 0;
    this.px = new Float32Array(0);
    this.py = new Float32Array(0);
    this.rowOf = new Uint8Array(0);
    this.hueSeed = new Float32Array(0);
    this.spark = new Uint8Array(0);
    this.lit = new Float32Array(0);
    this.seed = new Float32Array(0);

    this.hasPointer = false;
    this.rawX = 0;
    this.rawY = 0;
    this.lightX = 0;
    this.lightY = 0;
    this.lightSpeed = 0;

    this.raf = 0;

    this.stepL = new Float32Array(HUE_STEPS);
    this.stepC = new Float32Array(HUE_STEPS);

    this.resize();

    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerleave", this.onLeave);
  }

  resize() {
    const stage = this.host;
    const canvas = this.canvas;
    const ctx = this.ctx;

    const rect = stage.getBoundingClientRect();
    this.viewW = rect.width;
    this.viewH = rect.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cell = Math.max(2, Math.round(this.viewW / 460));
    const cell = this.cell;
    const viewW = this.viewW;
    const viewH = this.viewH;

    canvas.style.width = Math.round(viewW) + "px";
    canvas.style.height = Math.round(viewH) + "px";
    canvas.width = Math.ceil(viewW * this.dpr);
    canvas.height = Math.ceil(viewH * this.dpr);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const splits = ROWS.length === 1 ? [1] : [0.62, 0.38];
    const bandTops = [];
    const bandHeights = [];
    let acc = 0;
    for (const frac of splits) {
      bandTops.push(acc * viewH);
      bandHeights.push(frac * viewH);
      acc += frac;
    }

    const xs = [], ys = [], rw = [], sp = [], sd = [], hs = [];

    ROWS.forEach((row, ri) => {
      const bandTop = bandTops[ri];
      const bandH = bandHeights[ri];
      const sc = document.createElement("canvas");
      sc.width = Math.max(1, Math.floor(viewW));
      sc.height = Math.max(1, Math.floor(bandH));
      const s = sc.getContext("2d");
      const sls = s;
      s.fillStyle = "#000";
      s.textAlign = "center";
      s.textBaseline = "middle";

      let fs = bandH * 0.9;
      sls.letterSpacing = `${row.letterTrack * fs}px`;
      s.font = row.font(fs);
      const measured = s.measureText(row.word).width || 1;
      fs *= (viewW * row.fillFrac) / measured;
      sls.letterSpacing = `${row.letterTrack * fs}px`;
      s.font = row.font(fs);
      s.fillText(row.word, viewW / 2, bandH / 2);

      const data = s.getImageData(0, 0, sc.width, sc.height).data;
      const cols = Math.ceil(viewW / cell);
      const rows = Math.ceil(bandH / cell);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lx = Math.floor(c * cell + cell / 2);
          const ly = Math.floor(r * cell + cell / 2);
          if (lx >= sc.width || ly >= sc.height) continue;
          const a = (data[(ly * sc.width + lx) * 4 + 3] ?? 0) / 255;
          if (a <= 0.5) continue;
          const gx = lx;
          const gy = ly + bandTop;
          xs.push(gx);
          ys.push(gy);
          rw.push(ri);
          sp.push(hash(gx + 7, gy - 3) > 0.82 ? 1 : 0);
          sd.push(hash(gx * 1.3, gy * 0.7));
          hs.push(hash(gx * 0.7 + 11, gy * 1.9 - 5));
        }
      }
    });

    this.n = xs.length;
    this.px = new Float32Array(xs);
    this.py = new Float32Array(ys);
    this.rowOf = new Uint8Array(rw);
    this.spark = new Uint8Array(sp);
    this.seed = new Float32Array(sd);
    this.hueSeed = new Float32Array(hs);
    this.lit = new Float32Array(this.n);

    if (this.reduced && !this.raf) this.renderStatic();
  }

  distSegSq(qx, qy, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    if (dx === 0 && dy === 0) {
      const ex = qx - ax, ey = qy - ay;
      return ex * ex + ey * ey;
    }
    const t = clamp(((qx - ax) * dx + (qy - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    const ex = qx - (ax + dx * t), ey = qy - (ay + dy * t);
    return ex * ex + ey * ey;
  }

  frame = (t) => {
    const ctx = this.ctx;
    const { viewW, viewH, cell, n, px, py, rowOf, hueSeed, spark, lit, seed } = this;

    ctx.clearRect(0, 0, viewW, viewH);
    this.time += SPEED;
    const time = this.time;

    const prevX = this.lightX, prevY = this.lightY;
    if (this.hasPointer) {
      this.lightX += (this.rawX - this.lightX) * 0.5;
      this.lightY += (this.rawY - this.lightY) * 0.5;
    }
    const lightX = this.lightX, lightY = this.lightY;
    const stepDist = Math.hypot(lightX - prevX, lightY - prevY);
    this.lightSpeed = 0.9 * this.lightSpeed + 0.1 * stepDist;
    const lightSpeed = this.lightSpeed;
    const moving = this.hasPointer;

    const reach = clamp(viewH * 0.22 + lightSpeed * 0.9, viewH * 0.18, viewH * 0.42);
    const influence = 1.5 * reach;
    const influenceSq = influence * influence;
    const minX = Math.min(prevX, lightX) - influence;
    const maxX = Math.max(prevX, lightX) + influence;
    const minY = Math.min(prevY, lightY) - influence;
    const maxY = Math.max(prevY, lightY) + influence;

    const T = time;

    const grayP = new Path2D();
    const litList = [];
    const buckets = Array.from({ length: HUE_STEPS }, () =>
      Array.from({ length: ALPHA_STEPS }, () => new Path2D())
    );

    const hueOfStep = new Float32Array(HUE_STEPS);

    for (let i = 0; i < n; i++) {
      const x = px[i], y = py[i];

      let target = 0;
      if (moving && x >= minX && x <= maxX && y >= minY && y <= maxY) {
        const dSq = this.distSegSq(x, y, prevX, prevY, lightX, lightY);
        if (dSq <= influenceSq) {
          const ang = Math.atan2(y - lightY, x - lightX);
          const wobble =
            1 +
            0.30 * Math.sin(3 * ang + time * 1.6) +
            0.16 * Math.sin(5 * ang - time * 1.1 + 1.3);
          const f = clamp(1 - Math.sqrt(dSq) / (reach * wobble), 0, 1);
          target = f * f * (3 - 2 * f);
        }
      }

      const rate = target > lit[i] ? 0.24 : 0.02;
      lit[i] += (target - lit[i]) * rate;

      const u = x / Math.max(viewW, 1);
      const v = y / Math.max(viewH, 1);
      const flow =
        Math.sin((u * 1.6 + 0.4 * Math.sin(T * 0.3)) * TAU + T * 0.8) +
        0.7 * Math.sin((v * 2.1 - u * 0.9) * TAU - T * 0.6 + 1.7) +
        0.5 * Math.sin((u * 3.3 + v * 2.7) * TAU + T * 0.4 + 4.2) +
        0.4 * Math.cos((v * 1.3 - 1.1 * Math.sin(T * 0.2)) * TAU - T * 0.5);
      let colorAmt = smoothstep(flow, 0.1, 1.6);
      colorAmt = Math.max(colorAmt, lit[i]);

      const breathe = 0.5 + 0.5 * Math.sin(seed[i] * TAU + time * 1.3);
      const base = 0.22 + 0.1 * breathe;
      const sz = cell * (base + (MAXSZ - base) * colorAmt);
      const h = sz / 2;
      grayP.rect(x - h, y - h, sz, sz);

      if (colorAmt > 0.04) {
        let hue;
        let chroma;
        if (ROWS[rowOf[i]].bright) {
          hue = (hueSeed[i] * 360 + time * 26) % 360;
          chroma = 0.19;
        } else {
          const drift = (flow - 0.8) * 16;
          hue = BRAND_HUE + drift + (hueSeed[i] - 0.5) * 8;
          chroma = 0.085;
        }
        const hStep = ((Math.round((hue / 360) * HUE_STEPS) % HUE_STEPS) + HUE_STEPS) % HUE_STEPS;
        const lightness = ROWS[rowOf[i]].bright ? 0.62 : 0.5;
        hueOfStep[hStep] = hue;
        const as = Math.min(ALPHA_STEPS - 1, Math.floor(colorAmt * ALPHA_STEPS));
        buckets[hStep][as].rect(x - h, y - h, sz, sz);

        this.stepL[hStep] = lightness;
        this.stepC[hStep] = chroma;
      }

      if (lit[i] > 0.02) litList.push(i);
    }

    ctx.fillStyle = REST;
    ctx.fill(grayP);

    for (let hsI = 0; hsI < HUE_STEPS; hsI++) {
      const hue = hueOfStep[hsI];
      for (let as = 0; as < ALPHA_STEPS; as++) {
        const p = buckets[hsI][as];
        ctx.globalAlpha = (as + 1) / ALPHA_STEPS;
        ctx.fillStyle = `oklch(${this.stepL[hsI]} ${this.stepC[hsI]} ${hue})`;
        ctx.fill(p);
      }
    }
    ctx.globalAlpha = 1;

    for (const i of litList) {
      const L = lit[i];
      const x = px[i], y = py[i];
      const gsz = cell * (0.7 + (MAXSZ - 0.7) * L);
      const gh = gsz / 2;
      if (spark[i]) {
        const ph = seed[i];
        const tt = 0.00025 * t;
        const amp = (0.45 + ph) * cell * 0.28;
        const jx = x + Math.sin(0.05 * x + 1.3 * tt + ph * TAU) * amp;
        const jy = y + Math.cos(0.04 * y - 0.9 * tt + ph * TAU) * amp;
        ctx.fillStyle = `rgba(${SPARK},${(0.1 * L).toFixed(3)})`;
        ctx.fillRect(jx - gh * 1.5, jy - gh * 1.5, gsz * 1.5, gsz * 1.5);
        ctx.fillStyle = `rgba(${SPARK},${(0.55 * L).toFixed(3)})`;
        ctx.fillRect(jx - gh, jy - gh, gsz, gsz);
      } else {
        ctx.fillStyle = `oklch(${GLOW_LCH} / ${(0.85 * L).toFixed(3)})`;
        ctx.fillRect(x - gh, y - gh, gsz, gsz);
      }
    }

    this.raf = requestAnimationFrame(this.frame);
  };

  renderStatic() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    const grayP = new Path2D();
    for (let i = 0; i < this.n; i++) {
      const sz = this.cell * 0.5;
      const h = sz / 2;
      grayP.rect(this.px[i] - h, this.py[i] - h, sz, sz);
    }
    ctx.fillStyle = REST;
    ctx.fill(grayP);
  }

  onMove = (e) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= -40 && y >= -40 && x <= rect.width + 40 && y <= rect.height + 40) {
      if (!this.hasPointer) {
        this.hasPointer = true;
        this.lightX = x;
        this.lightY = y;
        this.lightSpeed = 0;
      }
      this.rawX = x;
      this.rawY = y;
    } else {
      this.hasPointer = false;
    }
  };

  onLeave = () => {
    this.hasPointer = false;
  };

  start() {
    if (this.reduced) return;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerleave", this.onLeave);
    this.canvas.remove();
  }
}
