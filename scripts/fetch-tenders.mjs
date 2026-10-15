// Haalt LEO-satelliettenders (Starlink, OneWeb, Amazon Leo, Project Kuiper) op uit:
//  - TED (Europese Unie, plus Noorwegen, IJsland enz.)
//  - Wereldbank (projecten wereldwijd)
//  - Find a Tender (Verenigd Koninkrijk)
// en werkt data/tenders.json bij. Draait automatisch via GitHub Actions.
// Valt één bron uit, dan blijven de bestaande berichten van die bron gewoon staan.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const FILE = new URL('../data/tenders.json', import.meta.url);
const NOW = new Date();
const DAY = 864e5;
const isoDay = d => new Date(d).toISOString().slice(0, 10);

// ---------- Wat telt als LEO ----------
const BRANDS = ['starlink', 'OneWeb', 'Project Kuiper', 'Amazon Leo']; // los "Kuiper" is ook een Nederlandse achternaam
// Alleen vaste combinaties: los "LEO" geeft veel ruis (Leopard, namen, woorden in andere talen).
const PHRASES = ['LEO satellite', 'LEO satellites', 'LEO satellite internet', 'LEO connectivity', 'LEO-satelliet', 'LEO-satellieten',
  'LEO-Satellit', 'LEO-Satelliten', 'satellite LEO', 'satellites LEO', 'satélite LEO', 'satélites LEO', 'satellite a bassa orbita',
  'satelliti LEO', 'satelity LEO', 'low earth orbit satellite', 'low earth orbit satellites', 'low-earth orbit satellite'];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEO_RE = new RegExp('(^|[^\\p{L}])(' + [...BRANDS, ...PHRASES].map(t => esc(t).replace(/[ -]/g, '[ -]?')).join('|') + ')([^\\p{L}]|$)', 'iu');
// Ruimtevaarthardware en andere zaken die niets met verbindingen voor klanten te maken hebben.
const EXCLUDE_RE = /(inter-?satellite|intersatellit|launch service|trägerrakete|lanceerdienst|telescope|teleskop|flight[- ]model|raumfahrzeug|spacecraft|missile|space station|destination contract|ruimtestation)/i;
// Telecom: hoofdcategorie (eerste CPV-code) apparatuur (32…) of diensten (64…). Zonder CPV: laten staan.
const isTelecom = t => !t.cpv?.length || /^(32|64)/.test(t.cpv[0]);
const keep = t => isTelecom(t) && !EXCLUDE_RE.test(t.title || '');

// Bewaar berichten tot ruim een jaar na publicatie, of zolang de sluitingsdatum nog komt.
const HISTORY_DAYS = 400;
const histCutoff = isoDay(NOW - HISTORY_DAYS * DAY);
const recent = t => (t.deadline && t.deadline >= isoDay(NOW)) || (t.published || '') >= histCutoff;

// ---------- Landen (naam → ISO2) ----------
const en = new Intl.DisplayNames(['en'], { type: 'region' });
const NAME2ISO = {};
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b); const name = en.of(code);
  if (name && name !== code) NAME2ISO[name.toLowerCase()] = code;
}
Object.assign(NAME2ISO, {
  'congo, democratic republic of': 'CD', 'congo, dem. rep.': 'CD', 'democratic republic of congo': 'CD', 'congo, republic of': 'CG', 'congo, rep.': 'CG',
  'yemen, republic of': 'YE', 'egypt, arab republic of': 'EG', 'iran, islamic republic of': 'IR', "lao people's democratic republic": 'LA',
  'micronesia, federated states of': 'FM', 'gambia, the': 'GM', 'bahamas, the': 'BS', 'venezuela, republica bolivariana de': 'VE',
  'kyrgyz republic': 'KG', 'slovak republic': 'SK', 'turkiye': 'TR', 'turkey': 'TR', "cote d'ivoire": 'CI', 'korea, republic of': 'KR',
  'west bank and gaza': 'PS', 'syrian arab republic': 'SY', 'st. lucia': 'LC', 'st. vincent and the grenadines': 'VC', 'st. kitts and nevis': 'KN',
  'russian federation': 'RU', 'viet nam': 'VN', 'vietnam': 'VN', 'cabo verde': 'CV', 'timor-leste': 'TL', 'eswatini': 'SZ', 'kosovo': 'XK',
  'united kingdom': 'GB', 'united states': 'US', 'myanmar': 'MM', 'macedonia, former yugoslav republic of': 'MK', 'north macedonia': 'MK',
  'moldova': 'MD', 'bolivia': 'BO', 'tanzania': 'TZ', 'czech republic': 'CZ', 'sao tome and principe': 'ST', 'somalia': 'SO'
});
const ISO3 = { ALB: 'AL', AND: 'AD', AUT: 'AT', BLR: 'BY', BEL: 'BE', BIH: 'BA', BGR: 'BG', HRV: 'HR', CYP: 'CY', CZE: 'CZ', DNK: 'DK', EST: 'EE', FIN: 'FI', FRA: 'FR', DEU: 'DE', GRC: 'GR', HUN: 'HU', ISL: 'IS', IRL: 'IE', ITA: 'IT', XKX: 'XK', LVA: 'LV', LIE: 'LI', LTU: 'LT', LUX: 'LU', MLT: 'MT', MDA: 'MD', MCO: 'MC', MNE: 'ME', NLD: 'NL', MKD: 'MK', NOR: 'NO', POL: 'PL', PRT: 'PT', ROU: 'RO', SMR: 'SM', SRB: 'RS', SVK: 'SK', SVN: 'SI', ESP: 'ES', SWE: 'SE', CHE: 'CH', UKR: 'UA', GBR: 'GB', VAT: 'VA', TUR: 'TR', GEO: 'GE', ARM: 'AM' };
function countryFromName(n) {
  const s = String(n || '').trim().toLowerCase();
  return NAME2ISO[s] || (s.includes(',') ? NAME2ISO[s.split(',')[0].trim()] : '') || '';
}

