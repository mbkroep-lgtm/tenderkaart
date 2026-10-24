import { writeFile } from 'node:fs/promises';
import dns from 'node:dns/promises';
let log = '';
for (const u of ['https://goszakup.gov.kz/ru/search/lots?filter%5Bname%5D=starlink&count_record=200&page=1', 'https://goszakup.gov.kz/', 'http://goszakup.gov.kz/', 'https://ows.goszakup.gov.kz/']) {
  for (let k = 0; k < 2; k++) {
    try { const t0 = Date.now(); const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0' }, signal: AbortSignal.timeout(60000) }); const b = await r.text(); log += `${u} -> ${r.status} ${Date.now() - t0}ms len=${b.length}\n`; }
    catch (e) { log += `${u} -> ERR ${e.name} ${e.message} cause=${e.cause?.code || ''} ${e.cause?.message || ''}\n`; }
  }
}
try { log += 'dns ' + JSON.stringify(await dns.lookup('goszakup.gov.kz', { all: true })) + '\n'; } catch (e) { log += 'dns ERR ' + e.message + '\n'; }
await writeFile('preview/kz.txt', log);
