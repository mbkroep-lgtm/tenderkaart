// Haalt Starlink- en satellietinternet-tenders op bij TED (Tenders Electronic Daily)
// en werkt data/tenders.json bij. Draait automatisch via GitHub Actions.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const API = 'https://api.ted.europa.eu/v3/notices/search';
const FILE = new URL('../data/tenders.json', import.meta.url);

const QUERY = '(FT ~ ("starlink" OR "satellite internet" OR "satellite broadband" OR "satellite connectivity" OR "satellite communication services" OR "satcom" OR "VSAT" OR "LEO satellite" OR "low earth orbit" OR "OneWeb" OR "satellietinternet" OR "satellietverbinding" OR "Satelliteninternet" OR "Satellitenkommunikation" OR "internet par satellite" OR "connectivité satellitaire" OR "internet satelital" OR "conectividad satelital" OR "internet satellitare" OR "connettività satellitare" OR "internet satelitarny" OR "łączność satelitarna" OR "mobile connectivity" OR "backup connectivity" OR "emergency communication" OR "noodcommunicatie" OR "Notfallkommunikation" OR "rural broadband") OR classification-cpv IN (32531000 32532000 32533000 32534000)) SORT BY publication-date DESC';
const BASE = ['publication-number', 'notice-title', 'buyer-name', 'buyer-country', 'publication-date', 'deadline-receipt-tender-date-lot', 'notice-type'];
const EXTRA = ['estimated-value-proc', 'estimated-value-cur-proc', 'estimated-value-lot', 'estimated-value-cur-lot'];

const ISO3 = { ALB: 'AL', AND: 'AD', AUT: 'AT', BLR: 'BY', BEL: 'BE', BIH: 'BA', BGR: 'BG', HRV: 'HR', CYP: 'CY', CZE: 'CZ', DNK: 'DK', EST: 'EE', FIN: 'FI', FRA: 'FR', DEU: 'DE', GRC: 'GR', HUN: 'HU', ISL: 'IS', IRL: 'IE', ITA: 'IT', XKX: 'XK', LVA: 'LV', LIE: 'LI', LTU: 'LT', LUX: 'LU', MLT: 'MT', MDA: 'MD', MCO: 'MC', MNE: 'ME', NLD: 'NL', MKD: 'MK', NOR: 'NO', POL: 'PL', PRT: 'PT', ROU: 'RO', SMR: 'SM', SRB: 'RS', SVK: 'SK', SVN: 'SI', ESP: 'ES', SWE: 'SE', CHE: 'CH', UKR: 'UA', GBR: 'GB', VAT: 'VA', TUR: 'TR', GEO: 'GE', ARM: 'AM' };

const TYPES = {
  'cn-standard': 'Aankondiging opdracht', 'cn-social': 'Aankondiging opdracht', 'cn-desg': 'Prijsvraag',
  'pin-only': 'Vooraankondiging', 'pin-buyer': 'Vooraankondiging', 'pin-cfc-standard': 'Vooraankondiging', 'pin-tran': 'Vooraankondiging',
  'can-standard': 'Gegunde opdracht', 'can-social': 'Gegunde opdracht', 'can-modif': 'Wijziging opdracht',
  'corr': 'Rectificatie', 'veat': 'Vrijwillige transparantie', 'qu-sy': 'Kwalificatiesysteem'
};

async function post(body) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`TED gaf ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

async function fetchAll(fields) {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const res = await post({ query: QUERY, fields, scope: 'ACTIVE', limit: 250, page });
    const notices = res.notices || [];
    all.push(...notices);
    if (notices.length < 250) break;
  }
  return all;
}

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
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}
function num(v) {
  if (v == null || v === '') return null;
  if (Array.isArray(v)) { const ns = v.map(num).filter(x => x != null); return ns.length ? ns.reduce((a, b) => a + b, 0) : null; }
  if (typeof v === 'object') return num(v.value ?? v.amount ?? Object.values(v)[0]);
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}
function link(n, pub) {
  const h = n.links && n.links.html;
  if (h && typeof h === 'object') {
    for (const k of ['NLD', 'ENG']) if (h[k]) return h[k];
    const f = Object.values(h)[0]; if (f) return f;
  }
  return `https://ted.europa.eu/nl/notice/-/detail/${encodeURIComponent(pub)}`;
}

function toTender(n) {
  const pub = text(n['publication-number']);
  if (!pub) return null;
  const countryRaw = String(first(n['buyer-country']) || '').toUpperCase();
  let value = num(n['estimated-value-proc']);
  let currency = text(n['estimated-value-cur-proc']);
  if (value == null) { value = num(n['estimated-value-lot']); currency = currency || text(n['estimated-value-cur-lot']); }
  const typeRaw = text(n['notice-type']);
  return {
    pub,
    title: text(n['notice-title']) || '(zonder titel)',
    buyer: text(n['buyer-name']),
    country: ISO3[countryRaw] || (countryRaw.length === 2 ? countryRaw : ''),
    published: date(n['publication-date']),
    deadline: date(n['deadline-receipt-tender-date-lot']),
    type: TYPES[typeRaw] || typeRaw,
    kind: /^(can-|veat)/.test(typeRaw) ? 'award' : /^pin-/.test(typeRaw) ? 'prior' : 'notice',
    link: link(n, pub),
    value,
    currency: (currency || 'EUR').toUpperCase().slice(0, 3)
  };
}

let notices;
try {
  notices = await fetchAll([...BASE, ...EXTRA]);
} catch (e) {
  console.warn('Ophalen met waardevelden lukte niet, opnieuw zonder:', e.message);
  notices = await fetchAll(BASE);
}
const fresh = notices.map(toTender).filter(Boolean);
console.log(`${fresh.length} tenders opgehaald bij TED.`);

let old = { updated: null, tenders: [] };
try { old = JSON.parse(await readFile(FILE, 'utf8')); } catch { /* eerste keer */ }

const now = new Date().toISOString();
const byPub = new Map((old.tenders || []).map(t => [t.pub, t]));
let added = 0;
for (const t of fresh) {
  const prev = byPub.get(t.pub);
  if (!prev) added++;
  // eerste vulling telt niet als 'nieuw'
  t.firstSeen = prev?.firstSeen || (old.updated ? now : '2000-01-01T00:00:00.000Z');
  if (t.value == null && prev?.value != null) { t.value = prev.value; t.currency = prev.currency; }
  byPub.set(t.pub, { ...prev, ...t });
}

// oude tenders opruimen: gesloten langer dan 180 dagen geleden
const cutoff = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
const tenders = [...byPub.values()]
  .filter(t => t.deadline ? t.deadline >= cutoff : (t.published || '') >= yearAgo)
  .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(FILE, JSON.stringify({ updated: now, source: 'TED – Tenders Electronic Daily', count: tenders.length, tenders }, null, 1) + '\n');
console.log(`Opgeslagen: ${tenders.length} tenders (${added} nieuw).`);
