// The sandbox has no "Dotted square" mode any more (2026-11-03): the
// dotted line is the only dotted rule. Checks, on a draft that still has
// old dotted squares:
//   • there's no Dotted square button
//   • the note under Rows/Columns points out the old dotted squares
//   • in Dotted mode, clicking an old dotted square opens it, and clicking
//     it again adds it to the dotted area
// Run with:  node sandbox_dotted_test.js
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';

let failures = 0;
function check(label, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (expected ' + JSON.stringify(want) + ')'}`);
}

(async ()=>{
  const browser = await chromium.launch(), errors = [];
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  // A 6 x 6 draft with two old dotted squares
  await ctx.addInitScript(()=>{
    if(localStorage.getItem('pb_sandboxDraft')) return;
    localStorage.setItem('pb_sandboxDraft', JSON.stringify({ title:'Test', rows:6, cols:6, removed:[],
      blocked:[[1,1],[4,4]], hintOutline:[], hintText:'',
      pieces:[ { name:'I', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]] }, { name:'L', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] } ] }));
  });
  const page = await ctx.newPage();
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(BASE + 'sandbox.html'); await page.waitForTimeout(500);

  check('no Dotted square button', await page.locator('#mode-seg [data-mode="block"]').count(), 0);
  check('modes', await page.locator('#mode-seg button').allTextContents(), ['Play', 'Shape', 'Dotted']);
  check('note mentions the old dotted squares', (await page.textContent('#board-note')).includes('2 old dotted squares'), true);

  await page.click('#mode-seg [data-mode="dotted"]');
  const cell = (r, c)=>page.locator(`.board-cell[data-r="${r}"][data-c="${c}"]`);
  await cell(1, 1).click(); await page.waitForTimeout(200);
  let d = await page.evaluate(()=>({ blocked: draft.blocked, area: draft.hintOutline }));
  check('1st click: dotted square opened', d, { blocked: [[4,4]], area: [] });
  await cell(1, 1).click(); await page.waitForTimeout(200);
  d = await page.evaluate(()=>({ blocked: draft.blocked, area: draft.hintOutline }));
  check('2nd click: added to the dotted area', d, { blocked: [[4,4]], area: [[1,1]] });
  await cell(4, 4).click(); await page.waitForTimeout(200);
  check('note: 1 old dotted square left → none', (await page.textContent('#board-note')).includes('dotted square'), false);

  // Dark mode button (theme.js): switches the page, and is remembered
  await page.screenshot({ path:'sandbox-light.png' });
  await page.click('[data-theme-toggle]'); await page.waitForTimeout(400);
  check('dark mode button switches to dark', await page.evaluate(()=>document.documentElement.classList.contains('dark')), true);
  await page.screenshot({ path:'sandbox-dark.png' });
  await page.reload(); await page.waitForTimeout(400);
  check('dark mode remembered', await page.evaluate(()=>document.documentElement.classList.contains('dark')), true);
  await page.click('[data-theme-toggle]'); await page.waitForTimeout(200);
  check('and back to light', await page.evaluate(()=>document.documentElement.classList.contains('dark')), false);

  console.log(errors.length ? 'page errors: ' + errors.join(' | ') : 'no page errors');
  console.log(failures ? `${failures} FAILED` : 'all passed');
  await browser.close();
})();
