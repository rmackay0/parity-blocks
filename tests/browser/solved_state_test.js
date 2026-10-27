// Checks the four fixes from the 2026-10-20 review, on a laptop and a phone:
//   1. (changed 2026-10-27) uncovered squares never change color, and each
//      dotted square has its own dotted line
//   2. a solved board is locked, and says "Solved in …" where the pieces were
//   3. reopening a solved puzzle shows it finished (no popup, no new star);
//      Reset plays it again, and solving it again adds no star
//   4. the pieces in each published puzzle all have different colors
// Run with:  node solved_state_test.js
const { chromium } = require('playwright');
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');
const fs = require('fs');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
const src = fs.readFileSync('/Users/robertmackay/Projects/Parity Blocks/published.js', 'utf8');
const PUB = JSON.parse(src.split('/*JSON*/')[1].split('/*END*/')[0]);

// The real solution of a published puzzle, as game pieces {name, cells, row, col}
function solution(level){
  const p = PUB[level].puzzle;
  const res = S.analyzePuzzle({ rows:p.rows, cols:p.cols, blocked:p.blocked, dotted:p.hintOutline,
    pieces: p.pieces.map(d=>({ name:d.name, cells:d.cells })) });
  return res.tilings.find(t=>t.parity).placements.map(pl=>{
    const r0 = Math.min(...pl.cells.map(c=>c[0])), c0 = Math.min(...pl.cells.map(c=>c[1]));
    return { name:pl.piece, row:r0, col:c0, cells:pl.cells.map(([r,c])=>[r-r0, c-c0]) };
  });
}
// Put pieces on the board as if the player had dragged them there
const place = (page, pieces)=>page.evaluate(ps=>{
  placedPieces = ps.map((p, i)=>({ id:'t' + i, color: puzzle.pieces.find(d=>d.name === p.name).color, ...p }));
  renderAll();
}, pieces);

let failures = 0;
function check(label, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (expected ' + JSON.stringify(want) + ')'}`);
}

