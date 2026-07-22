# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Marketing site + booking flow for **haloe**, a women-only hijama/cupping & massage wellness business in Manchester. Everything lives under `website-and-booking/`. There is no build step, framework, package manager, or test suite — the site is hand-written static HTML with inline `<style>` and inline `<script>`, plus a handful of Cloudflare Pages Functions and a D1 database.

**Service model: mobile only.** Halima travels to the client; there is no clinic or treatment room. Do not reintroduce a location choice or any "visit us" copy.

**Travel cost:** free within Manchester city centre; outside it, charged at the actual cost of a taxi from the centre (not a flat fee, not banded). Confirmed by Halima after booking. This wording appears in `book.html` (step 1), `booking-confirmed.html` (step 2) and `before-your-session.html` — keep all three identical.

## Architecture

### Pages
- `index.html` — the full marketing site (hero, services, conditions, FAQ, footer) **plus a self-contained booking widget** (`HB_SERVICES`, `hb*` functions). The widget does **not** take payment — it collects details and opens a pre-filled WhatsApp message. Its treatment list must be kept identical to `SERVICES` in `book.html`.
  - **The conditions hexagons open a modal**, and each entry in that modal's `data` object carries a `cta: { cat, svc }` that becomes a deep link into `book.html` (see below). Every `svc` must match a `SERVICES` name **exactly** — a typo silently drops the preselection and the client lands on a category with nothing chosen. Skin & Beauty maps to a single dry-cupping treatment (there is no package for it); Spiritual Wellbeing intentionally opens the wet-cupping list with nothing preselected.
- `book.html` — the 4-step booking wizard (Treatment → Date & Time → Details → Confirm) and **the only path that charges money**. State lives in one in-memory `state` object; panels toggle via `.panel.active` and `goToStep(n)`. The `SERVICES` constant is **the source of truth for treatments, durations and prices**.
  - **Layout is a single centred 560px column** (`.book-shell`) with a **frosted footer** (`.footbar`) carrying the running selection and total. The old two-column summary rail has been removed. `updateRail()` now populates `#foot-sum` / `#foot-total` and calls `syncFooter()`, which sets the footer button's label and disabled state and hides the whole bar on step 4. It runs on every state change — `selectService`, the category-tab handler, `selectDate`, `selectTime`, `goToStep` and `checkStep3`.
  - **Progress is dots**, not numbered steps: the four `.step` elements are restyled into dots (the active one a gold pill). One adaptive back control, `#back-control`, reads "Back to site" on step 1 and "Back" thereafter. There is **no** centered `<header>` logo (the original big logo SVG is kept in a `display:none` div).
  - **Step 2 puts the calendar and time slots side by side** via `.dt-cols` (grid, collapses to one column ≤720px). `#time-section` is always in the DOM; before a date is picked it shows `#time-hint`, which `selectDate` hides.
  - **It accepts a deep link:** `book.html?cat=<category>&svc=<exact treatment name>`. `applyDeepLink()` runs before the first render, switches the tab and preselects the treatment. `svc` is matched by **exact name**, so renaming a treatment silently breaks any link pointing at it. An unknown `cat` or `svc` degrades to the normal Massage default rather than erroring.
  - **Step 4 shows the booking as an "appointment pass"** — date and time as the hero, a perforated edge, then treatment and price. `renderSummary()` builds it. Both pay buttons carry the real amount via `depositLabel()` / `fullLabel()` (the deposit is capped at the treatment price, so the £1 test item reads "Pay £1 deposit" — never hard-code £25).
- `booking-confirmed.html` — Stripe's `success_url` landing page. Reads the booking from the query string and shows "You're booked." plus **two** numbered next steps (Halima will be in touch → on the day), with "Back to haloe" as the only action. The **WhatsApp hand-off has been removed** — the webhook already notifies Halima automatically, so the button was redundant. It also clears `haloe_address` from `sessionStorage`, since nothing needs it once the WhatsApp message is gone.
- `intake.html` — the on-site 5-step health intake form, POSTing to `/intake-submit`. **This replaced the old Google Form.** Do not reintroduce `forms.gle` links. Verified working end to end on 22 July 2026 (200 `{"ok":true}`, real row in D1).
  - **The 41-key payload in `collect()` is a hard contract.** Text fields and checkboxes are read by **`id`**, radio groups by **`name`**. Rename either and that answer is silently dropped — the form still reports success. Wrapper classes, label text and CSS are all safe to change; **`id` and `name` are not.** After any edit, re-run the check: every id `collect()` reads must still exist in the DOM (41 keys, 41 ids).
  - **Step 2 uses progressive disclosure.** The three "please list them" boxes carry `.field.reveal` and stay hidden until their question is answered Yes. `main_concern` and `safety_notes` follow a question row too but are **always** visible — never hide follow-ups with a blanket sibling rule. See `COMPONENTS.md`.
  - **Question runs are welded by a `.group` wrapper, not `:has()` adjacency.** The old adjacency chain broke the moment anything (like a hidden `.reveal`) sat between two rows, turning each question into its own island. Prefer the wrapper.
