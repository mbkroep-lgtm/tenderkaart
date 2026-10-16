import { writeFile } from 'node:fs/promises';
const terms = ['低軌衛星', 'OneWeb', '星鏈', 'Starlink', '低軌'];
const out = {};
for (const q of terms) {
  try {
    const r = await fetch('https://pcc-api.openfun.app/api/searchbytitle?query=' + encodeURIComponent(q), { headers: { 'User-Agent': 'Mozilla/5.0 (tendermap)', Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    out[q] = j ? { status: r.status, total: j.total_records, pages: j.total_pages, first: j.records?.slice(0, 2), titles: j.records?.slice(0, 15).map(x => [x.date, x.brief?.type, x.brief?.title, x.unit_name]) } : { status: r.status, start: t.slice(0, 200) };
  } catch (e) { out[q] = { error: String(e.message || e) }; }
  await new Promise(r => setTimeout(r, 1500));
}
await writeFile(new URL('../data/probe.json', import.meta.url), JSON.stringify(out, null, 1));
