# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Marketing site + booking flow for **haloe**, a women-only hijama/cupping & massage wellness business in Manchester. Everything lives under `website-and-booking/`. There is no build step, framework, package manager, or test suite — the site is hand-written static HTML with inline `<style>` and inline `<script>`, plus a handful of Cloudflare Pages Functions and a D1 database.

**Service model: mobile only.** Halima travels to the client; there is no clinic or treatment room. Do not reintroduce a location choice or any "visit us" copy.

## Architecture

### Pages
- `index.html` — the full marketing site (hero, services, conditions, FAQ, footer) **plus a self-contained booking widget** (`HB_SERVICES`, `hb*` functions). The widget does **not** take payment — it collects details and opens a pre-filled WhatsApp message. Its treatment list must be kept identical to `SERVICES` in `book.html`.
- `book.html` — the 4-step booking wizard (Treatment → Date & Time → Details → Confirm) and **the only path that charges money**. State lives in one in-memory `state` object; panels toggle via `.panel.active` and `goToStep(n)`. The `SERVICES` constant is **the source of truth for treatments, durations and prices**.
- `booking-confirmed.html` — Stripe's `success_url` landing page. Builds a `wa.me` deep link so the customer can message Halima. This is a *convenience*, not the notification mechanism (see below).
- `intake.html` — the on-site multi-step health intake form, POSTing to `/intake-submit`. **This replaced the old Google Form.** Do not reintroduce `forms.gle` links.
- `before-your-session.html` — pre-session guide, linked from the intake confirmation email.

### Functions (`functions/` maps to routes)
- `create-checkout.js` → `/create-checkout`. Creates a Stripe Checkout Session via the REST API (no SDK), embedding booking fields in `metadata[...]`.
- `stripe-webhook.js` → `/stripe-webhook`. Verifies the Stripe signature manually with Web Crypto (HMAC-SHA256, 5-minute timestamp tolerance), then on `checkout.session.completed` sends: a customer confirmation email, Halima's notification email (both via Resend), and a WhatsApp alert to Halima (via Twilio).
- `intake-submit.js` → `/intake-submit`. Upserts the client and writes an `intake_forms` row to the **D1 database (`haloe-clients`, bound as `DB`)**, then emails the pre-session guide. POST only — intake data is never publicly readable.
- `_email.js` — shared brand tokens and email helpers. The `_` prefix keeps it from becoming a route.

### Booking → payment → notification flow (the critical path)
1. `book.html` collects selection + details into `state`, then `handlePayment(type)` POSTs to `/create-checkout`. `type` is `'deposit'` (£25, capped at the treatment price so the £1 test item charges £1) or `'full'`.
2. The function creates the Checkout Session and sets `success_url` to `booking-confirmed.html` with booking details as query params.
3. **Notification is automatic and does not depend on the customer.** Stripe calls `/stripe-webhook`, which emails Halima and the customer and sends Halima a WhatsApp message. The WhatsApp button on `booking-confirmed.html` is an extra touch the customer may ignore.
4. The WhatsApp alert comes from the Twilio business number, **not** the client's number — sending as the client is impossible and would be impersonation. The client's number is in the message body so Halima can reply.

### Privacy: the client's address
The address collected at step 3 is deliberately **kept out of the URL**. It travels to Stripe as `metadata[customerAddress]`, and reaches `booking-confirmed.html` via `sessionStorage` (`haloe_address`). Never add it to `success_url` — home addresses in URLs leak into browser history, referrer headers and server logs.

## Compliance (client-facing copy)

- **All client-facing copy must use wellness/symptom language only.** Never claim — explicitly or by implication — to **treat, cure, manage, or heal a named medical condition** (e.g. arthritis, migraine, depression, infertility, IBS, sciatica, etc.). This applies to every customer-visible string: `index.html`, `book.html`, `booking-confirmed.html`, meta descriptions, alt text, and any Stripe/WhatsApp message copy.
- Frame benefits as supporting wellbeing or easing symptoms/sensations, not as medical intervention. Prefer "may help with tension, aches, and relaxation" over "treats back pain"; prefer "supports general wellbeing" over "manages anxiety".
- When editing or adding copy, audit it against this rule before committing. If asked to add a condition-specific claim, push back and reword it into compliant symptom/wellness language.

## Workflow

- **At the end of every task, always run `git add -A && git commit && git push`.** Stage all changes, commit with a clear message, and push so Cloudflare Pages deploys. Do this even for small edits — there is no separate deploy step.

## Deployment & secrets

- Hosted on **Cloudflare Pages**. Pushing to the repo triggers a deploy; there is no local build to run. To preview Functions locally you'd use `npx wrangler pages dev website-and-booking` (Wrangler is not committed/configured here).
- Currency is **GBP**; Stripe `unit_amount` is always in **pence** (multiply pounds by 100).
- Every secret is set in the Cloudflare Pages dashboard, **never in code**:

| Variable | Used by | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | `create-checkout.js` | Create Checkout Sessions |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook.js` | Verify webhook signatures |
| `RESEND_API_KEY` | `stripe-webhook.js`, `intake-submit.js` | Send email |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | `stripe-webhook.js` | WhatsApp alerts |
| `TWILIO_WHATSAPP_FROM` / `HALOE_WHATSAPP_TO` | `stripe-webhook.js` | WhatsApp sender / recipient |
| `DB` (binding) | `intake-submit.js` | D1 database `haloe-clients` |

- Missing Twilio or Resend vars are handled gracefully — the webhook logs and still returns 200 rather than failing. So absent notifications usually mean **unset env vars or no registered Stripe webhook endpoint**, not broken code.

## Conventions & gotchas

- Keep CSS/JS inline in each HTML file — that's the established pattern; there are no shared/external asset files.
- Design tokens are CSS custom properties redefined per file (`--gold #C8A96E`, `--black #0D0D0D`, `--cream #F5F0E8`). Reuse them rather than hard-coding colours. Font is Poppins via Google Fonts.
- **The real WhatsApp number is `447474833643`** — used everywhere. Never reintroduce the old `447700000000` placeholder.
- The health intake is the on-site form at `/intake`, linked from `book.html`, `index.html` and `booking-confirmed.html`. Update all three together.
- If you change a price or treatment name, update `SERVICES` in `book.html` **and `HB_SERVICES` in `index.html`** — the two lists are separate and have silently diverged before (the homepage once advertised facials and peels that were never offered). The function and confirmation page just echo whatever the wizard sends.
- Calendar disables past dates and Sundays. Time slots are a fixed hard-coded list, 10:00–20:00 in 30-minute steps, duplicated in both `book.html` and `index.html`.
- **Known gap: slots ignore treatment duration.** There is no availability check, so a 1h45 treatment can be booked at 20:00, and overlapping bookings are possible. Fixing this means deriving the slot list from the selected treatment's `time`.
- `/book.html?test=1` injects a hidden **£1 test treatment** for live Stripe checks (`SERVICES.massage.unshift`, near the catalogue). It is invisible without the query flag. Remove the block when testing is done.
- The site serves extensionless URLs — `/book.html` redirects to `/book`. Query strings survive the redirect, but `curl` needs `-L` or you'll read an empty 308 and wrongly conclude a deploy failed.