(async ()=>{
  const browser = await chromium.launch(), errors = [];
  for(const [w, h, label, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]]){
    console.log(`\n── ${label} ──`);
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:touch, isMobile:touch });
    await ctx.addInitScript(()=>localStorage.setItem('pb_tutorialSeen', '1'));
    const page = await ctx.newPage();
    page.on('pageerror', e=>errors.push(label + ': ' + e.message));

    // 4. Every published puzzle: six different colors
    for(const level of ['easy', 'medium', 'hard']){
      await page.goto(BASE + 'play.html?level=' + level); await page.waitForTimeout(300);
      const colors = await page.evaluate(()=>puzzle.pieces.map(d=>d.color));
      check(`${level}: different piece colors`, new Set(colors).size, colors.length);
    }

    const sol = solution('hard');
    // How many different looks the board's squares have (1 = all the same)
    const looks = ()=>page.evaluate(()=>new Set([...document.querySelectorAll('.board-cell')].map(el=>{
      const s = getComputedStyle(el); return s.backgroundColor + ' ' + s.borderStyle + ' ' + s.borderColor;
    })).size);
    const visible = id=>page.evaluate(i=>!document.getElementById(i).hidden, id);

    // 1. Squares all look the same, before and after every piece is down;
    //    one dotted line per dotted square (+ one for the dotted area)
    await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(300);
    // Dotted lines: drawn, and never two on the same spot (shapes that touch share one line)
    check('dotted lines drawn', await page.evaluate(()=>document.querySelectorAll('#hint-overlay .dotted-line').length > 0), true);
    check('no dotted line drawn twice', await page.evaluate(()=>{
      const ds = [...document.querySelectorAll('#hint-overlay .dotted-line')].map(p=>p.getAttribute('d'));
      return new Set(ds).size === ds.length;
    }), true);
    check('no red X squares', await page.locator('.board-cell.blocked').count(), 0);
    await place(page, sol.slice(0, 5));
    check('5 of 6 pieces placed: squares all look the same', await looks(), 1);
    await place(page, sol.map((p, i)=>i === 0 ? { ...p, col: p.col + 1 } : p));
    check('all placed, wrong board: board glows red', await page.evaluate(()=>document.getElementById('board-outer').classList.contains('uneven') || !!document.querySelector('.placed-piece.invalid')), true);
    check('all placed, wrong board: squares all look the same', await looks(), 1);
    await place(page, sol);
    await page.waitForTimeout(200);
    check('solved: squares all look the same', await looks(), 1);
    await page.screenshot({ path:`solved-${label}-popup.png` });

    // 2. Solved: popup, nothing above the board, and the board is locked
    check('solved: popup shown', await visible('solved-popup'), true);
    check('solved: popup time', (await page.textContent('#solved-win')).includes('Your time: 0:00'), true);
    await page.click('#solved-close'); await page.waitForTimeout(200);
    check('solved: no "Solved in" above the board', await page.locator('.tray-area .win-badge').count(), 0);
    check('solved: popup has the animated badge', await page.locator('#solved-win .win-badge.animate').count(), 1);
    const before = await page.evaluate(()=>JSON.stringify(placedPieces.map(p=>[p.row, p.col, p.cells])));
    const piece = page.locator('.placed-piece .blk').first();      // (a piece's squares take the clicks)
    const box = await piece.boundingBox(), cx = box.x + box.width/2, cy = box.y + box.height/2;
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 120, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(400);
    await page.mouse.move(cx, cy); await page.keyboard.press('r'); await page.waitForTimeout(100);
    if(touch){ await piece.tap(); await page.waitForTimeout(400); } else { await piece.click(); await page.waitForTimeout(400); }
    check('solved: dragging, R and tapping change nothing', await page.evaluate(()=>JSON.stringify(placedPieces.map(p=>[p.row, p.col, p.cells]))), before);
    check('solved: star recorded', await page.evaluate(()=>loadSolves().length), 1);
    await page.screenshot({ path:`solved-${label}-badge.png` });

    // 3. Reopen: finished board, badge, no popup, still one star
    await page.reload(); await page.waitForTimeout(400);
    check('reopened: pieces on the board', await page.locator('.placed-piece').count(), 6);
    check('reopened: popup shown', await visible('solved-popup'), false);
    check('reopened: squares all look the same', await looks(), 1);
    check('reopened: board locked', await page.evaluate(()=>document.getElementById('board-outer').classList.contains('locked')), true);
    check('reopened: stars', await page.evaluate(()=>loadSolves().length), 1);
    await page.screenshot({ path:`solved-${label}-reopened.png` });

    // Reset on a solved puzzle = play again
    await page.click('#reset-btn'); await page.waitForTimeout(150);
    check('Reset asks', await page.textContent('#reset-title'), 'Play again?');
    await page.click('#reset-confirm'); await page.waitForTimeout(200);
    check('after Reset: pieces on the board', await page.locator('.placed-piece').count(), 0);
    check('after Reset: board locked', await page.evaluate(()=>document.getElementById('board-outer').classList.contains('locked')), false);
    await place(page, sol); await page.waitForTimeout(200);
    check('solved again: popup shown', await visible('solved-popup'), true);
    check('solved again: still one star', await page.evaluate(()=>loadSolves().length), 1);

    // 5. The timer: time asleep, in the background or in the tutorial doesn't count
    await page.goto(BASE + 'play.html?level=easy'); await page.waitForTimeout(300);
    const elapsed = ()=>page.evaluate(()=>Math.round((Date.now() - startTime) / 1000));
    // (Pretends ms passed since the last tick: both clocks move back)
    const pass = ms=>page.evaluate(ms=>{ startTime -= ms; lastTick -= ms; timerTick(); }, ms);
    await pass(10 * 60 * 1000);                                     // as if the laptop slept 10 min
    check('timer: 10 min asleep counts as ~1 s', (await elapsed()) <= 2, true);
    await page.evaluate(()=>openTutorial());
    await pass(5 * 60 * 1000);                                      // 5 min in the tutorial
    check('timer: time in the tutorial doesn\'t count', (await elapsed()) <= 2, true);
    await page.evaluate(()=>{ tutorialOverlay.hidden = true; timerTick(); });
    await page.waitForTimeout(2100);
    check('timer: counts again after the tutorial', (await elapsed()) >= 2, true);
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILED' : 'all passed') + ' | ' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors'));
})();
