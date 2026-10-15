import { writeFile } from 'node:fs/promises';
const J = { 'Content-Type': 'application/json' };
const probes = {
  tn_zoek1: ['GET', 'https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties?page=0&size=3&search=starlink'],
  tn_zoek2: ['GET', 'https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties?page=0&size=3&zoekTerm=starlink'],
  tn_zoek3: ['GET', 'https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties?page=0&size=3&q=starlink'],
  tn_zoek4: ['GET', 'https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties/zoeken?page=0&size=3&zoekterm=starlink'],
  tn_zoek5: ['GET', 'https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties?page=0&size=3&trefwoord=starlink'],
  pz_status: ['POST', 'https://prozorro.gov.ua/api/search/tenders', { text: 'starlink', status: ['active.tendering'], page: 1 }],
  pz_date: ['POST', 'https://prozorro.gov.ua/api/search/tenders', { text: 'starlink', date: { tender_start: [new Date(Date.now()-60*864e5).toISOString().slice(0,10), new Date().toISOString().slice(0,10)] }, page: 1 }],
  pz_sort: ['POST', 'https://prozorro.gov.ua/api/search/tenders', { text: 'starlink', sort: 'publication_date', order: 'desc', page: 1 }],
  pz_plain: ['POST', 'https://prozorro.gov.ua/api/search/tenders', { text: 'starlink', page: 1 }],
  cf_full: ['POST', 'https://www.contractsfinder.service.gov.uk/api/rest/2/search_notices/json', { searchCriteria: { keyword: 'starlink' }, size: 2 }],
  boamp_full: ['GET', 'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records?where=search(%22starlink%22)&limit=1&select=idweb,objet,dateparution,datelimitereponse,nomacheteur,nature,nature_libelle,type_marche,code_departement,etat,descripteur_libelle,url_avis'],
  pncp_full: ['GET', 'https://pncp.gov.br/api/search/?q=starlink&tipos_documento=edital&pagina=1&tam_pagina=2&ordenacao=-data'],
  secop_full: ['GET', 'https://www.datos.gov.co/resource/p6dx-8zbt.json?$q=starlink&$limit=1&$order=fecha_de_publicacion_del%20DESC'],
  simap_sat: ['GET', 'https://www.simap.ch/api/publications/v2/project/project-search?search=satellit&lang=de'],
  undp_rows: ['GET', 'https://procurement-notices.undp.org/search.cfm?cur_nego_type=&cur_countries=&cur_agency=&cur_srch_str=starlink', null, 'starlink'],
  austender_one: ['GET', `https://api.tenders.gov.au/ocds/findByDates/contractPublished/${new Date(Date.now()-3*864e5).toISOString().slice(0,10)}T00:00:00Z/${new Date().toISOString().slice(0,10)}T00:00:00Z`, null, 'releases']
};
const out = {};
for (const [k, [method, url, body, around]] of Object.entries(probes)) {
  try {
    const r = await fetch(url, { method, headers: { Accept: 'application/json, text/html', 'User-Agent': 'Mozilla/5.0 (tendermap)', ...(body ? J : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    const txt = await r.text();
    let start = txt.slice(0, 3500);
    if (around) { const i = txt.toLowerCase().indexOf(around); if (i >= 0) start = txt.slice(Math.max(0, i - 2500), i + 2500); }
    out[k] = { status: r.status, length: txt.length, start };
  } catch (e) { out[k] = { error: String(e.message || e).slice(0, 300) }; }
  console.log(k, out[k].status || out[k].error);
}
await writeFile(new URL('../data/probe.json', import.meta.url), JSON.stringify(out, null, 1));
