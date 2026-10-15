// Tijdelijk: telt per zoekterm hoeveel TED-berichten er zijn.
import { writeFile } from 'node:fs/promises';
const API = 'https://api.ted.europa.eu/v3/notices/search';
const tests = {
  sat_cpv: 'classification-cpv IN (32531000 32532000 32533000 32534000)',
  ft_starlink: 'FT ~ "starlink"',
  ft_starlink_noquote: 'FT ~ starlink',
  ft_mobile: 'FT ~ "mobile connectivity"',
  ft_or_list: 'FT ~ ("mobile connectivity" OR "starlink")',
  ft_or_sep: '(FT ~ "mobile connectivity") OR (FT ~ "starlink")',
  ft_satcom: 'FT ~ "satcom"',
  ft_vsat: 'FT ~ "VSAT"',
  ft_emergency: 'FT ~ "emergency communication"',
  ft_satinternet: 'FT ~ "satellite internet"',
  ft_satelliet_nl: 'FT ~ "satellietverbinding"',
  ft_word_satellite: 'FT ~ satellite',
  title_starlink: 'notice-title ~ starlink',
  title_satellite: 'notice-title ~ satellite'
};
const out = {};
for (const [k, q] of Object.entries(tests)) {
  for (const scope of ['ACTIVE', 'ALL']) {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, fields: ['publication-number'], scope, limit: 1, page: 1 }) });
      const t = await r.text();
      out[`${k}|${scope}`] = r.ok ? JSON.parse(t).totalNoticeCount : `HTTP ${r.status}: ${t.slice(0, 200)}`;
    } catch (e) { out[`${k}|${scope}`] = 'fout ' + e.message; }
  }
}
await writeFile(new URL('../data/diag.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out);
