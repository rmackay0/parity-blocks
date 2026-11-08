// Sandbox (2026-11-08):
//   • the piece icons in the left panel are the same colors as the pieces
//     at the top and on the board (pieces not in the puzzle are grey)
//   • the Counts button shows the number of blocks in every row and column,
//     updates after each move, also shows a solution being viewed, and is
//     remembered after a reload
// Run with:  node sandbox_counts_test.js   (screenshots: sandbox-counts-*.png)
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
  for(const [name, viewport] of [['laptop', { width:1280, height:900 }], ['phone', { width:390, height:844 }]]){
    const ctx = await browser.newContext({ viewport });
    await ctx.addInitScript(()=>{
      if(localStorage.getItem('pb_sandboxDraft')) return;
      localStorage.setItem('pb_sandboxDraft', JSON.stringify({ title:'Test', rows:6, cols:6, removed:[],
        blocked:[], hintOutline:[], hintText:'',
        pieces:[
          { name:'L', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] }, { name:'I', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]] },
          { name:'X', cells:[[0,1],[1,0],[1,1],[1,2],[2,1]] }, { name:'N', cells:[[0,1],[1,1],[2,0],[2,1],[3,0]] },
          { name:'P', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] }, { name:'U', cells:[[0,0],[0,2],[1,0],[1,1],[1,2]] },
        ] }));
    });
    const page = await ctx.newPage();
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(BASE + 'sandbox.html'); await page.waitForTimeout(500);

    // ── Colors: panel icon = tray piece = color the game gives it ──
    const colors = await page.evaluate(()=>{
      const out = {};
      document.querySelectorAll('#picker .pick').forEach(el=>{
        out[el.textContent.trim()] = el.querySelector('path').getAttribute('fill');
      });
      return out;
    });
    const game = await page.evaluate(()=>pieceColors(draft));
    const tray = await page.evaluate(()=>{
      const out = {};
      document.querySelectorAll('#tray .tray-slot').forEach(s=>{
        const f = s.querySelector('[fill]:not([fill="none"])');
        out[s.dataset.name] = f && f.getAttribute('fill');
      });
      return out;
    });
    for(const n of ['L','I','X','N','P','U']){
      check(`${name}: ${n} panel = game color`, colors[n], game[n]);
      check(`${name}: ${n} tray = game color`, tray[n], game[n]);
    }
    check(`${name}: F (not in puzzle) is grey`, colors.F, '#9A9EA8');

    // Adding a piece gives its panel icon the same color as in the tray
    await page.click('#picker .pick:has-text("F")'); await page.waitForTimeout(200);
    const fNow = await page.evaluate(()=>[document.querySelector('#picker .pick:nth-child(1) path').getAttribute('fill'), pieceColors(draft).F]);
    check(`${name}: F added, panel = game color`, fNow[0], fNow[1]);
    await page.click('#picker .pick:has-text("F")'); await page.waitForTimeout(200);

    // ── Counts: off at first ──
    check(`${name}: no counts at first`, await page.locator('.live-count').count(), 0);
    await page.click('#counts-btn'); await page.waitForTimeout(200);
    check(`${name}: 6 + 6 counts`, await page.locator('.live-count').count(), 12);
    check(`${name}: all zero`, await page.locator('.live-count.zero').count(), 12);

    // Put the I piece across the top row (by code: dragging is tested elsewhere)
    await page.evaluate(()=>{
      placedPieces.push({ id:'t1', name:'I', color:'#000', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]], row:0, col:0 });
      renderAll();
    });
    const nums = await page.evaluate(()=>[...document.querySelectorAll('.live-count')].map(s=>s.textContent + ':' + s.className.split(' ')[1]));
    check(`${name}: rows after I`, nums.slice(0, 6), ['5:odd','0:zero','0:zero','0:zero','0:zero','0:zero']);
    check(`${name}: columns after I`, nums.slice(6), ['1:odd','1:odd','1:odd','1:odd','1:odd','0:zero']);

    // The numbers sit beside the board, on screen, without overlapping it
    const box = await page.evaluate(()=>{
      const b = document.getElementById('board').getBoundingClientRect();
      const s = [...document.querySelectorAll('.live-count')].map(e=>e.getBoundingClientRect());
      const rowsRight = s.slice(0, 6).every(r=>r.left > b.right);
      const colsBelow = s.slice(6).every(r=>r.top > b.bottom);
      // (on phones the game is below the panel, so measure against the game area)
      const g = document.querySelector('main.game').getBoundingClientRect();
      const onScreen = s.every(r=>r.right <= Math.min(innerWidth, g.right) && r.bottom <= g.bottom && r.left >= g.left);
      return { rowsRight, colsBelow, onScreen };
    });
    check(`${name}: placed beside the board, on screen`, box, { rowsRight:true, colsBelow:true, onScreen:true });
    await page.screenshot({ path: `sandbox-counts-${name}.png` });

    // Remembered after a reload
    await page.reload(); await page.waitForTimeout(500);
    check(`${name}: still on after reload`, [await page.getAttribute('#counts-btn', 'aria-pressed'), await page.locator('.live-count').count()], ['true', 12]);

    // Off again
    await page.click('#counts-btn'); await page.waitForTimeout(200);
    check(`${name}: off again`, await page.locator('.live-count').count(), 0);
    await ctx.close();
  }
  check('no page errors', errors, []);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
