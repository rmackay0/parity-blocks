// The ▾ "there's more below" on phones (scroll-hint.js, 2026-11-05):
//   - tutorial: shows on a slide that goes on below the screen; tapping it
//     scrolls down; gone at the bottom; back after scrolling up
//   - rules popup: the same
//   - never on a laptop, never when nothing is hidden below
// iPhone SE size (375 × 667, where several slides scroll) and a laptop,
// Chromium + WebKit.   Run:  node scroll_hint_test.js  (pictures: scrollhint-*.png)
const pw = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
let failures = 0;
const check = (ok, msg)=>{ console.log((ok ? '  ok   ' : '  FAIL ') + msg); if(!ok) failures++; };
const shown = p=>p.evaluate(()=>[...document.querySelectorAll('.scroll-hint')].some(h=>h.classList.contains('shown')));

(async ()=>{
  for(const engine of ['chromium', 'webkit']){
    const browser = await pw[engine].launch();
    for(const [w, h, dev, touch] of [[375, 667, 'phone', true], [1280, 800, 'laptop', false]]){
      console.log(`${engine} ${dev}`);
      const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:touch, isMobile:touch });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e=>errors.push(e.message));

      // Tutorial, slide 1 (taller than an iPhone SE's screen)
      await page.goto(BASE + 'tutorial.html');
      await page.waitForTimeout(700);
      const more = await page.evaluate(()=>{ const b = document.querySelector('.tut-body'); return b.scrollHeight - b.clientHeight; });
      if(dev === 'phone'){
        check(more > 24, `slide 1 goes on below the screen (${more}px)`);
        check(await shown(page), 'tutorial: the ▾ shows');
        const pos = await page.evaluate(()=>{ const r = document.querySelector('.scroll-hint').getBoundingClientRect(), f = document.querySelector('.tut-foot').getBoundingClientRect();
          return { aboveFooter: r.bottom <= f.top, centred: Math.abs((r.left + r.width/2) - innerWidth/2) < 2 }; });
        check(pos.aboveFooter && pos.centred, 'it sits just above the Back / Next buttons, centred');
        await page.screenshot({ path: `scrollhint-${engine}-tutorial.png` });
        await page.locator('.scroll-hint').tap({ force: true });     // (it bobs on purpose, so it's never "still")
        await page.waitForTimeout(700);
        const scrolled = await page.evaluate(()=>document.querySelector('.tut-body').scrollTop);
        check(scrolled > 0, `tapping it scrolls down (${scrolled}px)`);
        await page.evaluate(()=>{ const b = document.querySelector('.tut-body'); b.scrollTop = b.scrollHeight; });
        await page.waitForTimeout(600);
        check(!(await shown(page)), 'at the bottom: gone');
        await page.evaluate(()=>{ document.querySelector('.tut-body').scrollTop = 0; });
        await page.waitForTimeout(600);
        check(await shown(page), 'scrolled back up: it\'s back');
        // A slide that fits: no ▾ (slide 3, "Don't place a piece over")
        await page.evaluate(()=>showSlide(2));
        await page.waitForTimeout(700);
        const fits = await page.evaluate(()=>{ const b = document.querySelector('.tut-body'); return b.scrollHeight - b.clientHeight <= 24; });
        if(fits) check(!(await shown(page)), 'a slide that fits: no ▾');
      } else {
        check(!(await shown(page)), 'laptop: never shown');
      }

      // Rules popup on the start screen
      await page.goto(BASE + 'index.html');
      await page.waitForTimeout(400);
      await page.locator('[data-open-rules]').first().click();
      await page.waitForTimeout(700);
      if(dev === 'phone'){
        check(await shown(page), 'rules: the ▾ shows');
        await page.screenshot({ path: `scrollhint-${engine}-rules.png` });
        await page.evaluate(()=>{ const p = document.querySelector('.rules-popup'); p.scrollTop = p.scrollHeight; });
        await page.waitForTimeout(600);
        check(!(await shown(page)), 'rules at the bottom: gone');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
        check(!(await shown(page)), 'rules closed: gone');
      } else {
        check(!(await shown(page)), 'laptop rules: never shown');
      }
      check(!errors.length, 'no page errors ' + errors.join('; '));
      await ctx.close();
    }
    await browser.close();
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
