// Saving progress + the Archive calendar, on a laptop and a phone.
// Run: node progress_test.js
// (The Archive button is hidden for now, 2026-11-03; its calendar code is
// still on the start screen, so the test opens the calendar directly.)
const { chromium } = require('playwright');
const { BASE, solution, check, finish } = require('./lib');

(async () => {
  const browser = await chromium.launch(); const errors = [];
  const hard = solution('hard');
  for (const [w, h, label, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => localStorage.setItem('pb_tutorialSeen', '1'));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(label + ': ' + e.message));
    const onBoard = () => page.evaluate(() => placedPieces.filter(p => !p.locked).map(p => p.name + '@' + p.row + ',' + p.col).sort().join(' '));
    const put = ps => page.evaluate(ps => { ps.forEach(p => { const d = puzzle.pieces.find(x => x.name === p.name);
      placedPieces.push({ id: 'p' + (placedIdCounter++), name: p.name, color: d.color, cells: p.cells, row: p.row, col: p.col }); }); renderAll(); }, ps);

    // 1. Put two pieces on Hard, leave, come back: they're still there
    await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(300);
    await put(hard.slice(0, 2));
    const before = await onBoard();
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(200);
    await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(300);
    check(`[${label}] came back to Hard: same pieces`, await onBoard(), before);
    await page.goto(BASE + 'play.html?level=medium'); await page.waitForTimeout(300);
    check(`[${label}] Medium meanwhile is still empty`, await onBoard(), '');

    // 2. Reset clears the save
    await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(300);
    await page.click('#reset-btn'); await page.click('#reset-confirm'); await page.waitForTimeout(200);
    await page.reload(); await page.waitForTimeout(300);
    check(`[${label}] after Reset + reload: empty`, await onBoard(), '');

    // 3. Solve Hard: recorded for today; the save is kept, marked solved
    await put(hard); await page.waitForTimeout(200);
    check(`[${label}] solved Hard: popup shows`, await page.isVisible('#solved-popup'), true);
    check(`[${label}] solve recorded for today`, await page.evaluate(() => loadSolves().map(s => [s.date === localDay(), s.level])), [[true, 'hard']]);
    check(`[${label}] save kept as solved (reopening shows it finished)`, await page.evaluate(() =>
      Object.entries(JSON.parse(localStorage.getItem('pb_progress') || '{}')).filter(([k, v]) => k.startsWith('level:hard') && v.solved).length), 1);
    // A practice puzzle by link earns no star
    await page.goto(BASE + 'play.html?puzzle=test-puzzle-1'); await page.waitForTimeout(300);
    await put(require('./solutions.json')['test-puzzle-1']); await page.waitForTimeout(200);
    check(`[${label}] practice puzzle solved by link: still 1 solve`, await page.evaluate(() => loadSolves().length), 1);

    // 4. Calendar: a Medium solve on the 14th of last month too, then open it
    await page.evaluate(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); d.setDate(14);
      const list = loadSolves(); list.push({ date: localDay(d), level: 'medium', title: 'old', timeMs: 1, at: d.toISOString() }); writeJSON(COMPLETED_KEY, list); });
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(300);
    if (await page.locator('#archive-btn').count()) await page.click('#archive-btn');
    else await page.evaluate(() => { const n = new Date(); shownMonth = new Date(n.getFullYear(), n.getMonth(), 1); showMonth(); calPopup.hidden = false; });
    await page.waitForTimeout(200);
    const cal = () => page.evaluate(() => ({
      stars: [...document.querySelectorAll('.cal-day')].filter(d => d.querySelector('.stars svg')).map(d => d.firstChild.textContent + ':' + [...d.querySelectorAll('.stars path')].map(p => p.getAttribute('class').replace('star-', '')).join('+')),
      todayHasStar: !!document.querySelector('.cal-day.today .stars svg'), nextDisabled: document.getElementById('cal-next').disabled }));
    const today = String(new Date().getDate());
    check(`[${label}] this month: Hard star on today`, await cal(), { stars: [today + ':hard'], todayHasStar: true, nextDisabled: true });
    await page.screenshot({ path: `archive-${label}.png` });
    await page.click('#cal-prev'); await page.waitForTimeout(100);
    check(`[${label}] last month: Medium star on the 14th`, await cal(), { stars: ['14:medium'], todayHasStar: false, nextDisabled: false });
    await page.click('#cal-close');
    check(`[${label}] Close closes it`, await page.isHidden('#cal-popup'), true);
    await ctx.close();
  }
  await browser.close();
  finish(errors);
})();
