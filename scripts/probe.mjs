// Tijdelijk: test welke tenderbronnen bereikbaar zijn en hoe het antwoord eruitziet.
import { writeFile } from 'node:fs/promises';
const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
const probes = {
  contractsfinder_v2: ['POST', 'https://www.contractsfinder.service.gov.uk/api/rest/2/search_notices/json', { searchCriteria: { keyword: 'starlink' }, size: 5 }],
  contractsfinder_ocds: ['GET', `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?publishedFrom=${since}&size=2`],
  prozorro_feed: ['GET', 'https://public.api.openprocurement.org/api/2.5/tenders?descending=1&limit=3&opt_fields=title,status,procuringEntity,tenderPeriod,value,dateModified,dateCreated'],
  prozorro_search: ['POST', 'https://prozorro.gov.ua/api/search/tenders', { text: 'starlink', page: 1 }],
  tenderned_papi: ['GET', 'https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties?page=0&size=5&zoekterm=satelliet'],
  tenderned_papi2: ['GET', 'https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties?page=0&size=3'],
  boamp: ['GET', 'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records?where=search(%22starlink%22)&limit=3'],
  canadabuys_csv: ['GET', 'https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv'],
  austender: ['GET', `https://api.tenders.gov.au/ocds/findByDates/contractPublished/${since}T00:00:00Z/${new Date().toISOString().slice(0,10)}T00:00:00Z`],
  colombia_secop: ['GET', 'https://www.datos.gov.co/resource/p6dx-8zbt.json?$q=starlink&$limit=3'],
  brazil_pncp: ['GET', 'https://pncp.gov.br/api/search/?q=starlink&tipos_documento=edital&pagina=1&tam_pagina=3'],
  undp: ['GET', 'https://procurement-notices.undp.org/search.cfm?cur_nego_type=&cur_countries=&cur_agency=&cur_srch_str=starlink'],
  undp_rss: ['GET', 'https://procurement-notices.undp.org/rss_feeds/rss_feed_all.xml'],
  ungm: ['POST', 'https://www.ungm.org/Public/Notice/Search', { PageIndex: 0, PageSize: 5, Title: 'starlink', Description: '', Reference: '', PublishedFrom: '', PublishedTo: '', DeadlineFrom: '', DeadlineTo: '', Countries: [], Agencies: [], UNSPSCs: [], NoticeTypes: [], SortField: 'DatePublished', SortAscending: false, isPicker: false, IsSustainable: false, NoticeDisplayType: null, NoticeSearchTotalLabelId: 'noticeSearchTotal', TypeOfCompetitions: [] }],
  simap: ['GET', 'https://www.simap.ch/api/publications/v2/project/project-search?search=starlink&lang=de'],
  gets_nz: ['GET', 'https://www.gets.govt.nz/ExternalIndex.htm'],
  ocp_registry: ['GET', 'https://data.open-contracting.org/api/publications/'],
  contrataciondelestado: ['GET', 'https://contrataciondelestado.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom']
};
const out = {};
for (const [k, [method, url, body]] of Object.entries(probes)) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
    const r = await fetch(url, { method, signal: ctl.signal, headers: { Accept: 'application/json, text/csv, application/xml, text/html', 'User-Agent': 'Mozilla/5.0 (tendermap; +https://tenderkaart.vercel.app)', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    clearTimeout(t);
    const txt = await r.text();
    out[k] = { status: r.status, type: r.headers.get('content-type'), length: txt.length, start: txt.slice(0, 2500) };
  } catch (e) { out[k] = { error: String(e.message || e).slice(0, 300) }; }
  console.log(k, out[k].status || out[k].error);
}
await writeFile(new URL('../data/probe.json', import.meta.url), JSON.stringify(out, null, 1));
