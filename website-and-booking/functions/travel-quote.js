// GET /travel-quote?postcode=M1+1AA — the one place the browser asks for a
// home-visit travel fee, so the bands live only in _travel.js. Preview only:
// create-checkout.js recomputes the fee itself and never trusts this.
import { travelQuote, travelLabelFor } from './_travel.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = await travelQuote(url.searchParams.get('postcode'));
  const body = q.valid
    ? { valid: true, zone: q.zone, pence: q.pence, label: travelLabelFor(q.zone), lookupFailed: !!q.lookupFailed }
    : { valid: false };
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
