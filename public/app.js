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
const state = { q:"", status:"open", country:"", sort:"deadline", minValue:0, source:"", def:"", hw:"" };
// Alleen hardware? Uit de (vertaalde) titel: apparatuur zonder abonnement, dienst, installatie of beheer.
// Zonder duidelijke woorden beslist de CPV-code: 32… = apparatuur, 64…/72…/50… = diensten.
const HW_RE = /(modem|terminal|\bkits?\b|antenne|antenna|schotel|\bdish|router|apparatuur|equipment|uitrusting|kabel|behuizing|station|\bsets?\b|hardware|systeem|systemen|pakket|houder|voeding|adapter|montage|обладнання|термінал|комплект)/i;
const SVC_RE = /(abonnement|dienst|service|servicio|serviç|usług|послуг|connectivit|verbinding|aansluiting|toegang|activering|beheer|ondersteuning|onderhoud|installatie|contract|oplossing|verhuur|per maand|maanden|airtime|data ?bundel|tegoed)/i;
function hwScope(t){
  if(t._hw !== undefined) return t._hw;
  // alleen het begin: lange titels bevatten soms een hele specificatie ("ondersteuning van Wi-Fi 6" is geen dienst)
  const text = `${(t.titleNl || "").slice(0, 180)} ${(t.title || "").slice(0, 180)}`;
  const cpv = (t.cpv && t.cpv[0]) || "";
  let r = "";
  if(SVC_RE.test(text)) r = "svc";
  else if(HW_RE.test(text)) r = "hw";
  else if(/^32/.test(cpv)) r = "hw";
  else if(/^(64|72|50)/.test(cpv)) r = "svc";
  return (t._hw = r);
}
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
  if(t.deadlineAt && Date.parse(t.deadlineAt) <= Date.now()) return "closed";   // sluitingstijd vandaag al voorbij
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
    if(state.def === "no" && t.defense) return false;
    if(state.def === "only" && !t.defense) return false;
    if(state.hw === "only" && hwScope(t) !== "hw") return false;
    if(state.hw === "no" && hwScope(t) === "hw") return false;
    if(effStatus() === "open" && !isOpen(t)) return false;
    if(state.status === "soon" && st !== "soon") return false;
    if(state.status === "new" && (!isNew(t) || !isOpen(t))) return false;
    if(state.status === "prior" && st !== "prior") return false;
    if(state.status === "awarded" && st !== "awarded") return false;
    if(state.minValue > 0 && !(t.value >= state.minValue)) return false;
    if(!ignoreCountry && state.country && t.country !== state.country) return false;
    if(q && !(`${t.title} ${t.titleNl || ""} ${t.buyer} ${t.pub} ${cname(t.country)}`.toLowerCase().includes(q))) return false;
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
let nightEl = null, twilightEl = null, officesEl = null;
const TV = new URLSearchParams(location.search).has("tv");
// BroadbandEU-kantoren
const OFFICES = [{name:"Tynaarlo", at:[6.620, 53.077]}, {name:"Etten-Leur", at:[4.636, 51.570]}];

// ---- positie van de zon (voor dag en nacht), naar de formules van NOAA ----
const RAD = Math.PI / 180;
function sunPosition(date){
  const c = (date - Date.UTC(2000, 0, 1, 12)) / 864e5 / 36525;
  const L0 = ((280.46646 + c*(36000.76983 + c*0.0003032)) % 360 + 360) % 360 * RAD;
  const M = (357.52911 + c*(35999.05029 - 0.0001537*c)) * RAD;
  const e = 0.016708634 - c*(0.000042037 + 0.0000001267*c);
  const C = (Math.sin(M)*(1.914602 - c*(0.004817 + 0.000014*c)) + Math.sin(2*M)*(0.019993 - 0.000101*c) + Math.sin(3*M)*0.000289) * RAD;
  const omega = (125.04 - 1934.136*c) * RAD;
  const lambda = L0 + C - (0.00569 + 0.00478*Math.sin(omega)) * RAD;
  const eps0 = (23 + (26 + (21.448 - c*(46.8150 + c*(0.00059 - c*0.001813)))/60)/60) * RAD;
  const eps = eps0 + 0.00256*Math.cos(omega)*RAD;
  const decl = Math.asin(Math.sin(eps)*Math.sin(lambda));
  const y = Math.tan(eps/2)**2;
  const eqTime = y*Math.sin(2*L0) - 2*e*Math.sin(M) + 4*e*y*Math.sin(M)*Math.cos(2*L0) - 0.5*y*y*Math.sin(4*L0) - 1.25*e*e*Math.sin(2*M);
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const lon = (dayStart - date) / 864e5 * 360 - 180 - eqTime / RAD;
  return [((lon + 540) % 360) - 180, decl / RAD];
}
let nightGeo = null, twilightGeo = null;
function updateNight(){
  const [lon, lat] = sunPosition(new Date());
  const anti = [lon + 180, -lat];
  nightGeo = d3.geoCircle().center(anti).radius(90)();
  twilightGeo = d3.geoCircle().center(anti).radius(97)();
}

