// Sandbox Analyze (2026-11-08, solver.js analyzeFast):
//   • over 1,000 tilings: "Tilings" says 1,000+, only the parity-passing
//     tilings are listed (the "Parity-passing only" box is ticked and
//     can't be unticked, with a note why)
//   • 1,000 or fewer: the exact number, and every tiling can be flipped through
// Run with:  node sandbox_analyze_test.js
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
const CELLS = {
  F:[[0,1],[0,2],[1,0],[1,1],[2,1]], L:[[0,0],[1,0],[2,0],[3,0],[3,1]], N:[[0,1],[1,1],[2,0],[2,1],[3,0]],
  P:[[0,0],[0,1],[1,0],[1,1],[2,0]], T:[[0,0],[0,1],[0,2],[1,1],[2,1]], U:[[0,0],[0,2],[1,0],[1,1],[1,2]],
  W:[[0,0],[1,0],[1,1],[2,1],[2,2]],
};

let failures = 0;
function check(label, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (expected ' + JSON.stringify(want) + ')'}`);
}

async function analyze(browser, size, names){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  await ctx.addInitScript(([size, pieces])=>{
    localStorage.setItem('pb_sandboxDraft', JSON.stringify({ title:'Test', rows:size, cols:size, removed:[],
      blocked:[], hintOutline:[], hintText:'', pieces }));
  }, [size, names.map(n=>({ name:n, cells:CELLS[n] }))]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(BASE + 'sandbox.html', { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>typeof draft !== 'undefined' && document.querySelectorAll('#tray .tray-slot').length > 0);
  await page.click('#analyze-btn');
  await page.waitForSelector('#results:not([hidden])', { timeout: 60000 });
  const read = async ()=>({
    total: await page.textContent('#stat-total'),
    pass: await page.textContent('#stat-pass'),
    boxTicked: await page.isChecked('#parity-only'),
    boxLocked: await page.isDisabled('#parity-only'),
    noteShown: await page.isVisible('#parity-only-note'),
    step: await page.textContent('#step-label'),
    piecesShown: await page.locator('#pieces-layer .placed-piece').count(),
  });
  return { page, ctx, errors, read };
}

(async ()=>{
  const browser = await chromium.launch();

  // Over 1,000 tilings (355,344; 456 pass parity)
  let a = await analyze(browser, 6, ['F','L','N','P','T','U']);
  check('big: what the panel shows', await a.read(),
    { total:'1,000+', pass:'456', boxTicked:true, boxLocked:true, noteShown:true, step:'1 of 456', piecesShown:6 });
  await a.page.click('#next-btn'); await a.page.waitForTimeout(150);
  check('big: next solution', await a.page.textContent('#step-label'), '2 of 456');
  check('big: no page errors', a.errors, []);
  await a.ctx.close();

  // 1,000 or fewer (704 tilings): every one can be seen
  a = await analyze(browser, 5, ['F','W','T']);
  const small = await a.read();
  check('small: exact count, box can be unticked', [small.total, small.boxLocked, small.noteShown], ['704', false, false]);
  await a.page.uncheck('#parity-only'); await a.page.waitForTimeout(150);
  check('small: all tilings to flip through', await a.page.textContent('#step-label'), '1 of 704');
  check('small: no page errors', a.errors, []);
  await a.ctx.close();

  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
