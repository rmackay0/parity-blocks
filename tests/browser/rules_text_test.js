// Checks the rules popup (and its Large text button) on laptop and phone.  Run: node rules_text_test.js
const { chromium } = require('playwright');
const { BASE, check, finish } = require('./lib');

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h, label, touch] of [[1280, 860, 'laptop', false], [390, 800, 'phone', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(label + ': ' + e.message));
    const btnInfo = () => page.evaluate(() => {
      const b = document.querySelector('.rules-popup .text-size-btn');
      const p = document.querySelector('.rules-item p');
      const r = b.getBoundingClientRect(), pop = document.querySelector('.rules-popup').getBoundingClientRect();
      return { label: b.textContent, weight: getComputedStyle(b).fontWeight,
               textSize: getComputedStyle(p).fontSize, topLeft: r.left - pop.left < 30 && r.top - pop.top < 30 };
    });

    // 1. Splash screen → Rules
    await page.goto(BASE + 'index.html');
    await page.evaluate(() => document.fonts.ready);
    await page.click('.rules-top');
    await page.waitForTimeout(200);
    const before = await btnInfo();
    check(`[${label}] rules opens with button`, before.label, 'Large text');
    await page.screenshot({ path: `rules-${label}-standard.png` });
    await page.click('.rules-popup .text-size-btn');
    const after = await btnInfo();
    check(`[${label}] after clicking it: button says, text bigger`, [after.label, parseFloat(after.textSize) > parseFloat(before.textSize)], ['Standard text', true]);
    await page.screenshot({ path: `rules-${label}-large.png` });
    await page.evaluate(() => { const p = document.querySelector('.rules-popup'); p.scrollTop = p.scrollHeight; });
    await page.screenshot({ path: `rules-${label}-large-bottom.png` });
    await page.click('.rules-ok');

    // 2. The setting carries over to the tutorial
    await page.goto(BASE + 'tutorial.html');
    await page.waitForTimeout(300);
    check(`[${label}] tutorial picks it up (button, large)`, [await page.textContent('#text-size-btn'),
      await page.evaluate(() => document.documentElement.classList.contains('large-text'))], ['Standard text', true]);
    await page.click('#text-size-btn');      // switch back to standard in the tutorial
    check(`[${label}] tutorial button then says`, await page.textContent('#text-size-btn'), 'Large text');

    // 3. Puzzle page rules popup reflects the tutorial's change, and still offers the tutorial
    await page.evaluate(() => localStorage.setItem('pb_tutorialSeen', '1'));
    await page.goto(BASE + 'play.html?level=easy');
    await page.waitForTimeout(300);
    await page.click('[data-open-rules]');
    await page.waitForTimeout(200);
    const onPlay = await btnInfo();
    check(`[${label}] puzzle page rules: standard again, has "Play the tutorial"`, [onPlay.label, onPlay.textSize === before.textSize,
      await page.isVisible('.rules-tutorial')], ['Large text', true, true]);
    // Close with ✕ and Esc
    await page.click('.rules-close');
    check(`[${label}] ✕ closes it`, await page.isHidden('.rules-backdrop'), true);
    await page.click('[data-open-rules]'); await page.keyboard.press('Escape');
    check(`[${label}] Esc closes it`, await page.isHidden('.rules-backdrop'), true);
    // The game still works afterwards (clicking a piece at the top rotates it)
    const name0 = await page.evaluate(() => puzzle.pieces[0].name), cells0 = await page.evaluate(n => JSON.stringify(trayCells[n]), name0);
    await page.click(`.tray-slot[data-name="${name0}"]`); await page.waitForTimeout(400);
    check(`[${label}] game still responds after closing rules`, cells0 !== await page.evaluate(n => JSON.stringify(trayCells[n]), name0), true);
    await ctx.close();
  }
  await browser.close();
  finish(errors);
})();
