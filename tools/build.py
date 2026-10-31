#!/usr/bin/env python3
"""Builds the site from src/:
  index.html            production page (CSS and scripts minified with esbuild)
  recorder/engine.cjs   the same engine for the recorder
  build/test.html       readable page wired to the mock API (src/mock.js), for tests
Usage: python3 tools/build.py [--check]   (--check: fail if index.html / engine.cjs are out of date)"""
import json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda *p: os.path.join(ROOT, 'src', *p)
read = lambda p: open(p, encoding='utf-8').read()

head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Ministry of Victory · Helldivers 2 Major Order terminal</title>
<meta name="description" content="Unofficial tactical terminal for Helldivers 2 Major Orders: can we win it, and what should the community do right now?">
<meta property="og:type" content="website">
<meta property="og:title" content="Ministry of Victory · Can we win this Major Order?">
<meta property="og:description" content="Free Helldivers 2 Major Order terminal: live odds, where to drop right now, and every MO since 2024 checked for whether it was ever winnable.">
<meta property="og:url" content="https://shibacheemshd.github.io/ministry-of-victory/">
<meta property="og:image" content="https://shibacheemshd.github.io/ministry-of-victory/preview.png">
<meta property="og:image:width" content="1920"><meta property="og:image:height" content="1080">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&family=Chakra+Petch:wght@400;500;600;700&family=Share+Tech+Mono&display=swap">
<style>
'''
out = head + read(S('style.css')) + '</style>\n</head>\n<body>\n' + read(S('body.html'))
# game texts (hazards, biomes, effects) from github.com/helldivers-2/json (MIT)
env, bio, fx = (json.load(open(S('game', f), encoding='utf-8')) for f in ('environmentals.json', 'biomes.json', 'planetEffects.json'))
game = {'env': {k: {'n': v.get('name'), 'd': v.get('description')} for k, v in env.items()},
        'bio': {k: {'n': v.get('name'), 'd': v.get('description')} for k, v in bio.items()},
        'fx': {k: {'n': v.get('name'), 'd': v.get('description')} for k, v in fx.items() if v.get('name')}}
out += '<script>\nconst GAME = ' + json.dumps(game, ensure_ascii=False, separators=(',', ':')) + ';\n</script>\n'
for f in ('engine.js', 'i18n.js', 'app.js'):
    out += '<script>\n' + read(S(f)) + '\n</script>\n'
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

engine = read(S('engine.js'))
targets = {os.path.join(ROOT, 'index.html'): prod, os.path.join(ROOT, 'recorder', 'engine.cjs'): engine}
if '--check' in sys.argv:
    stale = [p for p, c in targets.items() if not os.path.exists(p) or read(p) != c]
    if stale: sys.exit('out of date (run python3 tools/build.py): ' + ', '.join(os.path.relpath(p, ROOT) for p in stale))
else:
    for p, c in targets.items(): open(p, 'w', encoding='utf-8').write(c)

# test page: the readable source, the mock API and a recorded archive
os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
arch = read(S('mock_archive.json')) if os.path.exists(S('mock_archive.json')) else 'null'
test = out.replace('<script>', '<script>window.__mockArchive=' + arch + ';\n' + read(S('mock.js')) + '</script>\n<script>', 1)
open(os.path.join(ROOT, 'build', 'test.html'), 'w', encoding='utf-8').write(test)
print('built', len(out), 'bytes of source,', len(prod), 'minified')
