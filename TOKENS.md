# Design tokens — what is tokenised and what is not

Tokens live in `website-and-booking/tokens.css` (plain CSS custom properties; the site has no build step or Tailwind). Pages: `book.html`, `intake.html`, `before-your-session.html`, plus `calm.css` and `ui.css`. Not covered: `index.html`, `hijama-manchester.html`, `booking-confirmed.html`, `app/` (separate passes).

**Replaced (Oct 2026):** 109 colours, 120 font sizes, 145 spacing values. Checked by pixel-comparing 44 screenshots (light/dark, 375/1280, every booking step, intake steps 1–5, guide) before and after: identical.

## Tokens
- **Colour:** `--c-ink #0D0D0D`, `--c-ink-warm #1A1208`, `--c-cream #F5F0E8`, `--c-white`, `--c-gold #C8A96E`, `--c-gold-mid #A8873A`, `--c-gold-light #DFC38E`, `--c-gold-deep #7A5C22` (gold as text), `--c-muted #6B6357`, `--c-body-soft`, `--c-sand`, dark surfaces `--c-dark-page/card/surface/raised`.
- **Spacing (4px grid):** `--s1 4` · `--s2 8` · `--s3 12` · `--s4 16` · `--s5 24` · `--s6 32`.
- **Type (px):** `--fs-label 12` · `--fs-caption 13` · `--fs-body 15` · `--fs-input 16` · `--fs-heading 17` · `--fs-title 28`.

## Flagged: does not map cleanly (left as-is on purpose)
**Colour — 59 distinct values, 93 uses**
- *Near-duplicates of a brand colour* (pick one, then they can be tokenised): `#C9A040`, `#A8842F`, `#8A6A2C` (old golds ≈ `--c-gold-mid`/`--c-gold-deep`); `#DBB85A` (≈ gold-light); `#A38548`.
- *Greys that are almost `--c-muted`* but fail or differ: `#8A8272`, `#8F8676`, `#9C9486`, `#9A917F`, `#A89F8C`, `#B8B0A2`, `#C6BCA9`, `#75706A`, `#6B5E4B`, `#5A5040`, `#4A3F2E`, `#4A4438`.
- *Fills and washes* with no token yet: `#FBF8F2`, `#FBF7EE`, `#FBF6EA`, `#F5EDDB`, `#F7F2EA`, `#EFE7D8`, `#EDE6D6`, `#EDE8DF`, `#E8E2D6`, `#E0D9CE`, `#D8D0BF`, `#F0EDE8`.
- *Pure/neutral blacks and whites*: `#000`, `#111`, `#040403`, `#080806`, `#1C1C1E`, `#2A2620`, `#CCC` — mostly legacy dark-theme or one-off shades; `#1C1C1E` and `#080806` look like leftovers from the old black design and may be unused.
- *Errors*: `#E5736A`, `#C97A6E`, `#E0A59B`, `#C0392B`, `#FBEFEC` (several reds for the same job); the AA-safe error colours (`#B3261E`, `#7A1A14`, `#FFD7D3`) are in `ui.css` as `--ui-error*` and should replace these.
- *Dark-mode overrides* in `ui.css` (`#D9BF86`, `#B9B0A1`, `#C9C0B2`, `#FF9C94`, `#3A1F1C`): need a `--c-*-on-dark` set, not a one-to-one swap.

**Font size — 50 distinct values, 157 uses**
- **123 sizes are in rem/em** (`0.72rem`, `0.95rem`, `1rem`…). They are scaled by the page's legacy `html { font-size: 78% }` (booking page was moved to 100% in the Atelier pass, so these now render at their rem value) — they have no px equivalent without changing the layout. They are the biggest chunk of legacy and can only be moved to tokens by rewriting those rules.
- **Odd px sizes:** `14px` (14 uses — sits between caption 13 and body 15; pick one), `11px`, `10px`, `9.5px`, `10.5px`, `13.5px`, `14.5px`, `18px`, `24px`, `25px`, `27px`.

**Spacing — 89 distinct values, 362 uses**
- **rem/em (about 200 uses)**: `1rem`, `0.6rem`, `0.85rem`, `0.4rem`, … — same legacy 78% issue, plus values like `0.962rem` and `1.282rem` that were derived from the old shrink.
- **Off-grid px:** `10px` (18 uses), `14px` (14), `6px` (12), `18px` (12), `28px` (12), `20px` (9), `9px`, `22px`, `26px`, `40px`, `48px`, `80px`, `2px`, `3px`, `5px`, `7px`, `11px`. Several are fixed bar heights/insets (`80px` etc.); the rest are legacy and should round to the nearest 4.
- **Expressions that cannot be a token:** `calc(1.17em * 0.35)` (logo lock-up), `calc(-1 * clamp(1rem, 4vw, 1.5rem))` (full-bleed bar), `-8px` negative margins (tap-target growth).
