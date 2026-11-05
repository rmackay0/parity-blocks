// Dark mode everywhere (user, 2026-11-05): one switch applies to the start
// screen, the puzzle page, the rules popup and the tutorial, straight away,
// and the button is the same round moon / sun on every one of them; in the
// rules popup and the tutorial it's at the far top left, Large text to its
// right. Laptop + phone, Chromium + WebKit.
// Run:  node theme_sync_test.js    (pictures: sync-*.png)
const pw = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
let failures = 0;
const check = (ok, msg)=>{ console.log((ok ? '  ok   ' : '  FAIL ') + msg); if(!ok) failures++; };
const dark = p=>p.evaluate(()=>document.documentElement.classList.contains('dark'));
// The far-left button of a .view-btns row, and what's to its right
const row = p=>p.evaluate(()=>{
  const v = document.querySelector('.view-btns');
  const first = v.firstElementChild, second = first.nextElementSibling;
  return { firstIsToggle: first.hasAttribute('data-theme-toggle'), icon: first.querySelector('svg') !== null,
           secondText: second.textContent.trim(), leftOf: first.getBoundingClientRect().right <= second.getBoundingClientRect().left,
           noWords: !/dark mode|light mode/i.test(v.innerText),
           top: Math.round(first.getBoundingClientRect().top), sizes: [first.offsetHeight, second.offsetHeight] };
});

(async ()=>{
  for(const engine of ['chromium', 'webkit']){
    const browser = await pw[engine].launch();
    for(const [w, h, dev, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]]){
      console.log(`${engine} ${dev}`);
      const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:touch, isMobile:touch });
      // (start fresh once: the flag lives in localStorage so a second tab doesn't wipe everything again)
      await ctx.addInitScript(()=>{ if(!localStorage.getItem('test-started')){ localStorage.clear(); localStorage.setItem('test-started', '1'); } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e=>errors.push(e.message));
      const tap = async loc=>{ if(touch) await loc.tap(); else await loc.click(); };

      // 1. The tutorial over the puzzle page (first visit)
      await page.goto(BASE + 'play.html?level=easy');
      await page.waitForTimeout(700);
      const frame = page.frames().find(f=>f.url().includes('tutorial.html'));
      const r = await row(frame);
      check(r.firstIsToggle && r.icon && r.leftOf && r.noWords, `tutorial: moon / sun far left, "${r.secondText}" to its right, no words`);
      await frame.locator('.tut-head').screenshot({ path: `sync-${engine}-${dev}-tutorial.png` });
      await tap(frame.locator('.view-btns [data-theme-toggle]'));
      await page.waitForTimeout(250);
      check(await dark(frame) && await dark(page), 'tutorial switch: tutorial AND puzzle page dark');
      check(await frame.evaluate(()=>document.querySelector('.view-btns [data-theme-toggle]').getAttribute('aria-label')) === 'Switch to light mode', 'its icon is now the sun');
      await tap(frame.locator('.view-btns [data-theme-toggle]'));
      await page.waitForTimeout(250);
      check(!(await dark(frame)) && !(await dark(page)), 'and back: both light');
      await tap(frame.locator('#close-x'));
      await page.waitForTimeout(300);

      // 2. The rules popup on the puzzle page
      await tap(page.locator('[data-open-rules]').first());
      await page.waitForTimeout(300);
      const rr = await row(page);
      check(rr.firstIsToggle && rr.icon && rr.leftOf && rr.noWords, `rules: moon / sun far left, "${rr.secondText}" to its right, no words`);
      check(Math.abs(rr.sizes[0] - rr.sizes[1]) <= 1, `rules: the two buttons are the same height (${rr.sizes.join(' / ')})`);
      await page.screenshot({ path: `sync-${engine}-${dev}-rules.png`, clip: { x:0, y:0, width:w, height:200 } });
      await tap(page.locator('.view-btns [data-theme-toggle]'));
      await page.waitForTimeout(250);
      check(await dark(page), 'rules switch: puzzle page dark');
      check(await page.evaluate(()=>[...document.querySelectorAll('[data-theme-toggle]')].every(b=>b.getAttribute('aria-label') === 'Switch to light mode')),
        'every moon / sun on the page shows the sun');
      await page.keyboard.press('Escape');

      // 3. Another tab follows straight away
      const other = await ctx.newPage();
      await other.goto(BASE + 'index.html');
      await other.waitForTimeout(300);
      check(await dark(other), 'start screen opened afterwards: dark');
      await tap(other.locator('[data-theme-toggle]'));
      await page.waitForTimeout(400);
      check(!(await dark(page)), 'switched on the start screen in another tab: the puzzle page follows');
      await other.close();

      // 4. Back with the browser's own button (it may show a kept copy)
      await page.goto(BASE + 'index.html');
      await page.waitForTimeout(300);
      await page.goto(BASE + 'play.html?level=medium');
      await page.waitForTimeout(400);
      await tap(page.locator('[data-theme-toggle]').first());
      await page.waitForTimeout(200);
      await page.goBack();
      await page.waitForTimeout(500);
      check(await dark(page), 'switched on the puzzle page, then Back: the start screen is dark');
      check(!errors.length, 'no page errors ' + errors.join('; '));
      await ctx.close();
    }
    await browser.close();
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
