// Skip ▸▸ (2026-11-17): on each tutorial slide that plays an animation,
// Skip shows while it plays and jumps straight to the end: the slide looks
// finished, Skip goes away, and Next is ready where watching was all it took.
// Laptop and phone. Run: node skip_test.js
const { chromium } = require('playwright');
const { BASE, check, finish } = require('./lib');

(async () => {
  const browser = await chromium.launch(); const errors = [];
  for (const [w, h, device, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${device}: ${e.message}`));
    const skipShown = () => page.isVisible('#skip-btn');
    const nextReady = () => page.evaluate(() => document.getElementById('next-btn').classList.contains('ready'));
    const skip = async () => { await page.click('#skip-btn'); await page.waitForTimeout(400); };

    // Slide 1: each goal's pictures play; Skip finishes each
    await page.goto(BASE + 'tutorial.html?slide=1'); await page.waitForTimeout(400);
    check(`${device} slide 1: no Skip before anything plays`, await skipShown(), false);
    await page.click('#goal1 .showme'); await page.waitForTimeout(1200);
    check(`${device} slide 1: Skip shows while the pieces are dragged`, await skipShown(), true);
    await skip();
    check(`${device} slide 1: after Skip, all six pieces on the grid, no copies left`,
      await page.evaluate(() => [document.querySelectorAll('#goal-board .mb-piece.ia-on').length, document.querySelectorAll('.drag-ghost').length]), [6, 0]);
    check(`${device} slide 1: Skip gone`, await skipShown(), false);
    await page.click('#goal2 .showme'); await page.waitForTimeout(800);
    await skip();
    check(`${device} slide 1: both goals skipped through: Next ready`, await nextReady(), true);

    // Slide 2: the words animation (after the welcome popup's Continue)
    await page.goto(BASE + 'tutorial.html?slide=2'); await page.waitForTimeout(500);
    await page.click('#spot-ok'); await page.waitForTimeout(1200);
    check(`${device} slide 2: Skip shows while it plays`, await skipShown(), true);
    await skip();
    check(`${device} slide 2: after Skip: six empty squares numbered, Next ready, Skip gone`,
      [await page.evaluate(() => document.querySelectorAll('#words-pic .term-num:not(.on-piece).ia-on').length), await nextReady(), await skipShown()], [6, true, false]);

    // Slide 3: picking the right grid starts its count
    await page.goto(BASE + 'tutorial.html?slide=3'); await page.waitForTimeout(500);
    await page.evaluate(() => PICK_BOARDS.find(b => b.right).btn.click()); await page.waitForTimeout(600);
    check(`${device} slide 3: Skip shows while the grid is counted`, await skipShown(), true);
    await skip();
    check(`${device} slide 3: after Skip: Next ready, Skip gone`, [await nextReady(), await skipShown()], [true, false]);

    // Slide 9 ("don't place a piece over"): its pictures play by themselves
    await page.goto(BASE + 'tutorial.html?slide=9'); await page.waitForTimeout(800);
    if (await skipShown()) {
      await skip();
      check(`${device} slide 9: after Skip: Next ready, Skip gone`, [await nextReady(), await skipShown()], [true, false]);
    }
    await ctx.close();
  }
  await browser.close();
  finish(errors);
})();
