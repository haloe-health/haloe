# Components

Reusable UI patterns for the haloe site. This file is the **canonical source** —
the site keeps all CSS/JS inline per page (see `CLAUDE.md`), so components live
here as copy-paste snippets rather than shared asset files.

When you use one, copy it verbatim and only change the tokens. If you improve a
component, update it **here first**, then in the pages that use it.

---

## Page control (progress dots)

A row of dots showing progress through a multi-step flow. The current step is a
stretched gold pill; completed steps are muted gold; upcoming steps are grey.

Apple calls this component a **page control** (`UIPageControl`). Strictly, a page
control marks your position among pages in a carousel, whereas we use it as a
**step indicator** — same visual, different job. The stretched-active-dot detail
has no official name; it's commonly called an *expanding dot* or *pill indicator*.

**Used by:** `book.html` (4 steps), `intake.html` (5 steps).

### Markup

```html
<div class="page-control" id="pageControl" aria-hidden="true">
  <i></i><i></i><i></i><i></i>
</div>
```

One `<i>` per step. It is `aria-hidden` on purpose — see Accessibility below.

### CSS

```css
.page-control { display: flex; justify-content: center; gap: 7px; }
.page-control i {
  display: block;
  width: 6px; height: 6px;
  border-radius: 999px;
  background: #3A3A3C;          /* upcoming */
  font-style: normal;            /* <i> is a container here, not italics */
  transition: background 0.25s, width 0.25s;
}
.page-control i.is-done    { background: rgba(201,160,64,0.55); }
.page-control i.is-current { background: var(--gold); width: 18px; }

@media (prefers-reduced-motion: reduce) {
  .page-control i { transition: none; }
}
```

### JS

```js
// current is 1-based
function setPageControl(current, el) {
  const dots = (el || document.getElementById('pageControl')).children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].className =
      i + 1 === current ? 'is-current' : (i + 1 < current ? 'is-done' : '');
  }
}
```

Call it wherever the step changes — the same place that shows/hides your panels.

### Accessibility

**Always pair the dots with a visible text counter** ("Step 3 of 5"). Dots alone
convey nothing to a screen reader, and colour alone shouldn't carry meaning. Both
current pages do this, which is why the dots themselves are `aria-hidden="true"`
rather than being given labels — announcing four empty list items would be noise.

If you ever drop the text counter, replace `aria-hidden` with
`role="progressbar"` plus `aria-valuenow` / `aria-valuemin` / `aria-valuemax`.

### Tokens

| Purpose | Value |
|---|---|
| Current | `var(--gold)` (`#C9A040`) |
| Completed | `rgba(201,160,64,0.55)` |
| Upcoming | `#3A3A3C` |
| Dot size | `6px`, current stretches to `18px` |
| Gap | `7px` |

### Known naming drift

The two live implementations predate this file and use different class names.
Both behave identically; neither is worth renaming right now (`book.html`'s
`.step` classes are toggled by `goToStep()` on the payment path, so renaming
carries risk for no user-visible gain). **New pages should use the canonical
`.page-control` / `.is-current` / `.is-done` above.**

| Page | Container | States |
|---|---|---|
| `book.html` | `.steps` > `.step` > `.step-dot` | `.active` / `.done` |
| `intake.html` | `.progress-dots` > `i` | `.on` / `.done` |
| **Canonical (new work)** | `.page-control` > `i` | `.is-current` / `.is-done` |

---

## Toggle switch

An iOS-style switch, used for consents and either/or confirmations where the
answer is really "yes or not yet" rather than a genuine choice. For a true
either/or, use a segmented control instead.

**Used by:** `intake.html` (the 18-or-over confirmation, and the five consents
on step 5), `book.html`.

### Geometry — do not change these five numbers

```css
.switch {
  position: relative;
  width: 38px; height: 22px;
  border-radius: 999px;
  background: #3A3A3C;           /* off */
  transition: background 0.2s;
}
.switch::after {                  /* the knob */
  content: '';
  position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--cream);       /* #F5F0E8 — NOT #fff, see below */
  transition: transform 0.2s;
}
input:checked + .switch          { background: var(--gold); }
input:checked + .switch::after   { transform: translateX(16px); }
```

They interlock: `2 + 18 + 2 = 22` sets the height, and the knob's travel is
`38 − 18 − 2 − 2 = 16`, which is the `translateX`. Change the track width and
you must change the translate to match, or the knob stops short of the edge.

### The knob is cream, never `#fff`

This is the one detail that's easy to get wrong, and it was wrong in all three
implementations until July 2026. **The palette contains no pure white** — the
lightest tokens are `--cream` / `--a-t1` (`#F5F0E8`) and `--white` (`#f7f2ea`),
both warm. A cool `#fff` knob on a warm `--gold` track is the only pure white on
the page, so it reads as a foreign object punched into the control rather than
part of it.

