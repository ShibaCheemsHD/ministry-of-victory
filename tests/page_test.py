#!/usr/bin/env python3
"""Opens the test page (build/test.html, mock API) in every scenario and in random-data runs, clicks through
each order's tabs, the share image and the archive, and fails on page errors or broken text: NaN, undefined,
Infinity, raw placeholders, absurd percentages, "1 times"... Usage: python3 tests/page_test.py [fuzz runs]"""
import os, re, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'file://' + os.path.join(ROOT, 'build', 'test.html')
BAD = re.compile(r'\bNaN\b|\bundefined\b|Infinity|\[object |\bnull\b|\{[a-z]+\}|\b\d{1,3}(,\d{3})+%|\b\d{4,}%|(?<![\d.,])1 (times|planets|missions|attacks|objectives|operations|extractions)\b|(?<![\d.,])1 (?!news\b|less\b|plus\b|bonus\b|status\b|gas\b)[a-z]{2,}s\b|stratagem: a stratagem|about 0 needed|\b0 Helldivers needed|#\d{6,}')
SCENARIOS = ['default', 'done', 'steady', 'impossible', 'none', 'fail', 'apidown', 'libn', 'measure', 'win', 'last', 'ended', 'edited',
             'regions', 'sector', 'intel', 'sniper', 'sniperlost', 'anyof', 'newmo'] + [f'type&t={t}' for t in (1, 2, 4, 5, 6, 7, 9, 10, 15, 16)]
FUZZ = int(sys.argv[1]) if len(sys.argv) > 1 else 25
problems = []

def check(pg, label, errs):
    text = pg.evaluate('document.body.innerText')
    for m in BAD.finditer(text):
        s = max(0, m.start() - 60); problems.append(f'{label}: "…{text[s:m.end() + 40]}…"'.replace('\n', ' '))

