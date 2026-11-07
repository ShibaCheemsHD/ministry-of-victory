"""Accessibility check: runs axe-core on every scenario of the test page, every tab,
the dialogs, the archive and a phone-sized screen, then checks the dialogs by keyboard.

Needs axe-core: `npm i --no-save axe-core@4.10.2` in the repo root.
Usage: python3 tests/a11y_test.py   (exit 1 on any violation)
"""
import os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'file://' + os.path.join(ROOT, 'build', 'test.html')
AXE = open(os.path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js')).read()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
SCENARIOS = ['default', 'none', 'fail', 'measure', 'win', 'ended', 'regions', 'intel', 'sniper', 'anyof', 'newmo', 'migr', 'type&t=9']
TABS = ['races', 'strategy', 'history', 'map']
RUN = """async () => { const r = await axe.run(document, { resultTypes: ['violations'] });
  return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help,
    nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\\n').slice(1, 2).join(' ')) })); }"""

found = {}
def check(pg, where):
    pg.add_script_tag(content=AXE)
    for v in pg.evaluate(RUN):
        found.setdefault(v['id'], (v['impact'], v['help'], []))[2].append(where + ': ' + ' | '.join(v['nodes'])[:300])

def open_page(br, sc, width=1366, lang=None):
    # axe is injected as a script: the page's security policy would refuse it (page_test checks the policy itself)
    pg = br.new_page(viewport={'width': width, 'height': 900}, locale=lang or 'en-US', bypass_csp=True)
    pg.goto(f'{PAGE}?s={sc}&motion=reduced'); pg.wait_for_timeout(1800)
    return pg

keys = []
with sync_playwright() as p:
    br = p.chromium.launch()
    for sc in SCENARIOS:
        for w in (1366, 390):
            pg = open_page(br, sc, w)
            check(pg, f'{sc}@{w}')
            if sc == 'default':
                pg.locator('.tab[data-tab="history"]:visible').first.click(); pg.wait_for_timeout(150)
                evidence = pg.locator('.forecast-evidence > summary').first
                evidence.click(); pg.wait_for_timeout(100)
                check(pg, f'{sc}/evidence-open@{w}')
            if w == 1366:
                for tab in TABS:
                    b = pg.locator(f'.tab[data-tab="{tab}"]:visible')
                    if b.count():
                        b.first.click(); pg.wait_for_timeout(250); check(pg, f'{sc}/{tab}')
                        if tab == 'strategy' and pg.locator('.mv-explain > summary').count():
                            pg.locator('.mv-explain > summary').first.click(); check(pg, f'{sc}/{tab}/disclosure')
            pg.close()
    pg = open_page(br, 'default')
    pg.click('#open-archive'); pg.wait_for_timeout(900); check(pg, 'archive')
    pg.close()
    pg = open_page(br, 'default')
    for opener, dlg in [('#open-settings', 'dlg-settings'), ('#open-faq', 'dlg-faq')]:
        pg.focus(opener); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        check(pg, dlg)
        inside = pg.evaluate(f"() => !!document.activeElement.closest('#{dlg}')")
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        back = pg.evaluate(f"() => '#' + document.activeElement.id === '{opener}' && !document.getElementById('{dlg}').open")
        if not inside: keys.append(f'{dlg}: focus does not move into the dialog')
        if not back: keys.append(f'{dlg}: Escape does not close it and return focus to {opener}')
    pg.evaluate("document.querySelectorAll('.share-menu').forEach(d => { d.open = true; })"); check(pg, 'share menu')
    pg.locator('[data-shareimg]:visible').first.click(); pg.wait_for_selector('#share-body img'); check(pg, 'share')
    pg.close()
    pg = open_page(br, 'intel')
    pg.locator('.tab[data-tab="races"]').click(); pg.wait_for_timeout(250); check(pg, 'grouped command log')
    pg.locator('.it-timeline > summary').first.click(); pg.wait_for_timeout(100); check(pg, 'command log timeline open')
    clusters = pg.locator('[data-igroup]')
    if clusters.count(): clusters.first.click(); pg.wait_for_timeout(100); check(pg, 'selected command events')
    pg.locator('[data-globe]:visible').first.click(); pg.wait_for_timeout(250); check(pg, 'planet popup briefing')
    pg.keyboard.press('Escape'); pg.close()
    # every control reachable by Tab has a visible focus style
    pg = open_page(br, 'default')
    for i in range(40):
        pg.keyboard.press('Tab')
        info = pg.evaluate("""() => { const e = document.activeElement; if (!e || e === document.body || e.closest('svg')) return null;  // map planets draw their own ring
          const s = getComputedStyle(e); const ring = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || /\\d/.test(s.boxShadow) && s.boxShadow !== 'none';
          return { ring, what: e.tagName + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0] }; }""")
        if info and not info['ring']: keys.append('no visible focus: ' + info['what'])
    pg.close()
    br.close()

for k, (impact, help, where) in sorted(found.items()):
    print(f'[{impact}] {k}: {help}')
    for w in where[:4]: print('   ', w)
for k in sorted(set(keys)): print('[keyboard]', k)
print(f'{len(found)} axe rules violated, {len(set(keys))} keyboard problems')
sys.exit(1 if found or keys else 0)
