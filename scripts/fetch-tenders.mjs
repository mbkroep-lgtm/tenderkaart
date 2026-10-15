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
const EXCLUDE_RE = /(inter-?satellite|intersatellit|launch service|trägerrakete|lanceerdienst|telescope|teleskop|flight[- ]model|raumfahrzeug|spacecraft)/i;
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
    const res = await fetch(url, { headers: { Accept: 'application/json', ...(opts.headers || {}) }, ...opts });
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
  console.log(`Wereldbank: ${byId.size} gevonden, ${out.length} echt over LEO.`);
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
  console.log(`Find a Tender: ${pages} pagina's, ${scanned} berichten bekeken, ${out.length} over LEO.`);
  return out;
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

const ftsSince = (!reset && old.sources['Find a Tender']?.since) || new Date(NOW - 45 * DAY).toISOString();
const SOURCES = [
  ['TED', () => fetchTed()],
  ['Wereldbank', () => fetchWorldBank()],
  ['Find a Tender', () => fetchFts(ftsSince)]
];

const oldBySource = {};
for (const t of old.tenders || []) (oldBySource[t.source || 'TED'] ||= []).push({ source: 'TED', ...t });

const result = [];
const sourceInfo = {};
for (const [name, fn] of SOURCES) {
  const previous = oldBySource[name] || [];
  try {
    const fresh = (await fn()).filter(keep);
    const freshIds = new Set(fresh.map(t => t.pub));
    // TED en Wereldbank geven bij elke ronde het hele beeld: wat er niet meer in zit (bij een reset) valt af.
    // Find a Tender werkt met alleen de laatste wijzigingen: oude berichten blijven staan.
    const carry = name === 'Find a Tender'
      ? previous.filter(t => !freshIds.has(t.pub) && keep(t) && !reset)
      : previous.filter(t => !freshIds.has(t.pub) && keep(t) && !reset);
    const prevById = new Map(previous.map(t => [t.pub, t]));
    for (const t of fresh) {
      const p = prevById.get(t.pub);
      t.firstSeen = p?.firstSeen || (old.updated && !reset ? nowIso : '2000-01-01T00:00:00.000Z');
      if (t.value == null && p?.value != null) { t.value = p.value; t.currency = p.currency; }
    }
    // bij een reset: berichten die al bekend waren, niet opnieuw als "nieuw" markeren
    if (reset) for (const t of fresh) { const p = prevById.get(t.pub); if (p?.firstSeen) t.firstSeen = p.firstSeen; }
    result.push(...fresh, ...carry);
    sourceInfo[name] = { ok: true, at: nowIso, count: fresh.length, ...(name === 'Find a Tender' ? { since: new Date(NOW - 2 * 3600e3).toISOString() } : {}) };
  } catch (e) {
    console.error(`${name} mislukt, bestaande berichten blijven staan:`, e.message);
    result.push(...previous);
    sourceInfo[name] = { ...(old.sources[name] || {}), ok: false, error: e.message.slice(0, 200), at: nowIso };
  }
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