Use `var(--cream)` (or `var(--a-t1)` on pages using the Apple token set — same
value). Note `book.html` also defines `--white: #FFFFFF`; that token is for
other purposes, so don't reach for it here.

### Accessibility

The real `<input>` stays in the DOM and keeps its `id`/`name` — the switch is
purely a restyle of the label. On `intake.html` this is load-bearing: `collect()`
reads text fields by **`id`** and radio groups by **`name`**, so a switch that
replaced its input would silently drop that answer while still reporting success.

Where a switch hides one half of a radio pair (`intake.html`'s 18-or-over shows
only the `Yes` option, with `[value="No"]` set to `display:none`), remember a
radio can't be unticked by clicking it again — that page wires up an explicit
handler so the switch can be turned back off.

---

## Segmented control

Either/or answers. `book.html` is canonical — `.segmented` / `.seg-option`.

| Part | Value |
|---|---|
| Track | `#1C1A16`, `border-radius: 9px`, `padding: 2px`, `gap: 2px`, no border |
| Option | no border, transparent, `var(--a-t2)`, `border-radius: 7px`, `padding: .34rem .95rem` |
| Selected | `book.html` uses `#3A362E` + cream; `intake.html` uses gold fill + black |
| Touch | `@media (pointer: coarse) { min-height: 44px }` |

**Options must have no border.** `intake.html` carries a legacy
`.opt span { border: 1px solid rgba(201,160,64,0.3) }` from the pre-Apple
design. The `.choices .opt span` override that restyles everything else never
reset `border`, so every Yes/No pill silently kept a gold hairline and the
control read as two outlined buttons rather than one segmented track. It is now
explicitly reset — don't remove that line.

The two pages still disagree on the **selected** fill (gold vs `#3A362E`).
That's unresolved, not an accident: gold gives stronger feedback across a
12-question safety screen. Pick one deliberately before adding a third page.

---

## Grouped inset list

A card of rows: one background, one radius, hairlines between. Used for every
question run on `intake.html` and throughout `book.html`.

```html
<div class="group">
  <div class="field">…</div>
  <div class="field">…</div>
</div>
```

```css
.group { background: var(--a-s1); border-radius: 12px; overflow: hidden; margin-bottom: .8rem; }
.group > .field { border-radius: 0 !important; margin: 0 !important;
                  border-bottom: 1px solid var(--a-sep); }
.group > .field:last-child { border-bottom: none; }
```

**Prefer the wrapper to `:has()` adjacency.** `intake.html` originally welded
rows with a chain of `.field:has(> .choices) + .field:has(> input)` rules that
rounded the first and last of each run. That chain breaks the moment anything
sits between two rows — when the hidden [[conditional follow-up]] fields were
added, every question became its own island with a gap. The wrapper owns the
card, so nothing between rows can break it.

---

## Conditional follow-up (progressive disclosure)

A free-text box that stays hidden until its question is answered Yes, then
opens welded to the card above it. Used on `intake.html` step 2 for the three
"please list them" boxes.

Before this existed, those boxes sat outside the card with their own label and
margin — the step ran ~1,180px and scrolled on every laptop. With disclosure it
is ~380px for a client with nothing to declare.

### Markup

Mark **only** the genuinely conditional wrapper. It must be the immediate next
sibling of its question.

```html
<div class="field">
  <label class="q">Are you currently taking any medication?</label>
  <div class="choices" data-group="takes_medication">…Yes / No radios…</div>
</div>

<div class="field reveal">
  <label class="q" for="current_medications">Please list them</label>
  <textarea id="current_medications"></textarea>
</div>
```

Drop the "If yes," prefix from the label — the box only exists when the answer
was Yes, so the words are redundant.

### CSS

```css
.field.reveal { display: none; }

.field:has(> .choices input[value="Yes"]:checked) + .field.reveal {
  display: block;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
/* the question above squares off its foot so the pair reads as one card */
.field:has(> .choices input[value="Yes"]:checked):has(+ .field.reveal) {
  border-bottom: 1px solid var(--a-sep);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  margin-bottom: 0;
}
```

### Do not use a blanket sibling rule

The obvious selector — every `.field:has(> textarea)` after a question — is
wrong. `main_concern` (step 2) and `safety_notes` (step 3) also follow a
question row and must **always** be visible. Requiring the explicit `.reveal`
class is what keeps them safe; adding a new conditional box is opt-in.

### Known caveat

Hiding is CSS-only, so a hidden `<textarea>` keeps any text already typed and
still submits it. Answer Yes, type, then switch to No, and the note is stored
alongside the "No". Clear the field on change if that matters for the record.

