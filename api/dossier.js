// AI Tender Bid Assistant: bereidt een inschrijfdossier voor met Claude.
// De browser leest de aanbestedingsstukken zelf uit en stuurt alleen de tekst. Per stap één Claude-aanroep;
// het resultaat (JSON) bewaren we in de database, zodat collega's het dossier later weer openen.
// Regels: niets verzinnen (referenties, certificaten, omzet, verklaringen); ontbrekend = [ONTBREEKT: …].
import { json, readSession, hasAccess, isAdmin, redis, readJson, env, fail } from '../lib/core.js';

const MODEL = () => env('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';
const KB_MAX = 400000;        // tekens bedrijfsdossier in de prompt
const TENDER_MAX = 600000;    // tekens aanbestedingsstukken in de prompt

const COMPANY = `BroadbandEU (Handelsweg 16B, 9482 WE Tynaarlo, Nederland; tel. +31 850 666 152; sales@broadbandeu.com; www.broadbandeu.com).
Levert zakelijke connectiviteit als complete dienst: Starlink LEO-satellietinternet (reseller), 4G/5G, straalverbindingen, glasvezel, Wi-Fi, SD-WAN,
tijdelijke en noodverbindingen, inclusief installatie, monitoring en support. Kantoren in Tynaarlo en Etten-Leur.
Beleid: BroadbandEU levert nooit alleen hardware; altijd in combinatie met een BroadbandEU-abonnement.`;

const RULES = `Harde regels:
- Verzin NOOIT referenties, klantnamen, certificeringen (ISO e.d.), omzet- of personeelscijfers, verzekeringen, KvK-gegevens, handtekeningen of juridische verklaringen.
  Gebruik alleen wat letterlijk in het BEDRIJFSDOSSIER of in de aanbestedingsstukken staat.
- Ontbreekt iets, schrijf dan precies: [ONTBREEKT: wat er nodig is]. Prijzen zonder bron in het bedrijfsdossier: [PRIJS INVULLEN].
- Documenten die een handtekening vereisen: markeer met [HANDTEKENING NODIG].
- Inschrijfdocumenten (offerte, technisch ontwerp, plan van aanpak, SLA, UEA) schrijf je in de taal van de aanbesteding; analyses en toelichtingen voor BroadbandEU in het Nederlands.
- Lever je antwoord via de tool lever_onderdeel, als één JSON-object volgens het gevraagde schema. Houd teksten zakelijk en beknopt.`;

const SECTIONS = '[{"kop": string, "tekst": string, "punten": [string]}]';
const STEPS = {
  analyse: { max: 16000, ask: `Analyseer de aanbesteding en beoordeel go/no-go voor BroadbandEU. Schema:
{"samenvatting": string, "opdrachtgever": string, "scope": string, "looptijd": string, "sluiting": string, "vragenDeadline": string, "taal": string,
 "gunningscriteria": [{"criterium": string, "weging": string}],
 "eisen": [{"id": string, "eis": string, "type": "knock-out"|"eis"|"wens", "bron": string}],
 "gevraagdeDocumenten": [string], "risicos": [string], "vragenAanOpdrachtgever": [string],
 "goNoGo": {"advies": "go"|"no-go"|"twijfel", "redenen": [string], "ontbrekend": [string]},
 "oplossing": string}
Neem ALLE eisen op die je in de stukken vindt (ook uit bijlagen), met een korte bronvermelding (document/paragraaf).` },
  ontwerp: { max: 8000, ask: `Schrijf het technisch ontwerp (oplossing met Starlink, 4G/5G, straalverbindingen, glasvezel of een combinatie, passend bij de eisen). Schema:
{"titel": string, "secties": ${SECTIONS}}
Behandel: uitgangssituatie, voorgestelde oplossing, architectuur, redundantie en beschikbaarheid, beveiliging, beheer en monitoring, hoe elke knock-out-eis wordt ingevuld.` },
  aanpak: { max: 8000, ask: `Schrijf het plan van aanpak en de SLA- en supportbeschrijving. Schema:
{"planVanAanpak": {"titel": string, "secties": ${SECTIONS}}, "sla": {"titel": string, "secties": ${SECTIONS}}}
SLA-waarden (responstijden, beschikbaarheid) alleen uit het bedrijfsdossier of de eisen; anders [ONTBREEKT: …].` },
  planning: { max: 12000, ask: `Maak de implementatieplanning, het prijzenblad en de commerciële offertebrief. Schema:
{"planning": [{"fase": string, "activiteit": string, "startWeek": number, "duurWeken": number, "verantwoordelijke": string, "mijlpaal": string}],
 "prijzen": [{"post": string, "omschrijving": string, "eenheid": string, "aantal": number, "eenmalig": number|null, "maandelijks": number|null, "bron": string, "opmerking": string}],
 "aannames": [string], "contractwaardeSchatting": string, "margeToelichting": string,
 "offerteBrief": {"titel": string, "secties": ${SECTIONS}}}
Prijzen alleen uit de prijslijst in het bedrijfsdossier (bron vermelden); onbekend = null met opmerking [PRIJS INVULLEN]. Altijd hardware mét abonnement.` },
  compliance: { max: 16000, ask: `Maak de compliance-matrix: per eis uit de analyse of BroadbandEU voldoet. Schema:
{"matrix": [{"id": string, "eis": string, "type": string, "voldoet": "ja"|"deels"|"nee"|"onbekend", "toelichting": string, "bewijs": string, "ontbreekt": string}],
 "referenties": [{"klant": string, "omschrijving": string, "jaar": string, "waarde": string, "contact": string, "bron": string}]}
"bewijs" verwijst naar een document uit het bedrijfsdossier; zonder bewijs "ontbreekt" invullen. Referenties ALLEEN uit het bedrijfsdossier; geen gevonden = lege lijst.` },
  espd: { max: 8000, ask: `Maak het UEA/ESPD-concept, de indieningschecklist en de eindcontrole. Schema:
{"espd": [{"deel": string, "vraag": string, "antwoord": string}],
 "checklist": [{"item": string, "status": "klaar"|"ontbreekt"|"handtekening"|"controleren", "toelichting": string}],
 "eindcontrole": {"ontbrekendeBewijsstukken": [string], "onbeantwoordeEisen": [string], "afwijkingen": [string], "advies": string}}
UEA-antwoorden alleen met gegevens uit het bedrijfsdossier; anders [ONTBREEKT: …]. Verklaringen die ondertekend moeten worden: [HANDTEKENING NODIG].` }
};
export const STEP_ORDER = Object.keys(STEPS);

async function who(request) {
  const email = readSession(request);
  if (!email || !(isAdmin(email) || await hasAccess(email))) return null;
  return email;
}
const key = (pub, part) => `dossier:${pub}:${part}`;

async function loadKb() {
  const ids = (await redis('SMEMBERS', 'kb:ids')) || [];
  if (!ids.length) return [];
  const vals = await Promise.all(ids.map(id => redis('GET', 'kb:' + id)));
  return vals.map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}

async function claude(system, messages, maxTokens) {
  const k = env('ANTHROPIC_API_KEY');
  if (!k) throw new Error('De AI is nog niet ingesteld: ANTHROPIC_API_KEY ontbreekt in Vercel.');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, system, messages, stream: true,
      // het antwoord moet via deze tool: dan levert de AI altijd geldige, ontleedbare JSON
      tools: [{ name: 'lever_onderdeel', description: 'Lever het gevraagde onderdeel van het inschrijfdossier aan als JSON-object volgens het schema in de opdracht.',
        input_schema: { type: 'object', additionalProperties: true } }],
      tool_choice: { type: 'tool', name: 'lever_onderdeel' } })
  });
  if (!r.ok) throw new Error('AI gaf een fout: ' + (await r.text()).slice(0, 300));
  // streamen: lange antwoorden lopen niet vast op een time-out
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '', text = '', usage = {}, stop = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'input_json_delta') text += ev.delta.partial_json || '';
      else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') text += ev.delta.text;
      else if (ev.type === 'message_start') usage = { ...usage, ...ev.message?.usage };
      else if (ev.type === 'message_delta') { usage = { ...usage, ...ev.usage }; stop = ev.delta?.stop_reason || stop; }
      else if (ev.type === 'error') throw new Error('AI gaf een fout: ' + (ev.error?.message || 'onbekend'));
    }
  }
  return { text, usage, stop };
}
function parseJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{');
  if (a < 0) throw new Error('De AI gaf geen bruikbaar antwoord. Probeer deze stap opnieuw.');
  t = t.slice(a);
  try { return JSON.parse(t); } catch {}
  // reparatie: komma's voor sluithaken weg, en een afgekapt antwoord netjes afsluiten
  let r = t.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(r); } catch {}
  const stack = []; let inStr = false, esc = false, lastSafe = 0;
  for (let i = 0; i < r.length; i++) {
    const c = r[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') { stack.pop(); lastSafe = i + 1; }
    else if (c === ',') lastSafe = i;
  }
  if (stack.length || inStr) {
    // terug naar het laatste complete element en alles wat nog open staat sluiten
    let cut = r.slice(0, lastSafe).replace(/,\s*$/, '');
    const st = []; let s2 = false, e2 = false;
    for (const c of cut) { if (s2) { if (e2) e2 = false; else if (c === '\\') e2 = true; else if (c === '"') s2 = false; continue; }
      if (c === '"') s2 = true; else if (c === '{') st.push('}'); else if (c === '[') st.push(']'); else if (c === '}' || c === ']') st.pop(); }
    try { const o = JSON.parse(cut + st.reverse().join('')); o._afgekapt = true; return o; } catch {}
  }
  throw new Error('Het antwoord van de AI was onvolledig. Klik op "Verder met de ontbrekende stappen" om het opnieuw te proberen.');
}

