// Fills boards wrongly so a long message appears, and checks the board doesn't move.
// Run: node board_still_test.js
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
// Runs inside the page: puts every piece from the top in the middle of the
// grid, all piled on each other (the longest possible message)
function dumpAll(){
  puzzle.pieces.forEach((d, i) => {
    const b = bounds(trayCells[d.name]);
    placedPieces.push({ id: 'dump' + i, name: d.name, color: d.color, cells: trayCells[d.name].map(c => c.slice()),
      row: Math.floor((puzzle.rows - b.rows) / 2), col: Math.floor((puzzle.cols - b.cols) / 2) });
  });
  renderAll();
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h, device, touch] of [[1280, 860, 'laptop', false], [390, 800, 'phone', true]]) {
    for (const large of [false, true]) {
      const label = device + (large ? ' large' : '');
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      await ctx.addInitScript(l => { localStorage.setItem('pb_tutorialSeen', '1'); localStorage.setItem('pb_largeText', l ? '1' : '0'); }, large);
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(label + ': ' + e.message));
      const rect = () => page.evaluate(() => { const r = document.getElementById('board-outer').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; });
      const status = () => page.evaluate(() => { const s = document.getElementById('status'); return { text: s.textContent, lines: Math.round(s.scrollHeight / parseFloat(getComputedStyle(s).lineHeight)) }; });

      // 1. Tutorial slide 2: put both pieces in the middle (wrong) with the letter keys
      await page.goto(BASE + 'tutorial.html');
      await page.evaluate(() => showSlide(1));
      await page.waitForTimeout(300);
      const t0 = await rect();
      await page.evaluate(dumpAll);
      await page.waitForTimeout(3300);              // the message waits 3 s before it appears
      const t1 = await rect(), s1 = await status();
      console.log(`[${label}] tutorial slide 2: board ${JSON.stringify(t0)} → ${JSON.stringify(t1)} ${JSON.stringify(t0) === JSON.stringify(t1) ? 'DID NOT MOVE ✓' : 'MOVED ✗'} | message (${s1.lines} line${s1.lines > 1 ? 's' : ''}): "${s1.text}"`);
      if (device === 'phone' || large) await page.screenshot({ path: `still-tut-${device}${large ? '-large' : ''}.png` });

      // 2. A real puzzle (Hard): every piece dumped in the middle → longest possible message
      await page.goto(BASE + 'play.html?level=hard');
      await page.waitForTimeout(300);
      const g0 = await rect();
      await page.evaluate(dumpAll);
      await page.waitForTimeout(3300);
      const g1 = await rect();
      const st = await page.evaluate(() => ({ text: document.getElementById('status').textContent, hidden: document.getElementById('status').hidden,
        red: document.querySelectorAll('.placed-piece.invalid').length + (document.getElementById('board-outer').classList.contains('uneven') ? ' + red frame' : '') }));
      console.log(`[${label}] puzzle page:      board ${JSON.stringify(g0)} → ${JSON.stringify(g1)} ${JSON.stringify(g0) === JSON.stringify(g1) ? 'DID NOT MOVE ✓' : 'MOVED ✗'} | message area hidden ${st.hidden}, text "${st.text}" (expected "") | red pieces ${st.red}`);
      if (!large) await page.screenshot({ path: `still-play-${device}.png` });
      await ctx.close();
    }
  }
  await browser.close();
  console.log(errors.length ? errors : 'no page errors');
})();
