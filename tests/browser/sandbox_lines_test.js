// Sandbox (2026-11-19): straight dotted lines + the highlighter
//   • Line mode: press on the gap between two squares and drag along it →
//     a straight dotted line (draft.dottedLines); starting on one erases
//   • the game won't let a piece cross it; the solver leaves out tilings
//     that would
//   • the highlighter: shown and working in Play mode, hidden in the others
// Run with:  node sandbox_lines_test.js   (screenshots: sandbox-lines-*.png)
const { chromium } = require('playwright');
const { BASE, check, finish } = require('./lib');

(async ()=>{
  const browser = await chromium.launch(), errors = [];
  for(const [name, viewport] of [['laptop', { width:1280, height:900 }], ['phone', { width:390, height:844 }]]){
    const ctx = await browser.newContext({ viewport, hasTouch: name === 'phone' });
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
    check(`${name}: an old draft gets an empty list of lines`, await page.evaluate(()=>draft.dottedLines), []);

    // The middle of the gap between two squares
    const cellRect = (r, c)=>page.evaluate(([r, c])=>{
      const b = document.querySelector(`#board .board-cell[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
    }, [r, c]);
    const gapV = async (r, c)=>{ const a = await cellRect(r, c-1), b = await cellRect(r, c); return { x:(a.right + b.left)/2, y:(a.top + a.bottom)/2 }; };
    const gapH = async (r, c)=>{ const a = await cellRect(r-1, c), b = await cellRect(r, c); return { x:(a.left + a.right)/2, y:(a.bottom + b.top)/2 }; };
    const drag = async (from, to)=>{
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move((from.x + to.x)/2, (from.y + to.y)/2, { steps: 4 });
      await page.mouse.move(to.x, to.y, { steps: 4 }); await page.mouse.up();
      await page.waitForTimeout(150);
    };
    const lines = ()=>page.evaluate(()=>draft.dottedLines.slice().sort());
    const drawn = ()=>page.evaluate(()=>document.querySelectorAll('#hint-overlay .dotted-line').length);

    // (phones: the panel comes first, the game below it)
    const toBoard = ()=>page.evaluate(()=>document.getElementById('board').scrollIntoView({ block:'center' }));

    // ── Highlighter in Play mode ──
    await toBoard();
    check(`${name}: highlighter shown in Play`, await page.isVisible('#hl-tool .hl-pencil'), true);
    await page.click('#hl-tool .hl-pencil');
    const c = await cellRect(5, 5);
    await page.mouse.click((c.left + c.right)/2, (c.top + c.bottom)/2); await page.waitForTimeout(100);
    check(`${name}: tapping a square highlights it`, await page.evaluate(()=>getMarks()), { '5,5': 0 });
    await page.click('#hl-tool .hl-pencil');      // (off again)

    // ── Line mode ──
    await page.click('#mode-seg button[data-mode="line"]');
    check(`${name}: highlighter hidden in Line mode`, await page.isVisible('#hl-tool .hl-pencil'), false);
    await toBoard();
    // Down the gap between columns 3 and 4 (grid line 3), rows 1 → 6
    await drag(await gapV(0, 3), await gapV(5, 3));
    check(`${name}: a straight line down`, await lines(), ['v,3,0','v,3,1','v,3,2','v,3,3','v,3,4','v,3,5']);
    check(`${name}: drawn on the board`, await drawn(), 6);
    // Across between rows 2 and 3, columns 1 → 3
    await drag(await gapH(2, 0), await gapH(2, 2));
    check(`${name}: a straight line across`, (await lines()).filter(k=>k[0]==='h'), ['h,2,0','h,2,1','h,2,2']);
    // Starting on a line erases (rows 3 → 4 of the line down)
    await drag(await gapV(2, 3), await gapV(3, 3));
    check(`${name}: dragging on a line erases it`, (await lines()).filter(k=>k[0]==='v'), ['v,3,0','v,3,1','v,3,4','v,3,5']);
    check(`${name}: highlight kept while editing`, await page.evaluate(()=>getMarks()), { '5,5': 0 });
    await page.screenshot({ path: `sandbox-lines-${name}.png` });

    // ── The rule: no piece across a line ──
    const rule = await page.evaluate(()=>({
      across: crossesDottedLine([[0,0],[0,1],[0,2],[0,3],[0,4]], 0, 0),   // I along row 1, over 'v,3,0'
      below:  crossesDottedLine([[0,0],[0,1],[0,2],[0,3],[0,4]], 2, 0),   // I along row 3: that part was erased
      down:   crossesDottedLine([[0,0],[1,0],[2,0],[3,0],[4,0]], 0, 1),   // I down column 2, over 'h,2,1'
      clear:  crossesDottedLine([[0,0],[1,0],[2,0],[3,0],[4,0]], 0, 4),   // I down column 5: nothing in the way
    }));
    check(`${name}: game rule`, rule, { across: true, below: false, down: true, clear: false });

    // ── Back to Play: highlighter back ──
    await page.click('#mode-seg button[data-mode="play"]');
    check(`${name}: highlighter back in Play`, await page.isVisible('#hl-tool .hl-pencil'), true);

    // ── Solver: no tiling crosses a line, and it finds fewer ──
    const solved = await page.evaluate(()=>{
      const base = { rows:6, cols:6, blocked:[], pieces:['L','I','X','N','P','U'].map(n=>({ name:n })) };
      const lines = ['v,3,0','v,3,1','v,3,2','v,3,3','v,3,4','v,3,5'];
      const free = ParitySolver.analyzePuzzle(base);
      const walled = ParitySolver.analyzePuzzle(Object.assign({ lines }, base));
      const crosses = walled.tilings.some(t=>t.placements.some(p=>p.cells.some(([r,c])=>c===2) && p.cells.some(([r,c])=>c===3)));
      return { fewer: walled.totalTilings < free.totalTilings, crosses };
    });
    check(`${name}: solver finds fewer tilings with a wall`, solved.fewer, true);
    check(`${name}: no solver tiling crosses the wall`, solved.crosses, false);

    // ── Clear board removes lines and highlights ──
    await page.click('#clear-btn'); await page.click('#clear-board'); await page.waitForTimeout(150);
    check(`${name}: Clear board removes lines`, await lines(), []);
    check(`${name}: Clear board removes highlights`, await page.evaluate(()=>getMarks()), {});
    await ctx.close();
  }
  await browser.close();
  finish(errors);
})();