// ---------- Hulpjes ----------
const first = v => Array.isArray(v) ? v[0] : v;
function text(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(text).find(Boolean) || '';
  if (typeof v === 'object') {
    for (const k of ['nld', 'NLD', 'eng', 'ENG']) if (v[k] != null) return text(v[k]);
    return text(Object.values(v)[0]);
  }
  return '';
}
function date(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(date).filter(Boolean).sort()[0] || '';
  const s = String(v);
  let m = s.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1];
  const d = Date.parse(s); return Number.isFinite(d) ? isoDay(d) : '';
}
function num(v) {
  if (v == null || v === '') return null;
  if (Array.isArray(v)) { const ns = v.map(num).filter(x => x != null); return ns.length ? ns.reduce((a, b) => a + b, 0) : null; }
  if (typeof v === 'object') return num(v.value ?? v.amount ?? Object.values(v)[0]);
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}
const stripHtml = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(url, opts = {}, tries = 4) {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) }, signal: opts.signal || AbortSignal.timeout(120000) });
    if ((res.status === 429 || res.status >= 500) && i < tries) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * (i + 1);
      await sleep(Math.min(wait, 60000)); continue;
    }
    const body = await res.text();
    if (!res.ok) throw new Error(`${new URL(url).host} gaf ${res.status}: ${body.slice(0, 400)}`);
    return JSON.parse(body);
  }
}

// ---------- Bron 1: TED ----------
const TED_API = 'https://api.ted.europa.eu/v3/notices/search';
const TED_TYPES = {
  'cn-standard': 'Aankondiging opdracht', 'cn-social': 'Aankondiging opdracht', 'cn-desg': 'Prijsvraag',
  'pin-only': 'Vooraankondiging', 'pin-buyer': 'Vooraankondiging', 'pin-cfc-standard': 'Vooraankondiging', 'pin-tran': 'Vooraankondiging',
  'can-standard': 'Gegunde opdracht', 'can-social': 'Gegunde opdracht', 'can-modif': 'Wijziging opdracht',
  'corr': 'Rectificatie', 'veat': 'Vrijwillige transparantie', 'qu-sy': 'Kwalificatiesysteem'
};
// TED ondersteunt geen ("a" OR "b") binnen één FT ~ (dat geeft 0 resultaten): elke term los.
const ftAny = list => list.map(t => `FT ~ "${t}"`).join(' OR ');
const TED_TERMS = `(${ftAny(BRANDS)} OR ${ftAny(PHRASES)})`;
const TED_BASE = ['publication-number', 'notice-title', 'buyer-name', 'buyer-country', 'publication-date', 'deadline-receipt-tender-date-lot', 'notice-type'];
const TED_OPTIONAL = [['estimated-value-proc', 'estimated-value-cur-proc', 'estimated-value-lot', 'estimated-value-cur-lot'], ['deadline-receipt-request-date-lot'], ['classification-cpv']];

function tedTender(n) {
  const pub = text(n['publication-number']);
  if (!pub) return null;
  const c = String(first(n['buyer-country']) || '').toUpperCase();
  let value = num(n['estimated-value-proc']);
  let currency = text(n['estimated-value-cur-proc']);
  if (value == null) { value = num(n['estimated-value-lot']); currency = currency || text(n['estimated-value-cur-lot']); }
  const typeRaw = text(n['notice-type']);
  let link = `https://ted.europa.eu/nl/notice/-/detail/${encodeURIComponent(pub)}`;
  const h = n.links && n.links.html;
  if (h && typeof h === 'object') link = h.NLD || h.ENG || Object.values(h)[0] || link;
  return {
    pub, source: 'TED',
    title: text(n['notice-title']) || '(zonder titel)',
    buyer: text(n['buyer-name']),
    country: ISO3[c] || (c.length === 2 ? c : ''),
    published: date(n['publication-date']),
    deadline: date(n['deadline-receipt-tender-date-lot']) || date(n['deadline-receipt-request-date-lot']),
    type: TED_TYPES[typeRaw] || typeRaw,
    kind: /^(can-|veat)/.test(typeRaw) ? 'award' : /^pin-/.test(typeRaw) ? 'prior' : 'notice',
    cpv: [...new Set([].concat(n['classification-cpv'] || []).map(String))],
    link, value, currency: (currency || 'EUR').toUpperCase().slice(0, 3)
  };
}
async function tedSearch(query, scope, fields) {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const res = await getJson(TED_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, fields, scope, limit: 250, page }) }, 2);
    const ns = res.notices || []; all.push(...ns);
    if (ns.length < 250) break;
  }
  return all;
}
async function fetchTed() {
  const since = isoDay(NOW - 365 * DAY).replace(/-/g, '');
  // eerst een jaar geschiedenis; lukt die zoekvorm niet, dan alleen actieve berichten
  const attempts = [
    [`(${TED_TERMS} AND publication-date >= ${since}) SORT BY publication-date DESC`, 'ALL'],
    [`${TED_TERMS} SORT BY publication-date DESC`, 'ACTIVE']
  ];
  for (const [query, scope] of attempts) {
    // velden: probeer alles, en laat bij een fout steeds een optionele groep weg
    for (let k = TED_OPTIONAL.length; k >= 0; k--) {
      const fields = [...TED_BASE, ...TED_OPTIONAL.slice(0, k).flat()];
      try {
        const ns = await tedSearch(query, scope, fields);
        console.log(`TED: ${ns.length} berichten (scope ${scope}, ${fields.length} velden).`);
        return ns.map(tedTender).filter(Boolean);
      } catch (e) { console.warn(`TED (${scope}, ${fields.length} velden) lukte niet:`, e.message.slice(0, 200)); }
    }
  }
  throw new Error('TED: alle zoekpogingen mislukt');
}

