# haloe.health — Project Context

Handoff doc for Claude Code sessions editing the haloe website. Drop this in the repo root (or reference it at the start of a session) so context doesn't need re-explaining each time.

**Note:** the repo already has its own `CLAUDE.md` with more precise technical detail (exact file/line references, architecture, workflow conventions). Where the two overlap, **trust the repo's `CLAUDE.md` over this doc** — this file is meant to add business/brand/pricing context that Claude Code wouldn't otherwise have, not to duplicate or override the repo's own technical documentation. If the two ever visibly disagree on something technical, that's a sign this doc is stale and needs updating, not that the repo is wrong.

## Business overview

Haloe is a premium, **women-only** hijama (wet cupping) and wellness therapy practice in Manchester, UK, run by Halima Yasmin. L5 Diploma in Health & Cupping Therapy (Distinction, The Suuk Academy), CMA & IPHM accredited.

- **Women only — permanent, firm boundary.** Professional and religious conviction, not a marketing phase. No mixed-gender treatment, no exceptions by service type. Do not reintroduce "all clients" language anywhere on the site.
- **Instagram: `@haloe.health`** (changed from `@haloe_hijama` — update any remaining old-handle references site-wide, including footer links, meta tags, and any hardcoded social icons).

## Compliance rule (non-negotiable — applies to all site copy)

Wellness and symptom language only. Never claim to treat, cure, diagnose, or manage named medical conditions. Stay at sensation/symptom level (e.g. "tight, heavy, tense back," not condition names). Enforced by insurance (Westminster) and ASA guidelines. Apply this to any copy changes, not just new pages.

## Services & pricing (source of truth — verify against latest business plan doc before editing site copy; figures have drifted before)

Session times run longer than typical for the industry by design — deliberately unhurried pace as part of the premium experience.

**Tier 1 · Massage**
| Treatment | Time | Price |
|---|---|---|
| Face | 45m | £40 |
| Head | 45m | £40 |
| Face & Head | 1h | £70 |
| Head & Foot | 1h | £60 |
| Back/Neck/Shoulders | 1h | £75 |
| Full Body | 1h15m | £90 |

**Tier 2 · Dry Cupping**
| Treatment | Time | Price |
|---|---|---|
| Face | 45m | £50 |
| Head | 45m | £50 |
| Face & Head | 1h | £85 |
| Targeted/Sports | 1h | £60 |
| Full Back | 1h | £80 |
| Full Body | 1h | £100 |
| Head/Scalp/Full Body | 1h15m | £115 |

**Tier 3 · Wet Cupping / Hijama**
| Treatment | Time | Price |
|---|---|---|
| Head & Scalp | 1h | £70 |
| Targeted/Sports | 1h | £80 |
| Full Back | 1h | £90 |
| Full Body | 1h30m | £120 |
| Head/Scalp/Full Body | 1h45m | £150 |

**Targeted Wellness Packages**
| Package | Sessions | Price |
|---|---|---|
| Pain & Mobility / Breathe & Immunity / Cycle Comfort | 4 | £340 (£85/session) |
| Stress & Sleep / Headache & Tension / Digestion & Detox | 6 | £480 (£80/session) |
| Circulation & Energy / Women's Hormonal Balance | 8 | £600 (£75/session) |

Flat fee, unlimited cups — no per-cup charges anywhere on the site. Every treatment includes take-home black seed oil aftercare; packages add a 30-min follow-up consultation and full herbal oil kit. Mobile sessions available with a flat travel fee by radius.

## Technical infrastructure

