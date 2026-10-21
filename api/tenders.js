// De tenders zelf: alleen voor ingelogde bezoekers met toegang.
// Door de beheerder verborgen tenders en uitsluitwoorden worden hier al weggefilterd.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { json, readSession, hasAccess, isAdmin, getHidden, getWords, getNoStar, getBids, applyAdminFilters, requireLogin, fail } from '../lib/core.js';

export async function GET(request) {
  try {
    const email = readSession(request);
    if (requireLogin() && (!email || !(await hasAccess(email)))) return json({ error: 'Log in om de tenders te bekijken.' }, 401);
    const data = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'tenders.json'), 'utf8'));
    // verborgen tenders en uitsluitwoorden; lukt de database even niet, dan toch de kaart tonen
    let hidden = [], words = [], bids = {};
    try { [hidden, words, bids] = await Promise.all([getHidden(), getWords(), getBids()]); } catch (e) { console.error(e); }
    data.nostar = await getNoStar();
    data.bids = bids;
    const all = data.tenders || [];
    data.tenders = applyAdminFilters(all, hidden, words);
    data.hiddenCount = all.length - data.tenders.length;
    data.build = process.env.VERCEL_GIT_COMMIT_SHA || '';   // nieuwe versie van de site of gegevens: open pagina's verversen zich
    if (!isAdmin(email)) delete data.sources;
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(e); }
}