// ---------- Bron 2: Wereldbank ----------
const WB_API = 'https://search.worldbank.org/api/v2/procnotices';
function wbDate(s) { // "13-Oct-2026" of ISO
  if (!s) return '';
  const d = Date.parse(String(s).replace(/^(\d{1,2})-(\w{3})-(\d{4})$/, '$2 $1, $3'));
  return Number.isFinite(d) ? isoDay(d) : date(s);
}
async function fetchWorldBank() {
  const terms = ['starlink', 'oneweb', '"project kuiper"', '"amazon leo"', '"leo satellite"', '"low earth orbit"'];
  const byId = new Map();
  for (const q of terms) {
    for (let os = 0; os < 1000; os += 100) {
      const d = await getJson(`${WB_API}?format=json&rows=100&os=${os}&qterm=${encodeURIComponent(q)}`);
      const list = d.procnotices || [];
      for (const n of list) if (n.id) byId.set(n.id, n);
      if (list.length < 100) break;
    }
  }
  const out = [];
  for (const n of byId.values()) {
    const body = `${n.bid_description || ''} ${n.project_name || ''} ${stripHtml(n.notice_text)}`;
    if (!LEO_RE.test(body)) continue; // zoekmachine van de Wereldbank is ruim; zelf nog eens controleren
    // Adviesopdrachten (CS = Consulting Services, bv. een strategie-adviseur) zijn niets voor een leverancier van verbindingen.
    // Zelfde voor de "Request for Expression of Interest" (selectie van adviseurs) en adviseurs-selectiemethodes.
    const method = String(n.procurement_method_code || '').toUpperCase();
    if (String(n.procurement_group || '').toUpperCase() === 'CS' || /expression of interest/i.test(n.notice_type || '')
        || ['QCBS', 'QBS', 'FBS', 'LCS', 'CQS', 'IC', 'INDV', 'CDS'].includes(method)) continue;
    const type = n.notice_type || '';
    const isAward = /award/i.test(type);
    const isPrior = /general procurement|expression of interest|eoi/i.test(type);
    out.push({
      pub: 'WB-' + n.id, source: 'Wereldbank',
      title: stripHtml(n.bid_description) || n.project_name || '(zonder titel)',
      buyer: n.project_name || '',
      country: countryFromName(n.project_ctry_name),
      countryName: n.project_ctry_name || '',
      published: wbDate(n.noticedate),
      deadline: isAward ? '' : date(n.submission_deadline_date || n.submission_date),
      type: type || 'Bericht',
      kind: isAward ? 'award' : isPrior ? 'prior' : 'notice',
      cpv: [], wbGroup: n.procurement_group || '', wbMethod: method,
      link: `https://projects.worldbank.org/en/projects-operations/procurement-detail/${encodeURIComponent(n.id)}`,
      value: null, currency: 'USD'
    });
  }
  say('Wereldbank', `${byId.size} gevonden, ${out.length} echt over LEO.`);
  return out;
}

