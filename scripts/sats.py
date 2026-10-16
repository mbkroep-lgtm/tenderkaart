# Tijdelijk: controle van de lichte rekenmethode tegen SGP4.
import json, math, urllib.request, datetime as dt, os
from sgp4.api import Satrec, jday
from sgp4 import omm
os.makedirs('preview', exist_ok=True)
log = open('preview/log.txt', 'w')
req = urllib.request.Request('https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json', headers={'User-Agent': 'Mozilla/5.0 (tendermap)'})
gp = json.loads(urllib.request.urlopen(req, timeout=90).read().decode())
log.write(f'{len(gp)} records\n')
sub = gp[::50]
json.dump(sub, open('preview/gp-sample.json', 'w'))
def gmst(jd):
    T = (jd - 2451545.0) / 36525.0
    g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T ** 3 / 38710000.0
    return math.radians(g % 360)
t0 = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
out = {'t0': t0.isoformat(), 'times': [0, 3600*6, 86400, 86400*3], 'pos': []}
for o in sub:
    s = Satrec(); omm.initialize(s, o)
    row = []
    for sec in out['times']:
        t = t0 + dt.timedelta(seconds=sec)
        jd, fr = jday(t.year, t.month, t.day, t.hour, t.minute, t.second)
        e, r, v = s.sgp4(jd, fr)
        if e: row.append(None); continue
        x, y, z = r; th = gmst(jd + fr)
        lon = (math.degrees(math.atan2(y, x) - th) + 540) % 360 - 180
        lat = math.degrees(math.atan2(z, math.hypot(x, y)))
        row.append([lon, lat, math.sqrt(x*x+y*y+z*z)])
    out['pos'].append(row)
json.dump(out, open('preview/check.json', 'w'))
log.write('ok\n')
