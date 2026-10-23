// Checks the four fixes from the 2026-10-20 review, on a laptop and a phone:
//   1. empty spaces turn dark once every piece is on the grid
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
    const dark = ()=>page.locator('.board-cell.gap-dark').count();
    const visible = id=>page.evaluate(i=>!document.getElementById(i).hidden, id);

    // 1. Empty spaces: normal until every piece is down, dark once it is (wrong or right)
    await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(300);
    await place(page, sol.slice(0, 5));
    check('5 of 6 pieces placed: dark squares', await dark(), 0);
    await place(page, sol.map((p, i)=>i === 0 ? { ...p, col: p.col + 1 } : p));
    check('all placed, wrong board: board glows red', await page.evaluate(()=>document.getElementById('board-outer').classList.contains('uneven') || !!document.querySelector('.placed-piece.invalid')), true);
    check('all placed, wrong board: some squares dark', (await dark()) > 0, true);
    await place(page, sol);
    await page.waitForTimeout(200);
    check('solved: dark squares (36 - 4 X - 30 blocks)', await dark(), 2);
    await page.screenshot({ path:`solved-${label}-popup.png` });

    // 2. Solved: popup, "Solved in" where the pieces were, and the board is locked
    check('solved: popup shown', await visible('solved-popup'), true);
    await page.click('#solved-close'); await page.waitForTimeout(200);
    check('solved: badge', await page.textContent('#solved-badge'), '✓ Solved in 0:00');
    check('solved: badge visible', await visible('solved-badge'), true);
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
    check('reopened: badge visible', await visible('solved-badge'), true);
    check('reopened: dark squares', await dark(), 2);
    check('reopened: board locked', await page.evaluate(()=>document.getElementById('board-outer').classList.contains('locked')), true);
    check('reopened: stars', await page.evaluate(()=>loadSolves().length), 1);
    await page.screenshot({ path:`solved-${label}-reopened.png` });

    // Reset on a solved puzzle = play again
    await page.click('#reset-btn'); await page.waitForTimeout(150);
    check('Reset asks', await page.textContent('#reset-title'), 'Play again?');
    await page.click('#reset-confirm'); await page.waitForTimeout(200);
    check('after Reset: pieces on the board', await page.locator('.placed-piece').count(), 0);
    check('after Reset: badge visible', await visible('solved-badge'), false);
    check('after Reset: board locked', await page.evaluate(()=>document.getElementById('board-outer').classList.contains('locked')), false);
    await place(page, sol); await page.waitForTimeout(200);
    check('solved again: popup shown', await visible('solved-popup'), true);
    check('solved again: still one star', await page.evaluate(()=>loadSolves().length), 1);
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILED' : 'all passed') + ' | ' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors'));
})();
