#!/usr/bin/env python3
"""Builds the site from src/:
  index.html            production page (CSS and scripts minified with esbuild)
  recorder/engine.cjs   the same engine for the recorder
  build/test.html       readable page wired to the mock API (src/mock.js), for tests
Usage: python3 tools/build.py [--check]   (--check: fail if index.html / engine.cjs are out of date)"""
import base64, hashlib, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda *p: os.path.join(ROOT, 'src', *p)
read = lambda p: open(p, encoding='utf-8').read()

head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Ministry of Victory · Helldivers 2 Major Order decision desk</title>
<meta name="theme-color" content="#0a1120">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='5' fill='%23fee700'/><g transform='translate(1 1) scale(.75)'><path d='M20 2 38 20 20 38 2 20Z' fill='none' stroke='%230a0a07' stroke-width='2.8'/><path d='M13 16h14l-2.4 4H22v8h-4v-8h-2.6Z' fill='%230a0a07'/></g></svg>">
<meta name="description" content="Unofficial decision desk for Helldivers 2 Major Orders: can we win it, and where should the community drop right now?">
<meta property="og:type" content="website">
<meta property="og:title" content="Ministry of Victory · Can we win this Major Order?">
<meta property="og:description" content="Free Helldivers 2 Major Order decision desk: live odds, where to drop right now, and every MO since 2024 checked for whether it was ever winnable.">
<meta property="og:url" content="https://shibacheemshd.github.io/ministry-of-victory/">
<meta property="og:image" content="https://shibacheemshd.github.io/ministry-of-victory/preview.png">
<meta property="og:image:width" content="1920"><meta property="og:image:height" content="1080">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="Ministry of Victory · Major Orders" href="https://raw.githubusercontent.com/ShibaCheemsHD/ministry-of-victory/data/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira:wdth,wght@100..125,400..900&display=swap">
<style>
'''
out = head + read(S('style.css')) + '</style>\n</head>\n<body class="data-loading">\n' + read(S('body.html'))
# game texts (hazards, biomes, effects) from github.com/helldivers-2/json (MIT)
env, bio, fx, foe, items = (json.load(open(S('game', f), encoding='utf-8')) for f in ('environmentals.json', 'biomes.json', 'planetEffects.json', 'enemies.json', 'items.json'))
game = {'icons': json.load(open(S('game', 'icons.json'), encoding='utf-8')), 'env': {k: {'n': v.get('name'), 'd': v.get('description')} for k, v in env.items()},
        'bio': {k: {'n': v.get('name'), 'd': v.get('description')} for k, v in bio.items()},
        'fx': {k: {'n': v.get('name'), 'd': v.get('description')} for k, v in fx.items() if v.get('name')},
        # enemy units named by Major Order objectives (our own list: the community one went offline)
        'foe': {k: {'one': v['one'], 'many': v['many']} for k, v in foe.items() if not k.startswith('_')},
        # weapons and stratagems named by objectives that the community item list lacks
        'item': {k: v['name'] for k, v in items.items() if not k.startswith('_')},
        # the galaxy's fixed shapes for the Fronts map (tools/galaxy_geo.py)
        'gal': {k: v for k, v in json.load(open(S('game', 'galaxy.json'), encoding='utf-8')).items() if k in ('p', 's')}}
out += '<script>\nconst GAME = ' + json.dumps(game, ensure_ascii=False, separators=(',', ':')) + ';\n</script>\n'
# the page's code lives in src/app/*.js, in order; together they make one closure (shared helpers and state)
parts = sorted(f for f in os.listdir(S('app')) if f.endswith('.js'))
app = "/* Ministry of Victory - user interface (built from src/app/) */\n(() => {\n  'use strict';\n" + ''.join(read(S('app', f)) for f in parts) + '})();\n'
for code in (read(S('engine.js')), read(S('i18n.js')), app):
    out += '<script>\n' + code + '\n</script>\n'
out += '</body>\n</html>\n'

def esbuild(code, loader):
    cmd = ['npx', '--yes', 'esbuild@0.24.0', '--minify', '--loader=' + loader] + (['--target=es2020'] if loader == 'js' else ['--log-level=warning'])
    r = subprocess.run(cmd, input=code, capture_output=True, text=True, cwd=ROOT)
    if r.returncode: sys.exit('esbuild failed: ' + r.stderr[:800])
    return r.stdout

prod = out
css = out.split('<style>\n', 1)[1].split('</style>', 1)[0]
prod = prod.replace(css, esbuild(css, 'css'), 1)
for js in re.findall(r'<script>\n(.*?)\n</script>', out, re.S):
    prod = prod.replace(js, esbuild(js, 'js').rstrip('\n'), 1)

# Content-Security-Policy (audit SEC-02): only this page's own scripts run (by hash, so an injected
# <script> or onerror="" is refused), and the page talks only to the sources it needs.
# GitHub Pages can't send headers, so it goes in a <meta>; frame-ancestors isn't possible there.
CONNECT = ['https://api.helldivers2.dev', 'https://raw.githubusercontent.com', 'https://cdn.jsdelivr.net']
def with_csp(html):
    hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(s.encode('utf-8')).digest()).decode() + "'" for s in re.findall(r'<script>(.*?)</script>', html, re.S)]
    csp = '; '.join([
        "default-src 'none'", 'script-src ' + ' '.join(hashes), 'connect-src ' + ' '.join(CONNECT),
        "style-src 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com',
        "img-src 'self' data: blob:", "base-uri 'none'", "form-action 'none'", "object-src 'none'"])
    return html.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">\n', 1)
prod = with_csp(prod)

engine = read(S('engine.js'))
targets = {os.path.join(ROOT, 'index.html'): prod, os.path.join(ROOT, 'recorder', 'engine.cjs'): engine}
if '--check' in sys.argv:
    stale = [p for p, c in targets.items() if not os.path.exists(p) or read(p) != c]
    if stale: sys.exit('out of date (run python3 tools/build.py): ' + ', '.join(os.path.relpath(p, ROOT) for p in stale))
else:
    for p, c in targets.items(): open(p, 'w', encoding='utf-8').write(c)

# test page: the readable source, the mock API and a recorded archive
os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
open(os.path.join(ROOT, 'build', 'app.js'), 'w', encoding='utf-8').write(app)   # the assembled code, for tools
arch = read(S('mock_archive.json')) if os.path.exists(S('mock_archive.json')) else 'null'
test = out.replace('<script>', '<script>window.__mockArchive=' + arch + ';\n' + read(S('mock.js')) + '</script>\n<script>', 1)
open(os.path.join(ROOT, 'build', 'test.html'), 'w', encoding='utf-8').write(with_csp(test))
print('built', len(out), 'bytes of source,', len(prod), 'minified')
