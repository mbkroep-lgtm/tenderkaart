# Tijdelijk: posities van Starlink-satellieten voor een voorbeeldfilmpje.
import json, math, urllib.request, datetime as dt
from sgp4.api import Satrec, jday
req = urllib.request.Request('https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle', headers={'User-Agent': 'tendermap-preview'})
lines = urllib.request.urlopen(req, timeout=60).read().decode().strip().splitlines()
sats = [Satrec.twoline2rv(lines[i+1], lines[i+2]) for i in range(0, len(lines) - 2, 3)]
t0 = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
FRAMES, STEP = 60, 20
def gmst(jd):
    T = (jd - 2451545.0) / 36525.0
    g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T ** 3 / 38710000.0
    return math.radians(g % 360)
frames = []
for f in range(FRAMES):
    t = t0 + dt.timedelta(seconds=f * STEP)
    jd, fr = jday(t.year, t.month, t.day, t.hour, t.minute, t.second)
    th = gmst(jd + fr)
    pts = []
    for s in sats:
        e, r, v = s.sgp4(jd, fr)
        if e: continue
        x, y, z = r
        lon = math.degrees(math.atan2(y, x) - th)
        lon = (lon + 540) % 360 - 180
        lat = math.degrees(math.atan2(z, math.hypot(x, y)))
        pts.append(round(lon, 1)); pts.append(round(lat, 1))
    frames.append(pts)
json.dump({'t0': t0.isoformat(), 'step': STEP, 'count': len(sats), 'frames': frames}, open('preview/sats.json', 'w'), separators=(',', ':'))
urllib.request.urlretrieve('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json', 'preview/countries-110m.json')
urllib.request.urlretrieve('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js', 'preview/topojson-client.min.js')
print(len(sats), 'satellieten,', FRAMES, 'momenten')
