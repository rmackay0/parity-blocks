// The piece animations (game.js FEEL, 2026-11-02): drags a piece with the
// mouse and checks it lifts, leans while moving, lands with an animation,
// and that the board ends up exactly as before (animations only, no moves).
// Also clicks to rotate and checks the spin plays.
// Run with:  node feel_test.js   (pictures: feel-*.png in this folder)
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';

let failures = 0;
function check(label, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (expected ' + JSON.stringify(want) + ')'}`);
}

(async ()=>{
  const browser = await chromium.launch(), errors = [];
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await ctx.addInitScript(()=>localStorage.setItem('pb_tutorialSeen', '1'));
  const page = await ctx.newPage();
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(400);

  // Press the first piece at the top: it squeezes
  const slot = page.locator('.tray-slot').first();
  const s = await slot.boundingBox();
  await page.mouse.move(s.x + s.width/2, s.y + s.height/2);
  await page.mouse.down();
  check('pressed piece squeezes', await page.locator('.tray-slot .piece-box.pressed').count(), 1);

  // Drag it to the board, moving fast to the right: it lifts and leans
  const b = await page.locator('#board').boundingBox();
  for(let i = 1; i <= 12; i++){
    await page.mouse.move(s.x + s.width/2 + (b.x + 150 - s.x - s.width/2) * i/12, s.y + s.height/2 + (b.y + 150 - s.y - s.height/2) * i/12);
    await page.waitForTimeout(8);
  }
  check('held piece is lifted', await page.locator('.ghost .piece-box.lifted').count(), 1);
  const lean = await page.evaluate(()=>press && press.tilt);
  check('held piece leans while moving', Math.abs(lean) > 0.5, true);
  check('its place at the top fades', await page.locator('.tray-slot.lifting').count(), 1);
  await page.screenshot({ path:'feel-drag.png' });
  await page.waitForTimeout(500);
  check('stands back up when it stops', Math.abs(await page.evaluate(()=>press.tilt)) < 0.3, true);

  // Let go: it lands with an animation, then sits exactly in its squares
  await page.mouse.up();
  await page.waitForTimeout(60);
  check('landing animation playing', await page.evaluate(()=>{
    const el = document.querySelector('.placed-piece');
    return el.getAnimations().length > 0;
  }), true);
  await page.screenshot({ path:'feel-land.png' });
  await page.waitForTimeout(500);
  check('after landing: no leftover transform', await page.evaluate(()=>getComputedStyle(document.querySelector('.placed-piece')).transform), 'none');
  check('one piece placed', await page.evaluate(()=>placedPieces.length), 1);

  // Click it: it rotates with a spin
  const pc = await page.locator('.placed-piece .blk').first().boundingBox();
  await page.mouse.click(pc.x + pc.width/2, pc.y + pc.height/2);
  await page.waitForTimeout(330);   // (a click waits to see if it's a double-click)
  check('rotate spin playing', await page.evaluate(()=>document.querySelector('.placed-piece .piece-svg').getAnimations().length > 0), true);

  // Drag it back to the top: it pops back in
  const pc2 = await page.locator('.placed-piece .blk').first().boundingBox();
  await page.waitForTimeout(300);
  await page.mouse.move(pc2.x + 5, pc2.y + 5); await page.mouse.down();
  await page.mouse.move(pc2.x + 30, pc2.y - 60, { steps: 4 });
  await page.mouse.move(s.x + s.width/2, s.y + s.height/2, { steps: 6 });
  await page.mouse.up(); await page.waitForTimeout(40);
  check('back at the top', await page.evaluate(()=>placedPieces.length), 0);
  check('pops back in', await page.evaluate(()=>[...document.querySelectorAll('.tray-slot .piece-box')].some(el=>el.getAnimations().length)), true);

  await browser.close();
  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
  console.log(failures ? failures + ' FAILED' : 'all passed');
})();
