// Online (video) coaching sessions — creates one Zoom meeting per booking and
// returns its join link, which goes in the client's confirmation email and
// Halima's notification.
//
// Uses a Zoom *Server-to-Server OAuth* app (marketplace.zoom.us → Develop →
// Build App → Server-to-Server OAuth; scopes: meeting:write:meeting:admin).
// Cloudflare Pages secrets: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.
//
// Best-effort, same contract as the rest of the notification code: with the
// secrets unset, or on any Zoom error, this returns null and the emails say
// Halima will send the link on WhatsApp. It never throws, and a video-link
// problem must never stop a paid booking from being confirmed.

export async function createVideoMeeting(env, { topic, bookingDate, startMin, durationMin }) {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate || '') || !Number.isFinite(startMin)) return null;

  try {
    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`,
      { method: 'POST', headers: { Authorization: `Basic ${btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`)}` } },
    );
    if (!tokenRes.ok) { console.error('Zoom token error:', tokenRes.status, await tokenRes.text()); return null; }
    const { access_token } = await tokenRes.json();

    const hh = String(Math.floor(startMin / 60)).padStart(2, '0');
    const mm = String(startMin % 60).padStart(2, '0');
    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic || 'haloe coaching',
        type: 2, // scheduled
        start_time: `${bookingDate}T${hh}:${mm}:00`, // local time in `timezone` below
        timezone: 'Europe/London',
        duration: durationMin || 60,
        settings: { waiting_room: true, join_before_host: false, host_video: true, participant_video: true },
      }),
    });
    if (!res.ok) { console.error('Zoom meeting error:', res.status, await res.text()); return null; }
    const meeting = await res.json();
    return meeting.join_url ? { joinUrl: meeting.join_url } : null;
  } catch (err) {
    console.error('Zoom error:', err);
    return null;
  }
}
