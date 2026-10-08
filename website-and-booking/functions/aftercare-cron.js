// Cloudflare Pages Function — POST /aftercare-cron
//
// Called once an hour by Supabase (pg_cron → pg_net, see run_aftercare_cron() in supabase-app-schema.sql) with the
// header  x-cron-secret: <CRON_SECRET>. Sends the Day 1 / Day 7 aftercare reminders and purges photos past their
// 90-day retention. Without the right secret it does nothing. Env: CRON_SECRET (secret), RESEND_API_KEY, VAPID_*,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { runAftercare } from './_aftercare.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// constant-time comparison
function same(a, b) {
  const x = new TextEncoder().encode(String(a)), y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.CRON_SECRET) return json({ error: 'not_configured' }, 503);
  if (!same(request.headers.get('x-cron-secret') || '', env.CRON_SECRET)) return json({ error: 'unauthorised' }, 401);
  const r = await runAftercare(env);
  return json({ ok: true, ...r });
}
