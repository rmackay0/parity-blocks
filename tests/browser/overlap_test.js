// When two pieces overlap, only the one moved most recently should glow red.
// Run: node overlap_test.js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch(); const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('pb_tutorialSeen', '1'));
  await page.goto('file:///Users/robertmackay/Projects/Parity%20Blocks/play.html?level=hard');
  await page.waitForTimeout(300);
  const red = () => page.evaluate(() => [...document.querySelectorAll('.placed-piece.invalid')]
    .map(el => placedPieces.find(p => p.id === el.dataset.id).name).join(',') || '(none)');

  // Drag a piece from the top so the square under its middle lands on (r, c)
  const dragTo = async (name, r, c) => {
    const s = await page.locator(`.tray-slot[data-name="${name}"]`).boundingBox();
    const t = await page.locator(`.board-cell[data-r="${r}"][data-c="${c}"]`).boundingBox();
    await page.mouse.move(s.x + s.width/2, s.y + s.height/2); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(s.x + s.width/2 + (t.x + t.width/2 - s.x - s.width/2)*i/8, s.y + s.height/2 + (t.y + t.height/2 - s.y - s.height/2)*i/8);
    await page.mouse.up(); await page.waitForTimeout(300);
  };
  await dragTo('L', 2, 2);
  console.log('L alone: red pieces', await red(), '(expected none)');
  await dragTo('I', 2, 2);                        // I dropped on top of L
  console.log('I dropped on top of L: red pieces', await red(), '(expected I)');
  // Now move L (one square down, by dragging a block of L that isn't under I): L is the newest move
  const lId = await page.evaluate(() => placedPieces.find(p => p.name === 'L').id);
  const blocks = page.locator(`.placed-piece[data-id="${lId}"] .blk`);
  let target = null;
  for (let i = 0; i < await blocks.count(); i++) {
    const b = await blocks.nth(i).boundingBox();
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).closest('.placed-piece')?.dataset.id, [b.x + b.width/2, b.y + b.height/2]);
    if (hit === lId) { target = b; break; }
  }
  const cx = target.x + target.width/2, cy = target.y + target.height/2, step = target.height + 4;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(cx, cy + step*i/6);
  await page.mouse.up(); await page.waitForTimeout(300);
  console.log('then L moved (still overlapping I?):', await page.evaluate(() => invalidIds.size > 0), '| red pieces', await red(), '(expected L)');
  // Drag-and-drop check: drag I off L entirely (back to the top) → nothing red
  const iId = await page.evaluate(() => placedPieces.find(p => p.name === 'I').id);
  const ib = await page.locator(`.placed-piece[data-id="${iId}"] .blk`).first().boundingBox();
  const tray = await page.locator('#tray').boundingBox();
  await page.mouse.move(ib.x + ib.width/2, ib.y + ib.height/2); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(ib.x + (tray.x + 30 - ib.x)*i/8, ib.y + (tray.y + 20 - ib.y)*i/8);
  await page.mouse.up(); await page.waitForTimeout(300);
  console.log('I dragged back to the top: red pieces', await red(), '(expected none)');
  await page.screenshot({ path: 'overlap.png' });
  await browser.close();
  console.log(errors.length ? errors : 'no page errors');
})();
