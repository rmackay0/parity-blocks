// "Analyze with any of the pieces" (sandbox, 2026-11-20):
//   - the popup: slider up to (open squares ÷ 5), an odd number warns and
//     can't run, "Any number" locks the slider, picking a piece turns on
//     "Must include"
//   - the results match solver.js findPieceSets (run in one go), split over
//     several workers; every set includes the must-include pieces
//   - Stop keeps what was found; clicking a set makes it the puzzle's
//     pieces and shows its answers on the board
const { chromium } = require('playwright');
const { BASE, check, finish } = require('./lib');

(async ()=>{
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(()=>{ if(!sessionStorage.getItem('x')){ localStorage.clear(); sessionStorage.setItem('x', '1'); } });
  const page = await ctx.newPage();
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(BASE + 'sandbox.html');
  await page.waitForTimeout(500);

  // A 4 × 6 board with one square cut out: 23 open squares, so up to 4 pieces
  const setSize = async (r, c)=>{
    await page.fill('#rows-input', String(r)); await page.dispatchEvent('#rows-input', 'change');
    await page.fill('#cols-input', String(c)); await page.dispatchEvent('#cols-input', 'change');
  };
  await setSize(4, 6);
  await page.evaluate(()=>{ draft.removed = [[0, 5]]; draftChanged(); });

  await page.click('#any-btn');
  check('popup opens', await page.isVisible('#any-modal'), true);
  check('slider goes up to 4 (23 squares ÷ 5)', await page.getAttribute('#any-slider', 'max'), '4');
  await page.fill('#any-slider', '3');
  check('3 pieces: warns it\'s odd', /odd/.test(await page.textContent('#any-count-note')), true);
  check('3 pieces: Analyze is off', await page.isDisabled('#any-go'), true);
  await page.click('#any-all');
  check('Any number: slider locked', await page.isDisabled('#any-slider'), true);
  check('Any number: Analyze is on', await page.isDisabled('#any-go'), false);
  await page.click('#any-all');
  await page.fill('#any-slider', '4');

  // Picking a piece turns on Must include
  check('Must include starts off', await page.getAttribute('#any-must', 'aria-pressed'), 'false');
  await page.click('#any-picker .pick[data-piece=L]');
  check('picking L turns Must include on', await page.getAttribute('#any-must', 'aria-pressed'), 'true');
  check('L is picked', await page.locator('#any-picker .pick.on').count(), 1);
  await page.screenshot({ path: 'sandbox-any-popup.png' });

  // Run it; compare with the solver run in one go
  await page.click('#any-go');
  await page.waitForFunction(()=>/Checked/.test(document.getElementById('any-status').textContent), null, { timeout: 120000 });
  const got = await page.evaluate(()=>anyFound.map(s=>s.pieces.join('') + ':' + s.paritySolutions).sort());
  const want = await page.evaluate(()=>ParitySolver.findPieceSets(
    { rows: draft.rows, cols: draft.cols, removed: draft.removed, blocked: draft.blocked, dotted: draft.hintOutline, lines: draft.dottedLines },
    { counts: [4], mustInclude: ['L'] }).found.map(s=>s.pieces.join('') + ':' + s.paritySolutions).sort());
  check('the workers found the same sets as one search (' + want.length + ')', got.join(' '), want.join(' '));
  check('some sets found', got.length > 0, true);
  check('every set has L and 4 pieces', got.every(s=>s.includes('L') && s.split(':')[0].length === 4), true);
  check('list shows them all', await page.locator('#any-results .any-set').count(), got.length);
  const firstUnique = await page.locator('#any-results .any-set').first().evaluate(el=>el.classList.contains('unique'));
  const anyUnique = got.some(s=>s.endsWith(':1'));
  check('unique answers first', firstUnique, anyUnique);
  await page.screenshot({ path: 'sandbox-any-results.png' });

  // Stop part-way on a bigger search (6 × 6, any number, nothing required)
  await page.click('#any-close');
  await setSize(6, 6);
  await page.evaluate(()=>{ draft.removed = []; draftChanged(); });
  await page.click('#any-btn');
  await page.click('#any-must');                   // (off)
  await page.click('#any-all');
  await page.click('#any-go');
  check('while running the button says Stop', await page.textContent('#any-go'), 'Stop');
  await page.waitForTimeout(1500);
  await page.click('#any-go');
  check('Stop: says it stopped', /Stopped/.test(await page.textContent('#any-status')), true);
  check('Stop: workers gone', await page.evaluate(()=>anyWorkers.length), 0);
  check('Stop: button back to Analyze', await page.textContent('#any-go'), 'Analyze');

  // Use a set: it becomes the puzzle's pieces and its answers show
  await setSize(4, 6);       // (popup still open: the board changes under it)
  await page.evaluate(()=>{ draft.removed = [[0, 5]]; draftChanged(); });
  await page.click('#any-all');
  await page.fill('#any-slider', '4');
  await page.click('#any-go');
  await page.waitForFunction(()=>/Checked/.test(document.getElementById('any-status').textContent), null, { timeout: 120000 });
  const pick = await page.locator('#any-results .any-set .names').first().textContent();
  await page.locator('#any-results .any-set').first().click();
  check('popup closes', await page.isHidden('#any-modal'), true);
  check('the puzzle now has that set', await page.evaluate(()=>draft.pieces.map(d=>d.name).join(' ')), pick);
  await page.waitForSelector('#results:not([hidden])', { timeout: 60000 });
  check('and its answers are analyzed', Number((await page.textContent('#stat-pass')).replace(/,/g, '')) > 0, true);

  check('no page errors', errors.join('; '), '');
  await browser.close();
  finish();
})();