- `before-your-session.html` — pre-session guide, linked from the intake confirmation email.

### Functions (`functions/` maps to routes)
- `create-checkout.js` → `/create-checkout`. Creates a Stripe Checkout Session via the REST API (no SDK), embedding booking fields in `metadata[...]`.
- `stripe-webhook.js` → `/stripe-webhook`. Verifies the Stripe signature manually with Web Crypto (HMAC-SHA256, 5-minute timestamp tolerance), then on `checkout.session.completed` sends: a customer confirmation email, Halima's notification email (both via Resend), and a WhatsApp alert to Halima (via Twilio). The customer email **no longer links the intake form** — see the intake note under Conventions. Both functions should pass `node --check` after editing; an unbalanced template literal in the email HTML kills confirmations silently.
- `intake-submit.js` → `/intake-submit`. Upserts the client and writes an `intake_forms` row to the **D1 database (`haloe-clients`, bound as `DB`)**, then emails the pre-session guide. POST only — intake data is never publicly readable.
- `availability.js` → `/availability?date=YYYY-MM-DD`. Read-only; returns `{ busy: [{s,e}] }` (start/end minutes) for active bookings on that date. Fails open (returns empty) on any error so a lookup fault never blocks booking.
- `_email.js` — shared brand tokens and email helpers. `_bookings.js` — slot-reservation helpers (table DDL, time/duration parsing, atomic reserve, confirm/release). The `_` prefix keeps both from becoming routes.

### Slot reservation / double-booking prevention (D1 `bookings` table)
- The `bookings` table is created lazily via `CREATE TABLE IF NOT EXISTS` (no migration step). Columns: `booking_date` (`YYYY-MM-DD`), `start_min`/`end_min` (minutes from midnight), status `'pending'|'confirmed'`, `hold_expires_at`, `stripe_session_id`.
- `create-checkout.js` reserves the slot **before** creating the Stripe session, via an atomic `INSERT…SELECT…WHERE NOT EXISTS(overlap)` — two racing requests can't both win. A win writes a `'pending'` row held for `HOLD_SECONDS` (35 min) and passes `metadata[bookingId]` + `expires_at` to Stripe. A loss returns **409 `slot_taken`**, and `book.html` sends the customer back to pick another time. Stripe failure releases the hold.
- `stripe-webhook.js` flips the row to `'confirmed'` on `checkout.session.completed`. Abandoned checkouts never confirm; their holds lapse and the overlap check ignores expired pending rows, so the slot frees itself.
- **Fail-open everywhere:** if `DB` is unbound or the time can't be parsed, checkout proceeds unreserved rather than blocking a paying customer.
- **Known limitations:** the homepage widget (`index.html`) takes no payment, so it neither reserves nor reflects availability — those WhatsApp bookings aren't in D1 and need Halima's manual eye. 8pm stays bookable for any treatment (no "runs past closing" rule).

