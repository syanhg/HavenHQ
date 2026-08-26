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
    frame-select.js the Figma-style ring that follows the pointer between bands
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

The page is one column of full-width bands — header, wordmark, tagline, CTA,
FAQ, pricing, headline, footer — each ruled off from the next by a hairline
that runs the full viewport width. A single pair of column rules
(`.hero-grid`) spans the whole page behind them, so the bands read as cells of
one grid rather than as separate blocks that happen to be stacked.

Each band carries a `data-frame` name. `frame-select.js` reads it to label the
selection ring, which is the page's one visual joke: hovering a band selects
it the way hovering a frame in Figma would.
