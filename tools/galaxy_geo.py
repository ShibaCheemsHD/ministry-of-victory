"""The galaxy's fixed geometry for the Fronts tab: where every planet is, its sector, its biome and hazards,
its supply lines, and the ground each one holds on the map. Planets never move, so this is built once (and again
when the game adds planets) from a snapshot of the community API's /api/v1/planets:

    curl -H 'X-Super-Client: ministry-of-victory' -H 'X-Super-Contact: github.com/ShibaCheemsHD/ministry-of-victory' \\
      https://api.helldivers2.dev/api/v1/planets > /tmp/planets.json
    python3 tools/galaxy_geo.py /tmp/planets.json      # writes src/game/galaxy.json

Each planet's ground is its Voronoi cell among all planets, kept within a round reach of the planet, so a
faction's territory is the union of the grounds of the planets it holds (drawn on the page). A sector is the
union of the full cells of its planets. Needs numpy, scipy and shapely (pip install scipy shapely).
"""
import json, math, sys, os
import numpy as np
from scipy.spatial import Voronoi
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

src = sys.argv[1]
d = json.load(open(src))
# placeholder worlds parked on Super Earth's own spot (sector 'TBD') are not on the map
d = [p for p in d if p['index'] == 0 or abs(p['position']['x']) + abs(p['position']['y']) > 1e-6]
pts = np.array([[p['position']['x'], p['position']['y']] for p in d])
R = float(np.max(np.hypot(pts[:, 0], pts[:, 1]))) * 1.07
ring = np.array([[3 * math.cos(a), 3 * math.sin(a)] for a in np.linspace(0, 2 * math.pi, 72, endpoint=False)])
vor = Voronoi(np.vstack([pts, ring]))
disc = Point(0, 0).buffer(R, resolution=96)
S = 500 / R                                   # map units: the galaxy's rim at 500 from Super Earth (y down)
tr = lambda x, y: (round(x * S, 1), round(-y * S, 1))

def path(g, simp=0.0):
    if g.is_empty: return ''
    if simp: g = g.simplify(simp / S)
    out = []
    for pg in ([g] if isinstance(g, Polygon) else list(g.geoms)):
        for r in [pg.exterior, *pg.interiors]:
            c = list(r.coords)[:-1]
            out.append('M' + 'L'.join('%g %g' % tr(x, y) for x, y in c) + 'Z')
    return ''.join(out)

cells = []
for i in range(len(d)):
    reg = vor.regions[vor.point_region[i]]
    cells.append(Polygon([vor.vertices[k] for k in reg]).intersection(disc))
sectors = {}
for name in sorted({p['sector'] for p in d}):
    ps = [k for k, p in enumerate(d) if p['sector'] == name]
    u = unary_union([cells[k] for k in ps])
    cx = sum(d[k]['position']['x'] for k in ps) / len(ps); cy = sum(d[k]['position']['y'] for k in ps) / len(ps)
    lab = Point(cx, cy) if u.contains(Point(cx, cy)) else u.representative_point()
    sectors[name] = [path(u, 0.6), *tr(lab.x, lab.y)]
title = lambda s: ' '.join(w if w.isupper() and len(w) <= 4 and set(w) <= set('IVX') else w.capitalize() for w in s.split(' '))
planets = []
for k, p in enumerate(d):
    blob = cells[k].intersection(Point(p['position']['x'], p['position']['y']).buffer(0.16, resolution=24))
    x, y = tr(p['position']['x'], p['position']['y'])
    planets.append([p['index'], title(p['name']), x, y, p['sector'], (p.get('biome') or {}).get('name', ''),
                    [h['name'] for h in p.get('hazards', []) if h['name'] != 'None'], p.get('waypoints', []), path(blob, 0.35)])
out = os.path.join(os.path.dirname(__file__), '..', 'src', 'game', 'galaxy.json')
json.dump({'v': 1, 'src': 'api.helldivers2.dev /api/v1/planets', 'p': planets, 's': sectors}, open(out, 'w'), separators=(',', ':'))
print(f'{len(planets)} planets, {len(sectors)} sectors, {os.path.getsize(out)} bytes')