// ---------- Bron 3: Find a Tender (Verenigd Koninkrijk) ----------
const FTS_API = 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages';
async function fetchFts(sinceIso) {
  let url = `${FTS_API}?limit=100&updatedFrom=${encodeURIComponent(sinceIso.slice(0, 19))}`;
  const byOcid = new Map();
  let pages = 0, scanned = 0;
  while (url && pages < 4000) {
    const d = await getJson(url);
    pages++;
    for (const r of d.releases || []) {
      scanned++;
      const t = r.tender || {};
      const parts = [t.title, t.description, ...(t.lots || []).flatMap(l => [l.title, l.description]), ...(t.items || []).map(i => i.description)];
      if (!LEO_RE.test(parts.filter(Boolean).join(' '))) continue;
      const prev = byOcid.get(r.ocid);
      if (prev && (prev.date || '') > (r.date || '')) continue;
      byOcid.set(r.ocid, r);
    }
    url = d.links?.next || null;
    if (!(d.releases || []).length) break;
  }
  const out = [];
  for (const r of byOcid.values()) {
    const t = r.tender || {};
    const tags = [].concat(r.tag || []);
    const cpvMain = t.classification?.id || t.items?.[0]?.classification?.id || r.awards?.[0]?.items?.[0]?.classification?.id || '';
    const value = num(t.value?.amount) ?? num(r.awards?.[0]?.value?.amount) ?? num(r.contracts?.[0]?.value?.amount);
    const currency = t.value?.currency || r.awards?.[0]?.value?.currency || r.contracts?.[0]?.value?.currency || 'GBP';
    const isAward = tags.some(x => /award|contract/i.test(x)) || ['complete', 'unsuccessful'].includes(t.status);
    const isPrior = tags.some(x => /planning/i.test(x));
    out.push({
      pub: 'UK-' + r.ocid, source: 'Find a Tender',
      title: t.title || '(zonder titel)',
      buyer: r.buyer?.name || '',
      country: 'GB',
      published: date(r.date),
      deadline: isAward ? '' : date(t.tenderPeriod?.endDate),
      type: isAward ? 'Gegunde opdracht' : isPrior ? 'Vooraankondiging' : t.status === 'cancelled' ? 'Geannuleerd' : 'Aankondiging opdracht',
      kind: isAward || t.status === 'cancelled' ? 'award' : isPrior ? 'prior' : 'notice',
      cpv: cpvMain ? [String(cpvMain)] : [],
      link: `https://www.find-tender.service.gov.uk/Notice/${encodeURIComponent(r.id)}`,
      value, currency: String(currency).toUpperCase().slice(0, 3)
    });
  }
  say('Find a Tender', `${pages} pagina's, ${scanned} berichten bekeken, ${out.length} over LEO.`);
  return out;
}

// ---------- Bron 4: SAM.gov (Amerikaanse overheid) ----------
// Gratis sleutel heeft een laag dagquotum (±10 verzoeken): daarom hooguit één keer per ~20 uur, 4 zoektermen.
const SAM_API = 'https://api.sam.gov/opportunities/v2/search';
const SAM_TYPES = { 'Award Notice': 'award', 'Presolicitation': 'prior', 'Sources Sought': 'prior', 'Special Notice': 'prior' };
const usDate = d => { const x = new Date(d); return `${String(x.getUTCMonth() + 1).padStart(2, '0')}/${String(x.getUTCDate()).padStart(2, '0')}/${x.getUTCFullYear()}`; };
async function fetchSam(key) {
  const terms = ['starlink', 'oneweb', 'LEO satellite', 'Kuiper'];
  const byId = new Map();
  for (const term of terms) {
    const url = `${SAM_API}?api_key=${encodeURIComponent(key)}&limit=1000&offset=0&postedFrom=${usDate(NOW - 364 * DAY)}&postedTo=${usDate(NOW)}&title=${encodeURIComponent(term)}`;
    const d = await getJson(url, {}, 1);
    for (const o of d.opportunitiesData || []) if (o.noticeId) byId.set(o.noticeId, o);
  }
  const out = [];
  for (const o of byId.values()) {
    if (!LEO_RE.test(`${o.title || ''} ${o.description || ''}`)) continue;
    const kind = SAM_TYPES[o.type] || 'notice';
    const c3 = String(o.placeOfPerformance?.country?.code || 'USA').toUpperCase();
    out.push({
      pub: 'US-' + o.noticeId, source: 'SAM.gov',
      title: o.title || '(zonder titel)',
      buyer: String(o.fullParentPathName || o.department || '').split('.').slice(-1)[0].trim() || o.fullParentPathName || '',
      country: c3 === 'USA' ? 'US' : (ISO3[c3] || (c3.length === 2 ? c3 : 'US')),
      published: date(o.postedDate),
      deadline: kind === 'award' ? '' : date(o.responseDeadLine),
      type: o.type || 'Bericht', kind,
      cpv: [],
      link: o.uiLink || `https://sam.gov/opp/${o.noticeId}/view`,
      value: num(o.award?.amount), currency: 'USD'
    });
  }
  say('SAM.gov', `${byId.size} gevonden, ${out.length} over LEO.`);
  return out;
}

// ---------- Extra bronnen (zonder sleutel) ----------
const NOTES = {};
const say = (name, msg) => { NOTES[name] = msg; console.log(`${name}: ${msg}`); };
const UA = { 'User-Agent': 'Mozilla/5.0 (tendermap; +https://tenderkaart.vercel.app)' };
const CORE_TERMS = ['starlink', 'oneweb', 'LEO satellite', 'Project Kuiper', 'Amazon Leo'];
const postJson = (url, body) => getJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...UA }, body: JSON.stringify(body) }, 2);
const getText = async url => {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`${new URL(url).host} gaf ${r.status}`);
  return r.text();
};
const isFresh = t => recent(t);

