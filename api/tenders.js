// De tenders zelf: alleen voor ingelogde bezoekers met toegang.
// Door de beheerder verborgen tenders en uitsluitwoorden worden hier al weggefilterd.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { json, readSession, hasAccess, isAdmin, getHidden, getWords, getNoStar, getBids, getBidBy, getMaintenance, getOwners, getStaff, applyAdminFilters, requireLogin, fail } from '../lib/core.js';

export async function GET(request) {
  try {
    const email = readSession(request);
    if (requireLogin() && (!email || !(await hasAccess(email)))) return json({ error: 'Log in om de tenders te bekijken.' }, 401);
    // onderhoud: alleen beheerders kunnen erin
    let m = null; try { m = await getMaintenance(); } catch {}
    if (m && m.on && !isAdmin(email)) return json({ maintenance: true, message: m.message || '' }, 503);
    const data = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'tenders.json'), 'utf8'));
    // verborgen tenders en uitsluitwoorden; lukt de database even niet, dan toch de kaart tonen
    let hidden = [], words = [], bids = {}, bidBy = {}, owners = {}, staff = [];
    try { [hidden, words, bids, bidBy, owners, staff] = await Promise.all([getHidden(), getWords(), getBids(), getBidBy(), getOwners(), getStaff()]); } catch (e) { console.error(e); }
    data.nostar = await getNoStar();
    data.bids = bids;
    // namen alleen voor ingelogde medewerkers
    data.bidBy = email ? bidBy : {};
    data.owners = email ? owners : {};
    data.staff = email ? [...new Set([...staff, email])].sort() : [];
    const all = data.tenders || [];
    data.tenders = applyAdminFilters(all, hidden, words);
    data.hiddenCount = all.length - data.tenders.length;
    data.build = process.env.VERCEL_GIT_COMMIT_SHA || '';   // nieuwe versie van de site of gegevens: open pagina's verversen zich
    if (!isAdmin(email)) delete data.sources;
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(e); }
}