def run(br, query, width):
    pg = br.new_page(viewport={'width': width, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append('page error: ' + str(e)[:300]))
    # anything the Content-Security-Policy blocks is a bug: a source missing from the policy, or code that needs it
    pg.add_init_script("window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || e.sample || '')))")
    pg.goto(f'{PAGE}?s={query}'); pg.wait_for_timeout(1600)
    label = f'{query} @{width}'
    check(pg, label + ' home', errs)
    # no empty band between the order of the day and the tabs (the side rail used to stretch the first row; desktop only)
    gap = pg.evaluate("() => { const d = document.querySelector('.area-dir'), t = document.querySelector('.area-tabs'); return d && t && innerWidth > 980 ? t.getBoundingClientRect().top - d.getBoundingClientRect().bottom : null; }")
    if gap is not None and gap > 40: errs.append(f'empty band of {round(gap)}px under the order of the day')
    # the header pieces never sit on top of each other (1 Nov 2026: the player count covered the logo on phones)
    clash = pg.evaluate("""() => { const r = (s) => document.querySelector(s)?.getBoundingClientRect(), l1 = r('.hud .logo .l1'), b = r('.hud .logo b');
      const logo = l1 && b ? { left: Math.min(l1.left, b.left), right: Math.max(l1.right, b.right), top: l1.top, bottom: b.bottom, width: 1 } : null;
      const a = [logo, r('#hud-stats .stat .v'), r('.hud-actions')].filter(x => x && x.width);
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i].left < a[j].right - 1 && a[j].left < a[i].right - 1 && a[i].top < a[j].bottom - 1 && a[j].top < a[i].bottom - 1) return true; return false; }""")
    if clash: errs.append('header pieces overlap')
    # the planet card opens fully on screen, its close button reachable (1 Nov 2026: a panel's cut-corner
    # clip-path hid its title and close button)
    pb = pg.locator('[data-globe]:visible')
    if pb.count():
        pb.first.click(timeout=3000); pg.wait_for_timeout(250)
        bad = pg.evaluate("""() => { const c = document.querySelector('.pc-wrap.open .pcard'), x = document.querySelector('.pc-wrap.open .pc-x'); if (!c || !x) return 'did not open';
          const r = c.getBoundingClientRect(), b = x.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return r.top < -1 || r.bottom > innerHeight + 1 ? 'off screen' : !(hit && (hit === x || x.contains(hit))) ? 'close button covered' : null; }""")
        if bad: errs.append('planet card: ' + bad)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    tabs = pg.locator('#order-tabs [data-otab]:visible')   # the order tabs only (other buttons also switch orders)
    for oi in range(max(1, tabs.count())):
        if tabs.count(): tabs.nth(oi).click(timeout=3000); pg.wait_for_timeout(120)
        for tb in ('strategy', 'history', 'intel', 'map'):
            el = pg.locator(f'.tab[data-tab="{tb}"]:visible')
            if el.count():
                el.first.click(timeout=3000); pg.wait_for_timeout(150); check(pg, f'{label} order {oi + 1} {tb}', errs)
                # nothing runs off the right edge, on every tab (1 Nov 2026: the Plan tab was cut on phones)
                over = pg.evaluate(f"""() => [...document.querySelectorAll('#view *')].filter(e => {{ const r = e.getBoundingClientRect(); return r.width > 0 && r.right > {width} + 1 && !e.closest('svg, .pc-wrap, .war-map'); }}).slice(0, 2).map(e => e.tagName + '.' + String(e.className).split(' ')[0])""")
                if over: errs.append(f'{tb} tab: wider than the screen ({", ".join(over)})')
        sh = pg.locator('[data-shareimg]:visible')
        if sh.count():
            sh.first.click(timeout=3000)
            try: pg.wait_for_selector('#share-body img', timeout=8000)
            except Exception: errs.append('share image not drawn')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    if pg.evaluate('document.documentElement.scrollWidth') > width + 1: errs.append('page wider than the screen')
    arch = pg.locator('#open-archive')
    if arch.count() and arch.is_visible():
        arch.click(); pg.wait_for_timeout(600); check(pg, label + ' archive', errs)
    csp = pg.evaluate('window.__csp || []')
    if csp: errs.append('blocked by the security policy: ' + ', '.join(sorted(set(csp))[:4]))
    missing = pg.evaluate('window.__missingT ? [...window.__missingT] : []')
    if missing: errs.append('texts missing from the dictionary: ' + ', '.join(sorted(missing)[:10]))
    problems.extend(f'{label}: {e}' for e in sorted(set(errs)))
    pg.close()

with sync_playwright() as p:
    br = p.chromium.launch()
    for s in SCENARIOS: run(br, s, 1366)
    for s in ('default', 'none', 'sniper'): run(br, s, 390)
    for s in ('default', 'intel'): run(br, s, 320)   # the narrowest phones still in use
    for seed in range(1, FUZZ + 1): run(br, f'fuzz&seed={seed}', 1366 if seed % 2 else 390)
    # GitHub raw down: the recorder's files come from jsDelivr instead (audit ARCH-05)
    pg = br.new_page(); pg.goto(f'{PAGE}?s=default&raw=down'); pg.wait_for_timeout(2500)
    via = pg.evaluate("window.__mockLog.filter(x => x.rec === 'intel.json').map(x => x.via)")
    if 'cdn.jsdelivr.net' not in via: problems.append('raw down: the recorder data did not come from the fallback')
    if not pg.locator('.trust-link').count(): problems.append('raw down: the page lost the recorder data')
    pg.close()
    # outside text never runs as code (1 Nov 2026: an order name with markup ran its onerror in the archive)
    pg = br.new_page()
    pg.add_init_script("""Object.defineProperty(window, '__mockArchive', { configurable: true, get() { return this.__a; }, set(v) {
      const bad = '<img src=x onerror="window.__pwn=1">';
      if (v && v.orders) v.orders.forEach(o => { o.name = 'MAJOR ORDER | ' + bad; o.brief = bad + ' Liberate it.'; (o.facts?.planets || []).forEach(p => { p.n = bad; }); });
      this.__a = v; } });""")
    # the security policy would now block the handler anyway: a blocked attempt counts as a failure too
    pg.add_init_script("window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective))")
    pg.goto(f'{PAGE}?s=default&motion=reduced'); pg.wait_for_timeout(1500)
    pg.click('#open-archive'); pg.wait_for_timeout(1500)
    if pg.evaluate('window.__pwn'): problems.append('outside text ran as code in the archive')
    if pg.evaluate('window.__csp.length'): problems.append('outside text tried to run as code in the archive (blocked by the security policy)')
    pg.close()
    br.close()
for x in problems[:60]: print('PROBLEM', x)
print(f'{len(SCENARIOS) + 5 + FUZZ} pages, {len(problems)} problems')
sys.exit(1 if problems else 0)
