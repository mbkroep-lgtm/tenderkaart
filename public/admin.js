(function () {
"use strict";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const NL = (() => { try { return new Intl.DisplayNames(["nl"], {type:"region"}); } catch(e) { return null; } })();
const cname = (c, fallback) => { if(!c) return fallback || "–"; try { const n = NL && NL.of(c); return n && n !== c ? n : c; } catch(e) { return c; } };
const when = iso => iso ? new Date(iso).toLocaleString("nl-NL", {day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"}) : "–";
let D = null;

function msg(text, err){ const m = $("msg"); m.textContent = text || ""; m.hidden = !text; m.classList.toggle("err", !!err); if(text && !err) setTimeout(() => { if(m.textContent === text) m.hidden = true; }, 5000); }
async function api(method, body){
  const r = await fetch("/api/admin", {method, credentials:"same-origin", headers:{"Content-Type":"application/json"}, body: body ? JSON.stringify(body) : undefined});
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
  const names = ["TED", "Find a Tender", "Wereldbank", "SAM.gov"];
  const counts = {}; D.tenders.forEach(t => counts[t.source] = (counts[t.source] || 0) + 1);
  $("srcRows").innerHTML = names.map(n => {
    const s = D.sources[n];
    const status = !s ? `<span class="note">nog niet opgehaald</span>` : s.ok ? `<span class="ok">werkt</span>` : `<span class="bad">fout</span><br><small class="note">${esc(s.error || "")}</small>`;
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
  return `<li><div class="t-title"><a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.title)}</a>
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
  const list = D.tenders.filter(t => !hidden.has(t.pub) && (!q || `${t.title} ${t.pub} ${cname(t.country, t.countryName)} ${t.source}`.toLowerCase().includes(q))).slice(0, 40);
  $("tList").innerHTML = list.length ? list.map(t => tenderLine(t, `<button type="button" class="danger" data-hide="${esc(t.pub)}">Verberg</button>`)).join("") : `<li><span class="note">Geen tenders gevonden.</span></li>`;
}
function renderCustomers(){
  $("custCount").textContent = D.customers.length;
  $("custRows").innerHTML = D.customers.length
    ? D.customers.map(c => `<tr><td>${esc(c.email)}</td><td>${when(c.at)}</td><td>${c.manual ? "handmatig" : "betaald via Stripe"}</td><td><button type="button" class="danger" data-revoke="${esc(c.email)}">Intrekken</button></td></tr>`).join("")
    : `<tr><td colspan="4" class="note">Nog geen klanten.</td></tr>`;
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
  try { D = await api("GET"); renderAll(); }
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
  else if(b.dataset.free){ act({action:"free-remove", value:b.dataset.free}, "Gratis toegang verwijderd."); }
});
$("wordForm").addEventListener("submit", e => { e.preventDefault(); const w = $("wordInput").value.trim(); if(w.length < 2) return msg("Een uitsluitwoord moet minstens 2 tekens hebben.", true); $("wordInput").value = ""; act({action:"words", words:[...D.words, w]}, `"${w}" toegevoegd.`); });
$("grantForm").addEventListener("submit", e => { e.preventDefault(); const v = $("grantInput").value.trim(); $("grantInput").value = ""; act({action:"grant", value:v}, `Toegang gegeven aan ${v}.`); });
$("freeForm").addEventListener("submit", e => { e.preventDefault(); const v = $("freeInput").value.trim(); $("freeInput").value = ""; act({action:"free-add", value:v}, `Gratis toegang voor ${v}.`); });
$("tSearch").addEventListener("input", renderSearch);
$("btnRefresh").addEventListener("click", async () => {
  const b = $("btnRefresh"); b.disabled = true;
  try { await api("POST", {action:"refresh"}); msg("Verversen gestart. Over een paar minuten staan de nieuwe gegevens erin."); }
  catch(e) { msg(e.message, true); }
  setTimeout(() => b.disabled = !D.canRefresh, 30000);
});
load();
})();
