// Tutorial slide 6's hint (user, 2026-11-05): "In this particular puzzle
// there needs to be either 2 or 0 empty spaces…" pops into the note after
// a minute and a half, unless the last empty space (row 3, column 4) has
// been highlighted. Uses Playwright's fake clock to skip the wait.
// Laptop + phone.   Run:  node hl_hint_test.js   (pictures: hl-hint-*.png)
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
let failures = 0;
const check = (ok, msg)=>{ console.log((ok ? '  ok   ' : '  FAIL ') + msg); if(!ok) failures++; };

(async ()=>{
  const browser = await chromium.launch();
  for(const [w, h, dev] of [[1280, 860, 'laptop'], [390, 800, 'phone']])
  for(const found of [false, true]){
    const label = `${dev}, ${found ? 'square found' : 'not found'}`;
    console.log(label);
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, isMobile: dev === 'phone', hasTouch: dev === 'phone' });
    await ctx.addInitScript(()=>sessionStorage.setItem('pb_tutorialSlide', '5'));   // (slide 6)
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await page.clock.install();
    await page.goto(BASE + 'tutorial.html');
    await page.clock.runFor(3000);                     // (past the dark)
    const text = await page.innerText('#n-boardr');     // (only the text you can see)
    check(!/there needs? to be/.test(text), 'at first the note has no hint sentence');
    check(await page.isHidden('#hl-hint'), 'hint hidden');
    if(found) await page.evaluate(()=>{ const m = getMarks(); m['2,3'] = 2; setMarks(m); });
    await page.clock.runFor(80000);
    check(await page.isHidden('#hl-hint'), 'still hidden after 83 s');
    await page.clock.runFor(10000);
    if(found) check(await page.isHidden('#hl-hint'), 'square was found: no hint at 93 s');
    else {
      check(await page.isVisible('#hl-hint'), 'not found: the hint is there at 93 s');
      const hint = await page.textContent('#hl-hint');
      check(hint.includes('there needs to be either 2 or 0 empty spaces'), 'wording: "' + hint.trim() + '"');
      const inView = await page.evaluate(()=>{ const r = document.getElementById('hl-hint').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
      check(inView, 'hint on screen');
      const clear = await page.evaluate(()=>{ const t = document.getElementById('hl-tool').getBoundingClientRect(), c = document.querySelector('#n-boardr .empty-card').getBoundingClientRect();
        return t.bottom <= c.top || c.bottom <= t.top || t.right <= c.left || c.right <= t.left; });
      check(clear, 'highlighter clear of the note');
      await page.screenshot({ path: `hl-hint-${dev}.png` });
    }
    check(!errors.length, 'no page errors ' + errors.join('; '));
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
