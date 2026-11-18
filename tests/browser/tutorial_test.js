// Plays the whole tutorial like a player would, on a laptop (mouse) and a
// phone (touch), and checks each slide. Every check prints ✓ or ✗.
// (2026-11-18: 8 slides: goals with "Show me", "Words we use" with the
// welcome popup, pick the grid, highlight then the sum (one slide), pick
// again counting empty squares, the 17 ways and the choice, rotate +
// reflect (with the "don't place over" line), the final puzzle. A first
// visit opens the rules; the tutorial is opened from them.)
// Run with:  node tutorial_test.js        (LARGE=1 for Large text)
const { chromium } = require('playwright');
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
const key = cells => JSON.stringify(S.normalize(cells));

// Where each piece must end up (from the solver)
const TURN_FLIP = { N: [[0,2],[1,1],[1,2],[2,1],[3,1]], F: [[1,3],[2,2],[2,3],[2,4],[3,2]] };
const FINAL = { W: [[0,1],[0,2],[1,0],[1,1],[2,0]], N: [[3,1],[3,2],[4,2],[4,3],[4,4]],
                P: [[4,0],[4,1],[5,0],[5,1],[5,2]], V: [[3,5],[4,5],[5,3],[5,4],[5,5]] };
const rotate = c => { const rows = Math.max(...c.map(x=>x[0]))+1; return S.normalize(c.map(([r,q])=>[q, rows-1-r])); };
const reflect = c => { const cols = Math.max(...c.map(x=>x[1]))+1; return S.normalize(c.map(([r,q])=>[r, cols-1-q])); };

let fails = 0;
function check(label, what, ok, detail){
  if(!ok) fails++;
  console.log(`${ok ? '✓' : '✗'} [${label}] ${what}${detail !== undefined ? ' (' + detail + ')' : ''}`);
}

