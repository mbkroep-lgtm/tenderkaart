import { writeFile } from 'node:fs/promises';
const probes = {
  taiwan_g0v: 'https://pcc-api.openfun.app/api/searchbytitle?query=starlink',
  taiwan_g0v_sat: 'https://pcc-api.openfun.app/api/searchbytitle?query=%E8%A1%9B%E6%98%9F',
  taiwan_pcc: 'https://web.pcc.gov.tw/prkms/tender/common/basic/indexTenderBasic',
  adb_rss: 'https://www.adb.org/projects/tenders/rss',
  adb_search: 'https://www.adb.org/projects/tenders?terms=starlink',
  afdb: 'https://www.afdb.org/en/projects-and-operations/procurement',
  iadb: 'https://www.iadb.org/en/how-we-can-work-together/procurement/procurement-projects/project-procurement',
  maldives: 'https://bandeyri.gov.mv',
  timor: 'https://www.eprocurement.gov.tl',
  hk_data: 'https://data.gov.hk/en-data/dataset?q=tender',
  openopps: 'https://openopps.com/sources/'
};
const out = {};
for (const [k, url] of Object.entries(probes)) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (tendermap)', Accept: 'application/json, application/rss+xml, text/html' }, signal: AbortSignal.timeout(30000) });
    const t = await r.text();
    const i = t.toLowerCase().indexOf('starlink');
    out[k] = { status: r.status, type: r.headers.get('content-type'), length: t.length, start: t.slice(0, 1200), hit: i >= 0 ? t.slice(Math.max(0, i - 400), i + 600) : null };
  } catch (e) { out[k] = { error: String(e.message || e).slice(0, 200) }; }
}
await writeFile(new URL('../data/probe.json', import.meta.url), JSON.stringify(out, null, 1));
