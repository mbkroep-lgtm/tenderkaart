// Inschrijfstatus van een tender zetten: mag iedere ingelogde medewerker. We onthouden wie het deed en wanneer.
import { json, readSession, hasAccess, isAdmin, redis, readJson, fail } from '../lib/core.js';

const STATUSES = ['ingeschreven', 'gewonnen', 'verloren', 'geen'];
export async function POST(request) {
  try {
    const email = readSession(request);
    if (!email || !(isAdmin(email) || await hasAccess(email))) return json({ error: 'Log in om de inschrijfstatus te zetten.' }, 401);
    const b = await readJson(request);
    const pub = String(b.pub || '').slice(0, 120), st = String(b.status || '');
    if (!pub) return json({ error: 'Geen tender opgegeven.' }, 400);
    if (!st) { await redis('HDEL', 'bids', pub); await redis('HDEL', 'bidby', pub); return json({ ok: true }); }
    if (!STATUSES.includes(st)) return json({ error: 'Onbekende status.' }, 400);
    const by = { by: email, at: new Date().toISOString() };
    await redis('HSET', 'bids', pub, st);
    await redis('HSET', 'bidby', pub, JSON.stringify(by));
    return json({ ok: true, ...by });
  } catch (e) { return fail(e); }
}