// ---- Starlink-satellieten (knop op de kaart, onthouden per browser; ?sats=1 of ?sats=0 in de link kan ook) ----
const SAT_ALT = 1.085;                 // ~550 km boven de aarde, in aardstralen
const SAT_TRAIL = 45000;               // spoortje: waar de satelliet 45 seconden geleden was
let satsOn = false, satData = null, satLoading = false;
const satCache = {t:0, now:null, prev:null};
try { satsOn = localStorage.getItem("tk-sats") === "1"; } catch(e) {}
{ const v = new URLSearchParams(location.search).get("sats"); if(v === "1") satsOn = true; if(v === "0") satsOn = false; }
function loadSats(){
  if(satData || satLoading || !window.StarlinkSats) return;
  satLoading = true; satInfo("Satellieten laden…");
  fetch("/starlink.json").then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { satData = StarlinkSats.decode(d); satCache.now = satCache.prev = null; satInfo(); redraw(); })
    .catch(() => { satInfo("Satellieten konden niet laden"); })
    .finally(() => { satLoading = false; });
}
function satInfo(msg){
  const el = $("satInfo"); if(!el) return;
  el.hidden = !satsOn;
  el.innerHTML = msg ? esc(msg) : satData ? `<b>${satData.n.toLocaleString("nl-NL")}</b> Starlink-satellieten · posities van nu` : "";
}
function setSats(on){
  satsOn = on;
  try { localStorage.setItem("tk-sats", on ? "1" : "0"); } catch(e) {}
  const b = $("zSat"); if(b){ b.setAttribute("aria-pressed", on ? "true" : "false"); b.classList.toggle("on", on); }
  satInfo();
  if(on) loadSats();
  redraw();
}
// eigen tekenlaag (canvas) boven de bol: tienduizend punten zijn daar veel sneller dan in de kaart zelf
let satCanvas = null, satCtx = null, satK = 1, satDpr = 1, satOx = 0, satOy = 0;
// tv-modus: de bol zelf ook op een canvas (onder de bolletjes met aantallen). Honderden landvormen per beeldje
// opnieuw opbouwen als svg is te zwaar voor een tv; op een canvas tekenen gaat vele malen sneller.
let landCanvas = null, landCtx = null, landPath = null, landStyle = null;
function sizeSatCanvas(){
  const svg = $("map"); if(!satCanvas || !svg) return;
  const r = svg.getBoundingClientRect(), pr = satCanvas.parentElement.getBoundingClientRect(), pb = satCanvas.parentElement;
  const w = r.width, h = r.height, dpr = TV ? 1 : Math.min(2, window.devicePixelRatio || 1);   // tv: geen extra scherpte, scheelt veel rekenwerk
  satCanvas.style.left = (r.left - pr.left - pb.clientLeft) + "px"; satCanvas.style.top = (r.top - pr.top - pb.clientTop) + "px";
  satCanvas.style.width = w + "px"; satCanvas.style.height = h + "px";
  satCanvas.width = Math.round(w * dpr); satCanvas.height = Math.round(h * dpr);
  // de bol past in het vak zoals een svg dat doet (passend en gecentreerd)
  const kc = Math.min(w / W, h / H);
  satK = kc * dpr; satDpr = dpr; satOx = (w - W * kc) / 2 * dpr; satOy = (h - H * kc) / 2 * dpr;
  if(landCanvas){
    landCanvas.style.cssText = satCanvas.style.cssText;
    landCanvas.width = satCanvas.width; landCanvas.height = satCanvas.height;
  }
}
// landen één keer omzetten naar punten op een bol (x, y, z); daarna is draaien alleen nog wat vermenigvuldigen
let landMesh = null;
function buildLandMesh(){
  const D = Math.PI / 180;
  const toXYZ = ring => { const a = new Float32Array(ring.length * 3);
    ring.forEach(([lon, lat], i) => { const la = lat * D, lo = lon * D, c = Math.cos(la); a[3*i] = c * Math.cos(lo); a[3*i+1] = c * Math.sin(lo); a[3*i+2] = Math.sin(la); });
    return a; };
  landMesh = features.map(x => {
    const g = (x.fl || x.f || {}).geometry; if(!g) return { x, polys: [] };
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return { x, polys: polys.map(rs => ({ rings: rs.map(toXYZ), geo: {type:"Polygon", coordinates: rs} })) };
  });
}
function drawLand(){
  const c = landCtx, k = satK;
  if(!landStyle){
    const cs = el => getComputedStyle(el), plain = features.find(x => !x.el.style.fill) || features[0];
    landStyle = { land: cs(plain.el).fill, edge: cs(plain.el).stroke, grat: cs(gratEl).stroke, rim: cs(sphereEl).stroke,
      night: cs(nightEl).fill, twilight: cs(twilightEl).fill };
  }
  if(!landMesh) buildLandMesh();
  const st = landStyle, [tx, ty] = proj.translate(), sc = proj.scale(), px = 1 / k;   // 1 schermpixel
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, landCanvas.width, landCanvas.height);
  c.setTransform(k, 0, 0, k, satOx, satOy);
  c.lineJoin = "round";
  // gloed rond de bol (in de gewone kaart de .halo-cirkel)
  const hg = c.createRadialGradient(tx, ty, 0, tx, ty, sc * 1.08);
  hg.addColorStop(0.88, "rgba(90,160,255,.28)"); hg.addColorStop(1, "rgba(90,160,255,0)");
  c.beginPath(); c.arc(tx, ty, sc * 1.08, 0, 2 * Math.PI); c.fillStyle = hg; c.fill();
  // oceaan met dezelfde gloed als de gewone kaart
  const g = c.createRadialGradient(tx - sc * 0.16, ty - sc * 0.24, 0, tx - sc * 0.16, ty - sc * 0.24, sc * 1.3);
  g.addColorStop(0, "#16305a"); g.addColorStop(0.7, "#0c1a33"); g.addColorStop(1, "#081224");
  c.beginPath(); c.arc(tx, ty, sc, 0, 2 * Math.PI); c.fillStyle = g; c.fill();
  c.save(); c.beginPath(); c.arc(tx, ty, sc, 0, 2 * Math.PI); c.clip();
  // draaiing als matrix (zelfde volgorde als d3); punten achter de bol schuiven naar de rand (net als bijsnijden)
  const D = Math.PI / 180, [r0, r1, r2] = proj.rotate();
  const cl = Math.cos(r0*D), sl = Math.sin(r0*D), cp = Math.cos(r1*D), sp = Math.sin(r1*D), cg = Math.cos(r2*D), sg = Math.sin(r2*D);
  const depth = (x, y, z) => (x * cl - y * sl) * cp - z * sp;   // > 0 = voorkant
  const ring = a => {
    const n = a.length / 3;
    for(let i = 0; i < n; i++){
      const x = a[3*i], y = a[3*i+1], z = a[3*i+2];
      const x1 = x * cl - y * sl, y1 = x * sl + y * cl;
      const z2 = z * cp + x1 * sp;
      const sx = tx + sc * (y1 * cg - z2 * sg), sy = ty - sc * (y1 * sg + z2 * cg);
      if(i === 0) c.moveTo(sx, sy); else c.lineTo(sx, sy);
    }
    c.closePath();
  };
  // helemaal aan de voorkant: zelf snel tekenen. Helemaal achter: overslaan. Over de rand: d3 snijdt netjes bij.
  const shape = m => {
    for(const pg of m.polys){
      let front = 0, back = 0;
      for(const a of pg.rings){ for(let i = 0; i < a.length; i += 3){ if(depth(a[i], a[i+1], a[i+2]) > 0) front++; else back++; } }
      if(!front) continue;
      if(!back) pg.rings.forEach(ring); else landPath(pg.geo);
    }
  };
  c.beginPath(); landPath(gratGeo); c.strokeStyle = st.grat; c.lineWidth = 0.5 * px; c.stroke();
  // gewone landen in één keer, gekleurde (met tenders) apart
  c.beginPath();
  for(const m of landMesh) if(!m.x.el.style.fill) shape(m);
  c.fillStyle = st.land; c.fill("evenodd"); c.strokeStyle = st.edge; c.lineWidth = 0.6 * px; c.stroke();
  for(const m of landMesh) if(m.x.el.style.fill){ c.beginPath(); shape(m); c.fillStyle = m.x.el.style.fill; c.fill("evenodd"); c.stroke(); }
  if(nightGeo){
    c.beginPath(); landPath(twilightGeo); c.fillStyle = st.twilight; c.fill();
    c.beginPath(); landPath(nightGeo); c.fillStyle = st.night; c.fill();
  }
  c.restore();
  c.beginPath(); c.arc(tx, ty, sc, 0, 2 * Math.PI); c.strokeStyle = st.rim; c.lineWidth = px; c.stroke();
}

