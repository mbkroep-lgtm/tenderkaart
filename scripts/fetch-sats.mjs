// Baangegevens van alle Starlink-satellieten ophalen (CelesTrak) voor de knop "Satellieten" op de bol.
// Schrijft public/starlink.json: per satelliet de baanelementen; de browser rekent zelf de posities uit.
import { writeFile, mkdir } from "node:fs/promises";

const URLS = [
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json",
  "https://celestrak.com/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json",
];

let gp = null;
for (const url of URLS) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (tendermap.eu)" }, signal: AbortSignal.timeout(90000) });
    if (!r.ok) { console.log(`${url}: HTTP ${r.status}`); continue; }
    const d = await r.json();
    if (Array.isArray(d) && d.length > 100) { gp = d; break; }
    console.log(`${url}: onverwacht antwoord`);
  } catch (e) { console.log(`${url}: ${e.message}`); }
}
if (!gp) { console.log("Geen satellietgegevens opgehaald; vorige versie blijft staan."); process.exit(0); }

// tijden als seconden ten opzichte van één basismoment, hoeken in graden
const epochs = gp.map(o => Date.parse(o.EPOCH.endsWith("Z") ? o.EPOCH : o.EPOCH + "Z"));
const base = Math.max(...epochs.filter(Number.isFinite));
const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const s = [];
gp.forEach((o, i) => {
  if (!Number.isFinite(epochs[i]) || !(o.MEAN_MOTION > 10)) return;   // alleen satellieten in een lage baan
  s.push(r((epochs[i] - base) / 1000, 1), r(o.MEAN_MOTION, 8), r(o.ECCENTRICITY, 7), r(o.INCLINATION, 3),
    r(o.RA_OF_ASC_NODE, 3), r(o.ARG_OF_PERICENTER, 3), r(o.MEAN_ANOMALY, 3), r(o.MEAN_MOTION_DOT || 0, 8));
});
await mkdir("public", { recursive: true });
await writeFile("public/starlink.json", JSON.stringify({ updated: new Date().toISOString(), base: new Date(base).toISOString(), fields: 8, s }));
console.log(`${s.length / 8} Starlink-satellieten opgeslagen.`);
