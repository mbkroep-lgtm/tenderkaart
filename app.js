(function () {
"use strict";

// ---------- Landen ----------
const NL_NAMES = {AL:"Albanië",AD:"Andorra",AT:"Oostenrijk",BY:"Belarus",BE:"België",BA:"Bosnië en Herzegovina",BG:"Bulgarije",HR:"Kroatië",CY:"Cyprus",CZ:"Tsjechië",DK:"Denemarken",EE:"Estland",FI:"Finland",FR:"Frankrijk",DE:"Duitsland",GR:"Griekenland",HU:"Hongarije",IS:"IJsland",IE:"Ierland",IT:"Italië",XK:"Kosovo",LV:"Letland",LI:"Liechtenstein",LT:"Litouwen",LU:"Luxemburg",MT:"Malta",MD:"Moldavië",MC:"Monaco",ME:"Montenegro",NL:"Nederland",MK:"Noord-Macedonië",NO:"Noorwegen",PL:"Polen",PT:"Portugal",RO:"Roemenië",SM:"San Marino",RS:"Servië",SK:"Slowakije",SI:"Slovenië",ES:"Spanje",SE:"Zweden",CH:"Zwitserland",UA:"Oekraïne",GB:"Verenigd Koninkrijk",VA:"Vaticaanstad",TR:"Turkije",GE:"Georgië",AM:"Armenië",RU:"Rusland"};
const EN = {albania:"AL",andorra:"AD",austria:"AT",belarus:"BY",belgium:"BE","bosnia and herz.":"BA","bosnia and herzegovina":"BA",bulgaria:"BG",croatia:"HR",cyprus:"CY",czechia:"CZ","czech rep.":"CZ","czech republic":"CZ",denmark:"DK",estonia:"EE",finland:"FI",france:"FR",germany:"DE",greece:"GR",hungary:"HU",iceland:"IS",ireland:"IE",italy:"IT",kosovo:"XK",latvia:"LV",liechtenstein:"LI",lithuania:"LT",luxembourg:"LU",malta:"MT",moldova:"MD",monaco:"MC",montenegro:"ME",netherlands:"NL",macedonia:"MK","north macedonia":"MK",norway:"NO",poland:"PL",portugal:"PT",romania:"RO","san marino":"SM",serbia:"RS",slovakia:"SK",slovenia:"SI",spain:"ES",sweden:"SE",switzerland:"CH",ukraine:"UA","united kingdom":"GB",vatican:"VA",turkey:"TR",georgia:"GE",armenia:"AM",russia:"RU"};
const EUROPE = Object.keys(NL_NAMES);
const cname = c => NL_NAMES[c] || c || "Onbekend";

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
const state = { q:"", status:"open", country:"", sort:"deadline", minValue:0 };
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
  if(k === "prior") return "prior";
  const dl = daysLeft(t.deadline);
  if(dl === null) return "open"; if(dl < 0) return "closed"; if(dl <= 14) return "soon"; return "open";
}
const isOpen = t => { const s = statusOf(t); return s === "open" || s === "soon"; };
function filtered(ignoreCountry){
  const q = state.q.trim().toLowerCase();
  return tenders.filter(t => {
    const st = statusOf(t);
    if(state.status === "open" && !isOpen(t)) return false;
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

// ---------- Kaart ----------
const ns = "http://www.w3.org/2000/svg";
const W = 1000, H = 880;
let paths = {}, shapeInfo = {}, centres = {}, labels = null, counts = {};
let home = null, vb = null, limits = null, dragging = false, suppressClick = false;

async function buildMap(){
  const svg = $("map");
  if(!window.d3 || !window.topojson){ $("mapnote").textContent = "De kaart kon niet laden. De lijst werkt gewoon."; return; }
  let world;
  try {
    const r = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json");
    world = await r.json();
  } catch(e) { $("mapnote").textContent = "De kaart kon niet laden. De lijst werkt gewoon."; return; }
  const geo = topojson.feature(world, world.objects.countries);

  const proj = d3.geoConicConformal().parallels([40,64]).rotate([-14,0]).center([0,52]);
  proj.fitExtent([[0,0],[W,H]], {type:"MultiPoint", coordinates:[[-11,35],[-11,70],[40,70],[40,35],[14,72],[14,34]]});
  const path = d3.geoPath(proj);

  const grat = document.createElementNS(ns,"path");
  grat.setAttribute("d", path(d3.geoGraticule().step([10,10])()));
  grat.setAttribute("class","grat");
  svg.appendChild(grat);
  const g = document.createElementNS(ns,"g"); g.setAttribute("class","lands"); svg.appendChild(g);

  geo.features.forEach((f, i) => {
    if(!f.geometry) return;
    const name = ((f.properties || {}).name || "").toLowerCase();
    const code = EN[name] || "";
    const c = d3.geoCentroid(f);
    const eu = code && EUROPE.includes(code);
    if(!eu && !(c[0] > -35 && c[0] < 75 && c[1] > 18 && c[1] < 83)) return;
    const d = path(f); if(!d) return;
    const key = eu ? code : "x" + i;
    const el = document.createElementNS(ns,"path");
    el.setAttribute("d", d); el.dataset.c = key;
    if(eu){ el.classList.add("eu"); el.setAttribute("tabindex","0"); el.setAttribute("aria-label", cname(code)); }
    g.appendChild(el); paths[key] = el;
    if(eu){
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      let best = null, ba = -1;
      polys.forEach(rings => { const p = {type:"Polygon", coordinates:rings}; const a = path.area(p); if(a > ba){ ba = a; best = p; } });
      if(best){ const ct = path.centroid(best); shapeInfo[key] = {cx:ct[0], cy:ct[1], size:Math.sqrt(ba), bounds:path.bounds(best)}; }
    }
  });

  // beginweergave: vasteland Europa
  const bboxOf = list => { let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    list.forEach(c => { const s = shapeInfo[c]; if(!s) return; const [[a,b],[cc,dd]] = s.bounds;
      x0=Math.min(x0,a); y0=Math.min(y0,b); x1=Math.max(x1,cc); y1=Math.max(y1,dd); });
    return x0 < 1e9 ? {x:x0, y:y0, w:x1-x0, h:y1-y0} : null; };
  const core = bboxOf(["IE","PT","FI","NO","UA","GR","CY"]) || {x:0,y:0,w:W,h:H};
  const grow = 1.1;
  home = {x:core.x - core.w*(grow-1)/2, y:core.y - core.h*(grow-1)/2, w:core.w*grow, h:core.h*grow};
  svg.style.aspectRatio = `${home.w}/${home.h}`;
  limits = {x0:-150, y0:-150, x1:W+150, y1:H+150};
  vb = {...home}; setVB();

  labels = document.createElementNS(ns,"g"); svg.appendChild(labels);
  $("mapnote").hidden = true;

  const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; $("mapbox").appendChild(tip);
  setupPanZoom(svg, tip);
  svg.addEventListener("mousemove", e => {
    const c = e.target.dataset && e.target.dataset.c;
    if(dragging || !c || !EUROPE.includes(c)){ tip.hidden = true; return; }
    const n = counts[c] || 0; const r = $("mapbox").getBoundingClientRect();
    tip.innerHTML = `<b>${esc(cname(c))}</b> · ${n} tender${n === 1 ? "" : "s"}`;
    tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; tip.hidden = false;
  });
  svg.addEventListener("mouseleave", () => tip.hidden = true);
  const pick = c => { if(!c || !EUROPE.includes(c)) return; state.country = state.country === c ? "" : c; render(); };
  svg.addEventListener("click", e => { if(suppressClick){ suppressClick = false; return; } pick(e.target.dataset && e.target.dataset.c); });
  svg.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); pick(e.target.dataset && e.target.dataset.c); } });
  render();
}

