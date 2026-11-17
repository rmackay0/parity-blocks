// Plays the three published puzzles like a person would, on a laptop and a
// phone-sized window: start screen → level button → turn each piece with
// R / E while pointing at it → drag it onto the grid → the Solved popup.
// Then a few extra behaviors on the practice puzzle test-puzzle-1.
// Run: node play_test.js
const { chromium } = require('playwright');
const { BASE, S, solution, check, finish } = require('./lib');
const same = (a, b) => JSON.stringify(S.normalize(a)) === JSON.stringify(S.normalize(b));
const errors = [];
async function center(p, sel){ const b = await p.locator(sel).boundingBox(); return [b.x+b.width/2, b.y+b.height/2]; }
async function drag(p, from, to){
  await p.mouse.move(...from); await p.mouse.down();
  for(let i=1;i<=8;i++) await p.mouse.move(from[0]+(to[0]-from[0])*i/8, from[1]+(to[1]-from[1])*i/8);
  await p.mouse.up();
}

(async () => {
  const b = await chromium.launch();
  for (const level of ['easy', 'medium', 'hard']) {
    const answer = solution(level);
    for (const [w,h,n] of [[1280,800,'laptop'],[390,780,'phone']]) {
      const p = await b.newPage({ viewport:{width:w,height:h} });
      await p.addInitScript(()=>localStorage.setItem('pb_tutorialSeen','1'));   // skip the first-visit tutorial
      p.on('pageerror', e=>errors.push(`${level} ${n}: ${e.message}`));
      await p.goto(BASE+'index.html');
      await p.click(`[data-difficulty=${level}]`);
      await p.waitForURL('**/play.html?level='+level); await p.waitForTimeout(300);
      await p.evaluate(()=>document.fonts.ready);

      for (const s of answer) {
        // Point at the piece, then R rotates / E reflects until it matches the answer
        await p.hover(`.tray-slot[data-name="${s.name}"]`);
        for (let i = 0; i < 8 && !same(await p.evaluate(nm=>trayCells[nm], s.name), s.cells); i++)
          await p.keyboard.press(i === 3 ? 'e' : 'r');
        const tc = await p.evaluate(nm=>trayCells[nm], s.name);
        if (!same(tc, s.cells)) { check(`${level} ${n}: ${s.name} turned to the answer's way`, false, true); continue; }
        // Drag it so its middle square lands where the answer's middle square goes
        const rows = Math.max(...tc.map(c=>c[0]))+1, cols = Math.max(...tc.map(c=>c[1]))+1;
        const gr = Math.floor((rows-1)/2), gc = Math.floor((cols-1)/2);
        await drag(p, await center(p, `.tray-slot[data-name="${s.name}"]`),
                      await center(p, `.board-cell[data-r="${s.row+gr}"][data-c="${s.col+gc}"]`));
        await p.waitForTimeout(150);
        const st = await p.evaluate(nm=>{const pc=placedPieces.find(x=>x.name===nm);return pc&&[pc.row,pc.col,invalidIds.size]}, s.name);
        if (JSON.stringify(st) !== JSON.stringify([s.row, s.col, 0])) check(`${level} ${n}: ${s.name} placed (row, col, red pieces)`, st, [s.row, s.col, 0]);
      }
      await p.waitForTimeout(300);
      check(`${level} ${n}: Solved popup after playing it`, await p.evaluate(()=>!document.getElementById('solved-popup').hidden), true);
      await p.screenshot({path:`play-${level}-${n}-solved.png`});
      await p.close();
    }
  }

  // Extra behaviors on test-puzzle-1 (laptop)
  const p = await b.newPage({ viewport:{width:1280,height:800} });
  await p.addInitScript(()=>localStorage.setItem('pb_tutorialSeen','1'));
  p.on('pageerror', e=>errors.push(e.message));
  await p.goto(BASE+'play.html?puzzle=test-puzzle-1'); await p.waitForTimeout(300);
  check('no Reflect / Rotate buttons', await p.locator('#reflect-btn, #rotate-btn, .controls').count(), 0);
  // Place I flat on row 3, then R on the board: upright from row 3 runs off the grid → red
  const fromI = await center(p, '.tray-slot[data-name="I"]');
  await drag(p, fromI, await center(p, '.board-cell[data-r="3"][data-c="2"]')); await p.waitForTimeout(150);
  check('after placing I: on the board, none outlined, its slot used', await p.evaluate(()=>[placedPieces.length, document.querySelectorAll('.selected').length,
    document.querySelector('.tray-slot[data-name="I"]').classList.contains('used')]), [1, 0, true]);
  await p.keyboard.press('r');                                       // the mouse is still on I after the drop
  check('R on the board: I upright and red (runs off the grid)', await p.evaluate(()=>[Math.max(...placedPieces[0].cells.map(c=>c[0]))+1, invalidIds.size]), [5, 1]);
  await p.screenshot({path:'invalid.png'});
  // Drag it off the board, back to the top
  await drag(p, await center(p, '.placed-piece .blk >> nth=0'), fromI); await p.waitForTimeout(150);
  check('dragged back to the top: board empty, slot free', await p.evaluate(()=>[placedPieces.length,
    document.querySelector('.tray-slot[data-name="I"]').classList.contains('used')]), [0, false]);
  // Clicking a piece at the top or empty space never outlines anything
  await p.click('.tray-slot[data-name="X"]');
  await p.mouse.click(1200, 400);
  check('clicks never outline a piece', await p.locator('.selected').count(), 0);
  // Dropping a piece beside the board cancels the drop
  await drag(p, await center(p, '.tray-slot[data-name="X"]'), [1240, 700]); await p.waitForTimeout(150);
  check('dropped beside the board: not placed', await p.evaluate(()=>placedPieces.length), 0);
  await b.close();
  finish(errors);
})();
