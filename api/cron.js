// Vangnet voor de dagelijkse ophaalronde: Vercel roept dit elke werkdag aan.
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

  let updated = null;
  try { updated = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'tenders.json'), 'utf8')).updated; } catch {}
  const ageH = updated ? (Date.now() - Date.parse(updated)) / 3600e3 : Infinity;
  if (ageH < 6) return json({ skipped: true, reason: `Gegevens zijn ${ageH.toFixed(1)} uur oud.` });

  const token = env('GITHUB_TOKEN');
  if (!token) return json({ error: 'GITHUB_TOKEN ontbreekt.' }, 500);
  const repo = env('GITHUB_REPO') || 'mbkroep-lgtm/tenderkaart';
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/update.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'tendermap' },
    body: JSON.stringify({ ref: 'main' })
  });
  if (!r.ok) return json({ error: 'GitHub weigerde: ' + (await r.text()).slice(0, 200) }, 502);
  return json({ started: true, previousUpdate: updated });
}
