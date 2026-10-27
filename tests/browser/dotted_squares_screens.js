// Screenshots of the dotted squares (2026-10-27): each published puzzle,
// the rules popup, and tutorial slides 3 and 5, on a laptop and a phone.
// Run with:  node dotted_squares_screens.js   (pictures saved in this folder)
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';

(async ()=>{
  const browser = await chromium.launch(), errors = [];
  for(const [w, h, label, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]]){
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:touch, isMobile:touch });
    await ctx.addInitScript(()=>{ localStorage.setItem('pb_tutorialSeen', '1'); localStorage.setItem('pb_rulesSeen', '1'); });
    const page = await ctx.newPage();
    page.on('pageerror', e=>errors.push(label + ': ' + e.message));

    for(const level of ['easy', 'medium', 'hard']){
      await page.goto(BASE + 'play.html?level=' + level); await page.waitForTimeout(400);
      const n = await page.evaluate(()=>({ dotted: puzzle.blocked.length, lines: document.querySelectorAll('#hint-overlay svg').length }));
      console.log(`${label} ${level}: ${n.dotted} dotted squares, ${n.lines} dotted lines drawn`);
      await page.screenshot({ path:`dotted-${label}-${level}.png` });
    }

    await page.goto(BASE + 'index.html'); await page.waitForTimeout(300);
    await page.click('[data-open-rules]'); await page.waitForTimeout(300);
    await page.evaluate(()=>{ const p = document.querySelector('.rules-popup'); p.scrollTop = p.scrollHeight; });
    await page.waitForTimeout(200);
    await page.screenshot({ path:`dotted-${label}-rules.png` });

    // Tutorial: slide 3 once its pictures have played, and the last slide
    await page.goto(BASE + 'tutorial.html'); await page.waitForTimeout(300);
    console.log(`${label} tutorial slides: ${await page.locator('.dot').count()}`);
    await page.evaluate(()=>showSlide(2)); await page.waitForTimeout(9800);
    await page.screenshot({ path:`dotted-${label}-tut3.png` });
    await page.evaluate(()=>showSlide(3)); await page.waitForTimeout(600);
    console.log(`${label} slide 4: ${await page.evaluate(()=>puzzle.blocked.length)} dotted squares, ${await page.locator('#hint-overlay svg').count()} dotted lines (incl. the dotted area)`);
    await page.screenshot({ path:`dotted-${label}-tut4.png` });
    await page.evaluate(()=>showSlide(4)); await page.waitForTimeout(3000);
    console.log(`${label} slide 5: ${await page.evaluate(()=>puzzle.blocked.length)} dotted squares`);
    await page.screenshot({ path:`dotted-${label}-tut5.png` });
    await page.click('#hint-btn', { force: true }).catch(()=>{});
    await page.evaluate(()=>showHint()); await page.waitForTimeout(500);
    await page.screenshot({ path:`dotted-${label}-tut5-hint.png` });
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
