"""The same figure says the same thing wherever the page shows it (8 Nov 2026: the call, the Plan and the radar
gave three different 'needed' for one planet, and the radar called a close race the verdict called On track).
Checks, for every scenario and random data: the call's fall time against the Objectives and Progress, and the
call's turnout gauge (minimum, to be safe) against the Plan's."""
import re, sys
from playwright.sync_api import sync_playwright
from pathlib import Path
R = str(Path(__file__).resolve().parents[1])
SC = ['default','done','steady','impossible','fail','libn','measure','win','last','edited','regions','sector','sniper','anyof','newmo','migr'] + [f'fuzz&seed={i}' for i in range(1, int(sys.argv[1]) + 1 if len(sys.argv) > 1 else 21)]
issues = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width':1440,'height':900}, timezone_id='Europe/Rome')
    for sc in SC:
        pg = ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.set_default_timeout(5000); pg.goto(f'file://{R}/build/test.html?s={sc}&motion=reduced'); pg.wait_for_timeout(1800)
        tabs = pg.locator('#order-tabs [data-otab]:visible'); n = max(1, tabs.count())
        for oi in range(n):
            if tabs.count(): tabs.nth(oi).click(); pg.wait_for_timeout(250)
            hero = pg.evaluate("""() => { const c = document.querySelector('.call'); if (!c) return null;
              const g = c.querySelector('.call-gauge .mvg-nums'); const h = c.querySelector('.wings, h2, .call-h');
              return { text: c.innerText, gauge: g ? g.innerText : null, planet: (c.innerText.match(/EVERYONE TO\\n([^\\n]+)/) || [])[1] || null,
                       eta: (c.innerText.match(/LIBERATED AROUND\\n([^\\n]+)/) || [])[1] || null }; }""")
            if not pg.locator('.tab[data-tab="races"]:visible').count(): continue
            pg.locator('.tab[data-tab="races"]:visible').first.click(); pg.wait_for_timeout(150)
            races = pg.locator('.tabpanel').first.inner_text()
            pg.locator('.tab[data-tab="strategy"]:visible').first.click(); pg.wait_for_timeout(150)
            plan = pg.evaluate("""() => { const g = document.querySelector('.tabpanel .mv-gauge:not(.call-gauge) .mvg-nums'); const h = document.querySelector('.tabpanel .mv-head, .tabpanel h3'); return { gauge: g ? g.innerText : null, text: document.querySelector('.tabpanel').innerText }; }""")
            pg.locator('.tab[data-tab="history"]:visible').first.click(); pg.wait_for_timeout(150)
            plates = pg.locator('.pk-plate').all_inner_texts()
            tag = f'{sc} o{oi+1}'
            if errs: issues.append((tag, 'page error', errs[0]))
            if hero and hero['eta'] and hero['planet']:
                eta = hero['eta'].strip().lower(); pl = hero['planet'].strip().lower()
                if eta not in races.lower(): issues.append((tag, 'ETA hero vs objectives', hero['eta'], pl))
                pp = [x for x in plates if x.lower().startswith(pl)]
                if pp and 'falls' in pp[0].lower() and eta not in pp[0].lower(): issues.append((tag, 'ETA hero vs progress', hero['eta'], pp[0].replace('\n', ' ')))
            if hero and hero['gauge'] and plan['gauge'] and hero['planet'] and ('EVERYONE ON ' + hero['planet'].upper()) in plan['text'].upper():
                mh = re.search(r'([\d,]+) minimum', hero['gauge']); mp = re.search(r'([\d,]+) minimum', plan['gauge'])
                sh = re.search(r'([\d,]+) to be safe', hero['gauge']); sp = re.search(r'([\d,]+) to be safe', plan['gauge'])
                if (mh and mh.group(1)) != (mp and mp.group(1)) or (sh and sh.group(1)) != (sp and sp.group(1)):
                    issues.append((tag, 'gauge hero vs plan', hero['gauge'].replace('\n', ' | '), plan['gauge'].replace('\n', ' | ')))
        pg.close()
    b.close()
for i in issues: print(i)
print(len(issues), 'issues over', len(SC), 'scenarios')
sys.exit(1 if issues else 0)