function drawSats(){
  if(!satCtx) return;
  satCtx.setTransform(1, 0, 0, 1, 0, 0);
  satCtx.clearRect(0, 0, satCanvas.width, satCanvas.height);
  window.__satN = 0;
  if(!satsOn || !satData) return;
  const now = Date.now();
  if(!satCache.now || now - satCache.t > 1000){   // posities hooguit één keer per seconde uitrekenen
    satCache.t = now;
    satCache.now = StarlinkSats.positions(satData, now, satCache.now);
    satCache.prev = StarlinkSats.positions(satData, now - SAT_TRAIL, satCache.prev);
  }
  // draaiing van de bol als matrix (zelfde volgorde als d3: eerst lengte, dan breedte, dan kanteling)
  const D = Math.PI / 180, [r0, r1, r2] = proj.rotate();
  const cl = Math.cos(r0*D), sl = Math.sin(r0*D), cp = Math.cos(r1*D), sp = Math.sin(r1*D), cg = Math.cos(r2*D), sg = Math.sin(r2*D);
  const [tx, ty] = proj.translate(), R = proj.scale() * SAT_ALT, inner = 1 / (SAT_ALT * SAT_ALT), k = satK;
  const pos = new Float32Array(2);
  const place = (lon, lat) => {
    const la = lat * D, lo = lon * D, c = Math.cos(la);
    let x = c * Math.cos(lo), y = c * Math.sin(lo), z = Math.sin(la);
    const x1 = x * cl - y * sl, y1 = x * sl + y * cl;             // om de as draaien (lengtegraad)
    const x2 = x1 * cp - z * sp, z2 = z * cp + x1 * sp;            // kantelen (breedtegraad)
    const y3 = y1 * cg - z2 * sg, z3 = y1 * sg + z2 * cg;          // kanteling
    if(x2 < 0 && y3*y3 + z3*z3 < inner) return false;              // achter de aarde
    const sx = satOx + (tx + R * y3) * k, sy = satOy + (ty - R * z3) * k;
    if(sx < -20 || sy < -20 || sx > satCanvas.width + 20 || sy > satCanvas.height + 20) return false;
    pos[0] = sx; pos[1] = sy; return true;
  };
  const A = satCache.now, B = satCache.prev, n = satData.n, dots = new Float32Array(n * 2);
  let m = 0;
  const trails = !TV;   // tv: geen spoortjes, alleen stipjes (veel lichter)
  satCtx.beginPath();
  for(let i = 0; i < n; i++){
    if(!place(A[2*i], A[2*i+1])) continue;
    const ax = pos[0], ay = pos[1]; dots[m++] = ax; dots[m++] = ay;
    if(trails && place(B[2*i], B[2*i+1]) && Math.abs(pos[0] - ax) + Math.abs(pos[1] - ay) < 80 * k){ satCtx.moveTo(pos[0], pos[1]); satCtx.lineTo(ax, ay); }
  }
  const big = Math.max(0.55, Math.min(1, R * k / satDpr / 330));   // kleine bol (telefoon) = fijnere stipjes
  satCtx.lineWidth = 0.9 * satDpr * big; satCtx.strokeStyle = "rgba(150,205,255,.24)"; satCtx.stroke();
  const sz = 1.6 * satDpr * big, h = sz / 2;
  satCtx.fillStyle = "rgba(214,239,255,.85)";
  for(let j = 0; j < m; j += 2) satCtx.fillRect(dots[j] - h, dots[j+1] - h, sz, sz);
  window.__satN = m / 2;
}
// ook als de bol stilstaat bewegen de satellieten door
setInterval(() => { if(satsOn && satData && proj && !dragging && quality === "high") drawSats(); }, 2000);

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
  twilightEl = document.createElementNS(ns, "path"); twilightEl.setAttribute("class","twilight"); svg.appendChild(twilightEl);
  nightEl = document.createElementNS(ns, "path"); nightEl.setAttribute("class","night"); svg.appendChild(nightEl);
  updateNight(); setInterval(() => { updateNight(); redraw(); }, 60000);
  satCanvas = document.createElement("canvas"); satCanvas.className = "satlayer"; satCanvas.setAttribute("aria-hidden", "true");
  svg.after(satCanvas); satCtx = satCanvas.getContext("2d");
  if(TV && !new URLSearchParams(location.search).has("svg")){   // ?svg=1: de oude manier, om te vergelijken
    landCanvas = document.createElement("canvas"); landCanvas.className = "landlayer"; landCanvas.setAttribute("aria-hidden", "true");
    svg.before(landCanvas); landCtx = landCanvas.getContext("2d", {alpha: true}); landPath = d3.geoPath(proj, landCtx);
    svg.classList.add("overlay");
  }
  sizeSatCanvas();
  if(window.ResizeObserver) new ResizeObserver(() => { sizeSatCanvas(); drawSats(); }).observe(svg);
  else addEventListener("resize", () => { sizeSatCanvas(); drawSats(); });

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
  officesEl = document.createElementNS(ns, "g"); officesEl.setAttribute("class","offices"); svg.appendChild(officesEl);
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
  const pick = c => { if(TV || !c || c[0] === "x") return; state.country = state.country === c ? "" : c; render(); if(state.country) focusCountry(state.country); };
  svg.addEventListener("click", e => { if(suppressClick){ suppressClick = false; return; } pick(e.target.dataset && e.target.dataset.c); });
  svg.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); pick(e.target.dataset && e.target.dataset.c); } });
  render();
}