export async function GET(request) {
  try {
    const email = await who(request);
    if (!email) return json({ error: 'Log in om dossiers te bekijken.' }, 401);
    const u = new URL(request.url);
    if (u.searchParams.get('kb')) return json({ kb: (await loadKb()).map(d => ({ id: d.id, name: d.name, chars: d.text.length, by: d.by, at: d.at })) });
    const pub = String(u.searchParams.get('pub') || '').slice(0, 120);
    if (!pub) return json({ error: 'Geen tender opgegeven.' }, 400);
    const meta = await redis('GET', key(pub, 'meta'));
    if (!meta) return json({ exists: false, steps: STEP_ORDER });
    const parts = {};
    await Promise.all(STEP_ORDER.map(async s => { const v = await redis('GET', key(pub, s)); if (v) parts[s] = JSON.parse(v); }));
    return json({ exists: true, steps: STEP_ORDER, meta: JSON.parse(meta), parts });
  } catch (e) { return fail(e); }
}

export async function POST(request) {
  try {
    const email = await who(request);
    if (!email) return json({ error: 'Log in om een dossier te maken.' }, 401);
    const b = await readJson(request);

    // ---- bedrijfsdossier (prijslijst, referenties, SLA, certificaten …) ----
    if (b.action === 'kb-add') {
      const name = String(b.name || '').slice(0, 160), text = String(b.text || '').slice(0, 200000);
      if (!name || text.length < 20) return json({ error: 'Leeg of onleesbaar document.' }, 400);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await redis('SET', 'kb:' + id, JSON.stringify({ id, name, text, by: email, at: new Date().toISOString() }));
      await redis('SADD', 'kb:ids', id);
      return json({ ok: true, id });
    }
    if (b.action === 'kb-delete') {
      if (!isAdmin(email)) return json({ error: 'Alleen beheerders kunnen documenten verwijderen.' }, 403);
      const id = String(b.id || '');
      await redis('DEL', 'kb:' + id); await redis('SREM', 'kb:ids', id);
      return json({ ok: true });
    }

    // ---- één stap van het dossier ----
    if (b.action === 'step') {
      const step = String(b.step || ''), cfg = STEPS[step];
      const pub = String(b.pub || '').slice(0, 120);
      if (!cfg || !pub) return json({ error: 'Onbekende stap.' }, 400);
      const tenderText = String(b.tenderText || '').slice(0, TENDER_MAX);
      if (tenderText.length < 200) return json({ error: 'Te weinig tekst uit de aanbestedingsstukken. Upload het bestek of programma van eisen.' }, 400);
      const tender = b.tender || {};
      const kb = await loadKb();
      let kbText = kb.map(d => `### ${d.name}\n${d.text}`).join('\n\n');
      if (kbText.length > KB_MAX) kbText = kbText.slice(0, KB_MAX) + '\n[… bedrijfsdossier ingekort]';
      // vaste delen vooraan en gecachet: zo kost elke volgende stap veel minder
      const system = [
        { type: 'text', text: `Je bent de AI Tender Bid Assistant van BroadbandEU. Je bereidt inschrijvingen op aanbestedingen voor; een medewerker controleert, keurt goed en dient zelf in.\n\nOVER BROADBANDEU\n${COMPANY}\n\n${RULES}` },
        { type: 'text', text: `BEDRIJFSDOSSIER (enige bron voor bedrijfsgegevens, prijzen, referenties en certificaten)\n${kbText || '[leeg: er zijn nog geen bedrijfsdocumenten geüpload]'}` },
        { type: 'text', text: `AANBESTEDING\nTitel: ${tender.title || ''}\nOpdrachtgever: ${tender.buyer || ''}\nLand: ${tender.country || ''}\nKenmerk: ${pub}\nSluiting: ${tender.deadline || ''}\nLink: ${tender.link || ''}\n\nAANBESTEDINGSSTUKKEN\n${tenderText}`, cache_control: { type: 'ephemeral' } }
      ];
      let prior = '';
      if (step !== 'analyse') {
        const a = await redis('GET', key(pub, 'analyse'));
        if (!a) return json({ error: 'Maak eerst de analyse (stap 1).' }, 400);
        prior = `\n\nANALYSE (stap 1, gebruik deze eisen en de gekozen oplossing):\n${a}`;
      }
      const { text, usage, stop } = await claude(system, [{ role: 'user', content: cfg.ask + prior }], cfg.max);
      if (stop === 'max_tokens') console.warn('dossier: antwoord afgekapt', step);
      const data = parseJson(text);
      await redis('SET', key(pub, step), JSON.stringify(data));
      const metaOld = JSON.parse((await redis('GET', key(pub, 'meta'))) || '{}');
      const meta = { ...metaOld, pub, title: tender.title || metaOld.title || '', by: email, at: new Date().toISOString(),
        files: Array.isArray(b.files) ? b.files.slice(0, 50) : metaOld.files || [], model: MODEL(),
        done: [...new Set([...(metaOld.done || []).filter(s => step === 'analyse' ? false : true), step])] };
      await redis('SET', key(pub, 'meta'), JSON.stringify(meta));
      await redis('SADD', 'dossiers', pub);
      return json({ ok: true, step, data, usage });
    }
    return json({ error: 'Onbekende actie.' }, 400);
  } catch (e) { return fail(e); }
}
