#!/usr/bin/env python3
"""Opens the test page (build/test.html, mock API) in every scenario and in random-data runs, clicks through
each order's tabs, the share image and the archive, and fails on page errors or broken text: NaN, undefined,
Infinity, raw placeholders, absurd percentages, "1 times"... Usage: python3 tests/page_test.py [fuzz runs]"""
import os, re, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'file://' + os.path.join(ROOT, 'build', 'test.html')
BAD = re.compile(r'\bNaN\b|\bundefined\b|Infinity|\[object |\bnull\b|\{[a-z]+\}|\b\d{1,3}(,\d{3})+%|\b\d{4,}%|\b1 (times|planets|missions|attacks|objectives|operations|extractions)\b|about 0 needed|\b0 Helldivers needed|#\d{6,}')
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
    pg.goto(f'{PAGE}?s={query}'); pg.wait_for_timeout(1600)
    label = f'{query} @{width}'
    check(pg, label + ' home', errs)
    tabs = pg.locator('[data-otab]:visible')
    for oi in range(max(1, tabs.count())):
        if tabs.count(): tabs.nth(oi).click(timeout=3000); pg.wait_for_timeout(120)
        for tb in ('objectives', 'strategy', 'history', 'intel'):
            el = pg.locator(f'.tab[data-tab="{tb}"]:visible')
            if el.count(): el.first.click(timeout=3000); pg.wait_for_timeout(150); check(pg, f'{label} order {oi + 1} {tb}', errs)
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
    missing = pg.evaluate('window.__missingT ? [...window.__missingT] : []')
    if missing: errs.append('texts missing from the dictionary: ' + ', '.join(sorted(missing)[:10]))
    problems.extend(f'{label}: {e}' for e in sorted(set(errs)))
    pg.close()

with sync_playwright() as p:
    br = p.chromium.launch()
    for s in SCENARIOS: run(br, s, 1366)
    for s in ('default', 'none', 'sniper'): run(br, s, 390)
    for seed in range(1, FUZZ + 1): run(br, f'fuzz&seed={seed}', 1366 if seed % 2 else 390)
    br.close()
for x in problems[:60]: print('PROBLEM', x)
print(f'{len(SCENARIOS) + 3 + FUZZ} pages, {len(problems)} problems')
sys.exit(1 if problems else 0)
