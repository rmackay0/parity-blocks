// On an iPhone-sized screen, for every tutorial slide: is the board centred,
// and does anything come closer than 12px to the screen's sides?
// Run: node phone_layout_check.js   (LARGE=1 for Large text)
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';

(async () => {
  const browser = await chromium.launch();
  // Whole screens (iPhone 14 / SE / mini), then what a page really gets in
  // Safari with its address bar and toolbar showing (14 / mini / SE)
  const SIZES = process.env.SAFARI === '0' ? [[390, 844], [375, 667], [375, 812]]
              : [[390, 844], [375, 667], [375, 812], [390, 664], [375, 629], [375, 553]];
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    if (process.env.LARGE === '1') await ctx.addInitScript(() => localStorage.setItem('pb_largeText', '1'));
    const page = await ctx.newPage();
    await page.goto(BASE + 'tutorial.html');
    const slides = await page.evaluate(() => SLIDES.length);
    for (let i = 0; i < slides; i++) {
      await page.evaluate(n => showSlide(n), i);
      // let the animations finish (slide 3's pictures ~7.3 s, slide 6's dark 3.5 s)
      await page.waitForTimeout({ 2: 7500, 5: 4000 }[i] || 500);
      const r = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const box = el => el.getBoundingClientRect();
        const b = document.getElementById('board-outer');
        const board = !document.getElementById('play').hidden ? box(b) : null;
        // Visible things with text or pictures that come within 12px of a side
        const tight = [...document.querySelectorAll('.tut-body *')].filter(el => {
          if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
          if (el.closest('[hidden]')) return false;
          const hasOwnText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!hasOwnText && el.tagName !== 'svg') return false;
          const q = box(el);
          return q.width > 0 && (q.left < 12 || q.right > W - 12);
        }).map(el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} [${Math.round(box(el).left)}..${Math.round(box(el).right)}]`);
        const body = document.querySelector('.tut-body');
        return {
          W, scrollW: body.scrollWidth, overflowY: body.scrollHeight - body.clientHeight,
          board: board && { left: Math.round(board.left), right: Math.round(W - board.right) },
          play: !document.getElementById('play').hidden && (q => [Math.round(q.left), Math.round(q.right)])(box(document.getElementById('play'))),
          tight: tight.slice(0, 8),
        };
      });
      console.log(`[${w}x${h}] slide ${i + 1}: screen ${r.W}, content ${r.scrollW}, needs scrolling ${r.overflowY}px` +
        (r.board ? ` | board gap left ${r.board.left} / right ${r.board.right}${Math.abs(r.board.left - r.board.right) > 2 ? '  ✗ OFF-CENTRE' : '  ✓'}` : '') +
        (r.play ? ` | play area ${r.play}` : '') +
        (r.tight.length ? `\n    too close to a side: ${r.tight.join(', ')}` : ''));
      await page.screenshot({ path: `layout-${w}-slide${i + 1}.png` });
    }
    await ctx.close();
  }
  await browser.close();
})();