function setVB(){
  if(!vb) return;
  const minW = home.w/14, maxW = home.w*1.8, ratio = home.h/home.w;
  vb.w = Math.max(minW, Math.min(maxW, vb.w)); vb.h = vb.w*ratio;
  const L = limits;
  if(vb.w >= L.x1-L.x0) vb.x = (L.x0+L.x1-vb.w)/2; else vb.x = Math.max(L.x0, Math.min(L.x1-vb.w, vb.x));
  if(vb.h >= L.y1-L.y0) vb.y = (L.y0+L.y1-vb.h)/2; else vb.y = Math.max(L.y0, Math.min(L.y1-vb.h, vb.y));
  $("map").setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  drawLabels();
}
function zoomAt(factor, cx, cy){
  if(!vb) return;
  const nw = Math.max(home.w/14, Math.min(home.w*1.8, vb.w*factor)); const f = nw/vb.w;
  vb.x = cx - (cx - vb.x)*f; vb.y = cy - (cy - vb.y)*f; vb.w = nw; setVB();
}
function toMap(svg, x, y){ const r = svg.getBoundingClientRect(); return {x: vb.x + (x - r.left)/r.width*vb.w, y: vb.y + (y - r.top)/r.height*vb.h}; }
function setupPanZoom(svg, tip){
  const pts = new Map(); let start = null, pinch = null;
  svg.addEventListener("pointerdown", e => {
    pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(pts.size === 1) start = {x:e.clientX, y:e.clientY, vx:vb.x, vy:vb.y, moved:false};
    if(pts.size === 2){ const [a,b] = [...pts.values()];
      pinch = {d:Math.hypot(a.x-b.x, a.y-b.y), w:vb.w, mid:toMap(svg,(a.x+b.x)/2,(a.y+b.y)/2)}; start = null; }
  });
  svg.addEventListener("pointermove", e => {
    if(!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if(pinch && pts.size === 2){ const [a,b] = [...pts.values()]; const d = Math.hypot(a.x-b.x, a.y-b.y) || 1;
      zoomAt((pinch.w*pinch.d/d)/vb.w, pinch.mid.x, pinch.mid.y); suppressClick = true; return; }
    if(!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if(!start.moved && Math.hypot(dx,dy) < 5) return;
    if(!start.moved){ start.moved = true; dragging = true; svg.classList.add("dragging"); tip.hidden = true; try { svg.setPointerCapture(e.pointerId); } catch(_) {} }
    const r = svg.getBoundingClientRect();
    vb.x = start.vx - dx/r.width*vb.w; vb.y = start.vy - dy/r.height*vb.h; setVB();
  });
  const end = e => {
    pts.delete(e.pointerId);
    if(start && start.moved) suppressClick = true;
    if(pts.size < 2) pinch = null;
    if(pts.size === 0){ start = null; dragging = false; svg.classList.remove("dragging"); }
    else if(pts.size === 1){ const p = [...pts.values()][0]; start = {x:p.x, y:p.y, vx:vb.x, vy:vb.y, moved:true}; }
  };
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
  svg.addEventListener("wheel", e => { e.preventDefault(); const p = toMap(svg, e.clientX, e.clientY);
    zoomAt(Math.exp(e.deltaY*(e.deltaMode === 1 ? 0.05 : 0.0018)), p.x, p.y); }, {passive:false});
  const centre = () => ({x:vb.x + vb.w/2, y:vb.y + vb.h/2});
  $("zIn").onclick = () => { const c = centre(); zoomAt(1/1.5, c.x, c.y); };
  $("zOut").onclick = () => { const c = centre(); zoomAt(1.5, c.x, c.y); };
  $("zHome").onclick = () => { vb = {...home}; setVB(); };
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
  if(!labels || !home) return;
  labels.innerHTML = "";
  const k = vb.w/home.w, u = home.w/216;
  Object.entries(counts).forEach(([c, n]) => {
    const el = paths[c], s = shapeInfo[c]; if(!el || !s) return;
    if(!centres[c]){
      let x = s.cx, y = s.cy;
      const inside = (px, py) => { try { return el.isPointInFill(new DOMPoint(px, py)); } catch(e) { return true; } };
      if(!inside(x, y)){ // bv. Noorwegen: zoek een punt binnen het land, dicht bij het midden
        const [[bx0,by0],[bx1,by1]] = s.bounds; let bestD = 1e18;
        for(let i = 1; i < 20; i++) for(let j = 1; j < 20; j++){
          const px = bx0 + (bx1-bx0)*i/20, py = by0 + (by1-by0)*j/20;
          if(inside(px, py)){ const dd = (px-s.cx)**2 + (py-s.cy)**2; if(dd < bestD){ bestD = dd; x = px; y = py; } } }
      }
      centres[c] = [x, y];
    }
    const [cx, cy] = centres[c];
    // bolletje schaalt mee met de grootte van het land
    const r = Math.min(Math.max(s.size*0.085, 1.3*u), 4.4*u, 7*k*u);
    const ci = document.createElementNS(ns,"circle"); ci.setAttribute("cx",cx); ci.setAttribute("cy",cy); ci.setAttribute("r",r); ci.setAttribute("class","dot");
    const tx = document.createElementNS(ns,"text"); tx.setAttribute("x",cx); tx.setAttribute("y",cy); tx.setAttribute("class","cnt"); tx.style.fontSize = (r*1.3) + "px"; tx.textContent = n > 99 ? "99+" : n;
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
    <div class="meta"><span>${esc(cname(t.country))}</span>${t.buyer ? `<span>${esc(t.buyer)}</span>` : ""}</div>
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
  $("selChip").innerHTML = state.country ? `<span class="chip">${esc(cname(state.country))}<button type="button" id="clrC" aria-label="Landfilter wissen">×</button></span>` : "";
  if(state.country) $("clrC").onclick = () => { state.country = ""; render(); };
  const sel = $("fCountry");
  const cs = [...new Set(tenders.map(t => t.country).filter(Boolean))].sort((a,b) => cname(a).localeCompare(cname(b), "nl"));
  sel.innerHTML = `<option value="">Heel Europa</option>` + cs.map(c => `<option value="${c}">${esc(cname(c))}</option>`).join("");
  sel.value = state.country;
  $("fStatus").value = state.status; $("fSort").value = state.sort; $("fValue").value = String(state.minValue);
  const box = $("list");
  if(!loaded) {}
  else if(loadError) box.innerHTML = `<div class="empty">De tenders konden niet worden geladen. Ververs de pagina over een paar minuten.</div>`;
  else if(!tenders.length) box.innerHTML = `<div class="empty"><h2>Nog geen tenders</h2>De tenders worden elke werkdag automatisch opgehaald bij TED. Kijk straks nog eens.</div>`;
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
$("fSort").addEventListener("change", e => { state.sort = e.target.value; saveFilters(); render(); });
$("fValue").addEventListener("change", e => { state.minValue = Number(e.target.value) || 0; saveFilters(); render(); });
$("fCountry").addEventListener("change", e => { state.country = e.target.value; render(); });
$("cpClose").addEventListener("click", () => { state.country = ""; render(); });

// ---------- Starten ----------
render();
buildMap();
fetch("data/tenders.json?v=" + Date.now(), {cache:"no-store"})
  .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => { tenders = Array.isArray(d.tenders) ? d.tenders : []; updated = d.updated; loaded = true; render(); })
  .catch(() => { loaded = true; loadError = true; render(); });
})();
