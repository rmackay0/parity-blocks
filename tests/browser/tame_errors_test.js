// Checks the calmer error messages on the puzzle page: a wrong finished
// board glows red straight away, and the written message only appears after
// 3 seconds without a move.  Run: node tame_errors_test.js
const { chromium } = require('playwright');
const sol = require('./solutions.json');
const { BASE, check, finish } = require('./lib');

(async () => {
  const browser = await chromium.launch(); const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('pb_tutorialSeen', '1'));
  await page.goto(BASE + 'play.html?puzzle=test-puzzle-1');
  await page.waitForTimeout(300);
  const status = () => page.textContent('#status');
  // Parts 1–3 test the 3-second wait itself (the tutorial and sandbox use it),
  // so switch explanations on; part 4 checks the puzzle page's real setting
  check('puzzle page explains mistakes', await page.evaluate(() => gameSettings.explain), false);
  await page.evaluate(() => { gameSettings.explain = true; });
  const frameRed = () => page.evaluate(() => document.getElementById('board-outer').classList.contains('uneven'));
  const redPieces = () => page.locator('.placed-piece.invalid').count();
  // Put every piece in its solved spot (straight into the game state)
  const place = moves => page.evaluate(([s, moves]) => {
    placedPieces = placedPieces.filter(p => p.locked);
    s.forEach((p, i) => {
      const def = puzzle.pieces.find(d => d.name === p.name);
      const m = moves[p.name] || [0, 0];
      placedPieces.push({ id: 'p' + (100 + i), name: p.name, color: def.color, cells: p.cells, row: p.row + m[0], col: p.col + m[1] });
    });
    renderAll();
  }, [sol['test-puzzle-1'], moves]);

  // 1. Only the rows/columns are wrong: swap nothing, just shift one piece down a row into free space?
  //    Simplest uneven board: the solution with one piece moved one square where it still fits.
  //    Try each piece and each direction until we find a move that's uneven but breaks no rule.
  let found = null;
  for (const p of sol['test-puzzle-1']) {
    for (const m of [[1,0],[-1,0],[0,1],[0,-1]]) {
      await place({ [p.name]: m });
      if ((await redPieces()) === 0 && await frameRed()) { found = [p.name, m]; break; }
    }
    if (found) break;
  }
  if (check('found an uneven-only board (one piece moved a square)', !!found, true)) {
    await page.waitForTimeout(200);
    check(`uneven only (${found[0]} moved ${found[1]}): frame red, red pieces, message now`, [await frameRed(), await redPieces(), await status()], [true, 0, '']);
    await page.screenshot({ path: 'tame-uneven-glow.png' });
    await page.waitForTimeout(3100);
    const msg = await status();
    check('  after 3 s: message starts "Uneven"', msg.startsWith('Uneven'), true);
    await place({ [found[0]]: found[1] });          // same board again: nothing moved → message stays
    check('  re-drawn with nothing moved: message stays', await status(), msg);
    await page.setViewportSize({ width: 1200, height: 800 }); await page.waitForTimeout(300);
    check('  window resized: message stays', await status(), msg);
  }

  // 2. A piece breaks a rule (overlap): that piece glows red, frame doesn't, message waits
  const first = sol['test-puzzle-1'][0], second = sol['test-puzzle-1'][1];
  await place({ [second.name]: [first.row - second.row, first.col - second.col] });
  await page.waitForTimeout(200);
  check('rule broken: some piece red, frame not red, no message yet', [await redPieces() >= 1, await frameRed(), await status()], [true, false, '']);
  await page.screenshot({ path: 'tame-overlap-glow.png' });
  await page.waitForTimeout(3100);
  check('  after 3 s: message mentions the overlap', /overlap/i.test(await status()), true);

  // 4. The puzzle page's real setting: red glow only, never a message
  await page.evaluate(() => { gameSettings.explain = false; });
  await place({ [second.name]: [first.row - second.row + 1, first.col - second.col] });
  await page.waitForTimeout(3300);
  check('puzzle page setting: some piece red, no message after 3 s', [await redPieces() >= 1, await status()], [true, '']);

  // 3. Solved: no glow, no message, the solved popup
  await place({});
  await page.waitForTimeout(3300);
  check('solved: frame red, message, Solved popup', [await frameRed(), await status(), await page.isVisible('#solved-popup')], [false, '', true]);

  await browser.close();
  finish(errors);
})();
