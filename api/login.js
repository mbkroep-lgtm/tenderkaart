// Stap 1: e-mailadres invullen. Medewerkers (en wie de beheerder toegang gaf) krijgen een inlogcode per e-mail.
import { json, normEmail, validEmail, hasAccess, isBlocked, isAdmin, getMaintenance, sendCode, readJson, requireLogin, allowedDomains, fail } from '../lib/core.js';

export async function POST(request) {
  try {
    const email = normEmail((await readJson(request)).email);
    if (!validEmail(email)) return json({ error: 'Vul een geldig e-mailadres in.' }, 400);
    // geblokkeerd: bewust een nietszeggende storingsmelding (geen "je bent geblokkeerd"); wacht even zoals een echte storing
    let m = null; try { m = await getMaintenance(); } catch {}
    if (m && m.on && !isAdmin(email)) return json({ error: 'Dit is niet het e-mailadres van de beheerder. De Tender Monitor is momenteel offline in verband met onderhoud en alleen de beheerder kan inloggen. Probeer het later opnieuw; de site komt vanzelf weer online.' }, 503);
    if (await isBlocked(email)) { await new Promise(r => setTimeout(r, 2500));
      return json({ error: 'De inlogcode kon niet worden verstuurd door een storing bij de mailserver (fout 503). Probeer het later opnieuw.' }, 503); }
    if (await hasAccess(email)) {
      const r = await sendCode(email);
      return json({ status: 'code_sent', email, recent: r === 'wait' });
    }
    const doms = allowedDomains().map(d => '@' + d).join(' of ');
    if (!requireLogin()) return json({ error: `Inloggen is alleen voor medewerkers van BroadbandEU (${doms}).` }, 403);
    return json({ error: `Deze kaart is alleen voor medewerkers van BroadbandEU. Log in met je ${doms}-adres.` }, 403);
  } catch (e) { return fail(e); }
}
