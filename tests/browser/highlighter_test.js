// The highlighter on the puzzle page (user, 2026-11-05).
// Laptop + phone, light + dark, in Chromium and WebKit (Safari's engine):
//   - the pencil sits above and to the right of the rightmost piece in the
//     top row, on screen, clear of the top buttons and the pieces
//   - pencil on → shaded, the color dot + ▾ appears; off → it hides
//   - tap = highlight, tap again = clear, another color = switch
//   - dragging across squares highlights each one
//   - highlights survive a reload; Reset clears them
//   - pieces still drag onto the board with the pencil on
// Run:  node highlighter_test.js    (pictures: hl-*.png in this folder)
const pw = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
let failures = 0;
const check = (ok, msg)=>{ if(!ok){ failures++; console.log('  FAIL ' + msg); } };
const overlap = (a, b)=>a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

(async ()=>{
  for(const engine of ['chromium', 'webkit']){
    const browser = await pw[engine].launch();
    for(const [w, h, dev, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]])
    for(const theme of ['light', 'dark']){
      const label = `${engine}-${dev}-${theme}`;
      console.log(label);
      const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:touch, isMobile:touch });
      await ctx.addInitScript(t=>{ if(!sessionStorage.getItem('x')){ localStorage.clear(); sessionStorage.setItem('x', '1'); }
        localStorage.setItem('pb_tutorialSeen', '1'); localStorage.setItem('pb_theme', t); }, theme);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e=>errors.push(e.message));
      await page.goto(BASE + 'play.html?level=medium');
      await page.waitForTimeout(500);
      const tap = async loc=>{ if(touch) await loc.tap(); else await loc.click(); };

      // Where it sits
      const tool = await page.locator('#hl-tool').boundingBox();
      const pencil = await page.locator('.hl-pencil').boundingBox();
      // (the top row: every piece space that starts above the end of the shortest one)
      const slots = await page.locator('.tray-slot').evaluateAll(els=>els.map(e=>{
        const s = e.getBoundingClientRect(), p = e.querySelector('.piece-box').getBoundingClientRect();
        return { top:s.top, bottom:s.bottom, pTop:p.top, pRight:p.right };
      }));
      const firstEnd = Math.min(...slots.map(s=>s.bottom));
      const topRow = slots.filter(s=>s.top < firstEnd);
      const rightEdge = Math.max(...topRow.map(s=>s.pRight)), highest = Math.min(...topRow.map(s=>s.pTop));
      check(tool.x >= 0 && tool.x + tool.width <= w, 'tool on screen');
      check(pencil.y + pencil.height <= highest, 'pencil above every piece in the top row');
      const clamped = tool.x + tool.width >= w - 40;   // (squeezed in from the screen's edge)
      check(pencil.x >= rightEdge - 1 || clamped, `pencil right of the rightmost top piece (${pencil.x} vs ${rightEdge})`);
      check(pencil.x >= rightEdge - 120, 'pencil near the rightmost top piece');
      for(const sel of ['.back-btn', '.theme-toggle', '.reset-btn', '.rules-btn'])
        check(!overlap(tool, await page.locator(sel).boundingBox()), 'tool clear of ' + sel);
      const pieceBoxes = await page.locator('.tray-slot .piece-box').evaluateAll(els=>els.map(e=>{ const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; }));
      check(!pieceBoxes.some(b=>overlap(pencil, b)), 'pencil clear of the pieces');
      check(!(await page.locator('.hl-color').evaluate(e=>getComputedStyle(e).visibility === 'visible')), 'no color dot while off');
      // It stays put when pieces are turned (user, 2026-11-05)
      const toolAt = ()=>page.locator('#hl-tool').evaluate(e=>Math.round(e.getBoundingClientRect().left) + ',' + Math.round(e.getBoundingClientRect().top));
      const start = await toolAt();
      const nSlots = await page.locator('.tray-slot').count();
      for(let i = 0; i < nSlots; i++){ await tap(page.locator('.tray-slot').nth(i)); await page.waitForTimeout(330); }
      check(await toolAt() === start, `doesn't move when every piece is rotated (${start} → ${await toolAt()})`);
      for(let i = 0; i < nSlots; i++){ await (touch ? (async()=>{ const s = page.locator('.tray-slot').nth(i); await s.tap(); await page.waitForTimeout(60); await s.tap(); })() : page.locator('.tray-slot').nth(i).dblclick()); await page.waitForTimeout(350); }
      check(await toolAt() === start, `doesn't move when every piece is reflected (${await toolAt()})`);

      // On
      await tap(page.locator('.hl-pencil'));
      check(await page.locator('.hl-pencil.on').count() === 1, 'pencil shaded when on');
      check(await page.locator('.hl-color').evaluate(e=>getComputedStyle(e).visibility === 'visible'), 'color dot shows when on');
      const cell = (r, c)=>page.locator(`#board .board-cell[data-r="${r}"][data-c="${c}"]`);
      const markOf = (r, c)=>cell(r, c).evaluate(e=>e.classList.contains('marked') ? e.style.getPropertyValue('--mark') : null);
      await tap(cell(0, 0));
      check(await markOf(0, 0) === 'var(--hl-0)', 'tap highlights in the first color');
      await tap(cell(0, 0));
      check(await markOf(0, 0) === null, 'tap again clears');
      await tap(cell(0, 0));
      await tap(page.locator('.hl-color'));
      check(await page.locator('.hl-menu').isVisible(), 'menu opens');
      await page.screenshot({ path: `hl-${label}-menu.png` });
      const swatches = page.locator('.hl-swatch');
      check(await swatches.count() === 4, 'four colors');
      await tap(swatches.nth(2));
      check(!(await page.locator('.hl-menu').isVisible()), 'menu closes after picking');
      await tap(cell(0, 0));
      check(await markOf(0, 0) === 'var(--hl-2)', 'tap with another color switches');
      await tap(cell(0, 0));
      check(await markOf(0, 0) === null, 'then tap again clears');

      // Drag across a row
      const a = await cell(2, 1).boundingBox(), b = await cell(2, 4).boundingBox();
      if(touch){
        // (a touch drag through the page's own pointer events)
        await page.evaluate(([a, b])=>{
          const fire = (type, x, y, el)=>(el || document.elementFromPoint(x, y)).dispatchEvent(new PointerEvent(type, { clientX:x, clientY:y, bubbles:true, pointerType:'touch', isPrimary:true, button:0 }));
          const y = a.y + a.height/2;
          fire('pointerdown', a.x + a.width/2, y);
          for(let i = 1; i <= 10; i++){ const x = a.x + a.width/2 + (b.x - a.x) * i/10; window.dispatchEvent(new PointerEvent('pointermove', { clientX:x, clientY:y, pointerType:'touch' })); }
          window.dispatchEvent(new PointerEvent('pointerup', { clientX:b.x, clientY:y, pointerType:'touch' }));
        }, [a, b]);
      } else {
        await page.mouse.move(a.x + a.width/2, a.y + a.height/2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width/2, b.y + b.height/2, { steps: 12 });
        await page.mouse.up();
      }
      const row = await Promise.all([1, 2, 3, 4].map(c=>markOf(2, c)));
      check(row.every(m=>m === 'var(--hl-2)'), 'drag highlights each square: ' + row.join(' '));

      // A piece still drags onto the board with the pencil on
      const slot = await page.locator('.tray-slot').first().boundingBox();
      const target = await cell(4, 2).boundingBox();
      await page.mouse.move(slot.x + slot.width/2, slot.y + slot.height/2);
      await page.mouse.down();
      await page.mouse.move(target.x + 10, target.y + 10, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      if(!touch) check(await page.locator('.placed-piece').count() === 1, 'piece placed with the pencil on');
      check(await toolAt() === start, `doesn't move when a piece is placed (${await toolAt()})`);
      await page.screenshot({ path: `hl-${label}.png` });

      // Saved
      await page.reload();
      await page.waitForTimeout(500);
      check(await markOf(2, 3) === 'var(--hl-2)', 'highlights come back after a reload');
      // Reset clears them
      await tap(page.locator('#reset-btn'));
      await tap(page.locator('#reset-confirm'));
      check(await page.locator('#board .board-cell.marked').count() === 0, 'Reset clears the highlights');
      check(!errors.length, 'no page errors: ' + errors.join('; '));
      await ctx.close();
    }
    await browser.close();
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
