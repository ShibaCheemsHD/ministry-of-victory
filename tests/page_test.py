#!/usr/bin/env python3
"""Opens the test page (build/test.html, mock API) in every scenario and in random-data runs, clicks through
each order's tabs, the share image and the archive, and fails on page errors or broken text: NaN, undefined,
Infinity, raw placeholders, absurd percentages, "1 times"... Usage: python3 tests/page_test.py [fuzz runs]"""
import os, re, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'file://' + os.path.join(ROOT, 'build', 'test.html')
BAD = re.compile(r'\bNaN\b|\bundefined\b|Infinity|\[object |\bnull\b|\{[a-z]+\}|\b\d{1,3}(,\d{3})+%|(?<![\d.])\d{4,}%|(?<![\d.,])1 (times|planets|missions|attacks|objectives|operations|extractions)\b|(?<![\d.,])1 (?!news\b|less\b|plus\b|bonus\b|status\b|gas\b)[a-z]{2,}s\b|stratagem: a stratagem|about 0 needed|\b0 Helldivers needed|#\d{6,}')
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
    # the planet briefing expands in the page, with no internal scrollbars and a reachable close button (1 Nov 2026: a panel's cut-corner
    # clip-path hid its title and close button)
    pb = pg.locator('[data-globe]:visible')
    if pb.count():
        pb.first.click(timeout=3000); pg.wait_for_timeout(250)
        pg.locator('.pc-wrap.open .pc-x').scroll_into_view_if_needed()
        bad = pg.evaluate("""() => { const c = document.querySelector('.pc-wrap.open .pcard'), x = document.querySelector('.pc-wrap.open .pc-x'); if (!c || !x) return 'did not open';
          const r = c.getBoundingClientRect(), b = x.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          const style = getComputedStyle(c);
          return r.left < -1 || r.right > innerWidth + 1 ? 'wider than page' : c.scrollWidth > c.clientWidth + 1 ? 'content clipped horizontally' : style.overflowY === 'auto' || style.overflowY === 'scroll' || c.scrollHeight > c.clientHeight + 1 ? 'internal scrollbar or height cap' : !(hit && (hit === x || x.contains(hit))) ? 'close button covered' : null; }""")
        if bad: errs.append('planet card: ' + bad)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    tabs = pg.locator('#order-tabs [data-otab]:visible')   # the order tabs only (other buttons also switch orders)
    for oi in range(max(1, tabs.count())):
        if tabs.count(): tabs.nth(oi).click(timeout=3000); pg.wait_for_timeout(120)
        for tb in ('races', 'strategy', 'history', 'intel', 'map'):
            el = pg.locator(f'.tab[data-tab="{tb}"]:visible')
            if el.count():
                el.first.click(timeout=3000); pg.wait_for_timeout(150); check(pg, f'{label} order {oi + 1} {tb}', errs)
                # nothing runs off the right edge, on every tab (1 Nov 2026: the Plan tab was cut on phones)
                over = pg.evaluate(f"""() => [...document.querySelectorAll('#view *')].filter(e => {{ const r = e.getBoundingClientRect(); return r.width > 0 && r.right > {width} + 1 && !e.closest('svg, .pc-wrap, .war-map'); }}).slice(0, 2).map(e => e.tagName + '.' + String(e.className).split(' ')[0])""")
                if over: errs.append(f'{tb} tab: wider than the screen ({", ".join(over)})')
        pg.evaluate("document.querySelectorAll('.share-menu').forEach(d => { d.open = true; })")   # the image sits in the Share menu
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
    # Forecast evidence: native keyboard disclosure, persistent state and mobile containment.
    for w in (320, 390, 1366):
        pg = br.new_page(viewport={'width': w, 'height': 900}, reduced_motion='reduce')
        pg.goto(f'{PAGE}?s=default&motion=reduced'); pg.wait_for_timeout(1800)
        summary = pg.locator('.forecast-evidence > summary').first
        if not summary.count():
            problems.append(f'evidence @{w}: missing indicator')
        else:
            key = summary.get_attribute('id')
            summary.focus(); summary.press('Enter'); pg.wait_for_timeout(100)
            box = pg.locator(f'#{key}').locator('..')
            if not box.get_attribute('open') == '': problems.append(f'evidence @{w}: keyboard did not open details')
            if not box.locator('.fe-body').is_visible(): problems.append(f'evidence @{w}: missing explanation')
            if 'chance of winning' not in box.inner_text(): problems.append(f'evidence @{w}: missing distinction from verdict')
            pg.locator('.tab[data-tab="history"]').first.click(); pg.wait_for_timeout(200)
            if pg.locator(f'#{key}').locator('..').get_attribute('open') is None: problems.append(f'evidence @{w}: lost open state after rerender')
            if pg.evaluate('document.documentElement.scrollWidth > window.innerWidth'): problems.append(f'evidence @{w}: horizontal overflow')
            pg.locator('.call').first.screenshot(path=os.path.join(ROOT, 'build', f'evidence-{w}.png'))
            pg.locator(f'#{key}').focus(); pg.locator(f'#{key}').press('Space'); pg.wait_for_timeout(100)
            if pg.locator(f'#{key}').locator('..').get_attribute('open') is not None: problems.append(f'evidence @{w}: keyboard did not close details')
        pg.close()
    if problems:
        print('FORECAST EVIDENCE REGRESSION FAILED\n' + '\n'.join(problems)); br.close(); sys.exit(1)
    for w in (390, 1366):
        pg = br.new_page(viewport={'width': w, 'height': 900}, reduced_motion='reduce')
        pg.goto(f'{PAGE}?s=intel&corrections=1&motion=reduced'); pg.wait_for_timeout(1800)
        pg.locator('.tab[data-tab="intel"]').first.click(); pg.wait_for_timeout(250)
        seaf = pg.locator('.it-card.is-seaf').first
        if not seaf.count() or 'allied' not in seaf.inner_text().lower(): problems.append(f'corrections @{w}: missing allied SEAF')
        if not pg.locator('.it-card h5').filter(has_text='Caustic Strain').count(): problems.append(f'corrections @{w}: missing named Caustic Strain')
        extraction = pg.locator('.it-card').filter(has=pg.locator('h5').filter(has_text='extraction wait +20 seconds')).first
        if not extraction.count(): problems.append(f'corrections @{w}: missing extraction amount')
        else:
            extraction.locator('summary').click()
            if 'Adds 20 seconds' not in extraction.inner_text(): problems.append(f'corrections @{w}: missing extraction explanation')
        if pg.locator('.call-new').count(): problems.append(f'corrections @{w}: obsolete New call banner')
        if w == 1366:
            gap = pg.locator('.it-event-group.cat-news').evaluate("e => e.previousElementSibling ? e.getBoundingClientRect().top - e.previousElementSibling.getBoundingClientRect().bottom : 0")
            if gap > 32: problems.append(f'corrections: empty gap before dispatches: {gap}')
        pg.locator('.intel-tab').screenshot(path=os.path.join(ROOT, 'build', f'evidence-log-{w}.png'))
        pg.close()
    # Dense log: clusters are separate hit targets, and selection stays visible after scrolling.
    for w in (320, 390, 1366):
        pg = br.new_page(viewport={'width': w, 'height': 900}, reduced_motion='reduce')
        pg.goto(f'{PAGE}?s=intel&dense=1&motion=reduced'); pg.wait_for_timeout(1800)
        pg.locator('.tab[data-tab="intel"]').click(); pg.wait_for_timeout(300)
        dense_key = pg.locator('[data-igroup]').evaluate_all("els => els.find(e => e.dataset.igroup.split(',').length >= 24)?.dataset.igroup || null")
        cluster = pg.locator(f'[data-igroup="{dense_key}"]') if dense_key else None
        if cluster is None: problems.append(f'dense log @{w}: missing grouped events')
        else:
            cluster.first.click(); pg.wait_for_timeout(100)
            selected = pg.locator('.it-card.is-selected')
            if selected.count() != len(dense_key.split(',')): problems.append(f'dense log @{w}: selection lost entries')
            if not pg.locator('.it-card.is-selected .it-selected-label').first.is_visible(): problems.append(f'dense log @{w}: no persistent selection label')
            if pg.evaluate('document.activeElement.dataset.ikey') is None: problems.append(f'dense log @{w}: focus did not reach the selected entry')
            pg.locator('.tab[data-tab="races"]').click()
            pg.locator('.tab[data-tab="intel"]').click()
            if pg.locator('.it-card.is-selected').count() != len(dense_key.split(',')): problems.append(f'dense log @{w}: selection lost after rerender')
            pg.locator('[data-iclear]').click()
            if pg.locator('.it-card.is-selected').count(): problems.append(f'dense log @{w}: selection did not clear')
        pg.locator('[data-intelfilter="resistance"]').click()
        if pg.locator('.it-card:not(.cat-resistance)').count(): problems.append(f'dense log @{w}: type filter mixes categories')
        bounds = pg.locator('[data-igroup]').evaluate_all("els => els.map(e => { const r=e.getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom}; })")
        for i,a in enumerate(bounds):
            if any(a['l'] < b['r']-1 and b['l'] < a['r']-1 and a['t'] < b['b']-1 and b['t'] < a['b']-1 for b in bounds[i+1:]): problems.append(f'dense log @{w}: cluster targets overlap')
        pg.close()
    if problems:
        for problem in problems: print('PROBLEM', problem)
        sys.exit(1)
    for s in SCENARIOS: run(br, s, 1366)
    for s in ('default', 'none', 'sniper'): run(br, s, 390)
    for s in ('default', 'intel'): run(br, s, 320)   # the narrowest phones still in use
    for seed in range(1, FUZZ + 1): run(br, f'fuzz&seed={seed}', 1366 if seed % 2 else 390)
    # GitHub raw down: the recorder's files come from jsDelivr instead (audit ARCH-05)
    pg = br.new_page(); pg.goto(f'{PAGE}?s=default&raw=down'); pg.wait_for_timeout(2500)
    via = pg.evaluate("window.__mockLog.filter(x => x.rec === 'intel.json').map(x => x.via)")
    if 'cdn.jsdelivr.net' not in via: problems.append('raw down: the recorder data did not come from the fallback')
    if not pg.locator('.mworth').count(): problems.append('raw down: the page lost the recorder data')
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
