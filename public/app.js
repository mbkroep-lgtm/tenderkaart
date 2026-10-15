(function () {
"use strict";

// ---------- Landen ----------
// Landnamen in het Nederlands voor elk land (ingebouwd in de browser)
const NL_REGION = (() => { try { return new Intl.DisplayNames(["nl"], {type:"region"}); } catch(e) { return null; } })();
const EN_REGION = (() => { try { return new Intl.DisplayNames(["en"], {type:"region"}); } catch(e) { return null; } })();
const NAME_FIX = {XK:"Kosovo"};
const cname = c => { if(!c) return "Onbekend"; if(NAME_FIX[c]) return NAME_FIX[c]; try { const n = NL_REGION && NL_REGION.of(c); return n && n !== c ? n : c; } catch(e) { return c; } };
// Engelse kaartnamen → landcode
const EN = {};
if(EN_REGION) for(let a = 65; a <= 90; a++) for(let b = 65; b <= 90; b++){
  const code = String.fromCharCode(a, b); let n; try { n = EN_REGION.of(code); } catch(e) {}
  if(n && n !== code) EN[n.toLowerCase()] = code;
}
Object.assign(EN, {"bosnia and herz.":"BA","czech rep.":"CZ",czechia:"CZ",macedonia:"MK","north macedonia":"MK",kosovo:"XK",russia:"RU",
  "united states of america":"US","dem. rep. congo":"CD","congo":"CG","central african rep.":"CF","s. sudan":"SS","eq. guinea":"GQ",
  "w. sahara":"EH","solomon is.":"SB","côte d'ivoire":"CI","eswatini":"SZ","dominican rep.":"DO","n. cyprus":"CY","somaliland":"SO",
  "falkland is.":"FK","fr. s. antarctic lands":"TF","timor-leste":"TL","myanmar":"MM","laos":"LA","lao pdr":"LA","north korea":"KP",
  "dem. rep. korea":"KP","south korea":"KR","korea":"KR","taiwan":"TW","palestine":"PS","vietnam":"VN","syria":"SY","iran":"IR",
  "tanzania":"TZ","bolivia":"BO","venezuela":"VE","brunei":"BN","moldova":"MD","turkey":"TR","türkiye":"TR","cabo verde":"CV",
  "faeroe is.":"FO","cayman is.":"KY","marshall is.":"MH","n. mariana is.":"MP","st. vin. and gren.":"VC","st. kitts and nevis":"KN",
  "antigua and barb.":"AG","br. indian ocean ter.":"IO","heard i. and mcdonald is.":"HM","s. geo. and the is.":"GS","wallis and futuna is.":"WF",
  "fr. polynesia":"PF","u.s. virgin is.":"VI","british virgin is.":"VG","turks and caicos is.":"TC","st-martin":"MF","st-barthélemy":"BL",
  "sint maarten":"SX","curaçao":"CW","åland":"AX","vatican":"VA","macao":"MO","hong kong":"HK","greenland":"GL","puerto rico":"PR"});

// ---------- Hulpjes ----------
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const DAY = 86400000;
function today(){ const d = new Date(); d.setHours(0,0,0,0); return d; }
function fmt(d){ if(!d) return "–"; const [y,m,dd] = d.split("-"); return `${dd}-${m}-${y}`; }
function daysLeft(d){ if(!d) return null; return Math.round((new Date(d+"T00:00:00") - today()) / DAY); }
function fmtMoney(n, cur){
  if(n == null) return "";
  const sym = cur === "EUR" ? "€ " : (cur || "") + " ";
  if(n >= 1e6) return sym + (n/1e6).toLocaleString("nl-NL",{maximumFractionDigits:1}) + " mln";
  if(n >= 1e3) return sym + Math.round(n/1e3).toLocaleString("nl-NL") + "k";
  return sym + Math.round(n).toLocaleString("nl-NL");
}

// ---------- Status ----------
let tenders = [];
let updated = null;
const state = { q:"", status:"open", country:"", sort:"deadline", minValue:0, source:"" };
try { Object.assign(state, JSON.parse(localStorage.getItem("tk-filters") || "{}")); state.country = ""; state.q = ""; } catch(e) {}
function saveFilters(){ try { localStorage.setItem("tk-filters", JSON.stringify({status:state.status, sort:state.sort, minValue:state.minValue})); } catch(e) {} }

// 'nieuw' = binnengekomen na je vorige bezoek (per persoon, in deze browser)
let prevVisit = null;
try { prevVisit = localStorage.getItem("tk-lastvisit"); } catch(e) {}
if(!prevVisit) prevVisit = new Date().toISOString();
function markVisit(){ try { localStorage.setItem("tk-lastvisit", new Date().toISOString()); } catch(e) {} }
addEventListener("pagehide", markVisit);
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") markVisit(); });
const isNew = t => !!(t.firstSeen && t.firstSeen > prevVisit);

// soort bericht: echte aankondiging, gegunde opdracht of vooraankondiging
const AWARD_TYPES = ["Gegunde opdracht", "Wijziging opdracht", "Vrijwillige transparantie"];
function kindOf(t){
  if(t.kind) return t.kind;
  if(AWARD_TYPES.includes(t.type)) return "award";
  if(t.type === "Vooraankondiging") return "prior";
  return "notice";
}
function statusOf(t){
  const k = kindOf(t);
  if(k === "award") return "awarded";
  const dl = daysLeft(t.deadline);
  if(dl !== null && dl < 0) return "closed";            // sluitingsdatum voorbij = gesloten, wat voor bericht ook
  if(k === "prior") return "prior";
  if(dl === null){                                      // geen sluitingsdatum: na 3 maanden als gesloten beschouwen
    const age = t.published ? (today() - new Date(t.published + "T00:00:00")) / DAY : 0;
    return age > 90 ? "closed" : "open";
  }
  return dl <= 14 ? "soon" : "open";
}
const isOpen = t => { const s = statusOf(t); return s === "open" || s === "soon"; };
const effStatus = () => state.status;
function filtered(ignoreCountry){
  const q = state.q.trim().toLowerCase();
  return tenders.filter(t => {
    const st = statusOf(t);
    if(state.source && (t.source || "TED") !== state.source) return false;
    if(effStatus() === "open" && !isOpen(t)) return false;
    if(state.status === "soon" && st !== "soon") return false;
    if(state.status === "new" && (!isNew(t) || !isOpen(t))) return false;
    if(state.status === "prior" && st !== "prior") return false;
    if(state.status === "awarded" && st !== "awarded") return false;
    if(state.minValue > 0 && !(t.value >= state.minValue)) return false;
    if(!ignoreCountry && state.country && t.country !== state.country) return false;
    if(q && !(`${t.title} ${t.buyer} ${t.pub} ${cname(t.country)}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

// ---------- Wereldbol ----------
const ns = "http://www.w3.org/2000/svg";
const W = 1000, H = 760;
const HOME = {rot:[-14, -38, 0], zoom:0.95};  // hele aardbol, Europa naar voren
let proj = null, gpath = null, s0 = 1, zoom = HOME.zoom;
let features = [];            // {key, f, el, eu, best, area}
let paths = {}, labels = null, counts = {}, sphereEl = null, gratEl = null, gratGeo = null;
let dragging = false, suppressClick = false, raf = 0, idleTimer = 0, quality = "high";

async function buildMap(){
  const svg = $("map");
  if(!window.d3 || !window.topojson){ $("mapnote").textContent = "De kaart kon niet laden. De lijst werkt gewoon."; return; }
  let world, light;
  try {
    // gedetailleerde kaart voor stilstand, lichte kaart voor tijdens het draaien
    [world, light] = await Promise.all([
      fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json").then(r => r.json()),
      fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then(r => r.json()).catch(() => null)
    ]);
  } catch(e) { $("mapnote").textContent = "De kaart kon niet laden. De lijst werkt gewoon."; return; }
  const geo = topojson.feature(world, world.objects.countries);
  const lightById = {};
  if(light) topojson.feature(light, light.objects.countries).features.forEach(f => { if(f.id != null) lightById[f.id] = f; });

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.aspectRatio = `${W}/${H}`;
  proj = d3.geoOrthographic().clipAngle(90).precision(0.4).translate([W/2, H/2]);
  s0 = Math.min(W, H) / 2 - 12;
  proj.rotate(HOME.rot).scale(s0 * zoom);
  gpath = d3.geoPath(proj);

  // oceaan met gloed
  const defs = document.createElementNS(ns, "defs");
  defs.innerHTML = `<radialGradient id="ocean" cx="42%" cy="38%" r="65%"><stop offset="0%" stop-color="#16305a"/><stop offset="70%" stop-color="#0c1a33"/><stop offset="100%" stop-color="#081224"/></radialGradient>
    <radialGradient id="halo"><stop offset="88%" stop-color="rgba(90,160,255,.28)"/><stop offset="100%" stop-color="rgba(90,160,255,0)"/></radialGradient>`;
  svg.appendChild(defs);
  const halo = document.createElementNS(ns, "circle"); halo.setAttribute("class","halo"); svg.appendChild(halo);
  sphereEl = document.createElementNS(ns, "path"); sphereEl.setAttribute("class","sphere"); svg.appendChild(sphereEl);
  gratGeo = d3.geoGraticule().step([15,15])();
  gratEl = document.createElementNS(ns, "path"); gratEl.setAttribute("class","grat"); svg.appendChild(gratEl);
  const g = document.createElementNS(ns, "g"); g.setAttribute("class","lands"); svg.appendChild(g);

  geo.features.forEach((f, i) => {
    if(!f.geometry) return;
    const name = ((f.properties || {}).name || "").toLowerCase();
    if(name === "antarctica") return;
    const code = EN[name] || "";
    const eu = !!code && !paths[code];
    const key = eu ? code : "x" + i;
    const el = document.createElementNS(ns, "path");
    el.dataset.c = key;
    if(eu){ el.classList.add("eu"); el.setAttribute("tabindex","0"); el.setAttribute("aria-label", cname(code)); }
    g.appendChild(el); paths[key] = el;
    let best = null, area = 0;
    if(eu){ // grootste deel (vasteland) voor het bolletje
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      polys.forEach(rings => { const p = {type:"Polygon", coordinates:rings}; const a = d3.geoArea(p); if(a > area){ area = a; best = p; } });
    }
    features.push({key, f, fl: f.id != null ? lightById[f.id] || null : null, el, eu, centroid: best ? d3.geoCentroid(best) : null, area});
  });

  labels = document.createElementNS(ns, "g"); labels.setAttribute("class","labels"); svg.appendChild(labels);
  $("mapnote").hidden = true;
  redraw();

  const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; $("mapbox").appendChild(tip);
  setupGlobe(svg, tip);
  svg.addEventListener("mousemove", e => {
    const c = e.target.dataset && e.target.dataset.c;
    if(dragging || !c || c[0] === "x"){ tip.hidden = true; return; }
    const n = counts[c] || 0; const r = $("mapbox").getBoundingClientRect();
    tip.innerHTML = `<b>${esc(cname(c))}</b> · ${n} tender${n === 1 ? "" : "s"}`;
    tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; tip.hidden = false;
  });
  svg.addEventListener("mouseleave", () => tip.hidden = true);
  const pick = c => { if(!c || c[0] === "x") return; state.country = state.country === c ? "" : c; render(); };
  svg.addEventListener("click", e => { if(suppressClick){ suppressClick = false; return; } pick(e.target.dataset && e.target.dataset.c); });
  svg.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); pick(e.target.dataset && e.target.dataset.c); } });
  render();
}

function redraw(){
  if(!proj) return;
  const s = proj.scale();
  const low = quality === "low";
  proj.precision(low ? 1.5 : 0.4);
  const halo = $("map").querySelector(".halo");
  if(halo){ halo.setAttribute("cx", W/2); halo.setAttribute("cy", H/2); halo.setAttribute("r", s * 1.08); }
  sphereEl.setAttribute("d", gpath({type:"Sphere"}));
  gratEl.setAttribute("d", gpath(gratGeo) || "");
  for(const x of features){
    const f = low ? x.fl : x.f;          // tijdens draaien: lichte kaart (kleine eilanden even weg)
    x.el.setAttribute("d", f ? (gpath(f) || "") : "");
  }
  if(low) labels.innerHTML = ""; else drawLabels();
}
// tijdens bewegen licht tekenen, bij stilstand meteen weer gedetailleerd
const scheduleRedraw = () => {
  quality = "low";
  if(!raf) raf = requestAnimationFrame(() => { raf = 0; redraw(); });
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { quality = "high"; redraw(); }, 160);
};
function setZoom(z){ zoom = Math.max(0.6, Math.min(14, z)); proj.scale(s0 * zoom); scheduleRedraw(); }

// vloeiend naar een draaiing en zoom bewegen
function flyTo(rot, z, ms = 700){
  if(!proj) return;
  const r0 = proj.rotate(), z0 = zoom;
  const ir = d3.interpolate(r0, rot), iz = d3.interpolate(z0, z);
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce){ proj.rotate(rot); zoom = z; proj.scale(s0*z); quality = "high"; redraw(); return; }
  const t0 = performance.now();
  const step = now => { const t = Math.min(1, (now - t0)/ms), e = d3.easeCubicInOut(t);
    proj.rotate(ir(e)); zoom = iz(e); proj.scale(s0*zoom);
    quality = t < 1 ? "low" : "high"; redraw(); if(t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function setupGlobe(svg, tip){
  const pts = new Map(); let start = null, pinch = null;
  const toView = (x, y) => { const r = svg.getBoundingClientRect(); return [(x - r.left)/r.width*W, (y - r.top)/r.height*H]; };
  svg.addEventListener("pointerdown", e => {
    pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(pts.size === 1) start = {x:e.clientX, y:e.clientY, rot:proj.rotate().slice(), moved:false};
    if(pts.size === 2){ const [a,b] = [...pts.values()]; pinch = {d:Math.hypot(a.x-b.x, a.y-b.y), z:zoom}; start = null; }
  });
  svg.addEventListener("pointermove", e => {
    if(!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(pinch && pts.size === 2){ const [a,b] = [...pts.values()]; setZoom(pinch.z * (Math.hypot(a.x-b.x, a.y-b.y) || 1) / pinch.d); suppressClick = true; return; }
    if(!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if(!start.moved && Math.hypot(dx, dy) < 5) return;
    if(!start.moved){ start.moved = true; dragging = true; svg.classList.add("dragging"); tip.hidden = true; try { svg.setPointerCapture(e.pointerId); } catch(_) {} }
    const r = svg.getBoundingClientRect();
    const k = 180 / (proj.scale() * Math.PI) * (W / r.width);   // graden per schermpixel
    proj.rotate([start.rot[0] + dx*k, Math.max(-85, Math.min(85, start.rot[1] - dy*k)), 0]);
    scheduleRedraw();
  });
  const end = e => {
    pts.delete(e.pointerId);
    if(start && start.moved) suppressClick = true;
    if(pts.size < 2) pinch = null;
    if(pts.size === 0){ start = null; dragging = false; svg.classList.remove("dragging"); }
    else if(pts.size === 1){ const p = [...pts.values()][0]; start = {x:p.x, y:p.y, rot:proj.rotate().slice(), moved:true}; }
  };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
  svg.addEventListener("wheel", e => { e.preventDefault(); setZoom(zoom * Math.exp(-e.deltaY*(e.deltaMode === 1 ? 0.05 : 0.0018))); }, {passive:false});
  $("zIn").onclick = () => setZoom(zoom * 1.5);
  $("zOut").onclick = () => setZoom(zoom / 1.5);
  $("zHome").onclick = () => flyTo([-14, -50, 0], 2.4);
  $("zWorld").onclick = () => flyTo([proj.rotate()[0], -20, 0], 0.95);
}
// bij klik op een land in de lijst: daarheen draaien
function focusCountry(c){
  const x = features.find(f => f.key === c);
  if(x && x.centroid) flyTo([-x.centroid[0], -x.centroid[1], 0], Math.max(zoom, 2.2));
}

// weinig tenders = licht blauw, veel tenders = donkerder blauw
const RAMP = [[214,232,250],[150,198,245],[84,152,232],[36,104,206],[14,62,150]];
function ramp(t){ t = Math.max(0, Math.min(1, t)); const i = t*(RAMP.length-1), a = Math.floor(i), b = Math.min(a+1, RAMP.length-1), f = i-a;
  return `rgb(${RAMP[a].map((v,k) => Math.round(v + (RAMP[b][k]-v)*f)).join(",")})`; }
function paintMap(){
  counts = {}; filtered(true).forEach(t => { if(t.country) counts[t.country] = (counts[t.country] || 0) + 1; });
  const max = Math.max(1, ...Object.values(counts));
  $("legMax").textContent = max > 1 ? String(max) : "meer";
  Object.entries(paths).forEach(([c, el]) => {
    const n = counts[c] || 0;
    el.style.fill = n ? ramp(max > 1 ? Math.sqrt((n-1)/(max-1)) : 0) : "";
    el.classList.toggle("sel", state.country === c);
  });
  drawLabels();
}
function drawLabels(){
  if(!labels || !proj) return;
  labels.innerHTML = "";
  const centre = proj.invert([W/2, H/2]);
  const s = proj.scale();
  Object.entries(counts).forEach(([c, n]) => {
    const x = features.find(f => f.key === c); if(!x || !x.centroid) return;
    if(d3.geoDistance(x.centroid, centre) > Math.PI/2 - 0.05) return;   // achterkant van de bol
    const p = proj(x.centroid); if(!p) return;
    // bolletje schaalt mee met de grootte van het land op het scherm
    const r = Math.max(5, Math.min(16, Math.sqrt(x.area) * s * 0.28));
    const ci = document.createElementNS(ns,"circle"); ci.setAttribute("cx",p[0]); ci.setAttribute("cy",p[1]); ci.setAttribute("r",r); ci.setAttribute("class","dot");
    const tx = document.createElementNS(ns,"text"); tx.setAttribute("x",p[0]); tx.setAttribute("y",p[1]); tx.setAttribute("class","cnt"); tx.style.fontSize = (r*1.15) + "px"; tx.textContent = n > 99 ? "99+" : n;
    labels.appendChild(ci); labels.appendChild(tx);
  });
}

// ---------- Lijst ----------
const dlText = t => { const st = statusOf(t); return (st === "awarded" || st === "prior") ? leftText(t) : `Sluit ${fmt(t.deadline)} · ${leftText(t)}`; };
const valHtml = t => t.value ? `<span class="val">${esc(fmtMoney(t.value, t.currency))}</span>` : "";
const newHtml = t => isNew(t) ? `<span class="newtag">NIEUW</span>` : "";
function leftText(t){ const st = statusOf(t);
  if(st === "awarded") return "gegund"; if(st === "prior") return "vooraankondiging, inschrijven nog niet mogelijk";
  const dl = daysLeft(t.deadline); return dl === null ? "geen sluitingsdatum" : dl < 0 ? "gesloten" : dl === 0 ? "sluit vandaag" : `nog ${dl} dag${dl === 1 ? "" : "en"}`; }
function titleHtml(t){ return t.link ? `<a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.title)}</a>` : esc(t.title); }
function card(t){
  return `<article class="t ${statusOf(t)}"><h3>${newHtml(t)}${titleHtml(t)}</h3>
    <div class="meta"><span class="src">${esc(t.source || "TED")}</span><span>${esc(t.country ? cname(t.country) : (t.countryName || "Onbekend land"))}</span>${t.buyer ? `<span>${esc(t.buyer)}</span>` : ""}</div>
    <div class="meta"><span class="dl">${dlText(t)}</span>${valHtml(t)}<span class="mono">Gepubl. ${fmt(t.published)}</span><span class="mono">${esc(t.pub)}</span>${t.type ? `<span>${esc(t.type)}</span>` : ""}</div></article>`;
}
function panelCard(t){
  return `<article class="t ${statusOf(t)}"><h3>${newHtml(t)}${titleHtml(t)}</h3>${t.buyer ? `<div class="meta"><span>${esc(t.buyer)}</span></div>` : ""}<div class="meta"><span class="dl">${dlText(t)}</span>${valHtml(t)}</div></article>`;
}
const SORTERS = {
  deadline: (a,b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"),
  pub: (a,b) => (b.published || "").localeCompare(a.published || ""),
  value: (a,b) => (b.value || -1) - (a.value || -1),
  country: (a,b) => cname(a.country).localeCompare(cname(b.country), "nl") || (a.deadline || "9999").localeCompare(b.deadline || "9999")
};
let loaded = false, loadError = false;
function render(){
  const list = filtered(false).sort(SORTERS[state.sort] || SORTERS.deadline);
  if(loaded){
    $("sOpen").textContent = tenders.filter(isOpen).length;
    $("sNew").textContent = tenders.filter(t => isNew(t) && isOpen(t)).length;
    $("sSoon").textContent = tenders.filter(t => statusOf(t) === "soon").length;
    $("sCountries").textContent = new Set(tenders.filter(t => isOpen(t) && t.country).map(t => t.country)).size;
    $("sUpdated").textContent = updated ? new Date(updated).toLocaleString("nl-NL", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"}) : "nog niet";
  }
  $("listCount").textContent = loaded ? `${list.length} tender${list.length === 1 ? "" : "s"}` : "Laden…";
  const note = $("autoAll"); if(note) note.hidden = !(loaded && state.status === "open" && effStatus() === "all");
  $("selChip").innerHTML = state.country ? `<span class="chip">${esc(cname(state.country))}<button type="button" id="clrC" aria-label="Landfilter wissen">×</button></span>` : "";
  if(state.country) $("clrC").onclick = () => { state.country = ""; render(); };
  const sel = $("fCountry");
  const cs = [...new Set(tenders.map(t => t.country).filter(Boolean))].sort((a,b) => cname(a).localeCompare(cname(b), "nl"));
  sel.innerHTML = `<option value="">Alle landen</option>` + cs.map(c => `<option value="${c}">${esc(cname(c))}</option>`).join("");
  sel.value = state.country;
  $("fSource").value = state.source; $("fStatus").value = state.status; $("fSort").value = state.sort; $("fValue").value = String(state.minValue);
  const box = $("list");
  if(!loaded) {}
  else if(loadError) box.innerHTML = `<div class="empty">De tenders konden niet worden geladen. Ververs de pagina over een paar minuten.</div>`;
  else if(!tenders.length) box.innerHTML = `<div class="empty"><h2>Nog geen tenders</h2>De tenders worden elke werkdag automatisch opgehaald bij TED. Kijk straks nog eens.</div>`;
  else if(!list.length && state.status === "open" && !state.country && !state.q && !state.source && !state.minValue) box.innerHTML = `<div class="empty"><h2>Op dit moment geen open LEO-tenders</h2>Nieuwe tenders verschijnen hier vanzelf zodra ze gepubliceerd worden; de bronnen worden elke werkdag gecontroleerd. Kies bij Status "Gegunde opdrachten" om te zien wie er recent LEO heeft ingekocht.</div>`;
  else if(!list.length) box.innerHTML = `<div class="empty">Geen tenders die bij deze filters passen. Kies bij Status "Alles" of wis het landfilter.</div>`;
  else box.innerHTML = list.map(card).join("");
  paintMap();
  renderPanel(list);
}
function renderPanel(list){
  const p = $("cpanel");
  if(!state.country){ p.hidden = true; return; }
  const n = list.length;
  $("cpTitle").textContent = cname(state.country);
  $("cpSub").textContent = `${n} tender${n === 1 ? "" : "s"} · ${({open:"nog open", soon:"sluit binnen 14 dagen", new:"alleen nieuw", prior:"vooraankondigingen", awarded:"gegunde opdrachten", all:"alles"})[state.status]}`;
  $("cpList").innerHTML = n ? list.map(panelCard).join("") : `<div class="empty">Geen tenders met deze filters. Kies bij Status "Alles" om ook gesloten tenders te zien.</div>`;
  p.hidden = false;
}

// ---------- Bediening ----------
$("q").addEventListener("input", e => { state.q = e.target.value; render(); });
$("fStatus").addEventListener("change", e => { state.status = e.target.value; saveFilters(); render(); });
$("fSource").addEventListener("change", e => { state.source = e.target.value; render(); });
$("fSort").addEventListener("change", e => { state.sort = e.target.value; saveFilters(); render(); });
$("fValue").addEventListener("change", e => { state.minValue = Number(e.target.value) || 0; saveFilters(); render(); });
$("fCountry").addEventListener("change", e => { state.country = e.target.value; render(); if(state.country) focusCountry(state.country); });
$("cpClose").addEventListener("click", () => { state.country = ""; render(); });

// ---------- Starten (na inloggen) ----------
let started = false;
window.startTenderApp = function(){
  if(started) return; started = true;
  render();
  buildMap();
  fetch("/api/tenders", {cache:"no-store", credentials:"same-origin"})
    .then(r => { if(r.status === 401){ location.reload(); throw new Error("uitgelogd"); } if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { tenders = Array.isArray(d.tenders) ? d.tenders : []; updated = d.updated; loaded = true; render(); })
    .catch(() => { loaded = true; loadError = true; render(); });
};
})();
