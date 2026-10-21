(function () {
"use strict";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const NL = (() => { try { return new Intl.DisplayNames(["nl"], {type:"region"}); } catch(e) { return null; } })();
const cname = (c, fallback) => { if(!c) return fallback || "–"; try { const n = NL && NL.of(c); return n && n !== c ? n : c; } catch(e) { return c; } };
const when = iso => iso ? new Date(iso).toLocaleString("nl-NL", {day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"}) : "–";
let D = null;

function msg(text, err){ const m = $("msg"); m.textContent = text || ""; m.hidden = !text; m.classList.toggle("err", !!err); if(text && !err) setTimeout(() => { if(m.textContent === text) m.hidden = true; }, 5000); }
async function api(method, body, query){
  const r = await fetch("/api/admin" + (query || ""), {method, credentials:"same-origin", headers:{"Content-Type":"application/json"}, body: body ? JSON.stringify(body) : undefined});
  let d = {}; try { d = await r.json(); } catch(e) {}
  if(!r.ok) throw Object.assign(new Error(d.error || "Er ging iets mis."), {status:r.status});
  return d;
}
async function act(body, okText){
  try { await api("POST", body); if(okText) msg(okText); await load(); }
  catch(e) { msg(e.message, true); }
}

function renderSources(){
  $("updated").textContent = "Gegevens laatst bijgewerkt: " + when(D.updated) + ". Elke werkdag rond 07:00 automatisch.";
  const names = [...new Set([...Object.keys(D.sources || {}), ...D.tenders.map(t => t.source)])].sort((a,b) => a.localeCompare(b, "nl"));
  const counts = {}; D.tenders.forEach(t => counts[t.source] = (counts[t.source] || 0) + 1);
  $("srcRows").innerHTML = names.map(n => {
    const s = D.sources[n];
    const status = !s ? `<span class="note">nog niet opgehaald</span>` : s.ok ? `<span class="ok">werkt</span>${s.note ? `<br><small class="note">${esc(s.note)}</small>` : ""}` : `<span class="bad">fout</span><br><small class="note">${esc(s.error || "")}</small>`;
    return `<tr><td>${esc(n)}</td><td>${status}</td><td>${s ? when(s.at) : "–"}</td><td class="num">${counts[n] || 0}</td></tr>`;
  }).join("");
  $("btnRefresh").disabled = !D.canRefresh;
  $("refreshHint").innerHTML = D.canRefresh
    ? "Verversen duurt een paar minuten. Ververs daarna deze pagina."
    : `Verversen met deze knop is nog niet ingesteld. Je kunt het wel op GitHub doen: <a href="https://github.com/mbkroep-lgtm/tenderkaart/actions" target="_blank" rel="noopener">Actions</a> → Tenders ophalen → Run workflow.`;
}
function renderWords(){
  $("words").innerHTML = D.words.length
    ? D.words.map((w, i) => `<span class="chip">${esc(w)}<button type="button" data-word="${i}" aria-label="Verwijder ${esc(w)}">×</button></span>`).join("")
    : `<span class="note">Nog geen eigen uitsluitwoorden.</span>`;
}
function tenderLine(t, btn){
  return `<li><div class="t-title"><a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.titleNl || t.title)}</a>
    <small>${esc(t.source)} · ${esc(cname(t.country, t.countryName))} · ${esc(t.published || "")} · ${esc(t.pub)}</small></div>${btn}</li>`;
}
function renderHidden(){
  const byPub = new Map(D.tenders.map(t => [t.pub, t]));
  $("hiddenCount").textContent = D.hidden.length;
  $("hiddenList").innerHTML = D.hidden.length
    ? D.hidden.map(p => tenderLine(byPub.get(p) || {pub:p, title:"(niet meer in de gegevens)", source:"", link:"#"}, `<button type="button" data-unhide="${esc(p)}">Terugzetten</button>`)).join("")
    : `<li><span class="note">Er zijn geen verborgen tenders.</span></li>`;
  renderSearch();
}
function renderSearch(){
  const q = $("tSearch").value.trim().toLowerCase();
  const hidden = new Set(D.hidden);
  const list = D.tenders.filter(t => !hidden.has(t.pub) && (!q || `${t.title} ${t.titleNl || ""} ${t.pub} ${cname(t.country, t.countryName)} ${t.source}`.toLowerCase().includes(q))).slice(0, 40);
  $("tList").innerHTML = list.length ? list.map(t => tenderLine(t, `<button type="button" class="danger" data-hide="${esc(t.pub)}">Verberg</button>`)).join("") : `<li><span class="note">Geen tenders gevonden.</span></li>`;
}
function renderCustomers(){
  $("custCount").textContent = D.customers.length;
  $("custRows").innerHTML = D.customers.length
    ? D.customers.map(c => `<tr><td>${esc(c.email)}</td><td>${when(c.at)}</td><td>${c.manual ? "handmatig" : "betaald via Stripe"}</td><td><button type="button" class="danger" data-revoke="${esc(c.email)}">Intrekken</button></td></tr>`).join("")
    : `<tr><td colspan="4" class="note">Nog geen klanten.</td></tr>`;
  const bl = D.blocked || [];
  $("blockCount").textContent = bl.length;
  if(D.staffDomains) $("staffNote").textContent = `Iedereen met een e-mailadres op ${D.staffDomains.map(d => "@" + d).join(" of ")} kan inloggen. Wie hier staat, kan dat niet meer; is hij nu ingelogd, dan wordt hij er direct uitgezet.`;
  $("blocked").innerHTML = bl.length
    ? bl.map(v => `<span class="chip">${esc(v)}<button type="button" data-unblock="${esc(v)}" aria-label="Toegang teruggeven aan ${esc(v)}" title="Toegang teruggeven">×</button></span>`).join("")
    : `<span class="note">Niemand geblokkeerd.</span>`;
  const items = [...D.free.domains.map(v => ({v, label:"@" + v})), ...D.free.emails.map(v => ({v, label:v}))];
  $("free").innerHTML = items.length
    ? items.map(x => `<span class="chip">${esc(x.label)}<button type="button" data-free="${esc(x.v)}" aria-label="Verwijder ${esc(x.label)}">×</button></span>`).join("")
    : `<span class="note">Nog niemand via deze pagina.</span>`;
  const env = [D.free.envDomains, D.free.envEmails].filter(Boolean).join(", ");
  $("envFree").textContent = env ? `Vast ingesteld in Vercel (hier niet te wijzigen): ${env}` : "";
}
function renderAll(){
  $("who").textContent = "Ingelogd als " + D.me;
  renderSources(); renderWords(); renderHidden(); renderCustomers();
}
async function load(){
  try { D = await api("GET"); renderAll(); return D; }
  catch(e) {
    if(e.status === 403 || e.status === 401){ $("who").innerHTML = 'Alleen voor beheerders. <a href="/">Log in op de kaart</a> met een beheerdersadres.'; document.querySelectorAll(".card").forEach(c => c.hidden = true); }
    else msg(e.message, true);
  }
}

// ---------- acties ----------
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("button"); if(!b) return;
  if(b.dataset.word !== undefined){ const words = D.words.filter((_, i) => i !== Number(b.dataset.word)); act({action:"words", words}, "Uitsluitwoord verwijderd."); }
  else if(b.dataset.unhide){ act({action:"unhide", pub:b.dataset.unhide}, "Tender teruggezet."); }
  else if(b.dataset.hide){ act({action:"hide", pub:b.dataset.hide}, "Tender verborgen."); }
  else if(b.dataset.revoke){ if(confirm(`Toegang intrekken voor ${b.dataset.revoke}? Deze persoon moet dan opnieuw betalen.`)) act({action:"revoke", value:b.dataset.revoke}, "Toegang ingetrokken."); }
  else if(b.dataset.unblock){ act({action:"block-remove", value:b.dataset.unblock}, `Toegang teruggegeven aan ${b.dataset.unblock}.`); }
  else if(b.dataset.free){ act({action:"free-remove", value:b.dataset.free}, "Gratis toegang verwijderd."); }
});
$("wordForm").addEventListener("submit", e => { e.preventDefault(); const w = $("wordInput").value.trim(); if(w.length < 2) return msg("Een uitsluitwoord moet minstens 2 tekens hebben.", true); $("wordInput").value = ""; act({action:"words", words:[...D.words, w]}, `"${w}" toegevoegd.`); });
$("grantForm").addEventListener("submit", e => { e.preventDefault(); const v = $("grantInput").value.trim(); $("grantInput").value = ""; act({action:"grant", value:v}, `Toegang gegeven aan ${v}.`); });
$("blockForm").addEventListener("submit", e => { e.preventDefault(); const v = $("blockInput").value.trim(); if(!v) return; $("blockInput").value = ""; act({action:"block-add", value:v}, `${v} heeft geen toegang meer.`); });
$("freeForm").addEventListener("submit", e => { e.preventDefault(); const v = $("freeInput").value.trim(); $("freeInput").value = ""; act({action:"free-add", value:v}, `Gratis toegang voor ${v}.`); });
$("tSearch").addEventListener("input", renderSearch);
// ---------- voortgang van een ophaalronde ----------
const STAGES = [
  {key:"queued", label:"In de wachtrij"},
  {key:"setup", label:"Starten"},
  {key:"fetch", label:"Tenders ophalen"},
  {key:"save", label:"Opslaan"},
  {key:"deploy", label:"Site bijwerken"},
  {key:"done", label:"Klaar"}
];
let polling = 0, clickedAt = 0, tracking = null, deployUntil = 0;
const fmtDur = ms => { const s = Math.max(0, Math.round(ms/1000)); return s < 60 ? `${s} s` : `${Math.floor(s/60)} min ${String(s%60).padStart(2,"0")} s`; };
function stageOf(run, steps){
  if(!run) return 0;
  if(run.status === "queued" || run.status === "waiting" || run.status === "pending" || run.status === "requested") return 0;
  if(run.status !== "completed"){
    const f = steps.find(s => /ophalen/i.test(s.name)), o = steps.find(s => /opslaan/i.test(s.name));
    if(o && o.status !== "queued" && o.status !== "pending") return 3;
    if(f && f.status !== "queued" && f.status !== "pending") return 2;
    return 1;
  }
  return run.conclusion === "success" ? (Date.now() < deployUntil ? 4 : 5) : -1;
}
function showProgress(d){
  const run = d.run, steps = d.steps || [];
  const box = $("progress"); box.hidden = false;
  let st = stageOf(run, steps);
  const failed = st === -1;
  const failIdx = failed ? Math.max(1, steps.findIndex(s => s.conclusion === "failure") >= 0 && /opslaan/i.test(steps.find(s => s.conclusion === "failure").name) ? 3 : 2) : -1;
  box.classList.toggle("done", st === 5); box.classList.toggle("failed", failed);
  $("pgSteps").innerHTML = STAGES.map((s, i) => {
    let c = "";
    if(failed) c = i < failIdx ? "ok" : i === failIdx ? "bad" : "";
    else c = i < st ? "ok" : i === st ? (st === 5 ? "ok" : "active") : "";
    return `<li class="${c}">${s.label}</li>`;
  }).join("");
  const pct = failed ? 100 : st === 5 ? 100 : [5, 15, 45, 80, 92][st];
  $("pgBar").style.width = pct + "%";
  const start = Date.parse(run?.started_at || run?.created_at || clickedAt || Date.now());
  const end = run?.status === "completed" ? Date.parse(run.updated_at) : Date.now();
  $("pgTime").textContent = run ? (run.status === "completed" ? "duurde " : "bezig: ") + fmtDur(end - start) : "";
  const who = run?.event === "schedule" ? "automatische ronde" : (run?.event === "workflow_dispatch" || (!run?.event && clickedAt)) ? "handmatig gestart" : "na een wijziging";
  $("pgTitle").textContent = failed ? "Verversen mislukt" : st === 5 ? "Verversen klaar" : `Verversen bezig (${who})`;
  const link = run?.url ? ` <a href="${esc(run.url)}" target="_blank" rel="noopener">Details op GitHub</a>` : "";
  $("pgNote").innerHTML = failed ? "De vorige gegevens blijven gewoon op de kaart staan." + link
    : st === 0 ? "Wacht tot een eerdere ronde klaar is." + link
    : st === 2 ? "TED, Wereldbank, Find a Tender en SAM.gov worden doorzocht. Meestal 1 tot 3 minuten; na een grote wijziging soms 10 minuten." + link
    : st === 4 ? "De nieuwe gegevens worden op de site gezet (ongeveer 30 seconden)."
    : st === 5 ? "De nieuwe gegevens staan op de kaart." : link;
}
async function poll(){
  clearTimeout(polling);
  let d;
  try { d = await api("GET", null, "?runs=1"); } catch(e) { $("progress").hidden = true; return; }
  const run = d.run;
  // net op de knop geklikt, maar GitHub kent de nieuwe ronde nog niet: als wachtrij tonen
  if(clickedAt && !tracking && (!run || Date.parse(run.created_at) < clickedAt - 5000)){
    showProgress({run:{status:"queued", created_at:new Date(clickedAt).toISOString()}, steps:[]});
    polling = setTimeout(poll, 3000); return;
  }
  if(!run) return;
  // volgen: de ronde na een klik, of een ronde die al bezig was bij het openen van de pagina
  if(!tracking && (clickedAt || run.status !== "completed")) tracking = run.id;
  if(tracking !== run.id && run.status !== "completed") tracking = run.id;
  if(tracking !== run.id) return;
  if(run.status === "completed" && run.conclusion === "success" && !deployUntil) deployUntil = Date.now() + 40000;
  showProgress(d);
  const finished = run.status === "completed" && (run.conclusion !== "success" || Date.now() >= deployUntil);
  if(finished){
    clickedAt = 0; tracking = null; deployUntil = 0;
    $("btnRefresh").disabled = !D.canRefresh;
    if(run.conclusion === "success") load();
    return;
  }
  polling = setTimeout(poll, run.status === "completed" ? 5000 : 4000);
}
$("btnRefresh").addEventListener("click", async () => {
  const b = $("btnRefresh"); b.disabled = true;
  try { await api("POST", {action:"refresh"}); clickedAt = Date.now(); tracking = null; deployUntil = 0; poll(); }
  catch(e) { msg(e.message, true); b.disabled = !D.canRefresh; }
});
load().then(() => { if(D && D.canRefresh) poll(); });
})();
