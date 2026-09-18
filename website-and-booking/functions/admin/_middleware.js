// Cloudflare Pages Functions middleware — applies to every request under
// /admin and /admin/* (both the HTML page and the /admin/bookings JSON API),
// so neither is reachable without the admin password. HTTP Basic Auth is
// enough here: it's stateless, every browser handles the prompt/caching for
// us, and it covers the API route with zero extra code.
//
// Env var (set in the Cloudflare Pages dashboard, never in code):
//   ADMIN_PASSWORD — required. Any username is accepted; only the password
//                    is checked.

export async function onRequest(context) {
  const expected = context.env.ADMIN_PASSWORD;
  if (!expected) {
    return new Response('Admin is not configured — set ADMIN_PASSWORD in the Pages dashboard.', { status: 500 });
  }

  const authHeader = context.request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Basic ')) {
    let decoded = '';
    try {
      decoded = atob(authHeader.slice(6));
    } catch (e) {
      decoded = '';
    }
    const separatorIndex = decoded.indexOf(':');
    const password = separatorIndex === -1 ? '' : decoded.slice(separatorIndex + 1);
    if (password && constantTimeEqual(password, expected)) {
      return context.next();
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="haloe admin"',
      'Cache-Control': 'no-store',
    },
  });
}

// Avoid leaking the password's length/content through response-time
// differences on a byte-by-byte comparison.
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
