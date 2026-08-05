// functions/_email.js — shared brand email chrome + Resend sender.
//
// Single source of truth for haloe's transactional emails. Imported by both
// stripe-webhook.js (booking confirmation) and intake-submit.js (pre-session
// guide). Keeping the header / button / footer here means the brand only has to
// change in one place.
//
// NOTE: the leading underscore keeps this out of Cloudflare Pages Functions
// routing — files starting with "_" are treated as modules, not routes.

// Brand tokens (kept in sync with the website's email styling).
export const BLACK = '#0D0D0D';
export const GOLD = '#c9a040';
export const CREAM = '#F5F0E8';
export const MUTED = '#A39A86';
export const HAIRLINE = 'rgba(201,160,64,0.22)';
// Poppins where the client supports web fonts (Apple Mail, some Gmail apps),
// with a clean sans-serif fallback everywhere else. Used on every element.
export const FONT = "'Poppins', Arial, Helvetica, sans-serif";

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

// The brand call-to-action button (gold pill). `label` is escaped; `href` is
// trusted (always a hard-coded site URL, never user input).
export function emailButton(href, label) {
  return `<a href="${href}" style="display:inline-block;background:${GOLD};color:${BLACK};text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;padding:15px 32px;border-radius:26px;font-family:Arial,Helvetica,sans-serif;">${esc(label)}</a>`;
}

// The haloe wordmark header row (used at the top of client-facing emails).
export function emailHeader() {
  return `<!-- Header -->
              <tr>
                <td align="center" style="padding:8px 0 26px;border-bottom:1px solid ${HAIRLINE};">
                  <div style="font-family:${FONT};font-size:28px;letter-spacing:8px;color:${CREAM};font-weight:500;">haloe</div>
                  <div style="font-family:${FONT};font-size:11px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;margin-top:8px;">Hijama &middot; Wellness &middot; Manchester</div>
                </td>
              </tr>`;
}

// The "With warmth, Halima" footer row (used at the bottom of client-facing emails).
export function emailFooter() {
  return `<!-- Footer -->
              <tr>
                <td align="center" style="padding:26px 4px 8px;border-top:1px solid ${HAIRLINE};margin-top:20px;">
                  <div style="color:${MUTED};font-size:12px;letter-spacing:1px;font-family:${FONT};">With warmth,<br><span style="color:${GOLD};">Halima &middot; haloe</span></div>
                  <div style="color:#6B6357;font-size:11px;margin-top:12px;font-family:${FONT};">Women only &middot; Manchester</div>
                </td>
              </tr>`;
}

// A centred hero block: a gold eyebrow (the date), the time large, and an
// optional sub-line. Returns a full <tr> to drop into the 480px shell table.
export function heroRow(eyebrow, big, sub) {
  return `<tr>
                <td style="padding:0 0 14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:14px;background:#161310;">
                    <tr>
                      <td align="center" style="padding:22px 16px;font-family:${FONT};">
                        <div style="color:${GOLD};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">${esc(eyebrow)}</div>
                        <div style="color:${CREAM};font-size:30px;font-weight:600;letter-spacing:-0.5px;margin-top:3px;">${esc(big)}</div>
                        ${sub ? `<div style="color:${MUTED};font-size:13px;margin-top:6px;">${esc(sub)}</div>` : ''}
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
    const bb = i === items.length - 1 ? '' : 'border-bottom:1px solid rgba(255,255,255,0.06);';
    return `<tr>
                      <td style="width:38%;padding:12px 14px;${bb}font-family:${FONT};font-size:13.5px;color:${MUTED};vertical-align:top;">${esc(r.label)}</td>
                      <td align="right" style="width:62%;padding:12px 14px;${bb}font-family:${FONT};font-size:13.5px;color:${r.gold ? GOLD : CREAM};text-align:right;word-break:break-word;overflow-wrap:anywhere;">${esc(r.value)}</td>
                    </tr>`;
  }).join('');
  return `<tr>
                <td style="padding:0 0 14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:separate;border-radius:12px;background:#161310;">
                    ${body}
                  </table>
                </td>
              </tr>`;
}

// Wrap inner <tr> rows in the standard dark, 480px-wide email shell.
export function emailShell(innerRows) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');
      body, table, td, div, p, a, span, h1 { font-family: ${FONT}; }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BLACK};font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${BLACK}" style="border-collapse:collapse;background:${BLACK};">
      <tr>
        <td align="center" bgcolor="${BLACK}" style="padding:32px 16px;background:${BLACK};">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;">
            ${innerRows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