*(Reconciled against the repo's own `CLAUDE.md` — that file is the source of truth for anything technical; this section now matches it.)*

- **Hosting:** haloe.health on Cloudflare Pages
- **Repo:** site code lives in `website-and-booking/`. Hand-written static HTML, no framework, no build step, no package manager, no test suite. CSS/JS are inline per-file — there are no shared/external asset files, and that's the deliberate pattern, not a gap.
- **Pages:** `index.html` (marketing site, all CTAs link to `book.html`), `book.html` (4-step booking wizard; state lives in one in-memory `state` object), `booking-confirmed.html` (Stripe success landing page).
- **Function:** `functions/create-checkout.js` — a Cloudflare Pages Function mapped to `/create-checkout`. Creates a Stripe Checkout Session via the Stripe REST API directly (no SDK).
- **Payments:** Stripe (live). Currency is GBP; `unit_amount` is always in pence. Secret key is `context.env.STRIPE_SECRET_KEY`, set in the Cloudflare Pages dashboard — never in code.
- **No database, no webhook.** This corrects an earlier assumption in this doc (a D1 database was previously listed — that's not what's actually live in this repo). Confirmation after payment is manual: `booking-confirmed.html` auto-opens a pre-filled WhatsApp message to Halima, and that's the entire confirmation step.
- **WhatsApp number:** the real number is `447474833643`. `booking-confirmed.html` already uses it correctly. **`index.html` (~line 1339) still has a placeholder `447700000000`** — fix on next touch.
- **Health-intake form:** currently a Google Form (`https://forms.gle/UY2jpwdBHXPccfxJ9`), referenced in three files (`book.html`, `index.html`, `booking-confirmed.html`) — update all three together if it changes. (Note: this is a different, simpler intake mechanism than the custom haloe.health/intake form referenced elsewhere in business planning — worth clarifying with Halima which is actually current.)
- **Pricing source of truth on the live site:** the `SERVICES` constant near the top of `book.html` — not this doc, not the business plan doc directly. If a price changes, update `SERVICES`; the function and confirmation page just echo whatever the wizard sends.
- **DNS:** Cloudflare DNS. **2FA on the Cloudflare account was still outstanding as of last check** — worth confirming before doing sensitive infra work.

## Open items to check against the live site

- [ ] **Instagram handle** — confirm every reference site-wide uses `@haloe.health`, not `@haloe_hijama`
- [ ] **Pricing/session times** — confirm `SERVICES` in `book.html` matches the tables above (times were recently lengthened; site may still show old shorter durations)
- [ ] **Women-only messaging** — confirm site reflects this consistently (booking flow, intake form copy, About/FAQ pages), not leftover "all clients" language
- [ ] **Service model / home visits** — a recent building-specific poster used "Home Visits Only" positioning (Halima travels to the client) rather than "Private Room" (client comes to her). **Unconfirmed whether this is now the universal service model or specific to that one campaign** — check with Halima before changing site-wide service-model copy off the back of this doc alone.
- [ ] **WhatsApp placeholder number** in `index.html` (~line 1339) — swap `447700000000` for the real `447474833643`
- [ ] **Intake form mechanism** — confirm whether the Google Form or a custom `haloe.health/intake` form is actually current; the two references in prior planning docs don't agree

## Brand assets

*(Colours corrected to match the repo's actual CSS custom properties — this doc previously had close-but-wrong hex values.)*

- Colours: gold `#C8A96E`, black `#0D0D0D`, cream `#F5F0E8` — defined as CSS custom properties (`--gold`, `--black`, `--cream`) redefined per file in the repo. Reuse the variables rather than hardcoding hex.
- Typography: Poppins, via Google Fonts
- Logo: honeycomb + "haloe" wordmark, available as both flattened PNG and layered SVG (SVG has multiple clip-paths — if generating PDFs/print from it, rasterize first rather than trusting a renderer's native SVG support, some engines mishandle the clip-paths)
- Motif: honeycomb/hexagon pattern used decoratively across marketing materials
- **Note:** marketing materials (posters, business plan docs) have used slightly different hex values (`#C9A040` gold, `#201C18` charcoal, `#FAF6ED` cream) — close to the site's tokens but not identical. Worth a decision on whether to unify these or whether print/digital are intentionally allowed to drift slightly.

## Working style / build principles

- Fast-paced, action-oriented — prefers ready-to-use output over long explanations
- Orthogonality: one change at a time
- Reversibility: avoid one-way-door changes without flagging them first
- Read before writing — check existing code/content before editing
- No gold-plating before launch — ship the working version, polish later
- Always end tasks with `git add -A && git commit && git push`
