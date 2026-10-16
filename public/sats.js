// Starlink-satellieten: posities uitrekenen uit de baanelementen (public/starlink.json).
// Lichte versie van SGP4: cirkelvormige banen met de afplatting van de aarde (J2) en een beetje luchtweerstand.
// Nauwkeurig tot op enkele tientallen kilometers; ruim genoeg voor de wereldbol, en snel genoeg voor ruim 10.000 satellieten.
(function(root){
  const XKE = 0.0743669161, J2 = 0.001082616, TWO_PI = Math.PI * 2, D2R = Math.PI / 180;

  // gegevens omzetten naar voorgerekende waarden per satelliet
  function decode(data){
    const s = data.s, F = data.fields || 8, n = Math.floor(s.length / F);
    const base = Date.parse(data.base);
    const sat = new Float64Array(n * 9);
    for(let k = 0; k < n; k++){
      const o = k * F;
      const ep = base + s[o] * 1000, nRev = s[o+1], e = s[o+2], inc = s[o+3] * D2R;
      const raan = s[o+4] * D2R, argp = s[o+5] * D2R, M = s[o+6] * D2R, mdot2 = s[o+7];
      // gemiddelde beweging omrekenen zoals SGP4 dat doet (Kozai naar Brouwer)
      const n0 = nRev * TWO_PI / 1440;                 // rad per minuut
      const cosi = Math.cos(inc), x3 = 3 * cosi * cosi - 1, b = Math.pow(1 - e * e, 1.5);
      const a1 = Math.pow(XKE / n0, 2 / 3);
      const d1 = 0.75 * J2 * x3 / (a1 * a1 * b);
      const a0 = a1 * (1 - d1 / 3 - d1 * d1 - 134 / 81 * d1 * d1 * d1);
      const d0 = 0.75 * J2 * x3 / (a0 * a0 * b);
      const nn = n0 / (1 + d0), a = a0 / (1 - d0);
      const p = a * (1 - e * e), t = 1.5 * J2 / (p * p) * nn;
      const q = k * 9;
      sat[q] = ep;
      sat[q+1] = raan; sat[q+2] = -t * cosi;                                    // knoop + verschuiving per minuut
      sat[q+3] = argp + M; sat[q+4] = nn + 0.5 * t * (5 * cosi * cosi - 1) + 0.5 * t * Math.sqrt(1 - e * e) * x3;  // baanpositie + snelheid
      sat[q+5] = inc; sat[q+6] = e; sat[q+7] = argp; sat[q+8] = mdot2 * TWO_PI;  // luchtweerstand (omw/dag² → rad/dag²)
    }
    return { n, sat, updated: data.updated };
  }

  // sterrentijd in Greenwich (radialen)
  function gmst(ms){
    const jd = ms / 864e5 + 2440587.5, T = (jd - 2451545) / 36525;
    const g = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - T * T * T / 38710000;
    return ((g % 360) + 360) % 360 * D2R;
  }

  // posities op tijdstip ms → out[2k] = lengtegraad, out[2k+1] = breedtegraad (graden)
  function positions(d, ms, out){
    out = out || new Float32Array(d.n * 2);
    const th = gmst(ms), sat = d.sat;
    for(let k = 0; k < d.n; k++){
      const q = k * 9, dtMin = (ms - sat[q]) / 6e4, dtDay = dtMin / 1440;
      const raan = sat[q+1] + sat[q+2] * dtMin;
      // argument van breedte: (perigeum + middelbare anomalie) + verschuiving; kleine excentriciteit als correctie
      const Mtot = sat[q+3] + sat[q+4] * dtMin + sat[q+8] * dtDay * dtDay;
      const e = sat[q+6], Mm = Mtot - sat[q+7];
      const u = Mtot + 2 * e * Math.sin(Mm);
      const cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(sat[q+5]), si = Math.sin(sat[q+5]);
      const cO = Math.cos(raan), sO = Math.sin(raan);
      const x = cO * cu - sO * su * ci, y = sO * cu + cO * su * ci, z = su * si;
      let lon = (Math.atan2(y, x) - th) / D2R;
      lon = ((lon + 540) % 360 + 360) % 360 - 180;
      out[2*k] = lon; out[2*k+1] = Math.asin(Math.max(-1, Math.min(1, z))) / D2R;
    }
    return out;
  }
  root.StarlinkSats = { decode, positions };
})(typeof window !== "undefined" ? window : globalThis);
