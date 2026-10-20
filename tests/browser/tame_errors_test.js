// Checks the calmer error messages on the puzzle page: a wrong finished
// board glows red straight away, and the written message only appears after
// 3 seconds without a move.  Run: node tame_errors_test.js
const { chromium } = require('playwright');
const sol = require('./solutions.json');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';

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
  console.log('puzzle page explains mistakes:', await page.evaluate(() => gameSettings.explain), '(expected false)');
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
  if (!found) console.log('could not find an uneven-only board (skipping part 1)');
  else {
    await page.waitForTimeout(200);
    console.log(`uneven only (${found[0]} moved ${found[1]}): frame glows red ${await frameRed()} | red pieces ${await redPieces()} | message now "${await status()}" (expected "")`);
    await page.screenshot({ path: 'tame-uneven-glow.png' });
    await page.waitForTimeout(3100);
    console.log(`  after 3 s: message "${await status()}" (expected Uneven …)`);
    // A move restarts the wait
    await place({ [found[0]]: found[1] });          // same board again: nothing moved → message stays
    console.log(`  re-drawn with nothing moved: message "${await status()}" (expected it to stay)`);
    await page.setViewportSize({ width: 1200, height: 800 }); await page.waitForTimeout(300);
    console.log(`  window resized: message "${await status()}" (expected it to stay)`);
  }

  // 2. A piece breaks a rule (overlap): that piece glows red, frame doesn't, message waits
  const first = sol['test-puzzle-1'][0], second = sol['test-puzzle-1'][1];
  await place({ [second.name]: [first.row - second.row, first.col - second.col] });
  await page.waitForTimeout(200);
  console.log(`rule broken: red pieces ${await redPieces()} (expected ≥1) | frame red ${await frameRed()} (expected false) | message now "${await status()}" (expected "")`);
  await page.screenshot({ path: 'tame-overlap-glow.png' });
  await page.waitForTimeout(3100);
  console.log(`  after 3 s: message "${await status()}"`);

  // 4. The puzzle page's real setting: red glow only, never a message
  await page.evaluate(() => { gameSettings.explain = false; });
  await place({ [second.name]: [first.row - second.row + 1, first.col - second.col] });
  await page.waitForTimeout(3300);
  console.log(`puzzle page setting: red pieces ${await redPieces()} (expected ≥1) | message after 3 s "${await status()}" (expected "")`);

  // 3. Solved: no glow, no message, the solved popup
  await place({});
  await page.waitForTimeout(3300);
  console.log(`solved: frame red ${await frameRed()} | message "${await status()}" | solved popup ${await page.isVisible('#solved-popup')}`);

  await browser.close();
  console.log(errors.length ? errors : 'no page errors');
})();
