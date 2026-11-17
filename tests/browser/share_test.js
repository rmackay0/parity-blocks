// The Share button in the Solved popup (2026-11-02): solves each level on a
// laptop, presses Share and reads what was copied: the level's colored
// square (🟦 🟨 🟥), the level, the day and the time, and nothing else.
// Run with:  node share_test.js
const { chromium } = require('playwright');
const { BASE, solution, check, finish } = require('./lib');

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

  for(const [level, icon, name] of [['easy', '🟦', 'Easy'], ['medium', '🟨', 'Medium'], ['hard', '🟥', 'Hard']]){
    const answer = solution(level);      // (worked out first: Hard takes the solver a second)
    await page.goto(BASE + 'play.html?level=' + level); await page.waitForTimeout(300);
    await page.evaluate(ps=>{
      placedPieces = ps.map((p, i)=>({ id:'t' + i, color: puzzle.pieces.find(d=>d.name === p.name).color, ...p }));
      renderAll();
    }, answer);
    await page.waitForTimeout(300);
    await page.click('#solved-share');
    await page.waitForTimeout(100);
    // (the time: any m:ss, since a slow machine can tick past 0:00)
    const copied = await page.evaluate(()=>window.__copied);
    check(`${level}: copied`, copied && copied.replace(/\d+:\d\d$/, 'm:ss'), `Parity Blocks ${icon} ${name}\n${today} · m:ss`);
    check(`${level}: button says`, await page.textContent('#solved-share'), 'Copied!');
  }
  await browser.close();
  finish(errors);
})();