// Contracts Finder (VK, ook kleinere opdrachten)
async function fetchContractsFinder() {
  const byId = new Map();
  for (const keyword of CORE_TERMS) {
    const d = await postJson('https://www.contractsfinder.service.gov.uk/api/rest/2/search_notices/json', { searchCriteria: { keyword }, size: 100 });
    for (const x of d.noticeList || []) if (x.item?.id) byId.set(x.item.id, x.item);
  }
  const out = [];
  for (const n of byId.values()) {
    if (!LEO_RE.test(`${n.title} ${n.description}`)) continue;
    const st = String(n.noticeStatus || '').toLowerCase();
    const award = st === 'awarded' || /award/i.test(n.noticeType || '');
    const prior = /early|pipeline|engagement/i.test(n.noticeType || '');
    out.push({
      pub: 'CF-' + n.id, source: 'Contracts Finder', title: n.title || '(zonder titel)', buyer: n.organisationName || '',
      country: 'GB', published: date(n.publishedDate), deadline: award ? '' : date(n.deadlineDate),
      type: award ? 'Gegunde opdracht' : prior ? 'Vooraankondiging' : st === 'withdrawn' ? 'Ingetrokken' : 'Aankondiging opdracht',
      kind: award || st === 'withdrawn' || st === 'closed' ? 'award' : prior ? 'prior' : 'notice', cpv: [],
      link: `https://www.contractsfinder.service.gov.uk/Notice/${n.id}`,
      value: num(n.awardedValue) ?? num(n.valueHigh) ?? num(n.valueLow), currency: 'GBP'
    });
  }
  say('Contracts Finder', `${byId.size} gevonden, ${out.length} over LEO.`);
  return out.filter(isFresh);
}

// Prozorro (Oekraïne): alleen lopende procedures
async function fetchProzorro() {
  const statuses = ['active.enquiries', 'active.tendering', 'active.pre-qualification', 'active.pre-qualification.stand-still', 'active.auction', 'active.qualification'];
  const byId = new Map();
  for (const text of ['starlink', 'oneweb']) {
    for (let page = 1; page <= 15; page++) {
      const d = await postJson('https://prozorro.gov.ua/api/search/tenders', { text, status: statuses, page });
      for (const x of d.data || []) if (x.tenderID) byId.set(x.tenderID, x);
      if (!d.data || page * (d.per_page || 20) >= (d.total || 0)) break;
    }
  }
  const out = [];
  for (const x of byId.values()) {
    const tendering = /active\.(enquiries|tendering)/.test(x.status || '');
    out.push({
      pub: 'UA-' + x.tenderID, source: 'Prozorro', title: x.title || '(zonder titel)',
      buyer: x.procuringEntity?.name || x.procuringEntity?.identifier?.legalName || '', country: 'UA',
      published: date(x.enquiryPeriod?.startDate || x.tenderPeriod?.startDate || x.dateCreated),
      deadline: date(x.tenderPeriod?.endDate), type: tendering ? 'Aankondiging opdracht' : 'In beoordeling',
      kind: tendering ? 'notice' : 'award', cpv: [],
      link: `https://prozorro.gov.ua/tender/${encodeURIComponent(x.tenderID)}`,
      value: num(x.value?.amount), currency: x.value?.currency || 'UAH'
    });
  }
  say('Prozorro', `${out.length} lopende procedures.`);
  return out;
}

// TenderNed (NL)
async function fetchTenderNed() {
  const byId = new Map();
  for (const term of ['starlink', 'oneweb', 'LEO satelliet', 'satellietinternet', 'satellietverbinding']) {
    const d = await getJson(`https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties?page=0&size=100&search=${encodeURIComponent(term)}`, { headers: UA });
    for (const x of d.content || []) if (x.publicatieId) byId.set(x.publicatieId, x);
  }
  const out = [];
  for (const x of byId.values()) {
    if (!LEO_RE.test(`${x.aanbestedingNaam} ${x.opdrachtBeschrijving}`)) continue;
    const code = `${x.publicatiecode?.omschrijving || ''} ${x.typePublicatie?.omschrijving || ''}`;
    const award = /gegund|gunning|beëindiging/i.test(code), prior = /vooraankondiging|marktconsultatie/i.test(code);
    out.push({
      pub: 'NL-' + x.publicatieId, source: 'TenderNed', title: x.aanbestedingNaam || '(zonder titel)', buyer: x.opdrachtgeverNaam || '',
      country: 'NL', published: date(x.publicatieDatum), deadline: award ? '' : date(x.sluitingsDatum),
      type: x.publicatiecode?.omschrijving || x.typePublicatie?.omschrijving || 'Aankondiging', kind: award ? 'award' : prior ? 'prior' : 'notice',
      cpv: [], link: x.link?.href || `https://www.tenderned.nl/aankondigingen/overzicht/${x.publicatieId}`, value: null, currency: 'EUR'
    });
  }
  say('TenderNed', `${byId.size} gevonden, ${out.length} over LEO.`);
  return out.filter(isFresh);
}

// BOAMP (Frankrijk, ook onder de EU-drempel)
async function fetchBoamp() {
  const byId = new Map();
  for (const term of ['starlink', 'oneweb', 'Kuiper', 'satellite LEO', 'satellites LEO']) {
    const where = encodeURIComponent(`search("${term}") AND dateparution >= date'${histCutoff}'`);
    const d = await getJson(`https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records?where=${where}&limit=100&select=idweb,objet,dateparution,datelimitereponse,nomacheteur,nature,nature_libelle,url_avis`, { headers: UA });
    for (const x of d.results || []) if (x.idweb) byId.set(x.idweb, x);
  }
  const out = [];
  for (const x of byId.values()) {
    if (!LEO_RE.test(x.objet || '')) continue;
    const award = /ATTRIBUTION/i.test(x.nature || ''), prior = /PRE|PREINFO/i.test(x.nature || '');
    out.push({
      pub: 'FR-' + x.idweb, source: 'BOAMP', title: x.objet || '(zonder titel)', buyer: x.nomacheteur || '', country: 'FR',
      published: date(x.dateparution), deadline: award ? '' : date(x.datelimitereponse), type: x.nature_libelle || 'Avis',
      kind: award ? 'award' : prior ? 'prior' : 'notice', cpv: [], link: x.url_avis || `https://www.boamp.fr/pages/avis/?q=idweb:${x.idweb}`, value: null, currency: 'EUR'
    });
  }
  say('BOAMP', `${byId.size} gevonden, ${out.length} over LEO.`);
  return out.filter(isFresh);
}

