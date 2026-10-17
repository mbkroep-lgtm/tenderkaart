// Vangnet voor de ophaalrondes: Vercel roept dit elke dag aan.
// Tenders: als de gegevens ouder zijn dan 6 uur (werkdagen) of 26 uur (weekend). Satellieten: elke dag, als ze ouder zijn dan 30 uur.
// Is de automatische ronde van GitHub die ochtend niet gedraaid (GitHub slaat geplande taken soms over),
// dan start deze functie hem alsnog.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { json, env } from '../lib/core.js';

export async function GET(request) {
  const secret = env('CRON_SECRET');
  const auth = request.headers.get('authorization') || '';
  const fromVercel = /vercel-cron/i.test(request.headers.get('user-agent') || '');
  if (secret ? auth !== `Bearer ${secret}` : !fromVercel) return json({ error: 'Niet toegestaan.' }, 401);

  const token = env('GITHUB_TOKEN');
  if (!token) return json({ error: 'GITHUB_TOKEN ontbreekt.' }, 500);
  const repo = env('GITHUB_REPO') || 'mbkroep-lgtm/tenderkaart';
  const dispatch = async file => {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${file}/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'tendermap' },
      body: JSON.stringify({ ref: 'main' })
    });
    return r.ok ? 'gestart' : 'GitHub weigerde: ' + (await r.text()).slice(0, 200);
  };
  const out = {};

  // tenders (in het weekend draait er maar één ronde per dag)
  const day = new Date().getUTCDay(), maxAge = day === 0 || day === 6 ? 26 : 6;
  let updated = null;
  try { updated = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'tenders.json'), 'utf8')).updated; } catch {}
  const ageH = updated ? (Date.now() - Date.parse(updated)) / 3600e3 : Infinity;
  if (ageH < maxAge) out.tenders = `${ageH.toFixed(1)} uur oud, overgeslagen`;
  else out.tenders = await dispatch('update.yml');

  // satellieten (elke dag)
  let satUpdated = null;
  try { satUpdated = (await (await fetch(new URL('/starlink.json', request.url))).json()).updated; } catch {}
  const satAgeH = satUpdated ? (Date.now() - Date.parse(satUpdated)) / 3600e3 : Infinity;
  out.satellieten = satAgeH < 30 ? `${satAgeH.toFixed(1)} uur oud, overgeslagen` : await dispatch('sats.yml');

  return json(out);
}
