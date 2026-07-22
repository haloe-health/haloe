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
