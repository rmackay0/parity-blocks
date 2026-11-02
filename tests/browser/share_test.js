// The Share button in the Solved popup (2026-11-02): solves each level on a
// laptop, presses Share and reads what was copied: the level's colored
// circle (🟢 🟡 🟣), the level, the day and the time, and nothing else.
// Run with:  node share_test.js
const { chromium } = require('playwright');
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');
const fs = require('fs');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
const src = fs.readFileSync('/Users/robertmackay/Projects/Parity Blocks/published.js', 'utf8');
const PUB = JSON.parse(src.split('/*JSON*/')[1].split('/*END*/')[0]);

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
  const ctx = await browser.newContext({ viewport:{ width:1280, height:800 } });
  await ctx.addInitScript(()=>{
    localStorage.setItem('pb_tutorialSeen', '1');
    // (a stand-in clipboard, since the page is opened as a file)
    navigator.clipboard.writeText = t=>{ window.__copied = t; return Promise.resolve(); };
  });
  const page = await ctx.newPage();
  page.on('pageerror', e=>errors.push(e.message));
  const today = await page.evaluate(()=>new Date().toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }));

  for(const [level, icon, name] of [['easy', '🟢', 'Easy'], ['medium', '🟡', 'Medium'], ['hard', '🟣', 'Hard']]){
    await page.goto(BASE + 'play.html?level=' + level); await page.waitForTimeout(300);
    await page.evaluate(ps=>{
      placedPieces = ps.map((p, i)=>({ id:'t' + i, color: puzzle.pieces.find(d=>d.name === p.name).color, ...p }));
      renderAll();
    }, solution(level));
    await page.waitForTimeout(300);
    await page.click('#solved-share');
    await page.waitForTimeout(100);
    check(`${level}: copied`, await page.evaluate(()=>window.__copied), `Parity Blocks ${icon} ${name}\n${today} · 0:00`);
    check(`${level}: button says`, await page.textContent('#solved-share'), 'Copied!');
  }
  await browser.close();
  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
  console.log(failures ? failures + ' FAILED' : 'all passed');
})();
