# getsoffo.com

The Soffo landing page. A single static page with no build step: the HTML is
served as written, and the CSS and JS are plain files the browser loads
directly.

## Layout

```
index.html          the whole page
CNAME               the custom domain GitHub Pages serves it on
assets/
  css/styles.css    every rule on the page
  img/favicon.png
  js/
    tile-field.js   the animated "soffo" wordmark, drawn on a canvas
    ando-field.js   the stroke-drawn concrete, and the tree standing in it
    motion.js       the scroll reveal and the FAQ accordion
archive/            art from earlier drafts; nothing on the page loads it
```

## Working on it

There is nothing to install. Open `index.html` directly, or serve the folder
if you want paths to resolve the way they do in production:

```
python3 -m http.server 8000
```

Pushing to `main` publishes the site.

## How the page is built

The page is one column of full-width bands — header, wordmark, tagline, the
court drawing, CTA, FAQ, pricing, the concrete seam, headline, footer — each
ruled off from the next by a hairline that runs the full viewport width. A
single pair of column rules (`.hero-grid`) spans the whole page behind them, so
the bands read as cells of one grid rather than as separate blocks that happen
to be stacked.

Each band carries a `data-mark` number, printed small in the outer gutter. It
replaces the Figma-style selection ring that used to name the bands on hover:
the same information, but annotated once and left there the way a drawing is,
rather than something you have to poke at to see.

## The drawings

`ando-field.js` renders two canvases from one engine, both in the same
material: nothing is a vector stroke, every edge and seam and branch is a run
of small dots pushed off the line by value noise and sized by it, so a line has
grain. The technique comes from newyellow's "Zen Pots"
(openprocessing.org/sketch/2036000), whose recursive splitter grows a stick
into branches and paints each segment as a jittered dot run. That splitter is
here more or less intact — with a trunk added, since left to itself it wanders
from the first segment and the tree comes out a bent stick.

    court   the page's one picture: two overlapping concrete planes, the
            form-tie holes that are the only ornament fair-faced concrete
            has, a slit cut through for light, and one tree
    seam    a single course of the same formwork, run edge to edge as a rule
            between the pricing and the closing line

Both hold off until they scroll into view, then draw themselves stroke by
stroke over about three seconds. Under `prefers-reduced-motion` they land
whole. Each is fixed to a seed, so the composition is the same every load —
tune it by changing the seed in `index.html` and looking, not by reloading.
