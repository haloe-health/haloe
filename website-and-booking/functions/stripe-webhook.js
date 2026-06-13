// Cloudflare Pages Function — POST /stripe-webhook
//
// Receives Stripe webhook events. On `checkout.session.completed` it sends two
// branded emails via the Resend API: one warm confirmation to the customer, and
// one notification to Halima. There is no Stripe SDK in this environment, so the
// webhook signature is verified manually with Web Crypto (HMAC-SHA256).
//
// Env vars (set in the Cloudflare Pages dashboard, never in code):
//   STRIPE_WEBHOOK_SECRET  — the signing secret for this webhook endpoint (whsec_…)
//   RESEND_API_KEY         — Resend API key for sending email

const FROM = 'haloe <halima@haloe.health>';
const HALIMA_EMAIL = 'halima@haloe.health';
const INTAKE_FORM = 'https://forms.gle/UY2jpwdBHXPccfxJ9';
const GUIDE_URL = 'https://haloe.health/before-your-session';

// Brand tokens (kept in sync with the website)
const BLACK = '#0D0D0D';
const GOLD = '#C8A96E';
const CREAM = '#F5F0E8';
const MUTED = '#A39A86';
const HAIRLINE = 'rgba(200,169,110,0.22)';

export async function onRequestPost(context) {
  // --- Read the RAW body first (required for signature verification) ---
  const rawBody = await context.request.text();
  const sigHeader =
    context.request.headers.get('Stripe-Signature') ||
    context.request.headers.get('stripe-signature');

  // --- SECURITY: verify the Stripe webhook signature ---
  try {
    const secret = context.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !sigHeader) {
      console.error('Webhook rejected: missing signing secret or Stripe-Signature header');
      return new Response('Missing signature', { status: 400 });
    }

    const { t, signatures } = parseSignatureHeader(sigHeader);
    if (!t || signatures.length === 0) {
      console.error('Webhook rejected: malformed Stripe-Signature header');
      return new Response('Invalid signature', { status: 400 });
    }

    const signedPayload = `${t}.${rawBody}`;
    const expected = await hmacSha256Hex(secret, signedPayload);
    const verified = signatures.some((sig) => constantTimeEqual(sig, expected));
    if (!verified) {
      console.error('Webhook rejected: signature mismatch');
      return new Response('Invalid signature', { status: 400 });
    }
  } catch (err) {
    console.error('Webhook signature verification error:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // --- Parse the event ---
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('Webhook rejected: body is not valid JSON', err);
    return new Response('Invalid payload', { status: 400 });
  }

  // --- Only act on completed checkout sessions; ack everything else ---
  if (event?.type !== 'checkout.session.completed') {
    return new Response('Ignored', { status: 200 });
  }

  // --- Everything below must NEVER throw or return non-200 (avoid webhook retry storms) ---
  try {
    const session = event.data?.object || {};
    const md = session.metadata || {};

    const email =
      session.customer_email ||
      (session.customer_details && session.customer_details.email) ||
      '';
    const name = md.customerName || 'there';
    const phone = md.customerPhone || '';
    const treatment = md.treatmentName || 'Your treatment';
    const paymentType = md.paymentType || '';
    const date = md.date || '';
    const time = md.time || '';
    const location = md.location || '';
    const notes = md.notes || '';

    const amountPence =
      typeof session.amount_total === 'number'
        ? session.amount_total
        : parseInt(md.amount || '0', 10);
    const amount = formatGBP(amountPence);
    const isDeposit = paymentType === 'deposit';
    const paymentLabel = isDeposit ? `${amount} deposit paid` : `${amount} — paid in full`;

    const apiKey = context.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not configured; cannot send confirmation emails');
      return new Response('OK', { status: 200 });
    }

    const detail = { name, phone, email, treatment, date, time, location, amount, isDeposit, paymentLabel, notes };

    // Send the customer confirmation (skip gracefully if we have no address)
    if (email) {
      try {
        await sendEmail(apiKey, {
          from: FROM,
          to: [email],
          reply_to: HALIMA_EMAIL,
          subject: 'Your haloe booking is confirmed',
          html: clientEmailHtml(detail),
        });
      } catch (err) {
        console.error('Failed to send client confirmation email:', err);
      }
    } else {
      console.error('No customer email on session; skipping client confirmation email');
    }

    // Notify Halima
    try {
      await sendEmail(apiKey, {
        from: FROM,
        to: [HALIMA_EMAIL],
        reply_to: email || HALIMA_EMAIL,
        subject: `New booking — ${name}`,
        html: halimaEmailHtml(detail),
      });
    } catch (err) {
      console.error('Failed to send Halima notification email:', err);
    }
  } catch (err) {
    // Log, but still acknowledge so Stripe does not retry indefinitely
    console.error('Error handling checkout.session.completed:', err);
  }

  return new Response('OK', { status: 200 });
}

