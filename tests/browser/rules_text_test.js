// Checks the rules popup (and its Large text button) on laptop and phone.  Run: node rules_text_test.js
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';

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
    console.log(`[${label}] rules opens with button:`, JSON.stringify(before));
    await page.screenshot({ path: `rules-${label}-standard.png` });
    await page.click('.rules-popup .text-size-btn');
    const after = await btnInfo();
    console.log(`[${label}] after clicking it:`, JSON.stringify(after));
    await page.screenshot({ path: `rules-${label}-large.png` });
    await page.evaluate(() => { const p = document.querySelector('.rules-popup'); p.scrollTop = p.scrollHeight; });
    await page.screenshot({ path: `rules-${label}-large-bottom.png` });
    await page.click('.rules-ok');

    // 2. The setting carries over to the tutorial
    await page.goto(BASE + 'tutorial.html');
    await page.waitForTimeout(300);
    console.log(`[${label}] tutorial picks it up: button says "${await page.textContent('#text-size-btn')}", large:`,
      await page.evaluate(() => document.documentElement.classList.contains('large-text')));
    await page.click('#text-size-btn');      // switch back to standard in the tutorial
    console.log(`[${label}] tutorial button now says "${await page.textContent('#text-size-btn')}"`);

    // 3. Puzzle page rules popup reflects the tutorial's change, and still offers the tutorial
    await page.evaluate(() => localStorage.setItem('pb_tutorialSeen', '1'));
    await page.goto(BASE + 'play.html?level=easy');
    await page.waitForTimeout(300);
    await page.click('[data-open-rules]');
    await page.waitForTimeout(200);
    const onPlay = await btnInfo();
    console.log(`[${label}] puzzle page rules:`, JSON.stringify(onPlay), '| has "Play the tutorial":', await page.isVisible('.rules-tutorial'));
    // Close with ✕, Esc and the backdrop
    await page.click('.rules-close');
    console.log(`[${label}] ✕ closes it:`, await page.isHidden('.rules-backdrop'));
    await page.click('[data-open-rules]'); await page.keyboard.press('Escape');
    console.log(`[${label}] Esc closes it:`, await page.isHidden('.rules-backdrop'));
    // The game still works afterwards (clicking a piece at the top rotates it)
    const name0 = await page.evaluate(() => puzzle.pieces[0].name), cells0 = await page.evaluate(n => JSON.stringify(trayCells[n]), name0);
    await page.click(`.tray-slot[data-name="${name0}"]`); await page.waitForTimeout(400);
    console.log(`[${label}] game still responds after closing rules:`, cells0 !== await page.evaluate(n => JSON.stringify(trayCells[n]), name0));
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? errors : 'no page errors');
})();