function redraw(){
  if(!proj) return;
  const s = proj.scale();
  const low = quality === "low";
  proj.precision(low ? (TV ? 0 : 1.5) : 0.4);
  const halo = $("map").querySelector(".halo");
  const [tx, ty] = proj.translate();
  if(halo){ halo.setAttribute("cx", tx); halo.setAttribute("cy", ty); halo.setAttribute("r", s * 1.08); }
  if(landCtx) drawLand();
  else {
    sphereEl.setAttribute("d", gpath({type:"Sphere"}));
    gratEl.setAttribute("d", gpath(gratGeo) || "");
    for(const x of features){
      const f = low ? x.fl : x.f;          // tijdens draaien: lichte kaart (kleine eilanden even weg)
      x.el.setAttribute("d", f ? (gpath(f) || "") : "");
    }
    if(nightGeo){ nightEl.setAttribute("d", gpath(nightGeo) || ""); twilightEl.setAttribute("d", gpath(twilightGeo) || ""); }
  }
  drawSats();
  drawOffices();
  if(low && !TV) hideLabels(); else drawLabels();
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
    if(pts.size === 1){ suppressClick = false; start = {x:e.clientX, y:e.clientY, rot:proj.rotate().slice(), moved:false}; }
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
  $("zSat").onclick = () => setSats(!satsOn);
  setSats(satsOn);
}
// staat het landvenster open (breed scherm)? Dan de bol naar links schuiven zodat het land zichtbaar blijft.
let shiftTarget = W/2, shiftRaf = 0;
function setShift(open){
  const wide = window.matchMedia ? matchMedia("(min-width: 601px)").matches : true;
  shiftTarget = open && wide ? W*0.30 : W/2;
  if(!proj || shiftRaf) return;
  const stepFn = () => {
    const [x, y] = proj.translate(); const nx = x + (shiftTarget - x)*0.25;
    proj.translate([Math.abs(nx - shiftTarget) < 0.5 ? shiftTarget : nx, y]); quality = "low"; redraw();
    if(proj.translate()[0] !== shiftTarget) shiftRaf = requestAnimationFrame(stepFn);
    else { shiftRaf = 0; quality = "high"; redraw(); }
  };
  shiftRaf = requestAnimationFrame(stepFn);
}
// bij klik op een land in de lijst: daarheen draaien
function focusCountry(c){
  const x = (featureByKey && featureByKey.get(c)) || features.find(f => f.key === c);
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
// bolletjes met aantallen: elementen hergebruiken in plaats van elke keer opnieuw maken (scheelt veel op tv's)
const labelPool = new Map();   // land -> {ci, tx, ring}
let featureByKey = null;
function drawLabels(){
  if(!labels || !proj) return;
  if(!featureByKey){ featureByKey = new Map(); for(const f of features) featureByKey.set(f.key, f); }
  const centre = proj.invert(proj.translate());
  const s = proj.scale();
  const seen = new Set();
  for(const [c, n] of Object.entries(counts)){
    const x = featureByKey.get(c); if(!x || !x.centroid) continue;
    if(d3.geoDistance(x.centroid, centre) > Math.PI/2 - 0.05) continue;   // achterkant van de bol
    const p = proj(x.centroid); if(!p) continue;
    seen.add(c);
    let L = labelPool.get(c);
    if(!L){
      const ci = document.createElementNS(ns,"circle"); ci.setAttribute("class","dot");
      const tx = document.createElementNS(ns,"text"); tx.setAttribute("class","cnt");
      labels.appendChild(ci); labels.appendChild(tx);
      L = {ci, tx, ring:null, n:-1, r:-1}; labelPool.set(c, L);
    }
    // bolletje schaalt mee met de grootte van het land op het scherm
    const r = Math.round(Math.max(5, Math.min(16, Math.sqrt(x.area) * s * 0.28)) * 2) / 2;
    const px = p[0].toFixed(1), py = p[1].toFixed(1);
    L.ci.setAttribute("cx", px); L.ci.setAttribute("cy", py);
    L.tx.setAttribute("x", px); L.tx.setAttribute("y", py);
    if(L.r !== r){ L.r = r; L.ci.setAttribute("r", r); L.tx.style.fontSize = (r*1.15) + "px"; }
    if(L.n !== n){ L.n = n; L.tx.textContent = n > 99 ? "99+" : n; }
    L.ci.style.display = L.tx.style.display = "";
    const wantRing = TV && freshCountries.has(c);
    if(wantRing && !L.ring){ L.ring = document.createElementNS(ns,"circle"); L.ring.setAttribute("class","pulse"); labels.insertBefore(L.ring, L.ci); }
    if(L.ring){
      L.ring.style.display = wantRing ? "" : "none";
      if(wantRing){ L.ring.setAttribute("cx", px); L.ring.setAttribute("cy", py); L.ring.setAttribute("r", r); }
    }
  }
  for(const [c, L] of labelPool){
    if(seen.has(c)) continue;
    L.ci.style.display = L.tx.style.display = "none";
    if(L.ring) L.ring.style.display = "none";
  }
}
function hideLabels(){ for(const L of labelPool.values()){ L.ci.style.display = L.tx.style.display = "none"; if(L.ring) L.ring.style.display = "none"; } }
let freshCountries = new Set();

function drawOffices(){
  if(!officesEl || !proj) return;
  officesEl.innerHTML = "";
  const centre = proj.invert(proj.translate());
  const close = zoom >= 4;                 // ver weg: één markering voor beide kantoren
  const list = close ? OFFICES : [{name:"Tynaarlo en Etten-Leur", at:[5.63, 52.32]}];
  for(const o of list){
    if(d3.geoDistance(o.at, centre) > Math.PI/2 - 0.02) continue;
    const p = proj(o.at); if(!p) continue;
    const s = 15;
    const g = document.createElementNS(ns, "g"); g.setAttribute("class","office"); g.setAttribute("transform", `translate(${p[0]},${p[1]})`);
    g.innerHTML = `<title>BroadbandEU · ${esc(o.name)}</title><circle r="${s*0.95}" class="office-ring"/><image href="/favicon.svg" x="${-s/2}" y="${-s/2}" width="${s}" height="${s}"/>`
      + (close ? `<text x="${s*0.8}" y="4" class="office-name">BroadbandEU · ${esc(o.name)}</text>` : "");
    officesEl.appendChild(g);
  }
}

// ---------- Lijst ----------
const dlText = t => { const st = statusOf(t); return (st === "awarded" || st === "prior") ? leftText(t) : `Sluit ${fmt(t.deadline)} · ${leftText(t)}`; };
const defHtml = t => (t.defense ? `<span class="deftag" title="Opdrachtgever is een defensie-organisatie">Defensie</span>` : "")
  + (hwScope(t) === "hw" ? `<span class="deftag hw" title="Alleen apparatuur, zonder abonnement of dienst (afgeleid uit de titel)">Alleen hardware</span>` : "");
const valHtml = t => (t.qty ? `<span class="qty" title="Aantal uit de titel gehaald">${t.qty}×</span>` : "") + (t.value ? `<span class="val">${esc(fmtMoney(t.value, t.currency))}</span>` : "");
const newHtml = t => isNew(t) ? `<span class="newtag">NIEUW</span>` : "";
function leftText(t){ const st = statusOf(t);
  if(st === "awarded") return "gegund"; if(st === "prior") return "vooraankondiging, inschrijven nog niet mogelijk";
  if(st === "closed") return "gesloten";
  const dl = daysLeft(t.deadline);
  if(dl === 0 && t.deadlineAt) return "sluit vandaag om " + new Date(t.deadlineAt).toLocaleTimeString("nl-NL", {hour:"2-digit", minute:"2-digit"});
  return dl === null ? "geen sluitingsdatum" : dl < 0 ? "gesloten" : dl === 0 ? "sluit vandaag" : `nog ${dl} dag${dl === 1 ? "" : "en"}`; }
let showOriginal = false;
try { showOriginal = localStorage.getItem("tk-orig") === "1"; } catch(e) {}
const shownTitle = t => (!showOriginal && t.titleNl) ? t.titleNl : t.title;
function titleHtml(t){
  const main = t.link ? `<a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(shownTitle(t))}</a>` : esc(shownTitle(t));
  const other = t.titleNl ? (showOriginal ? t.titleNl : t.title) : "";
  return main + (other ? `<span class="orig" title="${showOriginal ? "Nederlandse vertaling" : "Originele titel"}">${showOriginal ? "NL: " : ""}${esc(other)}</span>` : "");
}
const hideBtn = t => window.isAdmin ? `<button type="button" class="hide-btn" data-hide="${esc(t.pub)}" title="Verbergen voor iedereen">Verberg</button>` : "";
function card(t){
  return `<article class="t ${statusOf(t)}">${hideBtn(t)}<h3>${newHtml(t)}${titleHtml(t)}</h3>
    <div class="meta"><span class="src">${esc(t.source || "TED")}</span>${defHtml(t)}<span>${esc(t.country ? cname(t.country) : (t.countryName || "Onbekend land"))}</span>${t.buyer ? `<span>${esc(t.buyer)}</span>` : ""}</div>
    <div class="meta"><span class="dl">${dlText(t)}</span>${valHtml(t)}<span class="mono">Gepubl. ${fmt(t.published)}</span><span class="mono">${esc(t.pub)}</span>${t.type ? `<span>${esc(t.type)}</span>` : ""}</div></article>`;
}
function panelCard(t){
  return `<article class="t ${statusOf(t)}">${hideBtn(t)}<h3>${newHtml(t)}${titleHtml(t)}</h3><div class="meta"><span class="src">${esc(t.source || "TED")}</span>${defHtml(t)}${t.buyer ? `<span>${esc(t.buyer)}</span>` : ""}</div><div class="meta"><span class="dl">${dlText(t)}</span>${valHtml(t)}</div></article>`;
}
const SORTERS = {
  deadline: (a,b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"),
  pub: (a,b) => (b.published || "").localeCompare(a.published || ""),
  value: (a,b) => (b.value || -1) - (a.value || -1),
  qty: (a,b) => (b.qty || 0) - (a.qty || 0) || (a.deadline || "9999").localeCompare(b.deadline || "9999"),
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
  const srcSel = $("fSource");
  const srcs = [...new Set(tenders.map(t => t.source || "TED"))].sort((a,b) => a.localeCompare(b, "nl"));
  if(srcSel.options.length !== srcs.length + 1) srcSel.innerHTML = `<option value="">Alle bronnen</option>` + srcs.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  srcSel.value = state.source; $("fDef").value = state.def; $("fStatus").value = state.status; $("fSort").value = state.sort; $("fValue").value = String(state.minValue);
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
  setShift(!!state.country);
  if(!state.country){ p.hidden = true; return; }
  const n = list.length;
  $("cpTitle").textContent = cname(state.country);
  $("cpSub").textContent = `${n} tender${n === 1 ? "" : "s"} · ${({open:"nog open", soon:"sluit binnen 14 dagen", new:"alleen nieuw", prior:"vooraankondigingen", awarded:"gegunde opdrachten", all:"alles"})[state.status]}`;
  $("cpList").innerHTML = (n ? list.map(panelCard).join("") : `<div class="empty">Geen tenders met deze filters. Kies bij Status "Alles" om ook gesloten tenders te zien.</div>`)
;
  p.hidden = false;
}

// ---------- Bediening ----------
$("q").addEventListener("input", e => { state.q = e.target.value; render(); });
$("fStatus").addEventListener("change", e => { state.status = e.target.value; saveFilters(); render(); });
$("fSource").addEventListener("change", e => { state.source = e.target.value; render(); });
$("fDef").addEventListener("change", e => { state.def = e.target.value; render(); });
$("fHw").addEventListener("change", e => { state.hw = e.target.value; render(); });
$("fLang").addEventListener("change", e => { showOriginal = e.target.value === "orig"; try { localStorage.setItem("tk-orig", showOriginal ? "1" : "0"); } catch(err) {} render(); });
$("fLang").value = showOriginal ? "orig" : "nl";
$("fSort").addEventListener("change", e => { state.sort = e.target.value; saveFilters(); render(); });
$("fValue").addEventListener("change", e => { state.minValue = Number(e.target.value) || 0; saveFilters(); render(); });
$("fCountry").addEventListener("change", e => { state.country = e.target.value; render(); if(state.country) focusCountry(state.country); });
$("cpClose").addEventListener("click", () => { state.country = ""; render(); });

// Beheerder: tender verbergen (voor iedereen), met de mogelijkheid het direct ongedaan te maken
document.addEventListener("click", async e => {
  const b = e.target.closest && e.target.closest("[data-hide]"); if(!b) return;
  const pub = b.dataset.hide; b.disabled = true; b.textContent = "Bezig…";
  try {
    const r = await fetch("/api/admin", {method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"hide", pub})});
    if(!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Verbergen lukte niet.");
    const t = tenders.find(x => x.pub === pub);
    tenders = tenders.filter(x => x.pub !== pub); render();
    showToast(`Verborgen: ${t ? shownTitle(t).slice(0, 60) : pub}`, async () => {
      await fetch("/api/admin", {method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"unhide", pub})});
      if(t){ tenders.push(t); render(); }
    });
  } catch(err) { b.disabled = false; b.textContent = "Verberg"; alert(err.message); }
});
function showToast(text, undo){
  let el = document.getElementById("toast");
  if(!el){ el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.innerHTML = `<span></span><button type="button">Ongedaan maken</button>`;
  el.querySelector("span").textContent = text;
  el.querySelector("button").onclick = async () => { el.hidden = true; await undo(); };
  el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => el.hidden = true, 7000);
}

