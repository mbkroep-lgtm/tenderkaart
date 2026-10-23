import { writeFile } from 'node:fs/promises';
const base = 'https://ocds-api.etenders.gov.za/api/OCDSReleases';
const days = ['2026-10-02','2026-10-09','2026-10-15','2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'];
const next = d => new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
const tries = [];
for (const d of days) tries.push(`?PageNumber=1&PageSize=50&dateFrom=${d}&dateTo=${next(d)}`);
tries.push('?PageNumber=2&PageSize=50&dateFrom=2026-10-20&dateTo=2026-10-21', '?PageNumber=5&PageSize=50&dateFrom=2026-10-20&dateTo=2026-10-21',
  '?PageNumber=1&PageSize=200&dateFrom=2026-10-20&dateTo=2026-10-21', '?PageNumber=1&PageSize=50&dateFrom=2026-10-20&dateTo=2026-10-22');
let log = '';
for (const q of tries) {
  for (let k = 0; k < 2; k++) {
    try {
      const r = await fetch(base + q, { headers: { 'User-Agent': 'Mozilla/5.0 (tendermap)', Accept: 'application/json' }, signal: AbortSignal.timeout(90000) });
      const b = await r.text(); let n = ''; try { const d = JSON.parse(b); n = `rel=${(d.releases || []).length} next=${(d.links?.next||'').slice(-80)}`; } catch {}
      log += `${q} #${k} -> ${r.status} ${n || b.slice(0, 150).replace(/\s+/g, ' ')}\n`;
    } catch (e) { log += `${q} -> ERR ${e.message}\n`; }
  }
}
await writeFile('preview/za2.txt', log);
