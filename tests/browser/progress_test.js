// Saving progress + the Archive calendar.  Run: node progress_test.js
const { chromium } = require('playwright');
const sol = require('./solutions.json');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';

(async () => {
  const browser = await chromium.launch(); const errors = [];
  for (const [w, h, label, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => localStorage.setItem('pb_tutorialSeen', '1'));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(label + ': ' + e.message));
    const onBoard = () => page.evaluate(() => placedPieces.filter(p => !p.locked).map(p => p.name + '@' + p.row + ',' + p.col).sort().join(' '));

    // 1. Put two pieces on Hard, leave, come back: they're still there
    await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(300);
    const two = sol['test-puzzle-1'].slice(0, 2);
    await page.evaluate(ps => { ps.forEach(p => { const d = puzzle.pieces.find(x => x.name === p.name);
      placedPieces.push({ id: 'p' + (placedIdCounter++), name: p.name, color: d.color, cells: p.cells, row: p.row, col: p.col }); }); renderAll(); }, two);
    const before = await onBoard();
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(200);
    await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(300);
    console.log(`[${label}] came back to Hard: pieces ${await onBoard()} (expected ${before})`);
    // Medium is separate: still empty
    await page.goto(BASE + 'play.html?level=medium'); await page.waitForTimeout(300);
    console.log(`[${label}] Medium meanwhile: pieces "${await onBoard()}" (expected "")`);

    // 2. Reset clears the save
    await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(300);
    await page.click('#reset-btn'); await page.click('#reset-confirm'); await page.waitForTimeout(200);
    await page.reload(); await page.waitForTimeout(300);
    console.log(`[${label}] after Reset + reload: pieces "${await onBoard()}" (expected "")`);

    // 3. Solve Hard: recorded for today; the save is gone
    await page.evaluate(ps => { ps.forEach(p => { const d = puzzle.pieces.find(x => x.name === p.name);
      placedPieces.push({ id: 'p' + (placedIdCounter++), name: p.name, color: d.color, cells: p.cells, row: p.row, col: p.col }); }); renderAll(); }, sol['test-puzzle-1']);
    await page.waitForTimeout(200);
    console.log(`[${label}] solved Hard: popup ${await page.isVisible('#solved-popup')} | recorded`, await page.evaluate(() => JSON.stringify(loadSolves().map(s => [s.date === localDay(), s.level]))),
      '| save left:', await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('pb_progress') || '{}')).filter(k => k.startsWith('level:hard')).length), '(expected 0)');
    // A practice puzzle by link earns no star
    await page.goto(BASE + 'play.html?puzzle=test-puzzle-1'); await page.waitForTimeout(300);
    await page.evaluate(ps => { ps.forEach(p => { const d = puzzle.pieces.find(x => x.name === p.name);
      placedPieces.push({ id: 'p' + (placedIdCounter++), name: p.name, color: d.color, cells: p.cells, row: p.row, col: p.col }); }); renderAll(); }, sol['test-puzzle-1']);
    console.log(`[${label}] practice puzzle by link solved: solves recorded still ${await page.evaluate(() => loadSolves().length)} (expected 1)`);

    // 4. Calendar: a Medium solve last month too (pretend), then open the Archive
    await page.evaluate(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); d.setDate(14);
      const list = loadSolves(); list.push({ date: localDay(d), level: 'medium', title: 'old', timeMs: 1, at: d.toISOString() }); writeJSON(COMPLETED_KEY, list); });
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(300);
    await page.click('#archive-btn'); await page.waitForTimeout(200);
    const cal = () => page.evaluate(() => ({ month: document.getElementById('cal-month').textContent,
      stars: [...document.querySelectorAll('.cal-day')].filter(d => d.querySelector('.stars svg')).map(d => d.firstChild.textContent + ':' + [...d.querySelectorAll('.stars path')].map(p => p.getAttribute('class').replace('star-', '')).join('+')),
      today: (document.querySelector('.cal-day.today') || {}).textContent, total: document.getElementById('cal-total').textContent,
      nextDisabled: document.getElementById('cal-next').disabled }));
    console.log(`[${label}] calendar now:`, JSON.stringify(await cal()));
    await page.screenshot({ path: `archive-${label}.png` });
    await page.click('#cal-prev'); await page.waitForTimeout(100);
    console.log(`[${label}] previous month:`, JSON.stringify(await cal()));
    await page.click('#cal-close');
    console.log(`[${label}] Close works:`, await page.isHidden('#cal-popup'));
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? errors : 'no page errors');
})();