---

## Logo lock-up (flower + wordmark)

The honeycomb flower mark next to the "haloe" wordmark, in Tan Ashford.
Appears as `.brand`/`.footer-brand` (`index.html`), `.nav-logo`/`.footer-left`
(`before-your-session.html`, `intake.html`, `hijama-manchester.html`), and as
a baked PNG for email (`images/email-logo@2x.png`, via `functions/_email.js`).
There is no longer a page-load intro animation — it (`intro.js`) was removed
in Sep 2026 along with the site-wide bee cursor; don't reintroduce either.

**Crop fix (Sep 2026):** `haloe-logo-flower.svg`'s own honeycomb artwork only
fills ~71% of its square viewBox (~14% padding on every side), so a plain
100%-fill `<img>` renders the flower visibly smaller than its box. Every
lock-up above wraps the `<img>` in a small frame (`.brand-icon`,
`.footer-brand-icon`, `.nav-logo-icon`, `.footer-left-icon` — naming varies
per page) that keeps the box's existing 1.17em size/position and clips an
oversized `140.85%` (`1/0.71`) copy of the image via `overflow:hidden`, so
the ink fills the box edge to edge. Never edit the SVG file itself. The same
technique, scaled to a 48px box, drives the minimal `#haloeLoader` flower
pulse on `book.html`/`intake.html` (a real loading state — gates on
`window.load` — not a decorative animation).

**The icon is vertically centred on the wordmark's cap-height, not
baseline-sitting.** Cap-height here means the span from the top of the "l"/"h"
ascender down to the baseline — measured from Tan Ashford's *actual rendered
glyphs*, not the font's nominal em-box: canvas `TextMetrics` on the string
"haloe" gives `actualBoundingBoxAscent` ≈ **1.17×** the font-size (this font's
ascenders overshoot its own em-box — confirmed against Arial/Playfair Display
controls, which measure ~0.72–0.79×, so it's a real font trait, not a
fallback-font artifact) and `actualBoundingBoxDescent` ≈ 0 (no descenders in
"haloe"). Gap between icon and wordmark is **0.35× the icon's width**.

### CSS (site)

```css
.brand { display:flex; align-items:center; gap:calc(1.17em * 0.35); font-size:1.5rem; }
.brand img { height:1.17em; width:1.17em; display:block; transform:translateY(-0.2918em); }
.brand .wordmark { font-family:var(--font-wordmark); font-size:1em; line-height:1; letter-spacing:0.02em; }
```

Font-size lives on the **container**, not the wordmark span — the icon's `em`
values must resolve against that same reference. Setting `font-size` only on
the wordmark (the old code) means the icon's `em` inherits from *its own*
ancestor instead, silently breaking the scaling this whole lock-up depends on.

`-0.2918em` is not a rounded/guessed number. Plain `align-items:center` +
`line-height:1` centres the icon on the wordmark's *line box* (the font's
design ascent+descent, 0.8em+0.2em here), which sits measurably lower than
the box the real ink actually occupies (1.17em+0em) once a font's ascenders
overshoot its own em-box this much — the two only coincide for "normal"
fonts. The `-0.2918em` translateY is the measured correction for Tan Ashford
specifically; re-derive it (see below) if the wordmark font ever changes.

### Re-deriving the numbers (if the font changes)

```js
await document.fonts.load("100px '<font>'");
const m = document.createElement('canvas').getContext('2d');
m.font = "normal 100px '<font>'";
const t = m.measureText('haloe');
const ascentRatio = t.actualBoundingBoxAscent / 100;   // -> icon height/width, in em
// Then empirically find the translateY correction: apply align-items:center
// + line-height:1 + icon height/width:${ascentRatio}em, measure the icon's
// actual centre vs. the text's true ink centre (baseline - (ascent-descent)/2
// above the baseline) via getBoundingClientRect, and translateY the icon by
// the difference. See the git history of index.html's .brand rule for the
// exact measurement script used for Tan Ashford.
```

### Email PNG

`images/email-logo@2x.png` bakes the same lock-up into a raster image (email
clients can't load the self-hosted font or reliably render SVG) on an opaque
cream rounded-pill background (see the `LOGO_URL` comment in
`functions/_email.js` for why the background must be baked in, not
transparent). Regenerate by drawing the icon at `height = 1.17 ×
<wordmark font-size>` with its **bottom edge at the text baseline** (so it
spans exactly ascender-top to baseline — equivalent to the site's
translateY correction, but simpler to express directly against a canvas
baseline instead of a flex line-box), gap = `0.35 ×` the icon's width, then
compare a screenshot of the result against a live `.brand` clone at the same
font-size before saving.
