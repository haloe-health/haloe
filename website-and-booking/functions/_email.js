// functions/_email.js — shared brand email chrome + Resend sender.
//
// Single source of truth for haloe's transactional emails. Imported by
// stripe-webhook.js (booking confirmation + owner notification) and
// intake-submit.js (pre-session guide). Keeping the header / button / footer
// here means the brand only has to change in one place.
//
// NOTE: the leading underscore keeps this out of Cloudflare Pages Functions
// routing — files starting with "_" are treated as modules, not routes.
//
// Light theme (Sep 2026) — brand tokens mirror index.html's :root custom
// properties (--cream, --white, --ink, --body, --gold, --gold-deep) so the
// emails read as the same brand as the site, not a separate dark theme.

export const CREAM = '#F5F0E8';
export const WHITE = '#FFFFFF';
export const INK = '#0D0D0D';
export const BODY_TEXT = '#5a5247';
export const GOLD = '#C8A96E';
export const GOLD_DEEP = '#8a6a2c';
export const HAIRLINE = 'rgba(13,13,13,0.08)';
// Poppins where the client supports web fonts (a <link> to the Google Fonts
// CSS in emailShell's <head> covers Apple Mail and some Gmail apps), with a
// web-safe sans fallback everywhere else — most clients strip @font-face and
// external stylesheets entirely.
export const FONT = "'Poppins', 'Helvetica Neue', Arial, sans-serif";
// Headings use the same Poppins stack at weight 600 (set inline per h1),
// not a serif fallback — the site's heading font is Playfair Display via a
// self-hosted web font, which email clients can't load any more reliably
// than Poppins, so falling back to Georgia/Times just swaps one unreliable
// font for a different, unrelated-looking one instead of degrading cleanly.
export const FONT_HEADING = FONT;

// The flower logo + "haloe" wordmark, pre-rendered together as a single PNG
// (2x, 1068x286) because email clients don't render SVG reliably and won't
// load the self-hosted Tan Ashford font for the wordmark. The cream rounded
// pill background is baked into the raster image itself (not the
// surrounding HTML) — Gmail/Apple Mail dark mode can still invert the page's
// CSS background despite the color-scheme meta tags, and an image with a
// transparent background would then show the near-black wordmark sitting on
// an inverted-dark page background, unreadable. An opaque background baked
// into the pixels can't be touched by that inversion.
//
// Lock-up (Sep 2026, regenerated): the icon's height matches the full
// height of the wordmark — the ascender-top ("h"/"l") to baseline span —
// and it's vertically centred on that span (not baseline-sitting); the gap
// between icon and wordmark is the width of the letter "a" at the same
// size. All three numbers are measured live, not hand-picked — Tan
// Ashford's ascenders overshoot its own em-box (confirmed against Arial/
// Playfair Display controls), so a fixed em multiple would be wrong for
// this font specifically.
//
// Regenerate with tools/email-logo-generator.html (open it through the
// local dev server, e.g. http://localhost:8788/tools/email-logo-generator.html,
// so its fetches of ../haloe-logo-flower.svg and ../fonts/TAN-ASHFORD.woff2
// resolve) — it renders the real, unedited logo SVG next to "haloe" set in
// the real Tan Ashford font-face, measures both via canvas TextMetrics, and
// gives a "Download email-logo@2x.png" link sized/positioned from those
// measurements. Save its output over this file.
export const LOGO_URL = 'https://haloe.health/images/email-logo@2x.png';
export const LOGO_WIDTH = 344;
export const LOGO_HEIGHT = 92;

