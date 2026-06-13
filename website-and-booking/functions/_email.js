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
export const GOLD = '#C8A96E';
export const CREAM = '#F5F0E8';
export const MUTED = '#A39A86';
export const HAIRLINE = 'rgba(200,169,110,0.22)';

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
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:9px;color:${CREAM};font-weight:normal;">haloe</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;margin-top:8px;">Hijama &middot; Wellness &middot; Manchester</div>
                </td>
              </tr>`;
}

// The "With warmth, Halima" footer row (used at the bottom of client-facing emails).
export function emailFooter() {
  return `<!-- Footer -->
              <tr>
                <td align="center" style="padding:26px 4px 8px;border-top:1px solid ${HAIRLINE};margin-top:20px;">
                  <div style="color:${MUTED};font-size:12px;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">With warmth,<br><span style="color:${GOLD};">Halima &middot; haloe</span></div>
                  <div style="color:#6B6357;font-size:11px;margin-top:12px;font-family:Arial,Helvetica,sans-serif;">Women only &middot; Manchester</div>
                </td>
              </tr>`;
}

// Wrap inner <tr> rows in the standard dark, 480px-wide email shell.
export function emailShell(innerRows) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BLACK};">
    <div style="background:${BLACK};padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;">
              ${innerRows}
            </table>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
}
