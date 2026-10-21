// Tv op kantoor: eenmalig openen via /api/tvlogin?key=<TV_KEY>; daarna blijft de tv een jaar ingelogd.
import crypto from 'node:crypto';
import { env, sessionCookie, json } from '../lib/core.js';

export async function GET(request) {
  const key = env('TV_KEY');
  const given = new URL(request.url).searchParams.get('key') || '';
  const ok = key.length >= 16 && given.length === key.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!ok) return json({ error: 'Onjuiste of ontbrekende tv-sleutel.' }, 403);
  return new Response(null, { status: 302, headers: { Location: '/?tv=1', 'Set-Cookie': sessionCookie('tv@broadbandeu.com', 365) } });
}
