const { chromium } = require('playwright');
const sol = require('./solutions.json');
const base = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
const norm = c => JSON.stringify(c.map(x=>x.join(',')).sort());
const errors = [];
async function center(p, sel){ const b = await p.locator(sel).boundingBox(); return [b.x+b.width/2, b.y+b.height/2]; }
async function drag(p, from, to){
  await p.mouse.move(...from); await p.mouse.down();
  for(let i=1;i<=8;i++) await p.mouse.move(from[0]+(to[0]-from[0])*i/8, from[1]+(to[1]-from[1])*i/8);
  await p.mouse.up();
}
(async () => {
  const b = await chromium.launch();
  for (const [btn, key, lvl] of [['hard','test-puzzle-1','hard'],['medium','test-puzzle-2','medium']]) {
    for (const [w,h,n] of [[1280,800,'desk'],[390,780,'phone']]) {
      const p = await b.newPage({ viewport:{width:w,height:h} });
      await p.addInitScript(()=>localStorage.setItem('pb_tutorialSeen','1'));   // skip the first-visit tutorial
      p.on('pageerror', e=>errors.push(e.message));
      await p.goto(base+'index.html'); if(await p.locator('.rules-backdrop:not([hidden])').count()) await p.click('.rules-ok');
      await p.click(`[data-difficulty=${btn}]`);
      await p.waitForURL('**/play.html?level='+lvl); await p.waitForTimeout(150); if(await p.locator('.rules-backdrop:not([hidden])').count()) await p.click('.rules-ok');
      await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(300);
      await p.screenshot({path:`${key}-${n}-start.png`});
      const layout = await p.evaluate(()=>({cell:CELL, scrollH:document.documentElement.scrollHeight, vh:innerHeight,
        btns:[...document.querySelectorAll('.controls button')].map(x=>{const r=x.getBoundingClientRect();return [x.textContent,Math.round(r.left),Math.round(r.bottom)]}),
        board:(r=>[Math.round(r.left),Math.round(r.right),Math.round(r.width)])(document.getElementById('board-outer').getBoundingClientRect())}));
      console.log(key, n, JSON.stringify(layout));

      for (const s of sol[key]) {
        await p.hover(`.tray-slot[data-name="${s.name}"]`);          // point at it, then E reflects / R rotates
        for(let i=0;i<s.f;i++) await p.keyboard.press('e');
        for(let i=0;i<s.k;i++) await p.keyboard.press('r');
        const tc = await p.evaluate(nm=>trayCells[nm], s.name);
        if(norm(tc)!==norm(s.cells)) errors.push(`${key} ${s.name} orientation mismatch`);
        const rows = Math.max(...tc.map(c=>c[0]))+1, cols = Math.max(...tc.map(c=>c[1]))+1;
        const gr = Math.floor((rows-1)/2), gc = Math.floor((cols-1)/2);
        const from = await center(p, `.tray-slot[data-name="${s.name}"]`);
        const to = await center(p, `.board-cell[data-r="${s.row+gr}"][data-c="${s.col+gc}"]`);
        await drag(p, from, to);
        const st = await p.evaluate(nm=>{const pc=placedPieces.find(x=>x.name===nm);return pc&&{row:pc.row,col:pc.col,inv:invalidIds.size}}, s.name);
        if(!st || st.row!==s.row || st.col!==s.col || st.inv) errors.push(`${key} ${n} ${s.name} placed wrong: ${JSON.stringify(st)}`);
      }
      const solved = await p.evaluate(()=>!document.getElementById('solved-popup').hidden);
      console.log(key, n, 'solved popup:', solved);
      if(!solved) errors.push(`${key} ${n} not solved`);
      await p.screenshot({path:`${key}-${n}-solved.png`});
      await p.close();
    }
  }

  // Extra behaviors on puzzle 1 (desktop)
  const p = await b.newPage({ viewport:{width:1280,height:800} });
  await p.addInitScript(()=>localStorage.setItem('pb_tutorialSeen','1'));   // skip the first-visit tutorial
  p.on('pageerror', e=>errors.push(e.message));
  await p.goto(base+'play.html?puzzle=test-puzzle-1'); if(await p.locator('.rules-backdrop:not([hidden])').count()) await p.click('.rules-ok');
  console.log('no Reflect/Rotate buttons:', await p.locator('#reflect-btn, #rotate-btn, .controls').count() === 0);
  // place I horizontally at row 0, then rotate on board -> vertical, still fits from (0,1)? check validity reported
  const fromI = await center(p, '.tray-slot[data-name="I"]');
  await drag(p, fromI, await center(p, '.board-cell[data-r="3"][data-c="2"]'));
  let s = await p.evaluate(()=>({n:placedPieces.length, outlined:document.querySelectorAll('.selected').length, used:document.querySelector('.tray-slot[data-name="I"]').classList.contains('used')}));
  console.log('after placing I:', JSON.stringify(s));
  await p.keyboard.press('r');                                       // mouse is still on I after the drop
  s = await p.evaluate(()=>({cells:placedPieces[0].cells.length, rows:Math.max(...placedPieces[0].cells.map(c=>c[0]))+1, invalid:[...invalidIds]}));
  console.log('after rotate on board (vertical I from row 3 should overflow):', JSON.stringify(s));
  await p.screenshot({path:'invalid.png'});
  // drag it off the board back to tray
  const pieceBox = await center(p, '.placed-piece .blk >> nth=0');
  await drag(p, pieceBox, fromI);
  s = await p.evaluate(()=>({n:placedPieces.length, trayI:trayCells.I, used:document.querySelector('.tray-slot[data-name="I"]').classList.contains('used')}));
  console.log('after dragging back to tray:', JSON.stringify(s));
  // clicking a piece at the top or empty space never outlines anything
  await p.click('.tray-slot[data-name="X"]');
  await p.mouse.click(1200, 400);
  console.log('outlined after clicks:', await p.locator('.selected').count(), '(expected 0)');
  // drop a piece off-board (beside the board) should cancel
  await drag(p, await center(p, '.tray-slot[data-name="X"]'), [1240, 700]);
  console.log('drop off-board count:', await p.evaluate(()=>placedPieces.length));
  // wrong full placement -> parity-odd highlight: place all pieces in solution positions but swap? simply use solution then move P one col
  await b.close();
  console.log(errors.length ? 'ERRORS:\n'+errors.join('\n') : 'no errors');
})();
