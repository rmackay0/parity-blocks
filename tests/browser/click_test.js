// Clicking / tapping pieces: one click rotates (after a short wait), a double
// click reflects, a click then drag carries the rotated shape.  Run: node click_test.js
const { chromium } = require('playwright');
const { BASE, S, check, finish } = require('./lib');
const key = c => JSON.stringify(S.normalize(c));
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w,h,n,touch] of [[1280,800,'desk',false],[390,780,'phone',true]]) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, hasTouch:touch, isMobile:touch });
    await ctx.addInitScript(()=>localStorage.setItem('pb_tutorialSeen','1'));   // skip the first-visit tutorial
    const p = await ctx.newPage(); p.on('pageerror', e=>errs.push(e.message));
    await p.goto(BASE + 'play.html?level=hard');
    const tray = name=>p.evaluate(n=>trayCells[n], name);
    const L0 = await tray('L');
    const tap = sel => touch ? p.tap(sel) : p.click(sel);
    // single click on a tray piece -> rotated clockwise after the wait
    await tap('.tray-slot[data-name="L"]');
    const immediately = key(await tray('L')) === key(L0);
    await p.waitForTimeout(400);
    check(`${n} single click: waits first, then rotated clockwise, nothing outlined`,
      [immediately, key(await tray('L')) === key(rot(L0)), await p.locator('.selected').count()], [true, true, 0]);
    // double click -> reflected (from current)
    const before = await tray('L');
    await tap('.tray-slot[data-name="L"]'); await p.waitForTimeout(80); await tap('.tray-slot[data-name="L"]');
    await p.waitForTimeout(400);
    check(`${n} double click reflected`, key(await tray('L')) === key(refl(before)), true);
    // quick clicks on two different pieces -> each rotates once
    const I0 = await tray('I'), X0 = await tray('U');
    await tap('.tray-slot[data-name="I"]'); await p.waitForTimeout(60); await tap('.tray-slot[data-name="U"]'); await p.waitForTimeout(400);
    check(`${n} two pieces clicked quickly: I and U each rotated`, [key(await tray('I')) === key(rot(I0)), key(await tray('U')) === key(rot(X0))], [true, true]);
    // placed piece: drag P onto the board, then click it -> rotates on the board
    const s = await p.locator('.tray-slot[data-name="P"]').boundingBox(), t = await p.locator('.board-cell[data-r="2"][data-c="2"]').boundingBox();
    await p.mouse.move(s.x+s.width/2, s.y+s.height/2); await p.mouse.down();
    for(let i=1;i<=8;i++) await p.mouse.move(s.x+s.width/2+(t.x-s.x)*i/8, s.y+s.height/2+(t.y-s.y)*i/8); await p.mouse.up();
    const P0 = await p.evaluate(()=>placedPieces.find(q=>q.name==='P').cells);
    const blk = await p.locator('.placed-piece .blk').first().boundingBox();
    if(touch) await p.touchscreen.tap(blk.x+blk.width/2, blk.y+blk.height/2); else await p.mouse.click(blk.x+blk.width/2, blk.y+blk.height/2);
    await p.waitForTimeout(400);
    check(`${n} clicking a placed piece rotates it`, key(await p.evaluate(()=>placedPieces.find(q=>q.name==='P').cells)) === key(rot(P0)), true);
    // click then immediately drag a tray piece -> the drag carries the rotated shape
    const N0 = await tray('N');
    const ns = await p.locator('.tray-slot[data-name="N"]').boundingBox();
    await p.mouse.click(ns.x+ns.width/2, ns.y+ns.height/2);
    await p.mouse.move(ns.x+ns.width/2, ns.y+ns.height/2); await p.mouse.down();
    const tt = await p.locator('.board-cell[data-r="4"][data-c="4"]').boundingBox();
    for(let i=1;i<=8;i++) await p.mouse.move(ns.x+ns.width/2+(tt.x-ns.x)*i/8, ns.y+ns.height/2+(tt.y-ns.y)*i/8); await p.mouse.up();
    await p.waitForTimeout(400);
    const placedN = await p.evaluate(()=>{ const q = placedPieces.find(x=>x.name==='N'); return q && q.cells; });
    check(`${n} click-then-drag places the rotated N`, !!placedN && key(placedN) === key(rot(N0)), true);
    await ctx.close();
  }
  await b.close(); finish(errs);
})();
function rot(c){ const rows = Math.max(...c.map(x=>x[0]))+1; return S.normalize(c.map(([r,q])=>[q, rows-1-r])); }
function refl(c){ const cols = Math.max(...c.map(x=>x[1]))+1; return S.normalize(c.map(([r,q])=>[r, cols-1-q])); }
