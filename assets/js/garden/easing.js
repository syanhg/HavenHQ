/* Easing curves (easings.net).

   Every stem, trunk and frond on the page tapers along one of these. Picking
   the curve at random per segment — alternating in and out — is what keeps two
   plants of the same species from reading as copies of each other. */

function easeInSine(x)  { return 1 - Math.cos((x * Math.PI) / 2); }
function easeOutSine(x) { return Math.sin((x * Math.PI) / 2); }

function easeInQuad(x)  { return x * x; }
function easeOutQuad(x) { return 1 - (1 - x) * (1 - x); }

function easeInCubic(x)  { return x * x * x; }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

function easeInQuart(x)  { return x * x * x * x; }
function easeOutQuart(x) { return 1 - Math.pow(1 - x, 4); }

function easeInQuint(x)  { return x * x * x * x * x; }
function easeOutQuint(x) { return 1 - Math.pow(1 - x, 5); }

function easeInCirc(x)  { return 1 - Math.sqrt(1 - Math.pow(x, 2)); }
function easeOutCirc(x) { return Math.sqrt(1 - Math.pow(x - 1, 2)); }

const curvesIn  = [easeInSine, easeInQuad, easeInCubic, easeInQuart, easeInQuint, easeInCirc];
const curvesOut = [easeOutSine, easeOutQuad, easeOutCubic, easeOutQuart, easeOutQuint, easeOutCirc];
