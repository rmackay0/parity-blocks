// Plays the whole tutorial like a player would, on desktop (mouse) and phone (touch).
// Run with:  node tutorial_test.js
const { chromium } = require('playwright');
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
const key = cells => JSON.stringify(S.normalize(cells));

// Where each piece must end up (from the solver's unique solutions)
const TARGETS = {
  2: { I: [[0,5],[1,5],[2,5],[3,5],[4,5]], F: [[1,2],[2,1],[2,2],[2,3],[3,3]] },
  3: { N: [[0,2],[1,1],[1,2],[2,1],[3,1]], F: [[1,3],[2,2],[2,3],[2,4],[3,2]] },
  4: { W: [[0,1],[0,2],[1,0],[1,1],[2,0]], N: [[3,1],[3,2],[4,2],[4,3],[4,4]],
       P: [[4,0],[4,1],[5,0],[5,1],[5,2]], V: [[3,5],[4,5],[5,3],[5,4],[5,5]] },
};
const rotate = c => { const rows = Math.max(...c.map(x=>x[0]))+1; return S.normalize(c.map(([r,q])=>[q, rows-1-r])); };
const reflect = c => { const cols = Math.max(...c.map(x=>x[1]))+1; return S.normalize(c.map(([r,q])=>[r, cols-1-q])); };

async function placePiece(page, frame, name, target, touch){
  const slot = frame.locator(`.tray-slot[data-name="${name}"]`);
  // Work out how many reflects/rotates turn the tray shape into the target shape
  const start = await frame.evaluate(n=>trayCells[n], name);
  let plan = null;
  for(let f=0; f<2 && !plan; f++){ let c = f ? reflect(start) : start;
    for(let k=0; k<4; k++){ if(key(c) === key(target)){ plan = { f, k }; break; } c = rotate(c); } }
  if(!plan) throw new Error('No way to orient ' + name);
  if(plan.f){ await (touch ? (async()=>{ await slot.tap(); await page.waitForTimeout(60); await slot.tap(); })() : slot.dblclick()); await page.waitForTimeout(350); }
  for(let i=0; i<plan.k; i++){ await (touch ? slot.tap() : slot.click()); await page.waitForTimeout(350); }
  // Drag it onto the board
  const cells = await frame.evaluate(n=>trayCells[n], name);
  const rows = Math.max(...cells.map(c=>c[0]))+1, cols = Math.max(...cells.map(c=>c[1]))+1;
  const r0 = Math.min(...target.map(c=>c[0])), c0 = Math.min(...target.map(c=>c[1]));
  const from = await slot.boundingBox();
  const to = await frame.locator(`.board-cell[data-r="${r0+Math.floor((rows-1)/2)}"][data-c="${c0+Math.floor((cols-1)/2)}"]`).boundingBox();
  const a = [from.x+from.width/2, from.y+from.height/2], b = [to.x+to.width/2, to.y+to.height/2];
  await page.mouse.move(...a); await page.mouse.down();
  for(let i=1;i<=10;i++) await page.mouse.move(a[0]+(b[0]-a[0])*i/10, a[1]+(b[1]-a[1])*i/10);
  await page.mouse.up();
}

