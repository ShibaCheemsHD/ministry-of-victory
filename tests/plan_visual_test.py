"""Focused Full Plan interaction and responsive layout checks; screenshots for visual review."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    br = p.chromium.launch()
    for sc, width in [('default',1366),('sniper',1366),('sniper',390),('regions',320),('done',390),('impossible',1366)]:
        pg = br.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
        errors=[]
        pg.on('pageerror',lambda e: errors.append(str(e)))
        pg.goto((ROOT/'build/test.html').as_uri()+f'?s={sc}&motion=reduced')
        pg.wait_for_timeout(1800)
        images = pg.locator('img.game-icon')
        assert images.count(), f'No game artwork: {sc}'
        assert images.evaluate_all('els => els.every(e => e.complete && e.naturalWidth > 0)'), f'Broken artwork: {sc}'
        pg.locator('.call').first.screenshot(path=str(ROOT/'build'/f'plan-game-icons-{sc}-{width}.png'))
        pg.locator('.tab[data-tab="strategy"]').first.click()
        pg.wait_for_timeout(200)
        plan=pg.locator('.plan').first
        assert plan.count(), f'No plan: {sc}'
        if pg.locator('.move-featured').count():
            assert pg.locator('.move-featured').count()==1
            assert pg.locator('.move-featured .mv-explain').get_attribute('open') is not None
            summary=pg.locator('.move-featured .mv-explain > summary')
            summary.focus();summary.press('Enter');pg.wait_for_timeout(50)
            assert pg.locator('.move-featured .mv-explain').get_attribute('open') is None
            pg.locator('[data-toggle-nums]').click()
            assert 'show-nums' in plan.get_attribute('class')
            assert 'about Helldivers' not in plan.inner_text(), 'Missing player quantity'
            pg.locator('.tab[data-tab="races"]').first.click()
            pg.locator('.tab[data-tab="strategy"]').first.click()
            assert pg.locator('.move-featured .mv-explain').get_attribute('open') is None, 'Disclosure reset'
            pg.locator('.move-featured .mv-explain > summary').click()
        assert not pg.evaluate('document.documentElement.scrollWidth > innerWidth+1'), f'Overflow {sc}@{width}'
        assert not errors, errors
        plan.screenshot(path=str(ROOT/'build'/f'plan-{sc}-{width}.png'))
        print(f'Full Plan: {sc}@{width} OK',flush=True)
        pg.close()
    # Cold start paints coherent recorder data before the deliberately delayed live API responds.
    pg=br.new_page(viewport={'width':1366,'height':900},reduced_motion='reduce')
    pg.goto((ROOT/'build/test.html').as_uri()+'?s=sniper&boot=1&motion=reduced')
    pg.wait_for_selector('.call',timeout=2500)
    assert not pg.locator('#skeleton').count(), 'Skeleton retained after initial snapshot'
    assert pg.locator('.call .tgt').first.inner_text() != 'MAJOR ORDER', 'Incomplete first paint'
    assert 'TOO EARLY TO CALL' not in pg.locator('.call').first.inner_text(), 'History missing at first paint'
    assert pg.locator('.game-icon').count()
    pg.locator('.call').first.screenshot(path=str(ROOT/'build'/'plan-loading-first-paint.png'))
    pg.goto((ROOT/'build/test.html').as_uri()+'?s=sniper&boot=1&warm=1&motion=reduced')
    pg.wait_for_selector('.call',timeout=1500)
    assert pg.evaluate("!window.__mockLog.some(x => x.rec === 'bootstrap.json')"), 'Warm start fetched data before painting'
    pg.close()
    # Motion preference is respected even if the OS itself allows motion.
    pg=br.new_page(viewport={'width':1366,'height':900})
    pg.goto((ROOT/'build/test.html').as_uri()+'?s=sniper&motion=reduced');pg.wait_for_timeout(1800)
    pg.locator('.tab[data-tab="strategy"]').first.click()
    assert pg.locator('html.calm').count()
    if pg.locator('.move').count():
        assert pg.locator('.move').first.evaluate("e=>getComputedStyle(e).transitionDuration") in ['0s','0s, 0s, 0s']
    br.close()
