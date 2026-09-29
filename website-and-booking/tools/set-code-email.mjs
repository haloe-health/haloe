// Locks a discount code to one email (allowed_email), or clears the lock.
//
//   node tools/set-code-email.mjs GUEST-YASMZEE yasmin@example.com
//   node tools/set-code-email.mjs GUEST-YASMZEE --clear
//
// Equivalent SQL:
//   update public.discount_codes set allowed_email = lower('yasmin@example.com') where code = 'GUEST-YASMZEE';
import { env, sbRequest } from './_env.mjs';

const [rawCode, arg] = process.argv.slice(2);
if (!rawCode || !arg) { console.error('Usage: node tools/set-code-email.mjs <CODE> <email | --clear>'); process.exit(1); }
const code = rawCode.trim().toUpperCase();
const email = arg === '--clear' ? null : arg.trim().toLowerCase();
if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error('That does not look like an email address.'); process.exit(1); }

const rows = await sbRequest(env, {
  path: `/rest/v1/discount_codes?code=eq.${encodeURIComponent(code)}`, method: 'PATCH',
  prefer: 'return=representation', body: { allowed_email: email },
});
if (!rows?.length) { console.error(`No code named ${code}.`); process.exit(1); }
console.log(`${rows[0].code}: allowed_email = ${rows[0].allowed_email ?? '(none — usable by anyone)'}`);
