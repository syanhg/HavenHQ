# getsoffo.com

The Soffo landing page. A single static page with no build step: the HTML is
served as written, and the CSS and JS are plain files the browser loads
directly.

## Layout

```
index.html            the whole page
CNAME                 the custom domain GitHub Pages serves it on
assets/
  css/styles.css      every rule on the page
  img/favicon.png
  js/
    motion.js         the scroll reveal, and the FAQ rows
    garden/
      easing.js       the curves every stem and trunk tapers along
      util.js         ink mixing, Catmull-Rom paths, branching sticks
      stipple.js      the drawing engine: dots, and nothing but dots
      flora.js        the planting list — hedge, cone, ball, shrub, tree, sprout
      garden.js       anchors each plant to an element, grows it, sways it
archive/              art from earlier drafts; nothing on the page loads it
tile-texture.html     a standalone sketch from an earlier draft
```

## Working on it

There is nothing to install. Serve the folder so paths resolve the way they do
in production:

```
python3 -m http.server 8000
```

Pushing to `main` publishes the site.

## How the page is built

One idea holds the page together: **the hairlines that rule the layout are
ground.** Every plant stands on one of them, so the rules are not decoration
between sections — they are the soil the garden grows out of. Nothing else on
the page is ruled; everything else is white.

The page is a column of beds, each closed by its ground line: the wordmark, the
tagline, the gate, the questions, the two plots, the closing line, the foot.
The tagline bed is left unplanted on purpose.

### The drawing

Everything drawn on the canvas is a cloud of small circles — no strokes, no
filled shapes — in the manner of newyellow's "Zen Pots". That is not only a
look: it is what makes the rest work. A stipple cloud has no continuous edges,
so it can be sheared into strips and shifted per strip without anyone seeing a
seam, which is how a plant sways.

`stipple.js` has one primitive worth knowing about. `buildField` takes an
inside-test for any shape and chamfers a distance field over it, which buys
three things at once: the inside test, the depth from the edge (so dots crowd
the trim line), and the gradient (so a form can be lit without knowing what
shape it is). A hedge, a cone, a canopy and the letters of the wordmark are all
the same primitive with a different mask.

### The wordmark

It is a hedge clipped into the word, cut from the `h1`'s own font at its own
size — so it is still the page's type, just grown rather than set. The heading
keeps its real text for screen readers and search, and only steps back to
transparent once there is a hedge to replace it.

Two things there are worth not undoing. The letters are drawn one at a time,
because Canvas2D accepts no font-feature settings and a serif face will happily
fuse `ff` into one glyph — a hedge grown from that ligature reads as "sotto".
And the field is sampled finely enough to resolve a crossbar, which at any
coarser setting simply disappears.

### Growing and swaying

Each plant is anchored to a real element: it fills that element's box and
stands on its bottom edge, so the planting reflows with the layout instead of
being positioned twice. Its ops are sorted lowest-ink-first and drained a few
milliseconds a frame, so it grows up out of the ground as it comes into view.
Then it is blitted from its buffer in horizontal strips, each offset by a sine
of its height — the breeze.

Plants in view are re-pinned to their anchors every frame. Their ground moves
more often than it looks: a bed slides up as it is revealed, a row pushes
everything below it down, a face finishes loading and the column reflows. The
alternative is a garden floating a few pixels off its own soil.

Most plants go in as the reader reaches them. The seedling beside a question
waits to be asked — it is planted when the answer is opened, and it stays.
