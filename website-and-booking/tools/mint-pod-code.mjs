// Mints a fresh single-use, 100%-off POD Football prize code for one winner.
//
//   node tools/mint-pod-code.mjs GOTW W40            -> POD-GOTW-W40
//   node tools/mint-pod-code.mjs POTM OCT            -> POD-POTM-OCT
//   node tools/mint-pod-code.mjs GOTW W41 winner@example.com   (optional: lock to the winner's email)
//
// Replaces the old shared POD-GOTW / POD-POTM codes, which were single-use
// per week/month and so couldn't serve more than one winner per period.
// Each code is type 'competition', tagged to the POD Football collaborator,
// max 1 use total (so it can't be shared on), and — like other gift-style
// codes — reopens if the winner's booking is cancelled.
import { env, sbRequest } from './_env.mjs';

const [kind, label, winnerEmail] = process.argv.slice(2);
if (!['GOTW', 'POTM'].includes(String(kind).toUpperCase()) || !label) {
  console.error('Usage: node tools/mint-pod-code.mjs <GOTW|POTM> <label e.g. W40 or OCT> [winner-email]');
  process.exit(1);
}
const code = `POD-${kind.toUpperCase()}-${label.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

const collab = await sbRequest(env, { path: '/rest/v1/collaborators?name=eq.POD%20Football&select=id&limit=1', method: 'GET' });
if (!collab?.[0]) { console.error('POD Football collaborator not found'); process.exit(1); }

const now = Math.floor(Date.now() / 1000);
try {
  await sbRequest(env, {
    path: '/rest/v1/discount_codes', method: 'POST', prefer: 'return=minimal',
    body: {
      code, type: 'competition', percent_off: 100, collaborator_id: collab[0].id,
      max_uses_total: 1, max_uses_per_customer: 1, first_time_only: false,
      valid_from: now, period: null,
      allowed_email: winnerEmail ? winnerEmail.trim().toLowerCase() : null,
      active: true, created_at: now,
    },
  });
} catch (e) {
  console.error(String(e.message).includes('23505') ? `${code} already exists.` : e.message);
  process.exit(1);
}
console.log(`Minted ${code} — 100% off, single use${winnerEmail ? `, locked to ${winnerEmail}` : ''}.`);