(async () => {
  const browser = await chromium.launch(); const errors = [];
  // Run with LARGE=1 to play the whole tutorial with Large text switched on
  const LARGE = process.env.LARGE === '1';
  for (const [w, h, baseLabel, touch] of [[1280, 860, 'desktop', false], [390, 800, 'phone', true]]) {
    const label = baseLabel + (LARGE ? '-large' : '');
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:touch, isMobile:touch });
    if(LARGE) await ctx.addInitScript(()=>localStorage.setItem('pb_largeText', '1'));
    const page = await ctx.newPage();
    page.on('pageerror', e=>errors.push(label + ': ' + e.message));
    await page.goto(BASE + 'play.html?level=easy');
    await page.waitForTimeout(500);
    console.log(`\n[${label}] tutorial opened on first visit:`, await page.isVisible('#tutorial-overlay'));
    let frame = page.frames().find(f=>f.url().includes('tutorial.html'));
    const nextReady = ()=>frame.evaluate(()=>document.getElementById('next-btn').classList.contains('ready'));
    console.log(`[${label}] slide 1 Next ready:`, await nextReady());
    console.log(`[${label}] slide 1 text:`, JSON.stringify((await frame.textContent('#intro')).replace(/\s+/g, ' ').trim()));
    await page.screenshot({ path:`tut-${label}-1.png` });
    await frame.click('#next-btn');

    const lit = id => frame.evaluate(i=>document.getElementById(i).classList.contains('lit'), id);

    const lit2 = async ()=>[await lit('step0'), await lit('step1')].join(', ');
    // Slide 2: step 1 (rotate) glows first; once rotated, step 2 (drag) glows; once placed, neither
    await page.waitForTimeout(250);
    console.log(`[${label}] slide 2 start: rotate step, drag step glowing: ${await lit2()} (expected true, false)`);
    console.log(`[${label}]   step 1 says: ${JSON.stringify((await frame.textContent('#step0')).trim())}`);
    await page.screenshot({ path:`tut-${label}-2-start.png` });
    const iSlot = frame.locator('.tray-slot[data-name="I"]');
    await (touch ? iSlot.tap() : iSlot.click()); await page.waitForTimeout(400);
    console.log(`[${label}] after rotating I at the top: ${await lit2()} (expected false, true)`);
    // I is now vertical, which is how it goes in; place both
    const boardAt = ()=>frame.evaluate(()=>{ const r = document.getElementById('board-outer').getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top); });
    const board0 = await boardAt();
    for(const [name, target] of Object.entries(TARGETS[2])) await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(150);
    console.log(`[${label}] solved: status "${await frame.textContent('#status')}" | steps glowing ${await lit2()} (expected false, false) | rings ${await frame.locator('#mark-overlay .empty-ring').count()} (expected 0) | empty spaces dark ${await frame.locator('.board-cell.gap-dark').count()} | Next ready ${await nextReady()} (expected true)`,
      `| board moved: ${board0 !== await boardAt()} (expected false) | no empty-space note here any more: ${!(await frame.textContent('#play')).includes('empty space')}`);
    await page.screenshot({ path:`tut-${label}-2-solved.png` });
    await frame.click('#next-btn');

    // Slide 3: slide 2's solved board, dimmed, with the empty-spaces note appearing line by line
    const recapState = ()=>frame.evaluate(()=>({
      dim: document.getElementById('board-outer').classList.contains('dim'),
      lines: document.querySelectorAll('.recap-item.shown').length,
      glowing: document.querySelectorAll('#tut-overlay .sq-ring.on').length,
      pieces: document.querySelectorAll('#pieces-layer .placed-piece').length,
      dark: document.querySelectorAll('.board-cell.gap-dark').length,
      trayShown: getComputedStyle(document.getElementById('tray')).display !== 'none',
    }));
    await page.waitForTimeout(200);
    console.log(`[${label}] slide 3 at 0.2 s:`, JSON.stringify(await recapState()), '(expected not dim, 0 lines, 6 pieces, 2 dark, no tray) | Next ready', await nextReady(), '(expected false)');
    await page.waitForTimeout(1300);
    console.log(`[${label}] slide 3 at 1.5 s:`, JSON.stringify(await recapState()), '(expected dim, 1 line, 2 glowing)');
    await page.screenshot({ path:`tut-${label}-3-line1.png` });
    await page.waitForTimeout(1500);
    console.log(`[${label}] slide 3 at 3 s:`, JSON.stringify(await recapState()), '(expected 2 lines, 4 glowing: the red Xs)');
    await page.waitForTimeout(1500);
    console.log(`[${label}] slide 3 at 4.5 s:`, JSON.stringify(await recapState()), '(expected 3 lines, 6 glowing) | Next ready', await nextReady(), '(expected true)');
    console.log(`[${label}]   note fully on screen: ${await frame.evaluate(()=>{ const r = document.querySelector('.recap-card').getBoundingClientRect(), f = document.querySelector('.tut-foot').getBoundingClientRect(); return r.top >= 0 && r.bottom <= f.top; })}`,
      `| needs scrolling: ${await frame.evaluate(()=>{ const b = document.querySelector('.tut-body'); return b.scrollHeight > b.clientHeight; })}`);
    await page.screenshot({ path:`tut-${label}-3-done.png` });
    await frame.click('#next-btn');

    // Slide 4: "Don't place a piece over" animations (slower now: heading 2.5 s, 2 s per picture)
    await page.waitForTimeout(1000);
    console.log(`[${label}] slide 4 heading glowing at 1 s: ${await frame.evaluate(()=>document.querySelector('#dont-slide h2').classList.contains('lit'))} (expected true)`);
    await page.waitForTimeout(2600);
    await page.screenshot({ path:`tut-${label}-4-mid.png` });
    console.log(`[${label}] slide 4 at 3.6 s: Next ready ${await nextReady()}, highlighted pictures ${await frame.locator('#dont figure.active').count()} (expected 1), signs showing ${await frame.locator('#dont .rb-nomark:not(.hide)').count()} (expected 1: the first started at 1.9 s)`);
    await page.waitForTimeout(8000);
    console.log(`[${label}] slide 4 after animations: Next ready ${await nextReady()}, signs showing ${await frame.locator('#dont .rb-nomark:not(.hide)').count()} of 4`);
    await page.screenshot({ path:`tut-${label}-4-done.png` });
    // Back to slide 3: it replays, but Next stays green
    await frame.click('#back-btn'); await page.waitForTimeout(300);
    console.log(`[${label}] Back to slide 3:`, JSON.stringify(await recapState()), `(expected replaying: not dim, 0 lines) | Next ready ${await nextReady()}`);
    await frame.click('#next-btn'); await page.waitForTimeout(300);
    console.log(`[${label}] slide 4 again: animations replay (signs hidden) ${await frame.locator('#dont .rb-nomark.hide').count()}, Next ready ${await nextReady()}`);
    await frame.click('#next-btn');

    // Slide 5: step 1 (reflect) glows; reflecting at the top moves the glow to step 2 (drag)
    await page.waitForTimeout(250);
    console.log(`[${label}] slide 5 start: reflect step, drag step glowing: ${await lit2()} (expected true, false) | right note: ${JSON.stringify((await frame.textContent('#n-boardr')).trim())} | board dim ${await frame.evaluate(()=>document.getElementById('board-outer').classList.contains('dim'))} (expected false)`);
    await page.screenshot({ path:`tut-${label}-5-start.png` });
    const nSlot = frame.locator('.tray-slot[data-name="N"]');
    if(touch){ await nSlot.tap(); await page.waitForTimeout(60); await nSlot.tap(); } else await nSlot.dblclick();
    await page.waitForTimeout(400);
    console.log(`[${label}] after reflecting a piece at the top: ${await lit2()} (expected false, true)`);
    // Refresh in the middle of the tutorial: it should come back to this slide
    await page.reload(); await page.waitForTimeout(600);
    frame = page.frames().find(f=>f.url().includes('tutorial.html'));
    console.log(`[${label}] after a refresh: tutorial open ${await page.isVisible('#tutorial-overlay')}, on slide ${await frame.evaluate(()=>current + 1)} (expected 5), earlier slides done ${await frame.evaluate(()=>done.slice(0,4).every(Boolean))}`);
    for(const [name, target] of Object.entries(TARGETS[3])) await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(250);
    console.log(`[${label}] slide 5 solved: Next ready ${await nextReady()}, steps glowing ${await lit2()} (expected false, false)`);
    await frame.click('#next-btn');

    // Slide 6: parity puzzle. No tray note or keyboard note any more
    await page.waitForTimeout(250);
    const shown = id => frame.evaluate(i=>document.getElementById(i).classList.contains('shown'), id);
    console.log(`[${label}] slide 6: tray note ${JSON.stringify((await frame.textContent('#n-trayl')).trim())} (expected "") | left note ${JSON.stringify((await frame.textContent('#n-boardl')).trim())} (expected "")`);
    await page.waitForTimeout(400);
    console.log(`[${label}]   orange note: ${JSON.stringify((await frame.textContent('#big-note')).trim())} | glowing at 0.65 s ${await lit('big-note')} (expected true) | Hint shown ${await shown('hint-btn')} (expected false)`);
    await page.screenshot({ path:`tut-${label}-6-start.png` });
    // The usual wrong guess: W and P in the outlined area → glowing Hint button
    const WRONG = { W: [[3,1],[3,2],[4,2],[4,3],[5,3]], P: [[3,5],[4,4],[4,5],[5,4],[5,5]] };
    await placePiece(page, frame, 'W', WRONG.W, touch);
    console.log(`[${label}] W placed: Hint shown ${await shown('hint-btn')} (expected false)`);
    await placePiece(page, frame, 'P', WRONG.P, touch);
    await page.waitForTimeout(300);
    console.log(`[${label}] W and P in the outline: Hint shown ${await shown('hint-btn')}, glowing ${await lit('hint-btn')} (expected true, true)`);
    await page.screenshot({ path:`tut-${label}-6-hint-btn.png` });
    await frame.click('#hint-btn'); await page.waitForTimeout(500);
    console.log(`[${label}] Hint opened: spotlight ${await frame.isVisible('#spot')} | spotlit squares ${await frame.locator('#spot-svg .spot-ring').count()} (expected 1) | button still glowing ${await lit('hint-btn')} (expected false)`);
    console.log(`[${label}]   card vs spotlit square:`, await frame.evaluate(()=>{
      const c = document.getElementById('spot-card').getBoundingClientRect(), s = document.querySelector('#spot-svg .spot-ring').getBBox();
      return { cardTop: Math.round(c.top), cardBottom: Math.round(c.bottom), squareTop: Math.round(s.y), squareBottom: Math.round(s.y + s.height), overlap: !(c.bottom < s.y || c.top > s.y + s.height) };
    }));
    await page.screenshot({ path:`tut-${label}-6-hint.png` });
    await frame.click('#spot-ok'); await page.waitForTimeout(200);
    console.log(`[${label}] Got it closes it: ${await frame.isHidden('#spot')}`);
    // Back + Next starts the slide over; then solve it
    await frame.click('#back-btn'); await page.waitForTimeout(250); await frame.click('#next-btn'); await page.waitForTimeout(250);
    console.log(`[${label}] slide 6 again: pieces on grid ${await frame.evaluate(()=>placedPieces.filter(p=>!p.locked).length)}, Hint shown ${await shown('hint-btn')} (expected 0, false)`);
    for(const [name, target] of Object.entries(TARGETS[4])) await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(1500);
    await page.screenshot({ path:`tut-${label}-6-counting.png` });
    console.log(`[${label}] slide 6 counting at 1.5 s: Next ready ${await nextReady()}, counts so far ${await frame.locator('#tut-overlay .count').count()} (slower now)`);
    await page.waitForTimeout(7500);
    console.log(`[${label}] slide 6 done: Finish ready ${await nextReady()}, counts ${await frame.locator('#tut-overlay .count').count()} (12 expected):`,
      (await frame.locator('#tut-overlay .count').allTextContents()).join(' '));
    await page.screenshot({ path:`tut-${label}-6-done.png` });
    await frame.click('#next-btn');
    await page.waitForTimeout(250);
    console.log(`[${label}] after Finish, popup closed:`, await page.isHidden('#tutorial-overlay'),
      '| remembered:', await page.evaluate(()=>localStorage.getItem('pb_tutorialSeen')));
    await page.reload(); await page.waitForTimeout(300);
    console.log(`[${label}] second visit opens it again:`, await page.isVisible('#tutorial-overlay'));
    // Rules popup offers the tutorial again
    await page.click('[data-open-rules]');
    await page.click('.rules-tutorial');
    await page.waitForTimeout(300);
    console.log(`[${label}] "Play the tutorial" button reopens it:`, await page.isVisible('#tutorial-overlay'));
    const f2 = page.frames().find(f=>f.url().includes('tutorial.html'));
    await f2.click('#close-x'); await page.waitForTimeout(150);
    console.log(`[${label}] red X closes it:`, await page.isHidden('#tutorial-overlay'));
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors'));
})();
