// Beheer: alleen voor adressen in ADMIN_EMAILS.
// GET  → overzicht (bronnen, verborgen tenders, uitsluitwoorden, gratis toegang, klanten)
// POST → { action, ... } om iets te wijzigen
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { json, readSession, isAdmin, redis, getHidden, getWords, normEmail, validEmail, env, readJson, fail } from '../lib/core.js';

async function guard(request) {
  const email = readSession(request);
  return email && isAdmin(email) ? email : null;
}

async function customers() {
  const out = [];
  let cursor = '0';
  for (let i = 0; i < 50; i++) {
    const [next, keys] = await redis('SCAN', cursor, 'MATCH', 'paid:*', 'COUNT', 500);
    if (keys.length) {
      const vals = await redis('MGET', ...keys);
      keys.forEach((k, j) => {
        let v = {}; try { v = JSON.parse(vals[j] || '{}'); } catch {}
        out.push({ email: k.slice(5), at: v.at || '', session: v.session || '', manual: !!v.manual });
      });
    }
    cursor = String(next);
    if (cursor === '0') break;
  }
  return out.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

// Voortgang van de laatste ophaalronde op GitHub
async function latestRun() {
  const token = env('GITHUB_TOKEN');
  if (!token) return json({ error: 'GITHUB_TOKEN ontbreekt.' }, 400);
  const repo = env('GITHUB_REPO') || 'mbkroep-lgtm/tenderkaart';
  const gh = async u => {
    const r = await fetch(`https://api.github.com/repos/${repo}${u}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'tendermap' } });
    if (!r.ok) throw new Error('GitHub gaf ' + r.status);
    return r.json();
  };
  const runs = await gh('/actions/workflows/update.yml/runs?per_page=3');
  const run = (runs.workflow_runs || [])[0];
  if (!run) return json({ run: null });
  let steps = [];
  try {
    const jobs = await gh(`/actions/runs/${run.id}/jobs`);
    steps = (jobs.jobs?.[0]?.steps || []).map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion, started_at: s.started_at, completed_at: s.completed_at }));
  } catch { /* stappen zijn er nog niet */ }
  return json({ run: { id: run.id, status: run.status, conclusion: run.conclusion, event: run.event, created_at: run.created_at,
    started_at: run.run_started_at, updated_at: run.updated_at, url: run.html_url }, steps, now: new Date().toISOString() });
}

export async function GET(request) {
  try {
    const me = await guard(request);
    if (!me) return json({ error: 'Alleen voor beheerders.' }, 403);
    if (new URL(request.url).searchParams.get('runs')) return await latestRun();
    const data = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'tenders.json'), 'utf8'));
    const [hidden, words, freeEmails, freeDomains, cust] = await Promise.all([
      getHidden(), getWords(), redis('SMEMBERS', 'free:emails'), redis('SMEMBERS', 'free:domains'), customers()
    ]);
    return json({
      me,
      updated: data.updated, sources: data.sources || {},
      tenders: (data.tenders || []).map(t => ({ pub: t.pub, title: t.title, source: t.source, country: t.country, countryName: t.countryName, published: t.published, deadline: t.deadline, kind: t.kind, link: t.link })),
      hidden, words,
      free: { emails: freeEmails || [], domains: freeDomains || [], envDomains: env('FREE_DOMAINS'), envEmails: env('FREE_EMAILS') },
      customers: cust,
      canRefresh: !!env('GITHUB_TOKEN')
    });
  } catch (e) { return fail(e); }
}

export async function POST(request) {
  try {
    const me = await guard(request);
    if (!me) return json({ error: 'Alleen voor beheerders.' }, 403);
    const b = await readJson(request);
    const pub = String(b.pub || '').slice(0, 120);
    switch (b.action) {
      case 'hide':
        if (!pub) return json({ error: 'Geen tender opgegeven.' }, 400);
        await redis('SADD', 'hidden', pub); return json({ ok: true });
      case 'unhide':
        await redis('SREM', 'hidden', pub); return json({ ok: true });
      case 'words': {
        const words = [...new Set((Array.isArray(b.words) ? b.words : []).map(w => String(w).trim()).filter(w => w.length >= 2 && w.length <= 60))].slice(0, 200);
        await redis('SET', 'exclude:words', JSON.stringify(words)); return json({ ok: true, words });
      }
      case 'free-add': case 'free-remove': {
        const v = normEmail(b.value).replace(/^@/, '');
        const isDomain = !v.includes('@');
        if (isDomain ? !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v) : !validEmail(v)) return json({ error: 'Vul een geldig e-mailadres of domein in (bv. naam@bedrijf.nl of bedrijf.nl).' }, 400);
        await redis(b.action === 'free-add' ? 'SADD' : 'SREM', isDomain ? 'free:domains' : 'free:emails', v);
        return json({ ok: true });
      }
      case 'grant': { // handmatig toegang geven zoals na een betaling (bv. bij betaling per factuur)
        const e = normEmail(b.value);
        if (!validEmail(e)) return json({ error: 'Vul een geldig e-mailadres in.' }, 400);
        await redis('SET', `paid:${e}`, JSON.stringify({ at: new Date().toISOString(), session: 'handmatig door ' + me, manual: true }));
        return json({ ok: true });
      }
      case 'revoke': {
        const e = normEmail(b.value);
        await redis('DEL', `paid:${e}`); return json({ ok: true });
      }
      case 'refresh': {
        const token = env('GITHUB_TOKEN');
        if (!token) return json({ error: 'Verversen vanaf hier is nog niet ingesteld (GITHUB_TOKEN ontbreekt).' }, 400);
        const repo = env('GITHUB_REPO') || 'mbkroep-lgtm/tenderkaart';
        const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/update.yml/dispatches`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'tendermap' },
          body: JSON.stringify({ ref: 'main' })
        });
        if (!r.ok) return json({ error: 'GitHub weigerde het verversen: ' + (await r.text()).slice(0, 200) }, 502);
        return json({ ok: true });
      }
      default:
        return json({ error: 'Onbekende actie.' }, 400);
    }
  } catch (e) { return fail(e); }
}