// ---------- Starten (na inloggen) ----------
let started = false;
window.rerenderTenders = () => { if(started) render(); };
window.startTenderApp = function(){
  if(started) return; started = true;
  render();
  buildMap();
  loadTenders("start");
  if(TV) startTv();
};
// Melding bovenin: de site haalt (nieuwe) tenders op. Bij openen/verversen van de pagina altijd,
// daarna elke 5 minuten stil controleren; alleen als er echt nieuwe gegevens zijn, komt de melding weer in beeld.
let noteTimer = 0;
function refreshNote(html, kind, ms){
  let el = document.getElementById("refreshNote");
  if(!el){ el = document.createElement("div"); el.id = "refreshNote"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
  el.className = "refreshnote " + (kind || "");
  el.innerHTML = html;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(noteTimer);
  if(ms) noteTimer = setTimeout(() => el.classList.remove("show"), ms);
}
// Bij nieuwe gegevens of een nieuwe versie van de site: open pagina's verversen zichzelf (na een melding),
// en laten daarna zien hoeveel tenders er nieuw zijn. Wie net iets aan het doen is, wordt pas ververst als hij even stil zit.
let build = null, lastInput = 0, reloading = false;
["pointerdown","keydown","wheel","touchstart"].forEach(ev => addEventListener(ev, () => { lastInput = Date.now(); }, {passive:true}));
function reloadSoon(){
  if(reloading) return; reloading = true;
  refreshNote(`<i class="spin"></i>Nieuwe gegevens binnen · de site wordt ververst…`, "busy");
  try { sessionStorage.setItem("tk-before", JSON.stringify(tenders.map(t => t.pub))); } catch(e) {}
  const go = () => { if(!TV && Date.now() - lastInput < 20000) return setTimeout(go, 3000); location.reload(); };
  setTimeout(go, 3000);
}
function loadTenders(mode){   // mode: "start" (pagina geopend) of "check" (automatisch)
  let before = null;
  try { const b = sessionStorage.getItem("tk-before"); if(b && mode === "start"){ before = new Set(JSON.parse(b)); sessionStorage.removeItem("tk-before"); } } catch(e) {}
  const t0 = Date.now();
  const later = f => setTimeout(f, Math.max(0, 1500 - (Date.now() - t0)));   // "wordt ververst" even leesbaar laten staan
  if(mode === "start") refreshNote(`<i class="spin"></i>Site wordt ververst · even kijken of er nieuwe tenders zijn…`, "busy");
  return fetch("/api/tenders", {cache:"no-store", credentials:"same-origin"})
    .then(r => { if(r.status === 401){ location.reload(); throw new Error("uitgelogd"); } if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => {
      if(mode === "check"){
        if(d.updated !== updated || (build && d.build && d.build !== build)) reloadSoon();
        return;
      }
      build = d.build || null;
      tenders = Array.isArray(d.tenders) ? d.tenders : []; updated = d.updated; loaded = true; loadError = false; render(); if(TV) tvUpdate();
      const fresh = before ? tenders.filter(t => !before.has(t.pub) && isOpen(t)) : tenders.filter(t => isNew(t) && isOpen(t));
      const n = fresh.length, ms = TV ? 12000 : 6000;
      later(() => {
        if(n) refreshNote(`<b>${n} nieuwe tender${n === 1 ? "" : "s"}</b> · ${esc([...new Set(fresh.map(t => t.country ? cname(t.country) : (t.countryName || "")).filter(Boolean))].slice(0, 4).join(", "))}`, "new", ms + 4000);
        else refreshNote(`Bijgewerkt · geen nieuwe tenders${before ? "" : " sinds je vorige bezoek"}`, "ok", ms / 2);
      });
    })
    .catch(() => { if(!loaded){ loaded = true; loadError = true; render(); } if(mode === "start") refreshNote("Ophalen lukte even niet · de site probeert het straks opnieuw", "err", 6000); });
}
setInterval(() => { if(loaded && document.visibilityState === "visible") loadTenders("check"); }, 5 * 60 * 1000);
document.addEventListener("visibilitychange", () => {   // terug naar het tabblad na een tijdje weg: meteen even kijken
  if(document.visibilityState === "visible" && loaded) loadTenders("check");
});

// ---------- Tv-modus (/?tv=1): schermvullend, draaiende bol, ververst zichzelf ----------
let tvPausedUntil = 0;
function startTv(){
  document.body.classList.add("tv");
  state.status = "open"; state.country = ""; state.q = ""; state.source = ""; state.def = ""; state.hw = ""; state.minValue = 0;
  // alleen even pauzeren als iemand zelf de bol draait of zoomt (niet bij knoppen)
  const pause = () => { tvPausedUntil = Date.now() + 8000; };
  const svg = $("map");
  ["pointerdown","wheel"].forEach(ev => svg.addEventListener(ev, pause, {passive:true}));
  // slepen altijd netjes afsluiten, ook als de muis buiten de bol wordt losgelaten
  const endDrag = () => { if(dragging){ dragging = false; svg.classList.remove("dragging"); } };
  ["pointerup","pointercancel","blur"].forEach(ev => addEventListener(ev, endDrag));
  document.addEventListener("fullscreenchange", endDrag);
  // langzaam draaien (ongeveer 3 minuten per rondje); een fout mag het draaien nooit stoppen.
  // Tv's hebben een trage processor: niet elk beeldje tekenen, maar hooguit ~20 keer per seconde,
  // en vanzelf minder vaak als het tekenen langzaam gaat. Het draaien blijft even snel (gaat op tijd, niet op beeldjes).
  let last = performance.now(), lastFrame = Date.now(), lastDraw = 0, avgCost = 0, gap = 30;
  const spin = now => {
    lastFrame = Date.now();
    try {
      if(now - lastDraw >= gap){
        const dt = Math.min(250, now - last); last = now; lastDraw = now;
        if(proj && Date.now() > tvPausedUntil && !dragging){
          const t0 = performance.now();
          const r = proj.rotate(); proj.rotate([r[0] + dt * 0.002, r[1] + (-28 - r[1]) * Math.min(1, dt * 0.00012), 0]);
          if(zoom > 1.05 || zoom < 0.9){ zoom += (0.98 - zoom) * Math.min(1, dt * 0.0006); proj.scale(s0 * zoom); }
          quality = "low"; redraw();
          const cost = performance.now() - t0;
          avgCost = avgCost ? avgCost * 0.9 + cost * 0.1 : cost;
          gap = Math.max(30, Math.min(100, avgCost * 1.6));   // gelijkmatig, hooguit ~30 beeldjes per seconde (rustiger voor een tv-processor)
        }
      }
    } catch(e) { console.error(e); }
    requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);
  window.__tvStats = () => ({avgCostMs: +avgCost.toFixed(1), fps: +(1000 / gap).toFixed(1)});
  // vangnet: als het scherm een tijd niets heeft getekend (bv. na slaapstand), opnieuw starten
  setInterval(() => { if(Date.now() - lastFrame > 5000 && document.visibilityState === "visible"){ last = performance.now(); requestAnimationFrame(spin); } }, 5000);
  document.addEventListener("visibilitychange", () => { last = performance.now(); if(document.visibilityState === "visible") keepAwake(); });
  // voorkomen dat het scherm in slaapstand gaat (waar de browser dat toestaat)
  const keepAwake = () => { try { navigator.wakeLock && navigator.wakeLock.request("screen").catch(() => {}); } catch(e) {} };
  keepAwake();
  setTimeout(() => location.reload(), 6 * 3600 * 1000); // elke 6 uur de hele pagina (nieuwe versie van de site)
  const showFps = new URLSearchParams(location.search).has("fps");   // ?fps=1: snelheid op het scherm (om te testen)
  const clock = () => { const el = $("tvClock"); if(el) el.textContent = new Date().toLocaleString("nl-NL", {weekday:"long", day:"numeric", month:"long", hour:"2-digit", minute:"2-digit"}); };
  if(showFps){ let n = 0, t0 = performance.now(); const el = document.createElement("span"); el.style.cssText = "color:#ffb547"; $("tvClock").after(el);
    const f = () => { n++; const now = performance.now(); if(now - t0 > 2000){ el.textContent = `${Math.round(n * 1000 / (now - t0))} b/s · ${avgCost.toFixed(0)} ms`; n = 0; t0 = now; } requestAnimationFrame(f); };
    requestAnimationFrame(f); }
  clock(); setInterval(clock, 15000);
  $("tvFull").addEventListener("click", () => { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); });
}
function tvUpdate(){
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const open = tenders.filter(isOpen).sort((a,b) => (a.deadlineAt || a.deadline || "9999").localeCompare(b.deadlineAt || b.deadline || "9999"));
  freshCountries = new Set(open.filter(t => t.firstSeen && t.firstSeen > dayAgo && t.firstSeen > "2001").map(t => t.country));
  const items = open.slice(0, 30).map(t => `<span class="tk-item"><b>${esc(t.country ? cname(t.country) : (t.countryName || ""))}</b> ${esc(shownTitle(t).slice(0, 90))} <i>${esc(leftText(t))}</i></span>`).join("");
  const tk = $("tvTicker");
  if(tk) tk.innerHTML = items ? `<div class="tk-track">${items}${items}</div>` : `<span class="tk-item">Op dit moment geen open LEO-tenders</span>`;
  drawLabels();
}
})();
