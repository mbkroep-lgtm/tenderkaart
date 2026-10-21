// Stap 1: e-mailadres invullen. Medewerkers (en wie de beheerder toegang gaf) krijgen een inlogcode per e-mail.
import { json, normEmail, validEmail, hasAccess, sendCode, readJson, requireLogin, allowedDomains, fail } from '../lib/core.js';

export async function POST(request) {
  try {
    const email = normEmail((await readJson(request)).email);
    if (!validEmail(email)) return json({ error: 'Vul een geldig e-mailadres in.' }, 400);
    if (await hasAccess(email)) {
      const r = await sendCode(email);
      return json({ status: 'code_sent', email, recent: r === 'wait' });
    }
    const doms = allowedDomains().map(d => '@' + d).join(' of ');
    if (!requireLogin()) return json({ error: `Inloggen is alleen voor medewerkers van BroadbandEU (${doms}).` }, 403);
    return json({ error: `Deze kaart is alleen voor medewerkers van BroadbandEU. Log in met je ${doms}-adres.` }, 403);
  } catch (e) { return fail(e); }
}
