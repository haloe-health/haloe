// Shared Supabase REST (PostgREST) helper — no SDK, matching the
// dependency-free style of the other Functions. The `_` prefix keeps it
// from becoming a route.

// Calls the Supabase REST API with the service-role key, which bypasses Row
// Level Security. The key goes in both the apikey header and the Bearer
// token — PostgREST needs both. Throws on a non-2xx response. Parses and
// returns JSON when the response has a body (e.g. return=representation, or
// a POST /rpc/* call, which returns its function's result directly).
export async function sbRequest(env, { path, method, prefer, body }) {
  const baseUrl = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured');
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} responded ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
