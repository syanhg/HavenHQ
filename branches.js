/* Branches behind the footer CTA.

   getStick(), StickObj, drawStick(), drawStickBranch(), getAngle(), sleep()
   and stickDotDensity are the OpenProcessing sketch "Zen
   Pots" (p5js.org/sketches/2036000, files divider.js, objects.js, drawer.js and
   helpers.js) verbatim — the recursive split, the noise-jittered dots along
   each segment, the thickness rule by node depth.

   What is not from there: the pots, and everything below setup(). The sketch
   grows its sticks out of the rim of a pot on a full-page canvas; here they
   grow off the bottom edge of the CTA, on a transparent canvas sized to that
   section, started when the section comes into view. */

let stickDotDensity = 0.8;

let _midLayer;   // whichever layer the sketch's own code is drawing into
let _backG;      // behind the words
let _frontG;     // the few branches that cross in front of them
let _frontEl;
let _frontCtx;
let _colorSet;
let _host;
let _grown = false;

// ---- from the sketch, unchanged -------------------------------------------

class NYColor {
  constructor(_h, _s, _b, _a = 1.0) {
    this.h = _h;
    this.s = _s;
    this.b = _b;
    this.a = _a;
  }
}

class StickObj {
  constructor(_x, _y, _startDir, _stickLength) {
    this.x = _x;
    this.y = _y;

    this.nodes = [];
    this.nodeCount = 6;

    let segmentAvgLength = _stickLength / this.nodeCount;

    this.nodes = getStick(_x, _y, _startDir, segmentAvgLength, this.nodeCount);
  }
}

function getStick(_x, _y, _dir, _length, _maxNodeDepth) {
  let fromX = _x;
  let fromY = _y;

  let toX = fromX + _length * sin(radians(_dir));
  let toY = fromY + _length * -cos(radians(_dir));

  let nodes = [];
  nodes.push({
    'x1': fromX,
    'y1': fromY,
    'x2': toX,
    'y2': toY,
    'dir': _dir,
    'length': _length,
    'nodeDepth': _maxNodeDepth
  });

  let splitNode = random() < 0.5;

  if (_maxNodeDepth > 0 && splitNode) {

    let leftMin = 0.6;
    let rightMin = 0.6;

    if (random() < 0.5)
      leftMin = 0.1;
    else
      rightMin = 0.1;

    let leftNodes = getStick(toX, toY, _dir + random(-20, -6), _length * random(leftMin, 0.95), _maxNodeDepth - 1);
    let rightNodes = getStick(toX, toY, _dir + random(6, 20), _length * random(rightMin, 0.95), _maxNodeDepth - 1);

    for (let i = 0; i < leftNodes.length; i++)
      nodes.push(leftNodes[i]);

    for (let i = 0; i < rightNodes.length; i++)
      nodes.push(rightNodes[i]);
  }
  else if (_maxNodeDepth > 0) {
    let newNodes = getStick(toX, toY, _dir + random(-20, 20), _length * random(0.6, 0.95), _maxNodeDepth - 1);

    for (let i = 0; i < newNodes.length; i++)
      nodes.push(newNodes[i]);
  }

  return nodes;
}

// get angle between two points and return in degrees
function getAngle(_x1, _y1, _x2, _y2) {
  let xDiff = _x2 - _x1;
  let yDiff = _y2 - _y1;
  return atan2(yDiff, xDiff) * 180 / PI + 90;
}

/* The sketch's drawStick, minus its flowers: the dotted blossoms it scatters
   around the shallow nodes are the one part of it this page does without. */
async function drawStick(_stickObj) {

  for (let i = 0; i < _stickObj.nodes.length; i++) {
    let nodeData = _stickObj.nodes[i];
    _midLayer.noStroke();
    _midLayer.fill(_colorSet.stickColor.h, _colorSet.stickColor.s, _colorSet.stickColor.b);

    let nowThickness = 3;

    if (nodeData.nodeDepth <= 2) {
      nowThickness = 2;
    }
    drawStickBranch(nodeData.x1, nodeData.y1, nodeData.x2, nodeData.y2, nowThickness);

    UpdateLayers();
    await sleep(1);
  }
}

function drawStickBranch(_x1, _y1, _x2, _y2, _thickness) {
  let dotCount = dist(_x1, _y1, _x2, _y2) * stickDotDensity;

  for (let i = 0; i < dotCount; i++) {
    let t = i / (dotCount - 1);
    let nowX = lerp(_x1, _x2, t);
    let nowY = lerp(_y1, _y2, t);

    let normalAngle = getAngle(_x1, _y1, _x2, _y2) + 90;

    nowX += sin(radians(normalAngle)) * noise(nowX * 0.1, nowY * 0.1, 666.0) * _thickness;
    nowY -= cos(radians(normalAngle)) * noise(nowX * 0.1, nowY * 0.1, 999.0) * _thickness;

    let dotSize = noise(nowX * 0.6, nowY * 0.6) * _thickness + _thickness * 0.5;
    _midLayer.circle(nowX, nowY, dotSize);
  }
}

