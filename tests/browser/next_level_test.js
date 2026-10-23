// The Solved popup on the puzzle page, on a laptop and a phone:
//   - after Easy it offers "Play Medium →", after Medium "Play Hard →",
//     after Hard nothing (Menu is then the green button)
//   - the badge has room above the buttons
//   - the back button's arrow sits in the middle of its circle
// Run with:  node next_level_test.js
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

    for(const [level, wantText, wantHref] of [['easy', 'Play Medium →', 'play.html?level=medium'],
                                              ['medium', 'Play Hard →', 'play.html?level=hard'], ['hard', null, null]]){
      await page.goto(BASE + 'play.html?level=' + level); await page.waitForTimeout(300);
      check(`${level}: no caption under the board`, await page.isVisible('#hint-caption'), false);
      if(level === 'easy'){
        // The back button's arrow: centre of the drawn chevron vs centre of the circle
        const off = await page.evaluate(()=>{
          const b = document.querySelector('.back-btn').getBoundingClientRect(), p = document.querySelector('.back-btn path').getBoundingClientRect();
          return [Math.round((p.left + p.width/2) - (b.left + b.width/2)), Math.round((p.top + p.height/2) - (b.top + b.height/2))];
        });
        check('back arrow off centre by (x, y) px', off, [0, 0]);
        await page.screenshot({ path:`back-btn-${label}.png`, clip:{ x:0, y:0, width:120, height:80 } });
      }
      await page.evaluate(ps=>{
        placedPieces = ps.map((p, i)=>({ id:'t' + i, color: puzzle.pieces.find(d=>d.name === p.name).color, ...p }));
        renderAll();
      }, solution(level));
      await page.waitForTimeout(2400);     // (the badge animation has finished)
      const btn = await page.evaluate(()=>{ const b = document.getElementById('solved-next'); return b.hidden ? null : [b.textContent, b.getAttribute('href'), getComputedStyle(b).backgroundColor]; });
      check(`${level}: its color (the start screen's)`, btn && btn[2], { easy: 'rgb(217, 154, 78)', medium: 'rgb(125, 90, 120)', hard: null }[level]);
      check(`${level}: next-level button`, btn && btn[0], wantText);
      check(`${level}: it goes to`, btn && btn[1], wantHref);
      const gap = await page.evaluate(()=>{
        const badge = document.getElementById('solved-win').getBoundingClientRect();
        const below = document.querySelector('#solved-popup .next-level-btn:not([hidden])') || document.querySelector('#solved-popup .popup-buttons');
        return Math.round(below.getBoundingClientRect().top - badge.bottom);
      });
      check(`${level}: room between the time and the buttons ≥ 20px`, gap >= 20, true);
      await page.screenshot({ path:`next-${label}-${level}.png` });
      if(btn){
        await page.click('#solved-next'); await page.waitForTimeout(300);
        check(`${level}: clicking it opens`, page.url().split('/').pop(), wantHref);
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (failures ? failures + ' FAILED' : 'all passed') + (errors.length ? ' | ERRORS:\n' + errors.join('\n') : ' | no page errors'));
})();
