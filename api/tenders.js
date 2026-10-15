// De tenders zelf: alleen voor ingelogde bezoekers met toegang.
// Door de beheerder verborgen tenders en uitsluitwoorden worden hier al weggefilterd.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { json, readSession, hasAccess, isAdmin, getHidden, getWords, applyAdminFilters, fail } from '../lib/core.js';

export async function GET(request) {
  try {
    const email = readSession(request);
    if (!email || !(await hasAccess(email))) return json({ error: 'Log in om de tenders te bekijken.' }, 401);
    const data = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'tenders.json'), 'utf8'));
    const [hidden, words] = await Promise.all([getHidden(), getWords()]);
    const all = data.tenders || [];
    data.tenders = applyAdminFilters(all, hidden, words);
    data.hiddenCount = all.length - data.tenders.length;
    if (!isAdmin(email)) delete data.sources;
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(e); }
}
