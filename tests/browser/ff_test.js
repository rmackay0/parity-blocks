// Fast forward ▸▸ (2026-11-17; was skip_test): on each tutorial slide that
// plays an animation, a round ▸▸ button sits just right of it while it
// plays; pressing it plays the rest faster (not a jump to the end): the
// slide still finishes properly, ▸▸ goes away, Next is ready.
// Laptop and phone. Run: node ff_test.js
const { chromium } = require('playwright');
const { BASE, check, finish } = require('./lib');

(async () => {
  const browser = await chromium.launch(); const errors = [];
  for (const [w, h, device, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${device}: ${e.message}`));
    const shown = () => page.isVisible('#ff-btn');
    const nextReady = () => page.evaluate(() => document.getElementById('next-btn').classList.contains('ready'));
    // Is ▸▸ right of (or tucked into the corner of) the given element?
    const beside = sel => page.evaluate(sel => {
      const b = document.getElementById('ff-btn').getBoundingClientRect(), r = document.querySelector(sel).getBoundingClientRect();
      const midY = b.top + b.height / 2;
      // (right of it, or astride its bottom edge at the right when there's no room)
      return (b.left >= r.right - b.width - 14) && midY >= r.top - 4 && midY <= r.bottom + b.height;
    }, sel);
    // Press ▸▸ and wait for it to go (the animation over); seconds taken
    const fastForward = async () => {
      const t0 = Date.now();
      await page.click('#ff-btn');
      await page.waitForFunction(() => document.getElementById('ff-btn').hidden, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(300);
      return (Date.now() - t0) / 1000;
    };

    // Slide 1: the Tiling drags (≈7 s at normal speed)
    await page.goto(BASE + 'tutorial.html?slide=1'); await page.waitForTimeout(400);
    check(`${device} slide 1: no ▸▸ before anything plays`, await shown(), false);
    await page.click('#goal1 .showme'); await page.waitForTimeout(1000);
    check(`${device} slide 1: ▸▸ shows beside the pieces while they move`, [await shown(), await beside('#goal-board')], [true, true]);
    const s1 = await fastForward();
    check(`${device} slide 1: fast forward plays the rest quickly (< 2.5 s)`, s1 < 2.5, true);
    check(`${device} slide 1: then all six pieces on the grid, no copies left, ▸▸ gone`,
      [await page.evaluate(() => document.querySelectorAll('#goal-board .mb-piece.ia-on').length), await page.evaluate(() => document.querySelectorAll('.drag-ghost').length), await shown()], [6, 0, false]);
    check(`${device} slide 1: no pointer on the moving pieces`, await page.evaluate(() => !document.querySelector('.drag-pointer')), true);
    await page.click('#goal2 .showme'); await page.waitForTimeout(800);
    await fastForward();
    check(`${device} slide 1: both goals played: Next ready`, await nextReady(), true);

    // (2026-11-18, user: ▸▸ only on animations over 5 s that people wait
    // through, not ones they learn from)
    // Slide 2: the words animation is read, not waited through: no ▸▸
    await page.goto(BASE + 'tutorial.html?slide=2'); await page.waitForTimeout(500);   // (no welcome popup since 2026-11-18)
    let seen2 = false;
    for (let k = 0; k < 8; k++) { await page.waitForTimeout(500); seen2 = seen2 || await shown(); }
    check(`${device} slide 2: no ▸▸ while the words play`, seen2, false);

    // Slide 3: the wrong grid's count (stops at its first odd line): no ▸▸;
    // then the right grid's full count: ▸▸ beside the grids
    await page.goto(BASE + 'tutorial.html?slide=3'); await page.waitForTimeout(500);
    await page.evaluate(() => PICK_BOARDS.find(b => !b.right).btn.click()); await page.waitForTimeout(600);
    check(`${device} slide 3: no ▸▸ while the wrong grid is counted`, await shown(), false);
    await page.waitForFunction(() => !document.getElementById('ff-btn').hidden, null, { timeout: 15000 }).catch(() => {});
    check(`${device} slide 3: ▸▸ beside the grids while the right one is counted`, [await shown(), await beside('#pick-boards > :last-child')], [true, true]);
    const s3 = await fastForward();
    check(`${device} slide 3: fast forward is quick (< 3 s)`, s3 < 3, true);
    check(`${device} slide 3: then Next ready, ▸▸ gone`, [await nextReady(), await shown()], [true, false]);

    // Slide 7 (2026-11-18): "Show me" plays the 17 ways (≈ 9 s): ▸▸ just
    // right of the count; the popup demos after it go with words: no ▸▸
    await page.goto(BASE + 'tutorial.html?slide=6'); await page.waitForTimeout(500);   // (8 slides since 2026-11-18)
    await page.click('#spot-ok'); await page.waitForTimeout(1800);
    check(`${device} slide 6: no ▸▸ before Show me`, await shown(), false);
    await page.click('#ways-btn'); await page.waitForTimeout(800);
    check(`${device} slide 6: ▸▸ beside the count while the ways play`, [await shown(), await beside('#demo-count')], [true, true]);
    const s7 = await fastForward();
    check(`${device} slide 6: fast forward is quick (< 3 s), then Continue`,
      [s7 < 3, await page.evaluate(() => /Continue/.test(document.getElementById('ways-btn').textContent))], [true, true]);
    await page.click('#ways-btn');
    let seen7 = false;
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 4; j++) { await page.waitForTimeout(400); seen7 = seen7 || await shown(); }
      if (await page.isVisible('#spot-ok')) await page.click('#spot-ok');
    }
    check(`${device} slide 6: no ▸▸ during the popup demos`, seen7, false);

    // (the "don't place a piece over" slide was removed 2026-11-18)
    await ctx.close();
  }
  await browser.close();
  finish(errors);
})();
