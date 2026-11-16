// Plays the whole tutorial like a player would, on a laptop (mouse) and a
// phone (touch), and checks each slide. Every check prints ✓ or ✗.
// (Rewritten 2026-11-15 for the 10-slide tutorial: goals with "Show me",
// "Words we use" with the welcome popup, pick the grid, highlight, the sum,
// pick again counting empty squares, the highlighter board, rotate + reflect,
// don't place over, the final puzzle.)
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
    check(label, 'the tutorial opens on a first visit', await page.isVisible('#tutorial-overlay'));
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

    check(label, 'there are 10 slides', await frame.locator('.dot').count() === 10, await frame.locator('.dot').count());

    // ── Slide 1: the two goals, each opened with "Show me" ──
    check(label, 'slide 1: both goals start closed, Next not ready', !(await nextReady()) && await F(()=>!document.querySelector('.goal.open')));
    await tap('#goal1 .showme');
    await page.waitForTimeout(8000);
    check(label, 'slide 1: Tiling open, all six pieces dropped in', await F(()=>document.querySelectorAll('#goal-board .mb-piece.ia-on').length) === 6);
    check(label, 'slide 1: one goal seen is not enough for Next', !(await nextReady()));
    await tap('#goal2 .showme');
    const open2 = await F(()=>[1, 2].filter(n=>document.getElementById('goal' + n).classList.contains('open')).join('+'));
    check(label, `slide 1: ${touch ? 'phones keep one goal open' : 'laptops keep both open'}`, open2 === (touch ? '2' : '1+2'), open2);
    await page.waitForTimeout(18500);
    check(label, 'slide 1: Next ready once both goals have played', await nextReady());
    check(label, 'slide 1: no scrolling', await scroll() === 0, await scroll() + 'px');
    await page.screenshot({ path: `tut-${label}-1.png` });
    await next();

    // ── Slide 2: the welcome popup first; nothing plays until Continue ──
    await page.waitForTimeout(1500);
    check(label, 'slide 2: the welcome popup is showing', await popupOpen() && /This tutorial contains all of the rules/.test(await popupText()));
    check(label, 'slide 2: nothing plays behind the popup', await F(()=>document.querySelectorAll('#intro .ia-on').length) === 0);
    await frame.click('#spot-ok');
    check(label, 'slide 2: plays to the end after Continue', await playThrough(30, false));
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

    // ── Slide 4: highlight every empty square; its popup's button moves on ──
    await tap('.hl-pencil');
    const empties = await F(()=>emptyOf(puzzle));
    for(const k of empties){ const [r, c] = k.split(','); await tap(`.board-cell[data-r="${r}"][data-c="${c}"]`); await page.waitForTimeout(120); }
    await page.waitForTimeout(1200);
    check(label, 'slide 4: once all are highlighted, the glowing popup comes', await popupOpen() && /examine this grid/.test(await popupText()));
    await frame.click('#spot-ok');
    await page.waitForTimeout(600);
    check(label, 'slide 4: its "Next →" goes straight to slide 5', await slideNo() === 5, await slideNo());

    // ── Slide 5: the sum (36 − 30 = 6), then "Since this grid is 6 × 6…" and the count ──
    check(label, 'slide 5: plays to the end (pressing each popup)', await playThrough(60));
    check(label, 'slide 5: no scrolling', await scroll() === 0, await scroll() + 'px');
    await page.screenshot({ path: `tut-${label}-5.png` });
    await next();

    // ── Slide 6: pick the grid again, counting empty squares ──
    check(label, 'slide 6: the new wording', /Count the empty squares in every row and column/.test(await F(()=>document.getElementById('pick-ask').innerText)));
    await tap('.pick-btn:nth-child(2)');
    check(label, 'slide 6: the right grid is counted and Next lights up', await playThrough(30, false));
    await next();

    // ── Slide 7: the highlighter board ──
    await page.waitForTimeout(500);
    check(label, 'slide 7: the popup says why ("To narrow down where the pieces can go")', /To narrow down where the pieces can go/.test(await popupText()));
    await frame.click('#spot-ok');
    await page.waitForTimeout(400);
    // (2026-11-16) the "17 ways to tile this grid" text: beside the board on
    // a laptop; on phones a second popup part
    if(touch){
      check(label, 'slide 7: phones: the "17 ways" text is the popup\'s second part', /There are 17 different ways to tile this grid/.test(await popupText()));
      await frame.click('#spot-ok');
    } else check(label, 'slide 7: laptops: the "17 ways" text is beside the board', /There are 17 different ways to tile this grid/.test(await F(()=>document.getElementById('n-boardr').innerText)));
    await page.waitForTimeout(1200);
    check(label, 'slide 7: the highlighter glows until tapped', await F(()=>document.getElementById('hl-tool').classList.contains('glowing')));
    await tap('.hl-pencil');
    for(const k of await F(()=>HL_SIX)){ const [r, c] = k.split(','); await tap(`.board-cell[data-r="${r}"][data-c="${c}"]`); await page.waitForTimeout(150); }
    await page.waitForTimeout(800);
    check(label, 'slide 7: all six found: "✓ All 6 empty squares found!"', /All 6 empty squares found/.test(await F(()=>document.getElementById('n-boardr').innerText)));
    check(label, 'slide 7: N and P drop in by themselves, then the count', await playThrough(30, false));
    await page.screenshot({ path: `tut-${label}-7.png` });
    await next();

    // ── Slide 8: rotate and reflect on one slide ──
    check(label, 'slide 8: three steps (rotate, reflect, drag)', await frame.locator('#n-trayl .step').count() === 3);
    // refresh in the middle: it comes back to this slide
    await page.reload(); await page.waitForTimeout(800);
    frame = page.frames().find(f=>f.url().includes('tutorial.html'));
    check(label, 'a refresh mid-tutorial comes back to slide 8', await page.isVisible('#tutorial-overlay') && await slideNo() === 8, await slideNo());
    for(const [name, target] of Object.entries(TURN_FLIP)) await placePiece(page, frame, name, target, touch);
    check(label, 'slide 8: solved and counted', await playThrough(20, false));
    await next();

    // ── Slide 9: don't place a piece over… ──
    check(label, 'slide 9: the three pictures play, Next lights up', await playThrough(15, false));
    // Back: slide 8 starts over, but Next stays green
    await frame.click('#back-btn'); await page.waitForTimeout(400);
    check(label, 'Back to slide 8: pieces back at the top, Next still ready',
      await F(()=>placedPieces.filter(p=>!p.locked).length) === 0 && await nextReady());
    await next(); await next();

    // ── Slide 10: the final puzzle (no "Make sure…" note; the Hint when uneven) ──
    check(label, 'slide 10: no "Make sure…" note', !(await F(()=>!!document.getElementById('big-note'))));
    const WRONG = { W: [[3,1],[3,2],[4,2],[4,3],[5,3]], P: [[3,5],[4,4],[4,5],[5,4],[5,5]],
                    N: [[0,1],[0,2],[0,3],[1,0],[1,1]], V: [[3,0],[4,0],[5,0],[5,1],[5,2]] };
    for(const [name, target] of Object.entries(WRONG)) await placePiece(page, frame, name, target, touch);
    await page.waitForTimeout(400);
    check(label, 'slide 10: every piece placed but uneven → the Hint button shows', await F(()=>document.getElementById('hint-btn').classList.contains('shown')));
    await frame.click('#hint-btn'); await page.waitForTimeout(400);
    check(label, 'slide 10: the Hint opens on the dotted area', /dotted area/.test(await popupText()));
    await frame.click('#spot-ok'); await page.waitForTimeout(300);
    await frame.click('#spot-ok'); await page.waitForTimeout(300);
    await frame.click('#back-btn'); await page.waitForTimeout(400);
    await frame.click('#next-btn'); await page.waitForTimeout(600);
    for(const [name, target] of Object.entries(FINAL)) await placePiece(page, frame, name, target, touch);
    check(label, 'slide 10: solved and counted, Finish ready', await playThrough(20, false));
    check(label, 'slide 10: the button says Finish', /Finish/.test(await F(()=>document.getElementById('next-btn').textContent)));
    await page.screenshot({ path: `tut-${label}-10.png` });
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
