// The quick check (2026-11-16): about 30 seconds. Opens every page and every
// tutorial slide on a laptop and a phone, looks for JavaScript errors, and
// solves each published level. Run it after any change (tests/run.js runs it
// first); the slower tests check the details.
// Run: node smoke_test.js
const { chromium } = require('playwright');
const { BASE, PUB, solution, check, finish } = require('./lib');

(async () => {
  const errors = [];
  const answers = {};
  for (const level of ['easy', 'medium', 'hard']) answers[level] = solution(level);
  const browser = await chromium.launch();

  for (const [w, h, device, touch] of [[1280, 800, 'laptop', false], [390, 664, 'phone', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => localStorage.setItem('pb_tutorialSeen', '1'));
    const page = await ctx.newPage();
    let where = '';
    page.on('pageerror', e => errors.push(`${device} ${where}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${device} ${where}: console: ${m.text()}`); });
    const go = async (url, wait = 300) => { where = url; await page.goto(BASE + url); await page.waitForTimeout(wait); };
    const sideways = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

    // Start screen: three level buttons, Rules opens
    await go('index.html');
    check(`${device} start screen: level buttons`, await page.locator('[data-difficulty]:visible').count(), 3);
    check(`${device} start screen: no sideways scrolling`, await sideways(), false);
    await page.click('.rules-top'); await page.waitForTimeout(200);
    check(`${device} Rules opens`, await page.isVisible('.rules-popup'), true);

    // Each published level opens, and its answer solves it
    for (const level of ['easy', 'medium', 'hard']) {
      await go('play.html?level=' + level);
      check(`${device} ${level}: board drawn`, await page.locator('.board-cell').count() > 0, true);
      check(`${device} ${level}: no sideways scrolling`, await sideways(), false);
      await page.evaluate(ps => {
        placedPieces = placedPieces.filter(p => p.locked).concat(ps.map((p, i) => ({ id: 's' + i, color: puzzle.pieces.find(d => d.name === p.name).color, ...p })));
        renderAll();
      }, answers[level]);
      await page.waitForTimeout(300);
      check(`${device} ${level}: answer → Solved popup`, await page.isVisible('#solved-popup'), true);
    }

    // Every tutorial slide opens without errors
    await go('tutorial.html');
    const slides = await page.evaluate(() => SLIDES.length);
    const opened = [];
    for (let n = 1; n <= slides; n++) {
      await go('tutorial.html?slide=' + n, 400);
      opened.push(await page.evaluate(() => current + 1));
    }
    check(`${device} tutorial: each ?slide=N opens slide N`, opened, [...Array(slides)].map((_, i) => i + 1));

    // The admin pages load (laptop only: they're not for phones; playtest.html
    // needs a web server, so cloud_test.js covers it)
    if (device === 'laptop') {
      for (const url of ['sandbox.html', 'analyzer.html']) {
        await go(url);
        check(`${device} ${url} loads`, await page.evaluate(() => document.body.children.length > 0), true);
      }
    }
    await ctx.close();
  }
  await browser.close();
  finish(errors);
})();
