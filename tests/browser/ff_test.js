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
    check(`${device} slide 1: fast forward plays the rest quickly (< 3.5 s)`, s1 < 3.5, true);
    check(`${device} slide 1: then all six pieces on the grid, no copies left, ▸▸ gone`,
      [await page.evaluate(() => document.querySelectorAll('#goal-board .mb-piece.ia-on').length), await page.evaluate(() => document.querySelectorAll('.drag-ghost').length), await shown()], [6, 0, false]);
    check(`${device} slide 1: no pointer on the moving pieces`, await page.evaluate(() => !document.querySelector('.drag-pointer')), true);
    await page.click('#goal2 .showme'); await page.waitForTimeout(800);
    await fastForward();
    check(`${device} slide 1: both goals played: Next ready`, await nextReady(), true);

    // Slide 2: the words animation (≈25 s at normal speed)
    await page.goto(BASE + 'tutorial.html?slide=2'); await page.waitForTimeout(500);
    await page.click('#spot-ok'); await page.waitForTimeout(1200);
    check(`${device} slide 2: ▸▸ beside the picture while it plays`, [await shown(), await beside('#words-pic')], [true, true]);
    const s2 = await fastForward();
    check(`${device} slide 2: fast forward plays it quickly (< 10 s)`, s2 < 10, true);
    check(`${device} slide 2: then six empty squares numbered, Next ready, ▸▸ gone`,
      [await page.evaluate(() => document.querySelectorAll('#words-pic .term-num:not(.on-piece).ia-on').length), await nextReady(), await shown()], [6, true, false]);

    // Slide 3: picking the right grid starts its count
    await page.goto(BASE + 'tutorial.html?slide=3'); await page.waitForTimeout(500);
    await page.evaluate(() => PICK_BOARDS.find(b => b.right).btn.click()); await page.waitForTimeout(600);
    check(`${device} slide 3: ▸▸ shows while the grid is counted`, await shown(), true);
    await fastForward();
    check(`${device} slide 3: then Next ready, ▸▸ gone`, [await nextReady(), await shown()], [true, false]);

    // Slide 9 ("don't place a piece over"): its pictures play by themselves
    await page.goto(BASE + 'tutorial.html?slide=9'); await page.waitForTimeout(800);
    if (await shown()) {
      await fastForward();
      check(`${device} slide 9: then Next ready, ▸▸ gone`, [await nextReady(), await shown()], [true, false]);
    }
    await ctx.close();
  }
  await browser.close();
  finish(errors);
})();