// POST an email through the Resend REST API. Throws on a non-2xx response.
export async function sendEmail(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend responded ${res.status}: ${body}`);
  }
  return res.json();
}

// Escape user-supplied values before interpolating into HTML.
export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The brand call-to-action button (gold pill, ink text — matches .btn-gold).
// `label` is escaped; `href` is trusted (always a hard-coded site URL, never
// user input).
export function emailButton(href, label) {
  return `<a href="${href}" style="display:inline-block;background:${GOLD};color:${INK};text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;padding:15px 32px;border-radius:26px;font-family:Arial,Helvetica,sans-serif;">${esc(label)}</a>`;
}

// The haloe header row: the flower + wordmark PNG, centred, on the cream
// background — no card, matching the site's plain header-on-cream look.
// width is fixed via the attribute + inline style, and height is left to
// `auto` rather than also pinned — some clients (Gmail among them) inject
// their own `img { max-width:100% }`-style reset that can shrink the
// rendered width below LOGO_WIDTH depending on the client width; a fixed
// height alongside a shrunk width is exactly what stretches/squashes the
// image, whereas height:auto keeps it on the file's real ratio no matter
// what width ends up applied. The explicit width=""/height="" attributes
// are still there for Outlook, which does not reliably honour height:auto.
// max-width is a genuine `100%` (not `${LOGO_WIDTH}px`, which was a no-op
// cap equal to width itself) — LOGO_WIDTH at 344 is wide enough to overflow
// a narrow phone's content column in clients that DON'T inject their own
// shrink reset, so this is what actually keeps it from forcing horizontal
// scroll on mobile there.
export function emailHeader() {
  return `<!-- Header -->
              <tr>
                <td align="center" bgcolor="${CREAM}" style="padding:3px 0 22px;border-bottom:1px solid ${HAIRLINE};background:${CREAM};">
                  <img src="${LOGO_URL}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="haloe" style="display:block;width:${LOGO_WIDTH}px;height:auto;max-width:100%;border:0;outline:none;">
                  <div style="font-family:${FONT};font-size:11px;letter-spacing:3px;color:${GOLD_DEEP};text-transform:uppercase;margin-top:10px;">Hijama &middot; Wellness &middot; Manchester</div>
                </td>
              </tr>`;
}

// The "With warmth, Halima" footer row (used at the bottom of client-facing emails).
export function emailFooter() {
  return `<!-- Footer -->
              <tr>
                <td align="center" bgcolor="${CREAM}" style="padding:26px 4px 8px;border-top:1px solid ${HAIRLINE};background:${CREAM};">
                  <div style="color:${BODY_TEXT};font-size:12px;letter-spacing:1px;font-family:${FONT};">With warmth,<br><span style="color:${GOLD_DEEP};font-weight:600;">Halima &middot; haloe</span></div>
                  <div style="color:${BODY_TEXT};font-size:11px;margin-top:12px;font-family:${FONT};opacity:0.8;">Women &amp; Men &middot; Manchester</div>
                </td>
              </tr>`;
}

// A centred hero block: a gold eyebrow (the date), the time large, and an
// optional sub-line, on a white rounded card. Returns a full <tr> to drop
// into the 480px shell table.
export function heroRow(eyebrow, big, sub) {
  return `<tr>
                <td style="padding:0 0 14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${WHITE}" style="border-collapse:separate;border-radius:14px;background:${WHITE};border:1px solid ${HAIRLINE};">
                    <tr>
                      <td align="center" style="padding:22px 16px;font-family:${FONT};">
                        <div style="color:${GOLD_DEEP};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">${esc(eyebrow)}</div>
                        <div style="color:${INK};font-size:30px;font-weight:600;letter-spacing:-0.5px;margin-top:3px;">${esc(big)}</div>
                        ${sub ? `<div style="color:${BODY_TEXT};font-size:13px;margin-top:6px;">${esc(sub)}</div>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;
}

// A grouped, inset detail card (iOS-settings style): label left, value right,
// soft hairline between rows, long values wrap. `rows` is [{label, value, gold}].
// Empty-value rows are dropped. Returns a full <tr>.
export function infoCard(rows) {
  const items = (rows || []).filter(r => r && r.value);
  if (!items.length) return '';
  const body = items.map((r, i) => {
    const bb = i === items.length - 1 ? '' : `border-bottom:1px solid ${HAIRLINE};`;
    return `<tr>
                      <td style="width:38%;padding:12px 14px;${bb}font-family:${FONT};font-size:13.5px;color:${r.gold ? INK : BODY_TEXT};font-weight:${r.gold ? '600' : '400'};vertical-align:top;">${esc(r.label)}</td>
                      <td align="right" style="width:62%;padding:12px 14px;${bb}font-family:${FONT};font-size:13.5px;font-weight:${r.gold ? '600' : '500'};color:${r.gold ? GOLD_DEEP : INK};text-align:right;word-break:break-word;overflow-wrap:anywhere;">${esc(r.value)}</td>
                    </tr>`;
  }).join('');
  return `<tr>
                <td style="padding:0 0 14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${WHITE}" style="table-layout:fixed;border-collapse:separate;border-radius:12px;background:${WHITE};border:1px solid ${HAIRLINE};">
                    ${body}
                  </table>
                </td>
              </tr>`;
}

// Wrap inner <tr> rows in the standard cream, 480px-wide email shell.
// `color-scheme`/`supported-color-schemes` tell Gmail/Apple Mail this is a
// light-only design so they don't auto-invert it into a dark palette —
// every colour below is also set explicitly (with bgcolor attributes, which
// Gmail respects even when it does still re-theme) as a second line of
// defence so text never lands dark-on-dark or pale-on-pale.
export function emailShell(innerRows) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');
      body, table, td, div, p, a, span, h1 { font-family: ${FONT}; }
      :root { color-scheme: light; supported-color-schemes: light; }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${CREAM};font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${CREAM}" style="border-collapse:collapse;background:${CREAM};">
      <tr>
        <td align="center" bgcolor="${CREAM}" style="padding:16px 16px 32px;background:${CREAM};">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;">
            ${innerRows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