async function placePiece(page, frame, name, target, touch){
  const slot = frame.locator(`.tray-slot[data-name="${name}"]`);
  const start = await frame.evaluate(n=>trayCells[n], name);
  let plan = null;
  for(let f=0; f<2 && !plan; f++){ let c = f ? reflect(start) : start;
    for(let k=0; k<4; k++){ if(key(c) === key(target)){ plan = { f, k }; break; } c = rotate(c); } }
  if(!plan) throw new Error('No way to orient ' + name);
  if(plan.f){ await (touch ? (async()=>{ await slot.tap(); await page.waitForTimeout(60); await slot.tap(); })() : slot.dblclick()); await page.waitForTimeout(350); }
  for(let i=0; i<plan.k; i++){ await (touch ? slot.tap() : slot.click()); await page.waitForTimeout(350); }
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
  const LARGE = process.env.LARGE === '1';
  for (const [w, h, baseLabel, touch] of [[1280, 860, 'laptop', false], [390, 800, 'phone', true]]) {
    const label = baseLabel + (LARGE ? '-large' : '');
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:touch, isMobile:touch });
    if(LARGE) await ctx.addInitScript(()=>localStorage.setItem('pb_largeText', '1'));
    const page = await ctx.newPage();
    page.on('pageerror', e=>errors.push(label + ': ' + e.message));
    await page.goto(BASE + 'play.html?level=easy');
    await page.waitForTimeout(500);
    // (2026-11-18, user: the tutorial isn't forced: a first visit opens the
    // RULES, which end with a tip and a "Play the tutorial" button)
    check(label, 'a first visit opens the rules, not the tutorial', await page.isVisible('.rules-popup') && await page.isHidden('#tutorial-overlay'));
    check(label, 'the rules end with the tutorial tip', /For helpful tips on solving Medium and Hard puzzles, play the tutorial\./.test(await page.locator('.rules-tutorial-tip').innerText()));
    await page.mouse.click(4, 4); await page.waitForTimeout(300);
    check(label, 'clicking outside the rules closes them', await page.isHidden('.rules-popup'));
    await page.click('[data-open-rules]'); await page.waitForTimeout(300);
    await page.click('.rules-tutorial'); await page.waitForTimeout(800);
    check(label, '"Play the tutorial" opens it', await page.isVisible('#tutorial-overlay'));
    let frame = page.frames().find(f=>f.url().includes('tutorial.html'));
    const F = fn=>frame.evaluate(fn);
    const nextReady = ()=>F(()=>document.getElementById('next-btn').classList.contains('ready'));
    const slideNo = ()=>F(()=>current + 1);
    const scroll = ()=>F(()=>{ const b = document.querySelector('.tut-body'); return b.scrollHeight - b.clientHeight; });
    const tap = async sel=>{ const l = frame.locator(sel).first(); await (touch ? l.tap() : l.click()); };
    const popupOpen = ()=>F(()=>!document.getElementById('spot').hidden && getComputedStyle(document.getElementById('spot-card')).visibility !== 'hidden');
    const popupText = ()=>F(()=>document.getElementById('spot-text').innerText.trim());
    // wait until the slide is done, pressing each popup's button as it comes
    const playThrough = async (maxS, keepPressing = true)=>{
      for(let t = 0; t < maxS * 4; t++){
        if(await F(()=>done[current])) return true;
        if(keepPressing && await popupOpen()){ await page.waitForTimeout(400); await frame.click('#spot-ok'); }
        await page.waitForTimeout(250);
      }
      return F(()=>done[current]);
    };
    const next = async ()=>{ await frame.click('#next-btn'); await page.waitForTimeout(400); };

    check(label, 'there are 8 slides', await frame.locator('.dot').count() === 8, await frame.locator('.dot').count());

    // ── Slide 1: the two goals, each opened with "Show me" ──
    check(label, 'slide 1: both goals start closed, Next not ready', !(await nextReady()) && await F(()=>!document.querySelector('.goal.open')));
    await tap('#goal1 .showme');
    // (2026-11-16: the pieces are dragged in one by one, ~14 s; wait for all six)
    await page.waitForFunction(()=>document.querySelectorAll('#goal-board .mb-piece.ia-on').length === 6, null, { timeout: 20000 }).catch(()=>{});
    await page.waitForTimeout(500);
    check(label, 'slide 1: Tiling open, all six pieces dragged in, no copies left', await F(()=>document.querySelectorAll('#goal-board .mb-piece.ia-on').length === 6 && !document.querySelector('.drag-ghost')));
    check(label, 'slide 1: one goal seen is not enough for Next', !(await nextReady()));
    await tap('#goal2 .showme');
    const open2 = await F(()=>[1, 2].filter(n=>document.getElementById('goal' + n).classList.contains('open')).join('+'));
    check(label, `slide 1: ${touch ? 'phones keep one goal open' : 'laptops keep both open'}`, open2 === (touch ? '2' : '1+2'), open2);
    await page.waitForTimeout(10500);   // (the Parity counting: ~9 s since 2026-11-18)
    check(label, 'slide 1: Next ready once both goals have played', await nextReady());
    check(label, 'slide 1: no scrolling', await scroll() === 0, await scroll() + 'px');
    await page.screenshot({ path: `tut-${label}-1.png` });
    await next();

    // ── Slide 2: plays straight away (2026-11-18: the welcome popup is gone) ──
    await page.waitForTimeout(1500);
    check(label, 'slide 2: no welcome popup, the animation is playing', !(await popupOpen()) && await F(()=>document.querySelectorAll('#intro .ia-on').length) > 0);
    check(label, 'slide 2: plays to the end', await playThrough(30, false));
    check(label, 'slide 2: the four captions are all showing', await F(()=>document.querySelectorAll('#words-list li.ia-on').length) === 4);
    check(label, 'slide 2: no scrolling', await scroll() === 0, await scroll() + 'px');
    await page.screenshot({ path: `tut-${label}-2.png` });
    await next();

    // ── Slide 3: pick the grid with an even number of blocks ──
    check(label, 'slide 3: no welcome popup here any more', !(await popupOpen()));
    await tap('.pick-btn:nth-child(2)');
    check(label, 'slide 3: the right grid is counted and Next lights up', await playThrough(30, false));
    check(label, 'slide 3: the "Correct!" text is one sentence (not one word per line)',
      await F(()=>{ const s = document.querySelector('.win-text > span'); return !!s && s.querySelectorAll('.term').length > 0 &&
        [...s.querySelectorAll('.term')].every(t=>getComputedStyle(t).display === 'inline'); }));
    await page.screenshot({ path: `tut-${label}-3.png` });
    await next();

    // ── Slide 4 (slides 4 + 5 merged, 2026-11-18): highlight every empty
    // square; that starts the sum (36 − 30 = 6) on the same slide, then
    // "Since this grid is 6 × 6…" and the count ──
    await tap('.hl-pencil');
    const empties = await F(()=>emptyOf(puzzle));
    for(const k of empties){ const [r, c] = k.split(','); await tap(`.board-cell[data-r="${r}"][data-c="${c}"]`); await page.waitForTimeout(120); }
    await page.waitForTimeout(600);
    check(label, 'slide 4: once all are highlighted, the sum starts here (no popup, same slide)', !(await popupOpen()) && await slideNo() === 4);
    check(label, 'slide 4: plays to the end (pressing each popup)', await playThrough(60));
    check(label, 'slide 4: "Since this grid is 6 × 6" came', await F(()=>/Since this grid is 6/.test(document.getElementById('spot-text').innerText)));
    check(label, 'slide 4: no scrolling', await scroll() === 0, await scroll() + 'px');
    await page.screenshot({ path: `tut-${label}-4.png` });
    await next();

    // ── Slide 5: pick the grid again, counting empty squares ──
    check(label, 'slide 5: "…also means that you have achieved parity."', /also means that you have achieved parity\./.test(await F(()=>document.getElementById('pick-ask').innerText)));
    await tap('.pick-btn:nth-child(2)');
    check(label, 'slide 5: the right grid is counted and Next lights up', await playThrough(30, false));
    await next();

    // ── Slide 6: the 17 ways and the choice ──
    await page.waitForTimeout(500);
    check(label, 'slide 6: the popup says why ("To narrow down where the pieces can go")', /To narrow down where the pieces can go/.test(await popupText()));
    // (2026-11-18) tapping the dark area beside a popup does nothing now
    await page.mouse.click(5, 300); await page.waitForTimeout(300);
    check(label, 'popups: tapping beside one doesn\'t close it', /To narrow down where the pieces can go/.test(await popupText()));
    await frame.click('#spot-ok');
    await page.waitForTimeout(400);
    // (2026-11-18) the popup closes; beside the grid, the 17 ways message,
    // then a glowing "Show me" plays them on the grid as the game's pieces
    check(label, 'slide 6: popup closed, "There are 17 different ways…" beside the grid',
      await F(()=>document.getElementById('spot').hidden) && /There are 17 different ways to tile the remaining two pieces/.test(await F(()=>document.getElementById('n-boardr').innerText)));
    await page.waitForTimeout(1600);
    check(label, 'slide 6: "Show me" glows in after 1.5 s', await F(()=>{ const b = document.getElementById('ways-btn'); return b.classList.contains('shown') && b.classList.contains('lit') && /Show me/.test(b.textContent); }));
    await tap('#ways-btn'); await page.waitForTimeout(1400);
    check(label, 'slide 6: the ways play as real pieces (count moving, 2 pieces on the grid, ▸▸ shown)',
      await F(()=>+document.getElementById('demo-n').textContent > 1 && document.querySelectorAll('.placed-piece.demo-piece').length === 2 && !document.getElementById('ff-btn').hidden));
    await tap('#ff-btn');
    await frame.waitForFunction(()=>/Continue/.test(document.getElementById('ways-btn').textContent) && !document.getElementById('ways-btn').hidden, null, { timeout: 8000 }).catch(()=>{});
    check(label, 'slide 6: then Continue, the grid empty again', await F(()=>/Continue/.test(document.getElementById('ways-btn').textContent) && !document.querySelector('.demo-piece')));
    await tap('#ways-btn'); await page.waitForTimeout(400);
    check(label, 'slide 6: step 3, no piece fits in 3 squares', /No piece fits in these 3 squares/.test(await popupText()));
    await page.waitForTimeout(1800);
    check(label, 'slide 6: those 3 are given (highlighted, locked)', await F(()=>Object.keys(getMarks()).sort().join(' ')) === '0,0 5,0 5,1');
    await frame.click('#spot-ok'); await page.waitForTimeout(400);
    check(label, 'slide 6: step 4, the 2 even ways, shown on the grid', /only 2 ways/.test(await popupText()) && await F(()=>document.querySelectorAll('#hl-demo .demo-sq.way').length) === 3);
    await frame.click('#spot-ok'); await page.waitForTimeout(400);
    // (2026-11-17) step 5 is a choice between the two ways: no "Got it",
    // tapping the dark area doesn't close it, no highlighter on this slide
    check(label, 'slide 6: step 5, the choice: two pictures, no "Got it"', /Which of these layouts allows you to fit the remaining two pieces\?/.test(await popupText())
      && await F(()=>document.querySelectorAll('#way-choices .way-btn').length) === 2 && await F(()=>document.querySelector('#spot-card .spot-btns').hidden));
    check(label, 'slide 6: no highlighter button on this slide', await F(()=>document.getElementById('hl-tool').hidden));
    await tap('#way-choices .way-btn:nth-child(1)'); await page.waitForTimeout(400);
    check(label, 'slide 6: Way 1 → "Not that one", the red space on the grid', /Not that one/.test(await popupText()) && await F(()=>document.querySelectorAll('#hl-demo .demo-sq.nofit').length) > 0);
    await tap('#way-choices .way-btn:nth-child(2)'); await page.waitForTimeout(800);
    // (2026-11-18) the popup stays: "Parity achieved!", L and P in the picture, Next at its bottom right
    check(label, 'slide 6: Way 2 → popup stays, "Parity achieved!", L and P drawn, Next in it',
      await F(()=>!document.getElementById('spot').hidden && /Parity achieved!/.test(document.getElementById('way-msg').textContent)
        && document.querySelectorAll('#way-choices .way-piece').length === 2 && !!document.getElementById('way-next')));
    check(label, 'slide 6: the page\'s Next is ready too', await nextReady());
    check(label, 'slide 6: the grid below gets the six highlights and L and P', await F(()=>Object.keys(getMarks()).length === 6 && document.querySelectorAll('.placed-piece.demo-piece').length === 2));
    await page.screenshot({ path: `tut-${label}-6.png` });
    await tap('#way-next'); await page.waitForTimeout(500);
    check(label, 'slide 6: the popup\'s Next goes to slide 7, popup gone', await slideNo() === 7 && await F(()=>document.getElementById('spot').hidden));

    // ── Slide 7: rotate and reflect, with the "don't place over" line
    // (that slide was folded in here, 2026-11-18) ──
    check(label, 'slide 7: three steps (rotate, reflect, drag)', await frame.locator('#n-trayl .step').count() === 3);
    check(label, 'slide 7: the "can\'t go over" line', /can’t go over a dotted line, the edge of the grid, or another piece/.test(await F(()=>document.getElementById('n-boardr').innerText)));
    // refresh in the middle: it comes back to this slide
    await page.reload(); await page.waitForTimeout(800);
    frame = page.frames().find(f=>f.url().includes('tutorial.html'));
    check(label, 'a refresh mid-tutorial comes back to slide 7', await page.isVisible('#tutorial-overlay') && await slideNo() === 7, await slideNo());
    for(const [name, target] of Object.entries(TURN_FLIP)) await placePiece(page, frame, name, target, touch);
    check(label, 'slide 7: solved and counted', await playThrough(20, false));
    await next();
    // Back: slide 7 starts over, but Next stays green
    await frame.click('#back-btn'); await page.waitForTimeout(400);
    check(label, 'Back to slide 7: pieces back at the top, Next still ready',
      await F(()=>placedPieces.filter(p=>!p.locked).length) === 0 && await nextReady());
    await next();

    // ── Slide 8: the final puzzle (no "Make sure…" note; the Hint when uneven) ──
    check(label, 'slide 8: no "Make sure…" note', !(await F(()=>!!document.getElementById('big-note'))));
    // (2026-11-18) the message beside the grid, and the grid glows twice
    check(label, 'slide 8: "To complete the tutorial, solve this puzzle."', /To complete the tutorial, solve this puzzle\./.test(await F(()=>document.getElementById('n-boardr').innerText)));
    await page.waitForTimeout(700);
    check(label, 'slide 8: the grid glows twice', await F(()=>{ const b = document.getElementById('board-outer'); return b.classList.contains('invite-twice') && getComputedStyle(b).animationIterationCount === '2'; }));
    const WRONG = { W: [[3,1],[3,2],[4,2],[4,3],[5,3]], P: [[3,5],[4,4],[4,5],[5,4],[5,5]],
                    N: [[0,1],[0,2],[0,3],[1,0],[1,1]], V: [[3,0],[4,0],[5,0],[5,1],[5,2]] };
    // (2026-11-18) the game's Clear: pieces off, Undo puts them back
    await placePiece(page, frame, 'W', WRONG.W, touch);
    await tap('#tut-clear'); await page.waitForTimeout(300);
    check(label, 'slide 8: Clear takes the pieces off, "Board cleared · Undo" shows',
      await F(()=>placedPieces.filter(p=>!p.locked).length === 0 && !document.getElementById('undo-bar').hidden));
    await tap('#undo-btn'); await page.waitForTimeout(300);
    check(label, 'slide 8: Undo puts it back', await F(()=>placedPieces.filter(p=>!p.locked).length === 1 && document.getElementById('undo-bar').hidden));
    for(const [name, target] of Object.entries(WRONG)) if(name !== 'W') await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(400);
    check(label, 'slide 8: every piece placed but uneven → the Hint button shows', await F(()=>document.getElementById('hint-btn').classList.contains('shown')));
    await frame.click('#hint-btn'); await page.waitForTimeout(400);
    check(label, 'slide 8: the Hint opens on the dotted area', /dotted area/.test(await popupText()));
    await frame.click('#spot-ok'); await page.waitForTimeout(300);
    await frame.click('#spot-ok'); await page.waitForTimeout(300);
    // (2026-11-18) after the hint, the highlighter glows twice, then stops
    check(label, 'slide 8: after the hint, the highlighter glows twice', await F(()=>{ const t = document.getElementById('hl-tool'); return t.classList.contains('glow-twice') && !t.classList.contains('glowing'); }));
    await frame.click('#back-btn'); await page.waitForTimeout(400);
    await frame.click('#next-btn'); await page.waitForTimeout(600);
    for(const [name, target] of Object.entries(FINAL)) await placePiece(page, frame, name, target, touch);
    check(label, 'slide 8: solved and counted, Finish ready', await playThrough(20, false));
    check(label, 'slide 8: the button says Finish', /Finish/.test(await F(()=>document.getElementById('next-btn').textContent)));
    await page.screenshot({ path: `tut-${label}-8.png` });
    await frame.click('#next-btn');
    await page.waitForTimeout(300);
    check(label, 'Finish closes the tutorial and remembers it', await page.isHidden('#tutorial-overlay') && await page.evaluate(()=>localStorage.getItem('pb_tutorialSeen')) === '1');
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors'));
  console.log(fails ? `${fails} check(s) FAILED` : 'all checks passed');
  process.exit(fails || errors.length ? 1 : 0);
})();
