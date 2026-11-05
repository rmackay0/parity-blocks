// Screenshots of the new look (2026-11-02): start screen, a half-finished
// board, a close-up of the board, the win popup as it plays, the rules and
// the tutorial; in light and dark mode, on a laptop and a phone.
// Run with:  node look_screens.js          (pictures: look-*.png in this folder)
//            ONLY=laptop-light node look_screens.js   (just one of the four)
const { chromium } = require('playwright');
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');
const fs = require('fs');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
const src = fs.readFileSync('/Users/robertmackay/Projects/Parity Blocks/published.js', 'utf8');
const PUB = JSON.parse(src.split('/*JSON*/')[1].split('/*END*/')[0]);

// The real solution of a published puzzle, as game pieces {name, cells, row, col}
function solution(level){
  const p = PUB[level].puzzle;
  const res = S.analyzePuzzle({ rows:p.rows, cols:p.cols, blocked:p.blocked, removed:p.removed, dotted:p.hintOutline,
    pieces: p.pieces.map(d=>({ name:d.name, cells:d.cells })) });
  return res.tilings.find(t=>t.parity).placements.map(pl=>{
    const r0 = Math.min(...pl.cells.map(c=>c[0])), c0 = Math.min(...pl.cells.map(c=>c[1]));
    return { name:pl.piece, row:r0, col:c0, cells:pl.cells.map(([r,c])=>[r-r0, c-c0]) };
  });
}
const place = (page, pieces)=>page.evaluate(ps=>{
  placedPieces = ps.map((p, i)=>({ id:'t' + i, color: puzzle.pieces.find(d=>d.name === p.name).color, ...p }));
  renderAll();
}, pieces);

(async ()=>{
  const browser = await chromium.launch(), errors = [];
  for(const [w, h, device, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]])
  for(const theme of ['light', 'dark']){
    const label = device + '-' + theme;
    if(process.env.ONLY && process.env.ONLY !== label) continue;
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:touch, isMobile:touch });
    await ctx.addInitScript(t=>{
      localStorage.setItem('pb_tutorialSeen', '1');
      localStorage.setItem('pb_theme', t);
    }, theme);
    const page = await ctx.newPage();
    page.on('pageerror', e=>errors.push(label + ': ' + e.message));
    const shot = name=>page.screenshot({ path:`look-${label}-${name}.png` });

    await page.goto(BASE + 'index.html'); await page.waitForTimeout(400);
    await shot('splash');

    // Hard, half done, plus a close-up of the board
    const sol = solution('hard');
    await page.goto(BASE + 'play.html?level=hard'); await page.waitForTimeout(400);
    await place(page, sol.slice(0, 3)); await page.waitForTimeout(700);
    await shot('play');
    await page.locator('#board-outer').screenshot({ path:`look-${label}-board.png` });

    // Solve it and catch the win popup as it plays
    await place(page, sol);
    for(const ms of [300, 900, 1600, 3000]){
      await page.waitForTimeout(ms - (ms === 300 ? 0 : [300, 900, 1600, 3000][[300, 900, 1600, 3000].indexOf(ms) - 1]));
      await shot('win-' + ms);
    }

    await page.goto(BASE + 'index.html'); await page.waitForTimeout(300);
    await page.click('[data-open-rules]'); await page.waitForTimeout(400);
    await shot('rules');

    await page.goto(BASE + 'tutorial.html'); await page.waitForTimeout(400);
    await shot('tut1');
    await page.evaluate(()=>showSlide(3)); await page.waitForTimeout(800);
    await shot('tut4');
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
})();