// async sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ---- this page ------------------------------------------------------------

/* The sketch paints its layers over an opaque background every node; here both
   layers stay transparent so the CTA's own ground shows through. The back one
   is the p5 canvas itself; the front one is blitted into a plain canvas that
   sits above the headline in the stacking order. */
function UpdateLayers() {
  clear();
  image(_backG, 0, 0);

  if (!_frontCtx) return;
  _frontCtx.clearRect(0, 0, _frontEl.width, _frontEl.height);
  _frontCtx.drawImage(_frontG.elt, 0, 0);
}

function setup() {
  _host = document.querySelector('.cta-art');

  if (!_host) {
    noCanvas();
    return;
  }

  let c = createCanvas(_host.clientWidth, _host.clientHeight);
  c.parent(_host);
  noLoop();

  colorMode(HSB);
  makeLayers();

  _colorSet = {
    stickColor: new NYColor(0, 0, 62)
  };

  // grow them when the section arrives rather than at load, so the drawing is
  // something you watch happen
  if ('IntersectionObserver' in window) {
    let io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || _grown) return;
      _grown = true;
      io.disconnect();
      grow();
    }, { threshold: 0.15 });
    io.observe(_host);
  } else {
    _grown = true;
    grow();
  }
}

/* Both layers, plus the plain canvas the front one is copied into. Its pixel
   buffer has to match the graphics buffer, which p5 sizes by pixel density. */
function makeLayers() {
  _backG = createGraphics(width, height);
  _backG.colorMode(HSB);

  _frontG = createGraphics(width, height);
  _frontG.colorMode(HSB);

  _midLayer = _backG;

  _frontEl = document.querySelector('.cta-front');
  if (!_frontEl) return;

  _frontEl.width = _frontG.elt.width;
  _frontEl.height = _frontG.elt.height;
  _frontCtx = _frontEl.getContext('2d');
}

/* Sticks rooted under the words rather than spread across the section: the
   roots cluster in the middle third and lean inward, so the growth gathers
   behind the headline and thins out toward the edges. */
function plant() {
  let count = width < 700 ? 4 : 7;
  let spread = width < 700 ? 0.52 : 0.46; // share of the width they root across
  let sticks = [];

  for (let i = 0; i < count; i++) {
    // jittered positions inside the middle band, densest at the centre
    let t = (i + random(0.2, 0.8)) / count;
    let pull = (t - 0.5) * 2;                    // -1 at the left of the band
    pull = pull * abs(pull);                     // eased: crowds the middle
    let x = width * (0.5 + pull * spread * 0.5);

    let lean = -pull * 22 + random(-7, 7);       // leaning back toward centre
    let len = random(0.48, 0.9) * height;

    // a couple of them pass in front of the headline instead of behind it —
    // the tallest ones, since those are the ones that reach the words at all
    let front = len > 0.72 * height && random() < 0.6;

    sticks.push({ x: x, dir: lean, len: len, front: front });
  }

  return sticks;
}

async function grow() {
  let sticks = plant();

  for (let i = 0; i < sticks.length; i++) {
    // the sketch's drawStick paints into _midLayer, so pointing that at the
    // front layer for a stick is all it takes to put it over the words
    _midLayer = sticks[i].front ? _frontG : _backG;
    await drawStick(new StickObj(sticks[i].x, height + 6, sticks[i].dir, sticks[i].len));
  }

  _midLayer = _backG;
}

function windowResized() {
  if (!_host) return;

  resizeCanvas(_host.clientWidth, _host.clientHeight);
  makeLayers();

  // redraw at the new size with no animation: a resize is not a performance
  _grown = true;
  redrawInstantly();
}

function redrawInstantly() {
  let sticks = plant();

  for (let i = 0; i < sticks.length; i++) {
    _midLayer = sticks[i].front ? _frontG : _backG;

    let stick = new StickObj(sticks[i].x, height + 6, sticks[i].dir, sticks[i].len);

    for (let n = 0; n < stick.nodes.length; n++) {
      let nodeData = stick.nodes[n];
      _midLayer.noStroke();
      _midLayer.fill(_colorSet.stickColor.h, _colorSet.stickColor.s, _colorSet.stickColor.b);
      drawStickBranch(nodeData.x1, nodeData.y1, nodeData.x2, nodeData.y2, nodeData.nodeDepth <= 2 ? 2 : 3);
    }
  }

  _midLayer = _backG;

  UpdateLayers();
}
