// Is any glow cut off? (user, 2026-11-06: the highlighter's glow was cut
// off at the top on a laptop.) The slide area (.tut-body) scrolls, so it
// clips anything poking out past its edges. For every glowing thing on every
// slide, on laptops and phones, this checks the glow (its ring plus most of
// its blur) stays inside that area.
// Run: node glow_clip_test.js
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
let failures = 0;

// [slide index, selector, how far the glow reaches (px), how to turn it on]
const GLOWS = [
  [1, '#step0', 14, null],
  [3, '#step0', 14, null],
  [2, '.dont-slide h2', 14, null],
  [4, '.hl-pencil', 21, null],
  [4, '#board-outer', 20, ()=>{ setHighlighting(true); setIntroStage('grid'); }],
  [5, '.hl-pencil', 21, null],
  [6, '#big-note', 18, null],
  [6, '#hint-btn', 19, ()=>{ document.getElementById('hint-btn').classList.add('shown', 'lit'); }],
];

(async () => {
  const browser = await chromium.launch();
  for (const [w, h, name, touch] of [[1280, 800, 'laptop', false], [1440, 900, 'big laptop', false], [1024, 700, 'small laptop', false],
                                     [390, 664, 'iPhone 14', true], [375, 629, 'iPhone mini', true], [375, 553, 'iPhone SE', true]]) {
    for (const large of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      if (large) await ctx.addInitScript(() => localStorage.setItem('pb_largeText', '1'));
      const page = await ctx.newPage();
      await page.goto(BASE + 'tutorial.html');
      for (const [slide, sel, reach, setup] of GLOWS) {
        await page.evaluate(n => showSlide(n), slide);
        await page.waitForTimeout(slide === 5 ? 4200 : 400);
        if (setup) { await page.evaluate(setup); await page.waitForTimeout(400); }
        const r = await page.evaluate(([sel, reach]) => {
          const el = document.querySelector(sel);
          if (!el || !el.offsetParent || getComputedStyle(el).visibility === 'hidden') return null;
          const body = document.querySelector('.tut-body'), b = body.getBoundingClientRect(), e = el.getBoundingClientRect();
          // (the glow scrolls with the slide: only what's at the top/bottom of what can be scrolled to is cut for good)
          const top = e.top + body.scrollTop - b.top, bottom = (b.top + body.scrollHeight) - (e.bottom + body.scrollTop);
          return { top: Math.round(top - reach), bottom: Math.round(bottom - reach),
                   left: Math.round(e.left - b.left - reach), right: Math.round(b.right - e.right - reach) };
        }, [sel, reach]);
        if (!r) continue;
        const cut = Object.entries(r).filter(([, v]) => v < 0).map(([k, v]) => `${k} by ${-v}px`);
        if (cut.length) { failures++; console.log(`  FAIL [${name}${large ? ', Large text' : ''}] slide ${slide + 1} ${sel}: glow cut off at the ${cut.join(', ')}`); }
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(failures ? `\n${failures} glow(s) cut off` : 'No glows cut off');
  process.exit(failures ? 1 : 0);
})();