### Booking → payment → notification flow (the critical path)
1. `book.html` collects selection + details into `state`, then `handlePayment(type)` POSTs to `/create-checkout`. `type` is `'deposit'` (£25, capped at the treatment price so the £1 test item charges £1) or `'full'`.
2. The function creates the Checkout Session and sets `success_url` to `booking-confirmed.html` with booking details as query params.
3. **Notification is automatic and does not depend on the customer.** Stripe calls `/stripe-webhook`, which emails Halima and the customer (and would WhatsApp Halima if Twilio were configured — it deliberately isn't). Nothing on the confirmation page is required for Halima to find out about a booking.
4. The WhatsApp alert comes from the Twilio business number, **not** the client's number — sending as the client is impossible and would be impersonation. The client's number is in the message body so Halima can reply.

### Design language (all customer-facing pages)
Reusable patterns are documented in **`COMPONENTS.md`** (repo root) — copy-paste snippets, since the site keeps CSS/JS inline per page. Update that file first when you improve one.

`book.html`, `booking-confirmed.html` and `intake.html` share one Apple-derived language — **true black, neutral greys (`#1C1C1E` surfaces, `rgba(255,255,255,0.10)` hairlines), gold used only for the active selection**, sentence-case headings with full stops, and `html { font-size: 78% }` as the single scale dial. Patterns to reuse rather than reinvent:
- **Grouped inset lists** (iOS Settings): label left, answer right, hairline between rows, 12px radius. Build them with a **`.group` wrapper that owns the card**, not per-row `:has()` adjacency rules.
- **Segmented controls** for either/or answers; **toggle switches** for consents. Use a segmented control for anything that reads as a *question* — a lone switch among questions looks out of place. Options must have **no border**; `intake.html` carries a legacy `.opt span` gold hairline that the Apple override has to reset explicitly.
- **There is no pure white in the palette.** The lightest tokens are `--cream` / `--a-t1` (`#F5F0E8`) and `--white` (`#f7f2ea`), both warm. A `#fff` toggle knob on a warm gold track reads as a foreign object — use `var(--cream)`.
- **Pill buttons** — gold fill for the primary action, neutral outline for the secondary.
- Validation sits **under the field it refers to**, with the hairline above it suppressed so field and message read as one cell.
- `book.html` drives steps from a **frosted footer**; its button proxies each step's hidden `#btn-stepN`, so the original validation still governs it.

### Privacy: the client's address
The address collected at step 3 is deliberately **kept out of the URL**. It travels to Stripe as `metadata[customerAddress]`, and reaches `booking-confirmed.html` via `sessionStorage` (`haloe_address`). Never add it to `success_url` — home addresses in URLs leak into browser history, referrer headers and server logs.

## Compliance (client-facing copy)

- **All client-facing copy must use wellness/symptom language only.** Never claim — explicitly or by implication — to **treat, cure, manage, or heal a named medical condition** (e.g. arthritis, migraine, depression, infertility, IBS, sciatica, etc.). This applies to every customer-visible string: `index.html`, `book.html`, `booking-confirmed.html`, meta descriptions, alt text, and any Stripe/WhatsApp message copy.
- Frame benefits as supporting wellbeing or easing symptoms/sensations, not as medical intervention. Prefer "may help with tension, aches, and relaxation" over "treats back pain"; prefer "supports general wellbeing" over "manages anxiety".
- When editing or adding copy, audit it against this rule before committing. If asked to add a condition-specific claim, push back and reword it into compliant symptom/wellness language.
- Claims removed in July 2026, for reference on what the rule catches: *"draws out stagnant blood, toxins, and impurities to restore the body's natural balance"* (physiological claim), *"one of the oldest and most powerful forms of natural medicine"* (calls it medicine, asserts potency), and a hero line *"addressing pain, hormonal health, fatigue"* (names conditions).
- **Outstanding:** the conditions section is still headed **"Conditions *we treat*"** in `index.html`. The word "treat" above a grid of named conditions is the clearest remaining violation on the site. Flagged with Halima; awaiting her decision on the replacement wording.

## Workflow

- **At the end of every task, always run `git add -A && git commit`.** Commit with a clear message, even for small edits.
- **Pushing usually has to be done by Halima.** The `gh` CLI on this machine is authenticated as `tigerflowai`, which has **read-only** access to `haloe-health/haloe` (`gh api repos/haloe-health/haloe --jq '.permissions'` → `push: false`). `git push` does not fail cleanly — Git Credential Manager waits on an interactive auth window that can't open in a headless session, so the command **hangs until it times out**. Don't burn minutes retrying. Check permissions first, then hand Halima the command. Pushing to `main` deploys to production immediately, so say so when handing it over.

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
- **The Instagram handle is `@haloe.health`.** The old `@haloe_hijama` survived in six places until July 2026 (the intake guide email, `before-your-session.html`, the homepage footer, the intake error message). Don't reintroduce it.
- **`book.html`'s pay-note promising a WhatsApp confirmation is correct copy, not a bug.** Twilio is inert, so it looks like a broken promise and is tempting to rewrite as email — but Halima messages every client on WhatsApp **herself**. Leave it.
- **The intake form is deliberately not linked or prompted anywhere.** Halima speaks to each client on WhatsApp first and sends `haloe.health/intake` herself. The automatic prompts were removed from all four places that had them — the customer email in `stripe-webhook.js`, `booking-confirmed.html`, `book.html` and `index.html`. The form is still live and still writes to D1; only the prompts are gone. **Do not "helpfully" re-add a link.** `stripe-webhook.js` carries a comment showing how to restore the email block when she wants it back.
- If you change a price or treatment name, update `SERVICES` in `book.html` **and `HB_SERVICES` in `index.html`** — the two lists are separate and have silently diverged before (the homepage once advertised facials and peels that were never offered).
- **A 20% promotional discount is active.** Both lists keep the **full** price so it can be shown struck through; the amount displayed and charged comes from `netPrice()` (`book.html`) / `hbNet()` (`index.html`). **Never read `svc.price` for money** — it is the pre-discount figure. To end the promotion set `PROMO_DISCOUNT` and `HB_PROMO_DISCOUNT` to `0`; the strikethroughs vanish and full prices are charged again, with no other edit needed. Keep the two constants in step. The function and confirmation page just echo whatever the wizard sends.
- Calendar disables past dates and Sundays. Time slots are a fixed hard-coded list, 10:00–20:00 in 30-minute steps, duplicated in both `book.html` and `index.html`.
- **`book.html` slots now reflect real availability** — on date select it fetches `/availability`, then greys out any slot that would overlap an existing booking given the selected treatment's duration (parsed from its `time`). Changing treatment re-validates the chosen slot on return to step 2. The homepage widget does **not** do this (see reservation section above).
- `/book.html?test=1` injects a hidden **£1 test treatment** for live Stripe checks (`SERVICES.massage.unshift`, near the catalogue). It is invisible without the query flag. Remove the block when testing is done.
- The site serves extensionless URLs — `/book.html` redirects to `/book`. Query strings survive the redirect, but `curl` needs `-L` or you'll read an empty 308 and wrongly conclude a deploy failed.
