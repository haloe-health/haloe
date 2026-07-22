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

Flat fee, unlimited cups — no per-cup charges anywhere on the site. Every treatment includes take-home black seed oil aftercare; packages add a 30-min follow-up consultation and full herbal oil kit.

**Travel:** free within Manchester city centre; outside it, charged at the actual cost of a taxi from the centre — **not** a flat fee and not banded. Confirmed by Halima after booking.

## Technical infrastructure

*(Reconciled against the repo's own `CLAUDE.md` — that file is the source of truth for anything technical; this section now matches it.)*

- **Hosting:** haloe.health on Cloudflare Pages
- **Repo:** site code lives in `website-and-booking/`. Hand-written static HTML, no framework, no build step, no package manager, no test suite. CSS/JS are inline per-file — there are no shared/external asset files, and that's the deliberate pattern, not a gap.
- **Pages:** `index.html` (marketing site + a non-paying WhatsApp booking widget), `book.html` (4-step booking wizard — the only path that charges), `booking-confirmed.html` (Stripe success page), `intake.html` (5-step health form → D1), `before-your-session.html` (pre-session guide, linked from the intake email).
- **Functions:** `create-checkout.js`, `stripe-webhook.js`, `intake-submit.js`, `availability.js`, plus shared `_email.js` / `_bookings.js`. See `CLAUDE.md` for what each does.
- **Payments:** Stripe (live). Currency is GBP; `unit_amount` is always in pence. Secret key is `context.env.STRIPE_SECRET_KEY`, set in the Cloudflare Pages dashboard — never in code.
- **There IS a database and a webhook.** An earlier revision of this doc "corrected" the D1 mention as wrong — that correction was itself wrong, and it misled a later session. A D1 database (`haloe-clients`) stores intake submissions **and** booking slot reservations, and `functions/stripe-webhook.js` fires on payment to email both parties (Resend). Twilio/WhatsApp alerts are coded but deliberately **not configured** — Halima chose email-only. The WhatsApp button that used to sit on the confirmation page has been removed entirely.
- **WhatsApp number:** `447474833643` — still used by the homepage widget's hand-off. The old `447700000000` placeholder is gone.
- **Health-intake form:** the on-site form at `haloe.health/intake`, which writes to D1. The old Google Form is **retired** and all links now point at `/intake`. This resolves the ambiguity previously flagged here.
- **Service model: mobile only.** No clinic or treatment room; the location toggle has been removed from both booking flows.
- **Pricing source of truth on the live site:** the `SERVICES` constant near the top of `book.html` — not this doc, not the business plan doc directly. If a price changes, update `SERVICES`; the function and confirmation page just echo whatever the wizard sends.
- **DNS:** Cloudflare DNS. **2FA on the Cloudflare account was still outstanding as of last check** — worth confirming before doing sensitive infra work.

## State of play (last updated 22 July 2026)

The booking flow, confirmation page and intake form have all been redesigned in one
Apple-derived language — see the "Design language" section of `CLAUDE.md` and the
reusable snippets in `COMPONENTS.md`. Payments, the D1 slot reservation and the
notification webhook all work and have been tested with real £1 bookings.

**Verified working end to end:** treatment selection → Stripe payment → confirmation
page → automatic notification email to halima@haloe.health (with the client's address).

**Never yet exercised:** the intake form's POST to `/intake-submit`. Cloudflare
Functions don't run under a static local server, so the only way to test it is to
submit the live form and confirm a row lands in D1 and the guide email sends. **Do
this first in the next session.** A silent failure looks identical to success — the
form says "thank you" either way.

## Open items to check against the live site

- [x] **Pricing/session times** — `SERVICES` now matches the tables above, including the lengthened durations
- [x] **Service model** — confirmed mobile-only by Halima; location toggle removed site-wide
- [x] **WhatsApp placeholder number** — replaced with `447474833643`
- [x] **Intake form mechanism** — resolved: the on-site `/intake` form is current, the Google Form is retired
- [x] **Client address** — now collected at booking (required, validated for a UK postcode), since every session is at the client's home
- [ ] **Instagram handle** — confirm every reference site-wide uses `@haloe.health`, not `@haloe_hijama`
- [ ] **Women-only messaging** — confirm site reflects this consistently (booking flow, intake copy, About/FAQ), not leftover "all clients" language
- [ ] **Notification env vars** — confirm `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` and the four `TWILIO_*` vars are set in Cloudflare, and that a Stripe webhook endpoint for `checkout.session.completed` points at `https://haloe.health/stripe-webhook`. Absent notifications are almost always config, not code.
- [x] **Slot durations / double-booking** — `book.html` now reserves the slot in D1 at checkout and greys out overlapping times; two people can no longer pay for the same slot. (Homepage WhatsApp widget still doesn't reserve — manual check needed there.)

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

- [ ] **Test a live intake submission** — the one untested link in the chain (see above)
- [ ] **Remove the £1 test treatment** once testing is finished — it's the `?test=1` block near the `SERVICES` catalogue in `book.html`, invisible without the query flag
- [ ] **Instagram handle** — confirm every reference site-wide uses `@haloe.health`, not `@haloe_hijama`
- [ ] **Women-only messaging** — confirm no leftover "all clients" language
- [ ] **Intake step 3** fits a 900px-tall window but will still scroll slightly on a shorter laptop; splitting the 12 safety questions across two steps would fix it properly
- [ ] **Nothing warns about GP clearance** for complex health histories any more — that copy was removed from the booking page at Halima's request and hasn't been re-homed in the intake email