// Colombia (SECOP II, open data)
async function fetchSecop() {
  const byId = new Map();
  for (const term of ['starlink', 'oneweb']) {
    const d = await getJson(`https://www.datos.gov.co/resource/p6dx-8zbt.json?$q=${encodeURIComponent(term)}&$limit=500&$where=${encodeURIComponent(`fecha_de_publicacion_del >= '${histCutoff}T00:00:00'`)}`, { headers: UA });
    for (const x of d || []) if (x.id_del_proceso) byId.set(x.id_del_proceso, x);
  }
  const out = [];
  for (const x of byId.values()) {
    if (!LEO_RE.test(`${x.nombre_del_procedimiento} ${x.descripci_n_del_procedimiento}`)) continue;
    const award = /^s[ií]/i.test(x.adjudicado || '') || /adjudicad|celebrad|terminad|cancelad|desiert/i.test(x.estado_del_procedimiento || '');
    const desc = String(x.descripci_n_del_procedimiento || '');
    out.push({
      pub: 'CO-' + x.id_del_proceso, source: 'SECOP (Colombia)',
      title: desc.length > 20 ? desc.slice(0, 220) : (x.nombre_del_procedimiento || desc || '(zonder titel)'),
      buyer: x.entidad || '', country: 'CO', published: date(x.fecha_de_publicacion_del), deadline: '',
      type: x.estado_del_procedimiento || x.fase || 'Proceso', kind: award ? 'award' : 'notice', cpv: [],
      link: x.urlproceso?.url || x.urlproceso || 'https://community.secop.gov.co/', value: num(x.precio_base), currency: 'COP'
    });
  }
  say('SECOP (Colombia)', `${byId.size} gevonden, ${out.length} over LEO.`);
  return out;
}

// Brazilië (PNCP)
async function fetchPncp() {
  const byId = new Map();
  for (const tipo of ['edital', 'contrato']) {
    for (let pagina = 1; pagina <= 5; pagina++) {
      const d = await getJson(`https://pncp.gov.br/api/search/?q=starlink&tipos_documento=${tipo}&pagina=${pagina}&tam_pagina=100&ordenacao=-data`, { headers: UA });
      for (const x of d.items || []) if (x.id) byId.set(x.id, { ...x, _tipo: tipo });
      if ((d.items || []).length < 100) break;
    }
  }
  const out = [];
  for (const x of byId.values()) {
    const award = x._tipo === 'contrato';
    out.push({
      pub: 'BR-' + x.id, source: 'PNCP (Brazilië)', title: x.description || x.title || '(zonder titel)', buyer: x.orgao_nome || x.unidade_nome || '',
      country: 'BR', published: date(x.data_publicacao_pncp || x.createdAt), deadline: award ? '' : date(x.data_fim_vigencia || ''),
      type: award ? 'Contrato' : (x.modalidade_licitacao_nome || 'Edital'), kind: award ? 'award' : 'notice', cpv: [],
      link: x.item_url ? `https://pncp.gov.br/app/editais${x.item_url.replace(/^\/compras/, '')}` : 'https://pncp.gov.br/',
      value: num(x.valor_global), currency: 'BRL'
    });
  }
  say('PNCP (Brazilië)', `${out.length} gevonden.`);
  return out.filter(isFresh);
}

// SIMAP (Zwitserland)
async function fetchSimap() {
  const byId = new Map();
  for (const term of ['starlink', 'oneweb', 'LEO Satellit']) {
    const d = await getJson(`https://www.simap.ch/api/publications/v2/project/project-search?search=${encodeURIComponent(term)}&lang=de`, { headers: UA });
    for (const x of d.projects || []) if (x.id) byId.set(x.id, x);
  }
  const out = [];
  for (const x of byId.values()) {
    const title = x.title?.de || x.title?.fr || x.title?.en || x.title?.it || '';
    if (!LEO_RE.test(title)) continue;
    const award = /award/i.test(x.pubType || '');
    out.push({
      pub: 'CH-' + x.id, source: 'SIMAP (Zwitserland)', title, buyer: x.procOfficeName?.de || x.procOfficeName?.fr || '', country: 'CH',
      published: date(x.publicationDate), deadline: '', type: x.pubType || 'Publikation', kind: award ? 'award' : /advance|prior/i.test(x.pubType || '') ? 'prior' : 'notice',
      cpv: [], link: `https://www.simap.ch/de/project-detail/${x.id}`, value: null, currency: 'CHF'
    });
  }
  say('SIMAP (Zwitserland)', `${byId.size} gevonden, ${out.length} over LEO.`);
  return out.filter(isFresh);
}

