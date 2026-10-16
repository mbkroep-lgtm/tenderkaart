import { writeFile } from 'node:fs/promises';
const r = await fetch('https://prozorro.gov.ua/api/search/tenders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (tendermap)' }, body: JSON.stringify({ text: 'UA-2026-10-07-005482-a', page: 1 }) });
const d = await r.json();
const x = (d.data || []).find(t => t.tenderID === 'UA-2026-10-07-005482-a') || d.data?.[0];
let full = null;
try { const p = await fetch('https://prozorro.gov.ua/api/tenders/UA-2026-10-07-005482-a', { headers: { 'User-Agent': 'Mozilla/5.0' } }); full = (await p.text()).slice(0, 4000); } catch (e) { full = String(e); }
await writeFile(new URL('../data/probe.json', import.meta.url), JSON.stringify({ search: x, full }, null, 1));
