// Tutorial slide 6's hint (2026-11-11): "Find a row with only one
// highlighted square…" pops into the note after a minute and a half, unless
// both missing empty spaces ((3,5) and (5,5)) have been highlighted. Phones
// (2026-11-06): it's a popup over the grid instead, with "Got it", then a
// Hint button that brings it back.
// Uses Playwright's fake clock to skip the wait.
// Laptop + phone.   Run:  node hl_hint_test.js   (pictures: hl-hint-*.png)
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
let failures = 0;
const check = (ok, msg)=>{ console.log((ok ? '  ok   ' : '  FAIL ') + msg); if(!ok) failures++; };

(async ()=>{
  const browser = await chromium.launch();
  for(const [w, h, dev] of [[1280, 860, 'laptop'], [390, 664, 'phone'], [375, 553, 'iPhone SE']])
  for(const found of [false, true]){
    const label = `${dev}, ${found ? 'square found' : 'not found'}`;
    console.log(label);
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, isMobile: dev !== 'laptop', hasTouch: dev !== 'laptop' });
    await ctx.addInitScript(()=>sessionStorage.setItem('pb_tutorialSlide', '5'));   // (slide 6)
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await page.clock.install();
    await page.goto(BASE + 'tutorial.html');
    await page.clock.runFor(5500);                     // (past the dark, 5 s)
    const text = await page.innerText('#n-boardr');     // (only the text you can see)
    check(!/only one highlighted/.test(text), 'at first the note has no hint sentence');
    check(await page.isHidden('#hl-hint'), 'hint hidden');
    if(found) await page.evaluate(()=>{ const m = getMarks(); m['3,5'] = 2; m['5,5'] = 2; setMarks(m); });
    await page.clock.runFor(80000);
    check(await page.isHidden('#hl-hint'), 'still hidden after 83 s');
    await page.clock.runFor(10000);
    const popupOpen = ()=>page.evaluate(()=>!document.getElementById('spot').hidden);
    if(found) check(await page.isHidden('#hl-hint') && !(await popupOpen()), 'square was found: no hint at 93 s');
    else if(dev !== 'laptop'){
      // Phones (user, 2026-11-06): a popup over the grid; "Got it" closes it
      // and leaves a Hint button that opens it again; the page never scrolls
      const scrollTop = ()=>page.evaluate(()=>document.querySelector('.tut-body').scrollTop);
      const before = await scrollTop();
      check(await popupOpen(), 'not found: the hint pops up at 93 s');
      const hint = await page.innerText('#spot-text');
      check(hint.includes('Find a row with only one highlighted square'), 'wording: "' + hint.trim() + '"');
      const over = await page.evaluate(()=>{ const c = document.getElementById('spot-card').getBoundingClientRect(), b = document.getElementById('board-outer').getBoundingClientRect();
        return c.top < b.bottom && c.bottom > b.top && c.top >= 0 && c.bottom <= innerHeight; });
      check(over, 'it sits over the grid, on screen');
      check(await page.isHidden('#hl-hint'), 'the note itself has no hint sentence');
      await page.screenshot({ path: `hl-hint-${dev}.png` });
      await page.tap('#spot-ok');
      await page.clock.runFor(500);
      check(!(await popupOpen()), 'Got it closes it');
      check(await page.isVisible('#hl-hint-btn'), 'a Hint button is there after');
      const btnClear = await page.evaluate(()=>{ const a = document.getElementById('hl-hint-btn').getBoundingClientRect(), t = document.getElementById('hl-tool').getBoundingClientRect(), b = document.getElementById('board-outer').getBoundingClientRect();
        const apart = (p, q)=>p.bottom <= q.top || q.bottom <= p.top || p.right <= q.left || q.right <= p.left;
        return apart(a, t) && apart(a, b) && [...document.querySelectorAll('.tray-slot .piece-box')].every(e=>apart(a, e.getBoundingClientRect())) && a.left >= 0; });
      check(btnClear, 'the Hint button is clear of the highlighter, the pieces and the grid');
      await page.screenshot({ path: `hl-hint-${dev}-button.png` });
      await page.tap('#hl-hint-btn');
      await page.clock.runFor(500);
      check(await popupOpen(), 'the Hint button opens it again');
      await page.tap('#spot-ok');
      await page.clock.runFor(500);
      check(await scrollTop() === before, `the page didn't scroll (${before} → ${await scrollTop()})`);
    }
    else {
      check(await page.isVisible('#hl-hint'), 'not found: the hint is there at 93 s');
      const hint = await page.textContent('#hl-hint');
      check(hint.includes('Find a row with only one highlighted square'), 'wording: "' + hint.trim() + '"');
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
