// Stap 3: code invullen. Klopt de code, dan krijgt de bezoeker een sessie-cookie.
import { json, normEmail, validEmail, hasAccess, checkCode, sessionCookie, readJson, fail } from '../lib/core.js';

const MESSAGES = {
  wrong: 'Deze code klopt niet. Controleer de code in je e-mail.',
  expired: 'Deze code is verlopen. Vraag een nieuwe code aan.',
  locked: 'Te vaak een verkeerde code ingevuld. Vraag een nieuwe code aan.'
};

export async function POST(request) {
  try {
    const body = await readJson(request);
    const email = normEmail(body.email);
    if (!validEmail(email)) return json({ error: 'Vul een geldig e-mailadres in.' }, 400);
    if (!(await hasAccess(email))) return json({ error: 'Voor dit e-mailadres is nog niet betaald.' }, 402);
    const r = await checkCode(email, body.code);
    if (r !== 'ok') return json({ error: MESSAGES[r] }, 401);
    return json({ ok: true, email }, 200, { 'Set-Cookie': sessionCookie(email) });
  } catch (e) { return fail(e); }
}