/* ------------------------------------------------------------------ */
/* Signature helpers                                                   */
/* ------------------------------------------------------------------ */

// Parse a Stripe-Signature header: "t=12345,v1=abc,v1=def" -> { t, signatures: [abc, def] }
function parseSignatureHeader(header) {
  let t = '';
  const signatures = [];
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') t = value;
    else if (key === 'v1') signatures.push(value);
  }
  return { t, signatures };
}

// HMAC-SHA256 of `payload` keyed by `secret`, returned as a lowercase hex string.
async function hmacSha256Hex(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = new Uint8Array(sigBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

// Constant-time string comparison (avoids leaking match position via timing).
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/* ------------------------------------------------------------------ */
/* Email sending + formatting                                          */
/* ------------------------------------------------------------------ */

async function sendEmail(apiKey, payload) {
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

function formatGBP(pence) {
  const pounds = (Number(pence) || 0) / 100;
  return '£' + (Number.isInteger(pounds) ? String(pounds) : pounds.toFixed(2));
}

// Escape user-supplied values before interpolating into HTML.
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A single label/value row for the details table.
function detailRow(label, value) {
  if (!value) return '';
  return `
    <tr>
      <td style="padding:13px 20px;border-top:1px solid ${HAIRLINE};color:${MUTED};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${esc(label)}</td>
      <td align="right" style="padding:13px 20px;border-top:1px solid ${HAIRLINE};color:${CREAM};font-size:14px;text-align:right;font-family:Arial,Helvetica,sans-serif;">${esc(value)}</td>
    </tr>`;
}

/* ------------------------------------------------------------------ */
/* Email templates                                                     */
/* ------------------------------------------------------------------ */

// Warm, premium, on-brand confirmation for the customer.
// COMPLIANCE: wellness/symptom language only — no claims to treat/cure/manage conditions.
function clientEmailHtml(d) {
  const depositNote = d.isDeposit
    ? `<p style="color:${MUTED};font-size:13px;line-height:1.7;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">Your deposit secures your appointment. The remaining balance is payable on the day.</p>`
    : '';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BLACK};">
    <div style="background:${BLACK};padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;">
              <!-- Header -->
              <tr>
                <td align="center" style="padding:8px 0 26px;border-bottom:1px solid ${HAIRLINE};">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:9px;color:${CREAM};font-weight:normal;">haloe</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;margin-top:8px;">Hijama &middot; Wellness &middot; Manchester</div>
                </td>
              </tr>
              <!-- Intro -->
              <tr>
                <td style="padding:30px 4px 4px;">
                  <h1 style="color:${CREAM};font-size:22px;font-weight:normal;margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;">Your booking is confirmed</h1>
                  <p style="color:${CREAM};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">Dear ${esc(d.name)},</p>
                  <p style="color:${MUTED};font-size:15px;line-height:1.75;margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;">Thank you for booking with haloe. Your payment has been received and your appointment is reserved. We look forward to welcoming you for a calm, restorative session in a relaxing, women-only space.</p>
                </td>
              </tr>
              <!-- Details card -->
              <tr>
                <td style="padding:0 0 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${HAIRLINE};border-radius:14px;overflow:hidden;background:#15120D;">
                    <tr>
                      <td style="padding:18px 20px 16px;">
                        <div style="color:${CREAM};font-size:18px;font-family:Georgia,'Times New Roman',serif;">${esc(d.treatment)}</div>
                        <div style="color:${GOLD};font-size:13px;letter-spacing:1px;margin-top:6px;font-family:Arial,Helvetica,sans-serif;">${esc(d.paymentLabel)}</div>
                      </td>
                    </tr>
                    ${detailRow('Date', d.date)}
                    ${detailRow('Time', d.time)}
                    ${detailRow('Location', d.location)}
                    ${detailRow('Amount paid', d.amount)}
                  </table>
                </td>
              </tr>
              <!-- Deposit note -->
              ${depositNote ? `<tr><td style="padding:0 4px 18px;">${depositNote}</td></tr>` : ''}
              <!-- Intake form -->
              <tr>
                <td style="padding:4px 4px 8px;">
                  <p style="color:${MUTED};font-size:15px;line-height:1.75;margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;">Before your appointment, please take a moment to complete your health intake form so Halima can prepare and tailor your session to you:</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 4px 14px;">
                  <a href="${INTAKE_FORM}" style="display:inline-block;background:${GOLD};color:${BLACK};text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;padding:15px 32px;border-radius:26px;font-family:Arial,Helvetica,sans-serif;">Complete your intake form</a>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 4px 26px;">
                  <a href="${GUIDE_URL}" style="display:inline-block;background:${GOLD};color:${BLACK};text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;padding:15px 32px;border-radius:26px;font-family:Arial,Helvetica,sans-serif;">Read your pre-session guide</a>
                </td>
              </tr>
              <!-- Personal note + compliance -->
              <tr>
                <td style="padding:4px 4px 0;">
                  <p style="color:${CREAM};font-size:15px;line-height:1.75;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">Halima will be in touch personally to confirm the final details and answer any questions you may have.</p>
                  <p style="color:${MUTED};font-size:12px;line-height:1.7;margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;">haloe offers complementary wellness therapy to support your general wellbeing, relaxation and everyday tension. It is not a substitute for medical advice, diagnosis or treatment.</p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="padding:26px 4px 8px;border-top:1px solid ${HAIRLINE};margin-top:20px;">
                  <div style="color:${MUTED};font-size:12px;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">With warmth,<br><span style="color:${GOLD};">Halima &middot; haloe</span></div>
                  <div style="color:#6B6357;font-size:11px;margin-top:12px;font-family:Arial,Helvetica,sans-serif;">Women only &middot; Manchester</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
}

// Plain, information-dense notification for Halima with everything she needs to follow up.
function halimaEmailHtml(d) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BLACK};">
    <div style="background:${BLACK};padding:28px 16px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 16px;">
                  <div style="color:${GOLD};font-size:12px;letter-spacing:2px;text-transform:uppercase;">New booking &middot; payment received</div>
                  <h1 style="color:${CREAM};font-size:20px;font-weight:normal;margin:8px 0 0;">${esc(d.name)}</h1>
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${HAIRLINE};border-radius:12px;overflow:hidden;background:#15120D;">
                    ${detailRow('Treatment', d.treatment)}
                    ${detailRow('Payment', d.paymentLabel)}
                    ${detailRow('Amount', d.amount)}
                    ${detailRow('Date', d.date)}
                    ${detailRow('Time', d.time)}
                    ${detailRow('Location', d.location)}
                    ${detailRow('Name', d.name)}
                    ${detailRow('Phone', d.phone)}
                    ${detailRow('Email', d.email)}
                    ${detailRow('Notes', d.notes)}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 2px 0;">
                  <p style="color:${MUTED};font-size:13px;line-height:1.7;margin:0;">Reply to this email to reach ${esc(d.name)} directly${d.phone ? `, or message them on ${esc(d.phone)}` : ''}.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
}
