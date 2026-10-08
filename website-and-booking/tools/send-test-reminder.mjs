// Sends the Day 1 (or Day 7) aftercare reminder email to a TEST client right now, so you can check how it looks.
//   node website-and-booking/tools/send-test-reminder.mjs [email] [day]
// Defaults: contact.haloe@gmail.com, day 1. The server refuses anyone who isn't flagged is_test.
// Needs CRON_SECRET in .dev.vars (same value as the Cloudflare secret) and the /aftercare-cron Function deployed.
import { env } from './_env.mjs';

const email = process.argv[2] || 'contact.haloe@gmail.com';
const day = Number(process.argv[3] || 1);
if (!env.CRON_SECRET) { console.error('CRON_SECRET is missing from .dev.vars'); process.exit(1); }
const res = await fetch('https://haloe.health/aftercare-cron', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
  body: JSON.stringify({ test_reminder: { email, day } }),
});
console.log(res.status, await res.text());
