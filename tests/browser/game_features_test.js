// Tests the new game features on the real puzzle page.  Run: node game_features_test.js
const { chromium } = require('playwright');
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
const same = (a, b) => JSON.stringify(S.normalize(a)) === JSON.stringify(S.normalize(b));
const rot = c => { const rows = Math.max(...c.map(x=>x[0]))+1; return S.normalize(c.map(([r,q])=>[q, rows-1-r])); };
const refl = c => { const cols = Math.max(...c.map(x=>x[1]))+1; return S.normalize(c.map(([r,q])=>[r, cols-1-q])); };

(async () => {
  const browser = await browser_();
  async function browser_(){ return chromium.launch(); }
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('pb_tutorialSeen', '1'));
  await page.goto(BASE + 'play.html?level=hard');
  await page.waitForTimeout(300);
  const piece = name => page.evaluate(n => { const p = placedPieces.find(q=>q.name===n); return p && { row:p.row, col:p.col, cells:p.cells }; }, name);
  const tray = name => page.evaluate(n => trayCells[n], name);

  // 1. Letter and arrow keys do nothing now (removed by the user)
  const before1 = await page.evaluate(() => JSON.stringify([placedPieces, trayCells]));
  for (const k of ['l', 'i', 'f', 'ArrowDown', 'ArrowLeft']) await page.keyboard.press(k);
  console.log('letter + arrow keys: nothing changed', before1 === await page.evaluate(() => JSON.stringify([placedPieces, trayCells])),
    '| outlined pieces:', await page.locator('.selected').count(), '(expected 0)',
    '| Reflect/Rotate buttons:', await page.locator('#reflect-btn, #rotate-btn').count(), '(expected 0)');

  // 2. Drag L onto the grid, then point at it: R rotates, E reflects. R/E keep
  //    acting on it even when a turn moves it out from under the mouse
  const drag = async (from, to) => {
    await page.mouse.move(from.x + from.width/2, from.y + from.height/2); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + from.width/2 + (to.x - from.x)*i/8, from.y + from.height/2 + (to.y - from.y)*i/8);
    await page.mouse.up(); await page.waitForTimeout(400);
  };
  await drag(await page.locator('.tray-slot[data-name="L"]').boundingBox(), await page.locator('.board-cell[data-r="2"][data-c="2"]').boundingBox());
  const L2 = await piece('L');
  const lb = await page.locator(`.placed-piece[data-id="${await page.evaluate(() => placedPieces.find(q=>q.name==='L').id)}"] .blk`).first().boundingBox();
  await page.mouse.move(lb.x + lb.width/2, lb.y + lb.height/2);
  await page.keyboard.press('r');
  console.log('pointing at L, R rotated it:', same((await piece('L')).cells, rot(L2.cells)));
  const L3 = (await piece('L')).cells;
  await page.keyboard.press('e');
  console.log('then E reflected it (same piece, mouse not moved):', same((await piece('L')).cells, refl(L3)));

  // 3. Hold a tray piece, press R, drag it onto the grid → it lands rotated
  const U0 = await tray('U');
  let s = await page.locator('.tray-slot[data-name="U"]').boundingBox();
  let t = await page.locator('.board-cell[data-r="0"][data-c="0"]').boundingBox();
  await page.mouse.move(s.x + s.width/2, s.y + s.height/2); await page.mouse.down();
  await page.keyboard.press('r');                                   // while holding, before moving
  for (let i = 1; i <= 8; i++) await page.mouse.move(s.x + s.width/2 + (t.x - s.x)*i/8, s.y + s.height/2 + (t.y - s.y)*i/8);
  await page.keyboard.press('e');                                   // while dragging
  await page.mouse.up();
  await page.waitForTimeout(400);
  const U1 = await piece('U');
  console.log('hold+R then drag+E: U landed rotated then reflected:', !!U1 && same(U1.cells, refl(rot(U0))));

  // 4. Hold without moving + E: reflects once, and letting go doesn't also rotate
  const N0 = await tray('N');
  s = await page.locator('.tray-slot[data-name="N"]').boundingBox();
  await page.mouse.move(s.x + s.width/2, s.y + s.height/2); await page.mouse.down();
  await page.keyboard.press('e');
  await page.mouse.up();
  await page.waitForTimeout(400);
  console.log('hold+E then release: reflected once, no extra rotate:', same(await tray('N'), refl(N0)));

  // 5. Box select is gone: dragging across the board's empty frame moves nothing
  const board = await page.locator('#board-outer').boundingBox();
  const b0 = { L: await piece('L'), U: await piece('U') };
  await page.mouse.move(board.x + 4, board.y + 4); await page.mouse.down();
  await page.mouse.move(board.x + board.width - 4, board.y + board.height - 4, { steps: 6 });
  await page.mouse.up();
  const b1 = { L: await piece('L'), U: await piece('U') };
  console.log('drag on empty board: no box drawn', await page.locator('.marquee').count() === 0,
    '| pieces unchanged', JSON.stringify(b0) === JSON.stringify(b1));

  // 6. Point at a piece and press a key
  const blockOf = async name => {
    const id = await page.evaluate(n => placedPieces.find(q=>q.name===n).id, name);
    return page.locator(`.placed-piece[data-id="${id}"] .blk`).first().boundingBox();
  };
  let bb = await blockOf('L'); const Lc = (await piece('L')).cells;
  await page.mouse.move(bb.x + bb.width/2, bb.y + bb.height/2);
  await page.keyboard.press('r');
  console.log('pointing at L + R: L rotated', same((await piece('L')).cells, rot(Lc)));
  const topName = await page.evaluate(() => document.querySelector('.tray-slot:not(.used)').dataset.name);
  const T0 = await tray(topName); s = await page.locator(`.tray-slot[data-name="${topName}"]`).boundingBox();
  await page.mouse.move(s.x + s.width/2, s.y + s.height/2);
  await page.keyboard.press('e');
  console.log(`pointing at ${topName} at the top + E: reflected`, same(await tray(topName), refl(T0)));
  const all0 = await page.evaluate(() => JSON.stringify([placedPieces, trayCells]));
  await page.mouse.move(5, 5);
  await page.keyboard.press('r');
  console.log('pointing at nothing + R: nothing changed', all0 === await page.evaluate(() => JSON.stringify([placedPieces, trayCells])));

  // 7. Typing in the sandbox's name box doesn't trigger R / E
  await page.goto(BASE + 'sandbox.html');
  await page.waitForTimeout(300);
  const before7 = await page.evaluate(() => JSON.stringify([placedPieces, trayCells]));
  const box7 = await page.locator('.tray-slot').first().boundingBox();
  await page.mouse.move(box7.x + box7.width/2, box7.y + box7.height/2);   // pointing at a piece while typing
  await page.fill('#save-name', '');
  await page.type('#save-name', 'rotate reflect');
  console.log('typing "rotate reflect" in the sandbox: pieces changed', before7 !== await page.evaluate(() => JSON.stringify([placedPieces, trayCells])), '(expected false)');

  await browser.close();
  console.log(errors.length ? errors : 'no page errors');
})();
