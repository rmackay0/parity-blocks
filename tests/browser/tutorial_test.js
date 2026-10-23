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
  // The empty-spaces puzzle (one of many answers) and a wrong try
  E:      { E1: [[1,2]], E2: [[3,4]], E3: [[5,2]], E4: [[5,4]] },
  Ewrong: { E1: [[1,2]], E2: [[3,2]], E3: [[5,2]], E4: [[5,3]] },
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
    const counts = async ()=>(await frame.locator('#tut-overlay .count').allTextContents()).join(' ');
    const boardAt = ()=>frame.evaluate(()=>{ const r = document.getElementById('board-outer').getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width); });
    const needsScroll = ()=>frame.evaluate(()=>{ const b = document.querySelector('.tut-body'); return b.scrollHeight - b.clientHeight; });
    console.log(`[${label}] slides: ${await frame.locator('.dot').count()} (expected 7) | slide 1 Next ready:`, await nextReady());
    await page.screenshot({ path:`tut-${label}-1.png` });
    await frame.click('#next-btn');

    const lit = id => frame.evaluate(i=>document.getElementById(i).classList.contains('lit'), id);
    const lit2 = async ()=>[await lit('step0'), await lit('step1')].join(', ');

    // Slide 2: rotate, then drag. Once solved, the blocks are counted, then "Solved!"
    await page.waitForTimeout(250);
    console.log(`[${label}] slide 2 start: rotate step, drag step glowing: ${await lit2()} (expected true, false)`);
    await page.screenshot({ path:`tut-${label}-2-start.png` });
    const iSlot = frame.locator('.tray-slot[data-name="I"]');
    await (touch ? iSlot.tap() : iSlot.click()); await page.waitForTimeout(400);
    console.log(`[${label}] after rotating I at the top: ${await lit2()} (expected false, true)`);
    const board2 = await boardAt();
    for(const [name, target] of Object.entries(TARGETS[2])) await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(1500);
    console.log(`[${label}] slide 2 counting at 1.5 s: Next ready ${await nextReady()} (expected false), counts so far ${await frame.locator('#tut-overlay .count').count()}`);
    await page.screenshot({ path:`tut-${label}-2-counting.png` });
    await page.waitForTimeout(7500);
    console.log(`[${label}] slide 2 done: counts "${await counts()}" (expected 4 6 6 4 4 6 | 4 6 4 6 4 6) | note ${JSON.stringify((await frame.textContent('#n-boardr')).trim())} | Next ready ${await nextReady()} | board moved ${board2 !== await boardAt()} (expected false)`);
    await page.screenshot({ path:`tut-${label}-2-solved.png` });
    await frame.click('#next-btn');

    // Slide 3: "Don't place a piece over" animations
    await page.waitForTimeout(1000);
    console.log(`[${label}] slide 3 heading glowing at 1 s: ${await frame.evaluate(()=>document.querySelector('#dont-slide h2').classList.contains('lit'))} (expected true)`);
    await page.waitForTimeout(10600);
    console.log(`[${label}] slide 3 after animations: Next ready ${await nextReady()}, signs showing ${await frame.locator('#dont .rb-nomark:not(.hide)').count()} of 4`);
    await page.screenshot({ path:`tut-${label}-3-done.png` });
    // Back to slide 2: it starts over, but Next stays green
    await frame.click('#back-btn'); await page.waitForTimeout(300);
    console.log(`[${label}] Back to slide 2: pieces placed ${await frame.evaluate(()=>placedPieces.filter(p=>!p.locked).length)} (expected 0) | Next ready ${await nextReady()} (expected true)`);
    await frame.click('#next-btn'); await page.waitForTimeout(300);
    await frame.click('#next-btn');

    // Slide 4: reflect, then drag. Once solved: counts, then the empty-spaces note
    await page.waitForTimeout(250);
    console.log(`[${label}] slide 4 start: reflect step, drag step glowing: ${await lit2()} (expected true, false) | right note: ${JSON.stringify((await frame.textContent('#n-boardr')).trim())}`);
    await page.screenshot({ path:`tut-${label}-4-start.png` });
    const nSlot = frame.locator('.tray-slot[data-name="N"]');
    if(touch){ await nSlot.tap(); await page.waitForTimeout(60); await nSlot.tap(); } else await nSlot.dblclick();
    await page.waitForTimeout(400);
    console.log(`[${label}] after reflecting a piece at the top: ${await lit2()} (expected false, true)`);
    // Refresh in the middle of the tutorial: it should come back to this slide
    await page.reload(); await page.waitForTimeout(600);
    frame = page.frames().find(f=>f.url().includes('tutorial.html'));
    console.log(`[${label}] after a refresh: tutorial open ${await page.isVisible('#tutorial-overlay')}, on slide ${await frame.evaluate(()=>current + 1)} (expected 4), earlier slides done ${await frame.evaluate(()=>done.slice(0,3).every(Boolean))}`);
    for(const [name, target] of Object.entries(TARGETS[3])) await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(8900);
    console.log(`[${label}] slide 4 counted: "${await counts()}" (expected 4 6 6 4 4 6 | 6 4 6 4 6 4) | Next ready ${await nextReady()} (expected false)`);
    const explainState = ()=>frame.evaluate(()=>({
      lines: document.querySelectorAll('#n-boardr .recap-item.shown').length,
      glowing: document.querySelectorAll('#tut-overlay .sq-ring.on').length,
    }));
    await page.waitForTimeout(800);
    console.log(`[${label}] slide 4 note at 0.8 s:`, JSON.stringify(await explainState()), '(expected 1 line, 2 glowing)');
    await page.screenshot({ path:`tut-${label}-4-line1.png` });
    await page.waitForTimeout(1800);
    console.log(`[${label}] slide 4 note at 2.6 s:`, JSON.stringify(await explainState()), '(expected 2 lines, 4 glowing: the Xs)');
    await page.waitForTimeout(1600);
    console.log(`[${label}] slide 4 done:`, JSON.stringify(await explainState()), `(expected 2 lines, 0 glowing) | note ${JSON.stringify((await frame.textContent('#n-boardr')).replace(/\s+/g,' ').trim())} | Next ready ${await nextReady()} | scroll needed ${await needsScroll()}px`);
    await page.screenshot({ path:`tut-${label}-4-done.png` });
    const board4 = await boardAt();
    await frame.click('#next-btn');

    // Slide 5: same board, same place; text fades, pieces fade, empty spaces counted
    const quietState = ()=>frame.evaluate(()=>({
      stepsOpacity: getComputedStyle(document.getElementById('n-trayl')).opacity,
      piecesOpacity: getComputedStyle(document.getElementById('pieces-layer')).opacity,
      dark: document.querySelectorAll('.board-cell.gap-dark').length,
      note: document.getElementById('n-boardr').textContent.replace(/\s+/g,' ').trim(),
    }));
    await page.waitForTimeout(100);
    console.log(`[${label}] slide 5 board moved: ${board4 !== await boardAt()} (expected false; ${board4} → ${await boardAt()}) | Next ready ${await nextReady()} (expected false)`);
    await page.waitForTimeout(2900);
    console.log(`[${label}] slide 5 at 3 s:`, JSON.stringify(await quietState()), '(expected steps 0, pieces 0, 2 dark, the new note)');
    await page.screenshot({ path:`tut-${label}-5-note.png` });
    await page.waitForTimeout(9500);
    console.log(`[${label}] slide 5 done: counts "${await counts()}" (expected 2 0 0 2 2 0 | 0 2 0 2 0 2) | Next ready ${await nextReady()} | board moved ${board4 !== await boardAt()} | scroll needed ${await needsScroll()}px`);
    await page.screenshot({ path:`tut-${label}-5-done.png` });
    await frame.click('#next-btn');

    // Slide 6: drag the four empty spaces
    const shown = id => frame.evaluate(i=>document.getElementById(i).classList.contains('shown'), id);
    await page.waitForTimeout(400);
    console.log(`[${label}] slide 6: tray pieces ${await frame.locator('.tray-slot').count()} (expected 4) | note ${JSON.stringify((await frame.textContent('#n-boardr')).replace(/\s+/g,' ').trim())} | Hint shown ${await shown('hint-btn')} (expected false)`);
    await page.screenshot({ path:`tut-${label}-6-start.png` });
    for(const [name, target] of Object.entries(TARGETS.Ewrong)) await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(300);
    console.log(`[${label}] wrong try: frame glows red ${await frame.evaluate(()=>document.getElementById('board-outer').classList.contains('uneven'))} (expected true) | squares turned dark ${await frame.locator('.board-cell.gap-dark').count()} (expected 0) | Next ready ${await nextReady()} (expected false)`);
    // (The Hint appears after 3 minutes; call it straight away here)
    await frame.evaluate(()=>offerHint());
    console.log(`[${label}] after 3 minutes: Hint shown ${await shown('hint-btn')}, glowing ${await lit('hint-btn')}`);
    await frame.click('#hint-btn'); await page.waitForTimeout(500);
    console.log(`[${label}] Hint opened: spotlit squares ${await frame.locator('#spot-svg .spot-ring').count()} (expected 2) | text starts ${JSON.stringify((await frame.textContent('#spot-text')).slice(0, 45))}`);
    await page.screenshot({ path:`tut-${label}-6-hint.png` });
    await frame.click('#spot-ok'); await page.waitForTimeout(200);
    await frame.click('#back-btn'); await page.waitForTimeout(250); await frame.click('#next-btn'); await page.waitForTimeout(250);
    console.log(`[${label}] slide 6 again: pieces on grid ${await frame.evaluate(()=>placedPieces.length)}, Hint shown ${await shown('hint-btn')} (expected 0, false)`);
    for(const [name, target] of Object.entries(TARGETS.E)) await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(400);
    console.log(`[${label}] slide 6 solved: Next ready ${await nextReady()} | message ${JSON.stringify((await frame.textContent('#n-boardr .great')).trim())} | dark squares ${await frame.locator('.board-cell.gap-dark').count()} (expected 0) | scroll needed ${await needsScroll()}px`);
    await page.screenshot({ path:`tut-${label}-6-solved.png` });
    await frame.click('#next-btn');

    // Slide 7: parity puzzle
    await page.waitForTimeout(650);
    console.log(`[${label}] slide 7: orange note glowing ${await lit('big-note')} (expected true) | Hint shown ${await shown('hint-btn')} (expected false)`);
    await page.screenshot({ path:`tut-${label}-7-start.png` });
    // Every piece placed with no rule broken, but uneven (puzzle4_tilings.js #0) → glowing Hint button
    const WRONG = { W: [[3,1],[3,2],[4,2],[4,3],[5,3]], P: [[3,5],[4,4],[4,5],[5,4],[5,5]],
                    N: [[0,1],[0,2],[0,3],[1,0],[1,1]], V: [[3,0],[4,0],[5,0],[5,1],[5,2]] };
    await placePiece(page, frame, 'W', WRONG.W, touch);
    await placePiece(page, frame, 'P', WRONG.P, touch);
    await page.waitForTimeout(300);
    console.log(`[${label}] W and P placed: Hint shown ${await shown('hint-btn')} (expected false)`);
    await placePiece(page, frame, 'N', WRONG.N, touch);
    await placePiece(page, frame, 'V', WRONG.V, touch);
    await page.waitForTimeout(300);
    console.log(`[${label}] all placed, uneven: Hint shown ${await shown('hint-btn')}, glowing ${await lit('hint-btn')} (expected true, true)`);
    await page.screenshot({ path:`tut-${label}-7-hint-btn.png` });
    await frame.click('#hint-btn'); await page.waitForTimeout(500);
    console.log(`[${label}] Hint opened: spotlit squares ${await frame.locator('#spot-svg .spot-ring').count()} (expected 1) | text starts ${JSON.stringify((await frame.textContent('#spot-text')).slice(0, 45))}`);
    await page.screenshot({ path:`tut-${label}-7-hint.png` });
    await frame.click('#spot-ok'); await page.waitForTimeout(200);
    await frame.click('#back-btn'); await page.waitForTimeout(250); await frame.click('#next-btn'); await page.waitForTimeout(250);
    for(const [name, target] of Object.entries(TARGETS[4])) await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(9000);
    console.log(`[${label}] slide 7 done: Finish ready ${await nextReady()}, counts "${await counts()}"`);
    await page.screenshot({ path:`tut-${label}-7-done.png` });
    await frame.click('#next-btn');
    await page.waitForTimeout(250);
    console.log(`[${label}] after Finish, popup closed:`, await page.isHidden('#tutorial-overlay'),
      '| remembered:', await page.evaluate(()=>localStorage.getItem('pb_tutorialSeen')));
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors'));
})();
