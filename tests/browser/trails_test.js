// Marks left beside the board (user, 2026-11-05: "along the sides of the
// board ... the shadow behind the piece or the outline of the piece is
// leaving lines behind", seen in Safari).
// For each browser (Chromium, WebKit = Safari's engine, Firefox) on a
// laptop and a phone: screenshot the strips left and right of the board,
// drag pieces around over them (lifting, leaning, landing, sending back to
// the top), then screenshot the strips again. They must match exactly.
// Run:  node trails_test.js     (ONLY=webkit for one browser)
// Pictures of any difference: trails-*.png in this folder.
const pw = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';

const DEVICES = [
  { name:'laptop', viewport:{ width:1280, height:800 }, touch:false },
  { name:'phone',  viewport:{ width:390,  height:844 }, touch:true },
];

async function strips(page){
  const b = await page.locator('#board-outer').boundingBox();
  const vw = page.viewportSize().width;
  const top = Math.max(0, b.y - 30), height = b.height + 60;
  const left  = { x:0, y:top, width:Math.max(1, Math.floor(b.x) - 1), height };
  const rightX = Math.ceil(b.x + b.width) + 1;
  const right = { x:rightX, y:top, width:Math.max(1, vw - rightX), height };
  return [await page.screenshot({ clip:left }), await page.screenshot({ clip:right })];
}

// A drag that wanders over the sides of the board, then lets go at (endX, endY)
async function wander(page, from, b, endX, endY){
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const pts = [];
  for(let i = 0; i <= 40; i++){
    const t = i / 40;
    const side = i % 2 ? b.x - 25 : b.x + b.width + 25;     // zig-zag across both edges
    pts.push([side + (Math.random() - 0.5) * 30, b.y + t * b.height]);
  }
  for(const [x, y] of pts) await page.mouse.move(x, y, { steps: 3 });
  await page.mouse.move(endX, endY, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(450);                           // (landing / return animations)
}

(async ()=>{
  let failed = 0;
  for(const engine of ['chromium', 'webkit', 'firefox']){
    if(process.env.ONLY && process.env.ONLY !== engine) continue;
    const browser = await pw[engine].launch();
    for(const dev of DEVICES){
      for(const theme of ['light', 'dark']){
        // (Firefox has no isMobile; a phone is a narrow window there)
        const ctx = await browser.newContext({ viewport: dev.viewport, hasTouch: dev.touch,
          ...(engine === 'firefox' ? {} : { isMobile: dev.touch }) });
        await ctx.addInitScript(t=>{ localStorage.clear(); localStorage.setItem('pb_tutorialSeen', '1'); localStorage.setItem('pb_theme', t); }, theme);
        const page = await ctx.newPage();
        await page.goto(BASE + 'play.html?level=medium');
        await page.waitForTimeout(600);
        const before = await strips(page);
        const b = await page.locator('#board-outer').boundingBox();
        const slots = page.locator('.tray-slot');
        const n = await slots.count();
        for(let i = 0; i < n; i++){
          const s = await slots.nth(i).boundingBox();
          const from = { x: s.x + s.width/2, y: s.y + s.height/2 };
          // drop it on the board somewhere, then drag it from there back to the top
          await wander(page, from, b, b.x + b.width*0.3 + (i%3)*30, b.y + b.height*0.3 + (i%2)*40);
          const placed = page.locator('.placed-piece .blk').last();
          if(await placed.count()){
            const p = await placed.boundingBox();
            await wander(page, { x:p.x + p.width/2, y:p.y + p.height/2 }, b, from.x, from.y);
          }
        }
        await page.mouse.move(5, 5);
        await page.waitForTimeout(400);
        const after = await strips(page);
        const label = `${engine}-${dev.name}-${theme}`;
        const same = ['left', 'right'].map((side, k)=>{
          const ok = before[k].equals(after[k]);
          if(!ok){
            require('fs').writeFileSync(`trails-${label}-${side}-before.png`, before[k]);
            require('fs').writeFileSync(`trails-${label}-${side}-after.png`, after[k]);
          }
          return ok;
        });
        const ok = same.every(Boolean);
        if(!ok) failed++;
        console.log((ok ? 'OK    ' : 'MARKS ') + label + (ok ? '' : `  (left ${same[0] ? 'clean' : 'changed'}, right ${same[1] ? 'clean' : 'changed'})`));
        await ctx.close();
      }
    }
    await browser.close();
  }
  console.log(failed ? `\n${failed} run(s) left marks` : '\nAll clean');
  process.exit(failed ? 1 : 0);
})();