// CanadaBuys: lijst met open tenders (CSV)
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
async function fetchCanadaBuys() {
  const rows = parseCsv(await getText('https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv'));
  const head = rows.shift() || [];
  const col = name => head.findIndex(h => h.toLowerCase().startsWith(name.toLowerCase()));
  const iT = col('title-titre-eng'), iR = col('referenceNumber'), iP = col('publicationDate'), iC = col('tenderClosingDate'),
    iD = head.findIndex(h => /tenderDescription.*eng/i.test(h)), iB = head.findIndex(h => /contractingEntityName.*eng/i.test(h)),
    iU = head.findIndex(h => /noticeURL.*eng/i.test(h));
  const out = [];
  for (const r of rows) {
    if (!LEO_RE.test(`${r[iT] || ''} ${iD >= 0 ? r[iD] : ''}`)) continue;
    out.push({
      pub: 'CA-' + (r[iR] || r[iT]), source: 'CanadaBuys', title: r[iT] || '(zonder titel)', buyer: iB >= 0 ? r[iB] : '', country: 'CA',
      published: date(r[iP]), deadline: date(r[iC]), type: 'Tender notice', kind: 'notice', cpv: [],
      link: (iU >= 0 && r[iU]) || 'https://canadabuys.canada.ca/en/tender-opportunities', value: null, currency: 'CAD'
    });
  }
  say('CanadaBuys', `${rows.length} open tenders bekeken, ${out.length} over LEO.`);
  return out;
}

