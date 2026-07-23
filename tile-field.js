const TAU = Math.PI * 2;

const ROWS = [
  {
    word: "soffo",
    font: (px) => `600 ${px}px ui-sans-serif, system-ui, Arial, sans-serif`,
    letterTrack: -0.02,
    fillFrac: 0.92,
  },
];

const REST = "oklch(0.64 0.006 263)";
const SPEED = 0.02;

function hash(x, y) {
  const r = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return r - Math.floor(r);
}

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
    this.seed = new Float32Array(0);

    this.raf = 0;

    this.resize();
  }

  resize() {
    const stage = this.host;
    const canvas = this.canvas;
    const ctx = this.ctx;

    const viewW = stage.getBoundingClientRect().width;
    this.viewW = viewW;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cell = Math.max(2, Math.round(viewW / 460));
    const cell = this.cell;

    const xs = [], ys = [], sd = [];
    let bandTop = 0;

    ROWS.forEach((row) => {
      const probe = document.createElement("canvas").getContext("2d");
      probe.textAlign = "center";
      probe.textBaseline = "alphabetic";

      let fs = 100;
      probe.letterSpacing = `${row.letterTrack * fs}px`;
      probe.font = row.font(fs);
      fs *= (viewW * row.fillFrac) / (probe.measureText(row.word).width || 1);
      probe.letterSpacing = `${row.letterTrack * fs}px`;
      probe.font = row.font(fs);
      const metrics = probe.measureText(row.word);
      const inkAscent = metrics.actualBoundingBoxAscent;
      const bandH = Math.max(1, Math.ceil(inkAscent + metrics.actualBoundingBoxDescent));

      const sc = document.createElement("canvas");
      sc.width = Math.max(1, Math.floor(viewW));
      sc.height = bandH;
      const s = sc.getContext("2d");
      s.fillStyle = "#000";
      s.textAlign = "center";
      s.textBaseline = "alphabetic";
      s.letterSpacing = `${row.letterTrack * fs}px`;
      s.font = row.font(fs);
      s.fillText(row.word, viewW / 2, inkAscent);

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
          xs.push(lx);
          ys.push(ly + bandTop);
          sd.push(hash(lx * 1.3, (ly + bandTop) * 0.7));
        }
      }

      bandTop += bandH;
    });

    // Trim the box to the lowest actual tile so no empty band (the font's
    // descent space) sits below the "haven" ink at the page bottom.
    let maxY = 0;
    for (let i = 0; i < ys.length; i++) if (ys[i] > maxY) maxY = ys[i];
    const viewH = ys.length ? Math.ceil(maxY + cell / 2) : bandTop;
    this.viewH = viewH;
    stage.style.height = Math.round(viewH) + "px";

    canvas.style.width = Math.round(viewW) + "px";
    canvas.style.height = Math.round(viewH) + "px";
    canvas.width = Math.ceil(viewW * this.dpr);
    canvas.height = Math.ceil(viewH * this.dpr);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    this.n = xs.length;
    this.px = new Float32Array(xs);
    this.py = new Float32Array(ys);
    this.seed = new Float32Array(sd);

    if (this.reduced && !this.raf) this.renderStatic();
  }

  frame = () => {
    const ctx = this.ctx;
    const { viewW, viewH, cell, n, px, py, seed } = this;

    ctx.clearRect(0, 0, viewW, viewH);
    this.time += SPEED;
    const time = this.time;

    const grayP = new Path2D();

    for (let i = 0; i < n; i++) {
      const x = px[i], y = py[i];
      const breathe = 0.5 + 0.5 * Math.sin(seed[i] * TAU + time * 1.3);
      const base = 0.22 + 0.1 * breathe;
      const sz = cell * base;
      const h = sz / 2;
      grayP.rect(x - h, y - h, sz, sz);
    }

    ctx.fillStyle = REST;
    ctx.fill(grayP);

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
    }a
    ctx.fillStyle = REST;
    ctx.fill(grayP);
  }

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
    this.canvas.remove();
  }
}
