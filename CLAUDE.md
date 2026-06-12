# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Marketing site + booking flow for **haloe**, a women-only hijama/cupping & massage wellness business in Manchester. Everything lives under `website-and-booking/`. There is no build step, framework, package manager, or test suite — the site is hand-written static HTML with inline `<style>` and inline `<script>`, plus one serverless function.

## Architecture

- `index.html` — the full marketing site (hero, services, conditions, FAQ, footer). Self-contained: all CSS and JS are inline. Every "Book" CTA links to `book.html`.
- `book.html` — the 4-step booking wizard (Treatment → Date & Time → Details → Confirm). All state lives in a single in-memory `state` object; panels are shown/hidden via the `.panel.active` class and `goToStep(n)`. The treatment catalogue (names, durations, prices in GBP) is the `SERVICES` constant near the top of the script — **this object is the source of truth for pricing**.
- `booking-confirmed.html` — Stripe's `success_url` landing page. It reads booking details from query-string params (set by the function), then builds a `wa.me` deep link so the customer messages Halima on WhatsApp to confirm.
- `functions/create-checkout.js` — a **Cloudflare Pages Function**. The `functions/` directory convention maps this file to the `/create-checkout` route (which is what `book.html` POSTs to). It creates a Stripe Checkout Session by POSTing form-encoded params to the Stripe REST API directly (no Stripe SDK), then returns `{ url }` for the browser to redirect to.

### Booking → payment flow (the critical path)
1. `book.html` collects the selection and customer details into `state`, then `handlePayment(type)` POSTs to `/create-checkout`. `type` is `'deposit'` (hard-coded £25 = `2500` pence) or `'full'` (`service.price * 100`).
2. The function builds a Stripe Checkout Session, embeds all booking fields in `metadata[...]`, and sets `success_url` to `booking-confirmed.html` with the booking details as query params.
3. After payment, Stripe redirects to `booking-confirmed.html`, which auto-opens a pre-filled WhatsApp message to Halima. **There is no backend database or webhook** — confirmation is a manual WhatsApp step.

## Compliance (client-facing copy)

- **All client-facing copy must use wellness/symptom language only.** Never claim — explicitly or by implication — to **treat, cure, manage, or heal a named medical condition** (e.g. arthritis, migraine, depression, infertility, IBS, sciatica, etc.). This applies to every customer-visible string: `index.html`, `book.html`, `booking-confirmed.html`, meta descriptions, alt text, and any Stripe/WhatsApp message copy.
- Frame benefits as supporting wellbeing or easing symptoms/sensations, not as medical intervention. Prefer "may help with tension, aches, and relaxation" over "treats back pain"; prefer "supports general wellbeing" over "manages anxiety".
- When editing or adding copy, audit it against this rule before committing. If asked to add a condition-specific claim, push back and reword it into compliant symptom/wellness language.

## Workflow

- **At the end of every task, always run `git add -A && git commit && git push`.** Stage all changes, commit with a clear message, and push so Cloudflare Pages deploys. Do this even for small edits — there is no separate deploy step.

## Deployment & secrets

- Hosted on **Cloudflare Pages**. Pushing to the repo triggers a deploy; there is no local build to run. To preview Functions locally you'd use `npx wrangler pages dev website-and-booking` (Wrangler is not committed/configured here).
- The function reads `context.env.STRIPE_SECRET_KEY` — set in the Cloudflare Pages dashboard as an environment variable, never in code.
- Currency is **GBP**; Stripe `unit_amount` is always in **pence** (multiply pounds by 100).

## Conventions & gotchas

- Keep CSS/JS inline in each HTML file — that's the established pattern; there are no shared/external asset files.
- Design tokens are CSS custom properties redefined per file (`--gold #C8A96E`, `--black #0D0D0D`, `--cream #F5F0E8`). Reuse them rather than hard-coding colours. Font is Poppins via Google Fonts.
- **The real WhatsApp number is `447474833643`.** `booking-confirmed.html` (line ~139) already uses it correctly. **`index.html` (line ~1339) still uses the placeholder `447700000000`** — fix this when next touching that file. Always use `447474833643` for any new or edited WhatsApp link.
- The health-intake Google Form (`https://forms.gle/UY2jpwdBHXPccfxJ9`) is referenced in `book.html`, `index.html`, and `booking-confirmed.html` — update all three together if it changes.
- If you change a price or treatment name, update it in the `SERVICES` object in `book.html`; the function and confirmation page just echo whatever the wizard sends.
- Calendar disables past dates and Sundays; time slots are a fixed hard-coded list (no real availability check).
