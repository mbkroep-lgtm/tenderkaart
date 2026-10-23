import { writeFile } from 'node:fs/promises';
const base = 'https://ocds-api.etenders.gov.za/api/OCDSReleases';
const tries = [
  '?PageNumber=1&PageSize=1000&dateFrom=2026-10-20&dateTo=2026-10-20',
  '?PageNumber=1&PageSize=100&dateFrom=2026-10-20&dateTo=2026-10-20',
  '?PageNumber=1&PageSize=50&dateFrom=2026-10-20&dateTo=2026-10-21',
  '?PageNumber=1&PageSize=50&dateFrom=2026-10-01&dateTo=2026-10-22',
  '?PageNumber=1&PageSize=50',
  '?PageNumber=1&PageSize=50&dateFrom=2026-10-20T00:00:00&dateTo=2026-10-20T23:59:59',
  '?PageNumber=1&PageSize=50&dateFrom=2026-09-01&dateTo=2026-09-01',
];
let log = '';
for (const q of tries) {
  try {
    const t0 = Date.now();
    const r = await fetch(base + q, { headers: { 'User-Agent': 'Mozilla/5.0 (tendermap)', Accept: 'application/json' }, signal: AbortSignal.timeout(90000) });
    const b = await r.text();
    let n = ''; try { const d = JSON.parse(b); n = `releases=${(d.releases || []).length} next=${!!d.links?.next}`; } catch {}
    log += `${q} -> ${r.status} ${Date.now() - t0}ms ${n} ${n ? '' : b.slice(0, 300).replace(/\s+/g, ' ')}\n`;
  } catch (e) { log += `${q} -> ERR ${e.message}\n`; }
}
for (const u of ['https://ocds-api.etenders.gov.za/swagger/v1/swagger.json', 'https://ocds-api.etenders.gov.za/', 'https://data.etenders.gov.za/']) {
  try { const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); log += `${u} -> ${r.status} ${(await r.text()).slice(0, 1500).replace(/\s+/g, ' ')}\n`; } catch (e) { log += `${u} -> ERR ${e.message}\n`; }
}
await writeFile('preview/za.txt', log);
