#!/usr/bin/env python3
"""Checks the recorder's own report (intel.json on the data branch) and says what is wrong, if anything.
Prints a markdown report; exit code 1 when something needs attention. Used by .github/workflows/health.yml,
which keeps one GitHub issue open while there are problems and closes it when all is well again."""
import json, sys, time, urllib.request

H = 3600
URL = sys.argv[1] if len(sys.argv) > 1 else 'https://raw.githubusercontent.com/ShibaCheemsHD/ministry-of-victory/data/intel.json'
now = time.time()

def ago(ms):
    if not ms: return 'never'
    s = now - ms / 1000
    return f'{s / 60:.0f} min ago' if s < 2 * H else f'{s / H:.1f} h ago' if s < 48 * H else f'{s / 86400:.1f} days ago'

def load():
    if URL.startswith('http'):
        req = urllib.request.Request(URL + ('&' if '?' in URL else '?') + f't={int(now)}', headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
    return json.load(open(URL))

problems, notes = [], []
try:
    intel = load()
except Exception as e:
    print(f'**The recorder\'s report can\'t be read:** {e}'); sys.exit(1)

upd = intel.get('updated') or 0
if now - upd / 1000 > 45 * 60:
    problems.append(f'**The recorder has stopped**: last snapshot {ago(upd)} (one every 10 minutes). Check the "Record the war" workflow.')
h = intel.get('health') or {}

def check(key, label, max_age_h, why):
    x = h.get(key) or {}
    okt, errt = x.get('ok') or 0, x.get('err') or 0
    since = h.get('_since') or 0
    if not okt and not errt and now - since / 1000 < max_age_h * H: return   # not tried yet since tracking began
    if now - okt / 1000 > max_age_h * H:
        problems.append(f'**{label}** {"last answered " + ago(okt) if okt else "has not answered yet"}: {why}' + (f' Last error ({ago(errt)}): `{x.get("msg", "")}`' if errt else ''))
    elif errt > okt:
        notes.append(f'{label}: error {ago(errt)} (`{x.get("msg", "")}`), last success {ago(okt)}.')

check('community', 'Community API (api.helldivers2.dev)', 2, 'the site is running on the recorder\'s copy of the official API.')
check('official', 'Official game API', 6, 'no galactic war effects, no launch briefings, no fallback if the community API goes down.')
check('warlog', 'Community war log (CrossWaveOmega)', 36, 'the archive of past orders isn\'t refreshed.')
check('rebuild', 'Archive rebuild (resort.json)', 36, 'past orders aren\'t checked again.')
check('helldiversstats', 'helldiversstats.com', 48, 'new past orders get no exact objectives (kill / mission checks).')
hs = h.get('helldiversstats') or {}
if hs.get('msg') and 'without readable objectives' in hs.get('msg', '') and (hs.get('err') or 0) >= (hs.get('ok') or 0):
    problems.append(f'**helldiversstats.com pages changed?** {hs["msg"]}: recorder/hs.mjs may need a new pattern.')
up = intel.get('warlogUpTo')
if up and now - up / 1000 > 10 * 86400:
    notes.append(f'The community war log stops {ago(up)}: recent orders are judged from the recorder\'s own data only.')

# a signature of what is wrong (without the times), so the issue only gets a comment when that changes
sig = '|'.join(sorted(p.split('**')[1] for p in problems if '**' in p))
print(f'<!-- sig:{sig} -->')
print('## Recorder health\n')
print(f'Last snapshot: {ago(upd)}.\n')
for p in problems: print(f'- {p}')
if not problems: print('All sources answered recently.')
if notes:
    print('\n**Notes**\n'); [print(f'- {n}') for n in notes]
sys.exit(1 if problems else 0)