// AusTender (Australië): gegunde contracten, per periode
async function fetchAusTender(sinceIso) {
  const out = [];
  let from = new Date(sinceIso), scanned = 0;
  while (from < NOW) {
    const to = new Date(Math.min(+from + 14 * DAY, +NOW));
    let url = `https://api.tenders.gov.au/ocds/findByDates/contractPublished/${from.toISOString().slice(0, 19)}Z/${to.toISOString().slice(0, 19)}Z`;
    for (let p = 0; url && p < 200; p++) {
      const d = await getJson(url, { headers: UA });
      for (const r of d.releases || []) {
        scanned++;
        const c = r.contracts?.[0] || {};
        const text = `${c.description || ''} ${r.tender?.title || ''} ${r.tender?.description || ''}`;
        if (!LEO_RE.test(text)) continue;
        out.push({
          pub: 'AU-' + (c.id || r.ocid), source: 'AusTender', title: c.description || r.tender?.title || '(zonder titel)',
          buyer: (r.parties || []).find(x => (x.roles || []).includes('procuringEntity'))?.name || '', country: 'AU',
          published: date(c.dateSigned || r.date), deadline: '', type: 'Gegund contract', kind: 'award', cpv: [],
          link: c.id ? `https://www.tenders.gov.au/Search/CnAdvancedSearch?keyword=${encodeURIComponent(c.id)}` : 'https://www.tenders.gov.au/',
          value: num(c.value?.amount), currency: c.value?.currency || 'AUD'
        });
      }
      url = d.links?.next || null;
    }
    from = to;
  }
  say('AusTender', `${scanned} contracten bekeken, ${out.length} over LEO.`);
  return out;
}

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function dmy(s) { // "26-Oct-26" → 2026-10-26 (zonder tijdzoneverschuiving)
  const m = String(s || '').match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
  if (!m || !MON[m[2].toLowerCase()]) return '';
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${y}-${String(MON[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
// UNDP: lijst met lopende inkoopberichten (webpagina)
async function fetchUndp() {
  const html = await getText('https://procurement-notices.undp.org/search.cfm');
  const out = [];
  const re = /<a href="view_negotiation\.cfm\?nego_id=(\d+)"[\s\S]*?<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const block = m[0];
    const cells = [...block.matchAll(/__cell__label">\s*([^<]+?)\s*<\/div>\s*<span>([\s\S]*?)<\/span>/g)].map(x => [x[1].trim(), stripHtml(x[2])]);
    const get = l => (cells.find(c => c[0].toLowerCase().startsWith(l)) || [])[1] || '';
    const title = get('title');
    if (!LEO_RE.test(title)) continue;
    const office = get('undp office');
    out.push({
      pub: 'UNDP-' + m[1], source: 'UNDP', title, buyer: 'UNDP ' + office.split('/')[0], country: countryFromName(office.split('/').slice(-1)[0]),
      countryName: office.split('/').slice(-1)[0].trim(), published: dmy(get('posted')), deadline: dmy(get('deadline')),
      type: get('process') || 'Notice', kind: 'notice', cpv: [], link: `https://procurement-notices.undp.org/view_negotiation.cfm?nego_id=${m[1]}`, value: null, currency: 'USD'
    });
  }
  say('UNDP', `${(html.match(/view_negotiation\.cfm\?nego_id=/g) || []).length} berichten bekeken, ${out.length} over LEO.`);
  return out;
}

// Defensie-markering: militaire opdrachtgever of Oekraïne (daar altijd bevestiging niet-militair gebruik nodig)
const DEFENSE_RE = /(defen[cs]e|defensie|verteidigung|bundeswehr|armée|armasuisse|ministerul apararii|unitatea militara|military|militar|army|navy|air force|marine corps|військов|збройн|національної гвардії|міністерство оборони|оборони)/i;
function markDefense(t) {
  if (DEFENSE_RE.test(`${t.buyer || ''} ${t.title || ''}`)) t.defense = true;
  if (t.country === 'UA') t.policyUA = true;
  return t;
}

// ---------- Samenvoegen ----------
let old = { updated: null, tenders: [], sources: {} };
try { old = JSON.parse(await readFile(FILE, 'utf8')); } catch { /* eerste keer */ }
old.sources = old.sources || {};
const nowIso = NOW.toISOString();

// verhogen als zoektermen of filters wezenlijk veranderen: dan worden oude berichten opnieuw opgeschoond
const FILTER_VERSION = 'world-v3-geen-advies';
const version = createHash('sha1').update(TED_TERMS + LEO_RE.source + EXCLUDE_RE.source + FILTER_VERSION).digest('hex').slice(0, 10);
const reset = old.queryVersion !== version;
if (reset) console.log('Zoekopdracht of filter gewijzigd: alles wordt opnieuw opgeschoond.');

const ausSince = (!reset && old.sources['AusTender']?.since) || new Date(NOW - 60 * DAY).toISOString();
const ftsSince = (!reset && old.sources['Find a Tender']?.since) || new Date(NOW - 45 * DAY).toISOString();
const SOURCES = [
  ['TED', () => fetchTed()],
  ['Wereldbank', () => fetchWorldBank()],
  ['Find a Tender', () => fetchFts(ftsSince)],
  ['Contracts Finder', () => fetchContractsFinder()],
  ['TenderNed', () => fetchTenderNed()],
  ['Prozorro', () => fetchProzorro()],
  ['BOAMP', () => fetchBoamp()],
  ['SIMAP (Zwitserland)', () => fetchSimap()],
  ['SECOP (Colombia)', () => fetchSecop()],
  ['PNCP (Brazilië)', () => fetchPncp()],
  ['CanadaBuys', () => fetchCanadaBuys()],
  ['AusTender', () => fetchAusTender(ausSince)],
  ['UNDP', () => fetchUndp()]
];
const SAM_KEY = process.env.SAM_API_KEY || '';
const lastSam = Date.parse(old.sources['SAM.gov']?.at || 0) || 0;
if (SAM_KEY && (reset || NOW - lastSam > 20 * 3600e3 || !old.sources['SAM.gov']?.ok)) SOURCES.push(['SAM.gov', () => fetchSam(SAM_KEY)]);
else if (SAM_KEY) console.log('SAM.gov: vandaag al opgehaald, overgeslagen (dagquotum).');

const oldBySource = {};
for (const t of old.tenders || []) (oldBySource[t.source || 'TED'] ||= []).push({ source: 'TED', ...t });

const result = [];
const sourceInfo = {};
for (const [name, fn] of SOURCES) {
  const previous = oldBySource[name] || [];
  try {
    const fresh = (await fn()).filter(keep).map(markDefense);
    const freshIds = new Set(fresh.map(t => t.pub));
    // TED en Wereldbank geven bij elke ronde het hele beeld: wat er niet meer in zit (bij een reset) valt af.
    // Find a Tender werkt met alleen de laatste wijzigingen: oude berichten blijven staan.
    // Find a Tender en AusTender halen alleen wijzigingen op: hun eerdere berichten blijven staan.
    // Bij de andere bronnen blijven eerdere berichten ook staan (tot ze te oud zijn), behalve na een reset.
    const carry = previous.filter(t => !freshIds.has(t.pub) && keep(t) && !reset).map(markDefense);
    const prevById = new Map(previous.map(t => [t.pub, t]));
    for (const t of fresh) {
      const p = prevById.get(t.pub);
      t.firstSeen = p?.firstSeen || (old.updated && !reset ? nowIso : '2000-01-01T00:00:00.000Z');
      if (t.value == null && p?.value != null) { t.value = p.value; t.currency = p.currency; }
    }
    // bij een reset: berichten die al bekend waren, niet opnieuw als "nieuw" markeren
    if (reset) for (const t of fresh) { const p = prevById.get(t.pub); if (p?.firstSeen) t.firstSeen = p.firstSeen; }
    result.push(...fresh, ...carry);
    sourceInfo[name] = { ok: true, at: nowIso, count: fresh.length, note: NOTES[name] || '', ...(['Find a Tender', 'AusTender'].includes(name) ? { since: new Date(NOW - 2 * 3600e3).toISOString() } : {}) };
  } catch (e) {
    console.error(`${name} mislukt, bestaande berichten blijven staan:`, e.message);
    result.push(...previous);
    sourceInfo[name] = { ...(old.sources[name] || {}), ok: false, error: e.message.slice(0, 200), at: nowIso };
  }
}

for (const name of Object.keys(oldBySource)) if (!SOURCES.some(([n]) => n === name)) {
  result.push(...oldBySource[name].filter(keep));
  if (old.sources[name]) sourceInfo[name] = old.sources[name];
}

const seen = new Set();
const tenders = result
  .filter(t => { if (seen.has(t.pub)) return false; seen.add(t.pub); return true; })
  .filter(recent)
  .sort((a, b) => (b.published || '').localeCompare(a.published || ''));

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(FILE, JSON.stringify({ updated: nowIso, queryVersion: version, sources: sourceInfo, count: tenders.length, tenders }, null, 1) + '\n');
const per = {}; tenders.forEach(t => per[t.source] = (per[t.source] || 0) + 1);
console.log(`Opgeslagen: ${tenders.length} tenders`, per);
