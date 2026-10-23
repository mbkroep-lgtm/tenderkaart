import { writeFile } from 'node:fs/promises';
let log = '';
const body = `type=search_anuncios&version=133.0&query=${encodeURIComponent('texto=starlink')}&sort=-drPublicationDate&page=0&size=100`;
for (const [u, opt] of [
  ['https://www.base.gov.pt/Base4/pt/resultados/', { method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0 (tendermap)', 'Content-Type': 'application/x-www-form-urlencoded' }, body }],
  ['https://www.base.gov.pt/Base4/pt/resultados/', { method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://www.base.gov.pt', Referer: 'https://www.base.gov.pt/Base4/pt/pesquisa/' }, body }],
  ['https://www.base.gov.pt/', {}],
  ['https://base.gov.pt/', {}],
  ['http://www.base.gov.pt/', {}],
]) {
  try { const t0 = Date.now(); const r = await fetch(u, { ...opt, signal: AbortSignal.timeout(60000) }); const b = await r.text(); log += `${opt.method || 'GET'} ${u} -> ${r.status} ${Date.now() - t0}ms ${b.slice(0, 200).replace(/\s+/g, ' ')}\n`; }
  catch (e) { log += `${opt.method || 'GET'} ${u} -> ERR ${e.name} ${e.message} cause=${e.cause?.code || ''} ${e.cause?.message || ''}\n`; }
}
const dns = await import('node:dns/promises');
try { log += 'dns ' + JSON.stringify(await dns.lookup('www.base.gov.pt', { all: true })) + '\n'; } catch (e) { log += 'dns ERR ' + e.message + '\n'; }
await writeFile('preview/pt.txt', log);
