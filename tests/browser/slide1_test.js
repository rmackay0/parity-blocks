// Slide 1 must never trap anyone (2026-11-17: a tester on an iPhone could
// not get past it: a goal only counted once its animation had finished, and
// on phones opening one goal closes the other and stops it). Tries the ways
// people really tap, in WebKit (Safari) and Chromium, phone and laptop:
// Next must light up once both goals have been opened, however fast.
// Run: node slide1_test.js
const { chromium, webkit } = require('playwright');
const { BASE, check, finish } = require('./lib');

(async () => {
  const errors = [];
  for (const [engineName, engine] of [['webkit', webkit], ['chromium', chromium]]) {
    const browser = await engine.launch();
    for (const [w, h, device, touch] of [[390, 664, 'phone', true], [375, 553, 'iPhone SE', true], [1280, 800, 'laptop', false]]) {
      const label = `${engineName} ${device}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
      const tap = sel => touch ? page.tap(sel) : page.click(sel);
      const ready = () => page.evaluate(() => document.getElementById('next-btn').classList.contains('ready'));
      const fresh = async () => { await page.goto(BASE + 'tutorial.html?slide=1'); await page.waitForTimeout(400); };

      // 1. Both opened at once, one straight after the other
      await fresh();
      await tap('#goal1 .showme'); await page.waitForTimeout(150); await tap('#goal2 .showme'); await page.waitForTimeout(400);
      check(`${label}: both opened quickly → Next ready`, await ready(), true);
      // 2. Back and forth before anything finishes
      await fresh();
      for (const g of [2, 1, 2, 1]) { await tap(`#goal${g} .showme`); await page.waitForTimeout(500); }
      check(`${label}: back and forth → Next ready`, await ready(), true);
      // 3. Open one, close it, open the other
      await fresh();
      await tap('#goal1 .showme'); await page.waitForTimeout(300); await tap('#goal1 .showme'); await page.waitForTimeout(300);
      await tap('#goal2 .showme'); await page.waitForTimeout(400);
      check(`${label}: open, hide, open the other → Next ready`, await ready(), true);
      // 4. Only one opened: not yet (they still have to look at both)
      await fresh();
      await tap('#goal1 .showme'); await page.waitForTimeout(400);
      check(`${label}: only one opened → Next not ready yet`, await ready(), false);
      // 5. Reload in the middle, then open both
      await page.reload(); await page.waitForTimeout(600);
      if (await page.evaluate(() => current) === 0) {
        await tap('#goal1 .showme'); await page.waitForTimeout(200); await tap('#goal2 .showme'); await page.waitForTimeout(400);
      }
      check(`${label}: after a reload → Next ready`, await ready(), true);
      // and Next really goes on to slide 2
      await tap('#next-btn'); await page.waitForTimeout(500);
      check(`${label}: Next goes to slide 2`, await page.evaluate(() => current), 1);
      await ctx.close();
    }
    await browser.close();
  }
  finish(errors);
})();
