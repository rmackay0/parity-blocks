// "Duplicated piece" (a friend's iPhone, 2026-11-05): a see-through lifted
// copy of a piece stayed on the board until a refresh. That's the drag
// copy (.ghost) left behind when a drag never finished properly. This
// recreates the ways that happens on a phone, with touch events, in
// Chromium and WebKit (Safari's engine):
//   1. a second finger lands on another piece mid-drag
//   2. the finger-up is lost, then the player touches a piece again
//   3. Safari cancels the touch (pointercancel) mid-drag
//   4. the page is hidden mid-drag (switching apps)
// After each: at most one lifted copy while something is held, none after,
// and the piece is where it should be.
// Run:  node ghost_test.js
const pw = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
let failures = 0;
const check = (ok, msg)=>{ console.log((ok ? '  ok   ' : '  FAIL ') + msg); if(!ok) failures++; };

(async ()=>{
  for(const engine of ['chromium', 'webkit']){
    console.log(engine);
    const browser = await pw[engine].launch();
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true });
    await ctx.addInitScript(()=>{ localStorage.clear(); localStorage.setItem('pb_tutorialSeen', '1'); });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(BASE + 'play.html?level=medium');
    await page.waitForTimeout(500);

    // Touch pointer events, sent to whatever is under the point (like a finger)
    await page.evaluate(()=>{
      window.touch = (type, x, y, id)=>{
        const el = document.elementFromPoint(x, y) || document.body;
        const ev = new PointerEvent(type, { clientX:x, clientY:y, pointerId:id, pointerType:'touch', isPrimary: id === 1, bubbles:true, cancelable:true, button:0 });
        el.dispatchEvent(ev);
      };
      window.centre = sel=>{ const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; };
      window.ghosts = ()=>document.querySelectorAll('#pieces-layer .ghost').length;
    });
    const ghosts = ()=>page.evaluate(()=>ghosts());
    const placed = ()=>page.evaluate(()=>placedPieces.filter(p=>!p.locked).length);
    // Start dragging the n-th piece at the top towards the board's middle, without letting go
    const startDrag = (n, id)=>page.evaluate(([n, id])=>{
      const [x, y] = centre(`.tray-slot:nth-child(${n}) .piece-box`);
      const [bx, by] = centre('#board');
      touch('pointerdown', x, y, id);
      for(let i = 1; i <= 8; i++) touch('pointermove', x + (bx - x)*i/8, y + (by - y)*i/8, id);
      return [bx, by];
    }, [n, id]);

    // 1. Second finger mid-drag
    await startDrag(1, 1);
    check(await ghosts() === 1, 'dragging: one lifted copy');
    await page.evaluate(()=>{ const [x, y] = centre('.tray-slot:nth-child(3) .piece-box'); touch('pointerdown', x, y, 2); touch('pointerup', x, y, 2); });
    check(await ghosts() === 1, 'second finger lands on another piece: still one lifted copy');
    await page.evaluate(()=>{ const [x, y] = centre('#board'); touch('pointerup', x, y, 1); });
    await page.waitForTimeout(400);
    check(await ghosts() === 0, 'first finger lifts: no lifted copy left');
    check(await placed() === 1, 'and the piece it held is on the board');

    // 2. Finger-up lost, then a new touch on a piece a while later
    await page.click('#reset-btn').catch(()=>{});
    await page.evaluate(()=>{ document.getElementById('reset-confirm').click(); });
    await startDrag(1, 3);
    await page.waitForTimeout(1700);           // (no more events from that finger)
    await page.evaluate(()=>{ const [x, y] = centre('.tray-slot:nth-child(2) .piece-box'); touch('pointerdown', x, y, 4); });
    check(await ghosts() === 0, 'lost finger-up, then a new touch: the old lifted copy is gone');
    await page.evaluate(()=>{ const [x, y] = centre('.tray-slot:nth-child(2) .piece-box'); touch('pointerup', x, y, 4); });
    await page.waitForTimeout(400);
    check(await ghosts() === 0 && await placed() === 0, 'nothing left over, nothing placed by accident');

    // 3. Safari cancels the touch mid-drag
    await startDrag(1, 5);
    await page.evaluate(()=>{ const [x, y] = centre('#board'); touch('pointercancel', x, y, 5); });
    await page.waitForTimeout(300);
    check(await ghosts() === 0, 'cancelled touch: no lifted copy');
    check(await page.evaluate(()=>!document.querySelector('.tray-slot:nth-child(1)').classList.contains('used')), 'and the piece is back at the top');
    // (a piece on the board stays put when its drag is cancelled)
    await startDrag(1, 6);
    await page.evaluate(()=>{ const [x, y] = centre('#board'); touch('pointerup', x, y, 6); });
    await page.waitForTimeout(400);
    const before = await page.evaluate(()=>JSON.stringify(placedPieces.map(p=>[p.row, p.col])));
    await page.evaluate(()=>{ const [x, y] = centre('.placed-piece .blk'); touch('pointerdown', x, y, 7);
      for(let i = 1; i <= 6; i++) touch('pointermove', x + 20*i, y + 10*i, 7); touch('pointercancel', x + 120, y + 60, 7); });
    await page.waitForTimeout(300);
    check(await page.evaluate(()=>JSON.stringify(placedPieces.map(p=>[p.row, p.col]))) === before && await ghosts() === 0,
      'cancelled drag of a placed piece: it stays where it was, no copy');
    check(await page.evaluate(()=>[...document.querySelectorAll('.placed-piece')].every(el=>el.style.visibility !== 'hidden')), 'and it is visible');

    // 4. The page is hidden mid-drag
    await startDrag(2, 8);
    await page.evaluate(()=>{ Object.defineProperty(document, 'hidden', { value:true, configurable:true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(200);
    check(await ghosts() === 0, 'page hidden mid-drag: no lifted copy');
    await page.screenshot({ path: `ghost-${engine}.png` });
    check(errors.length === 0, 'no page errors ' + errors.join('; '));
    await browser.close();
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
