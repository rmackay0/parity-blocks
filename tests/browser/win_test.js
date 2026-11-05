// The win animation in the Solved popup (user's spec, 2026-11-05):
//   - green bands exactly the grid's size (nothing past its edge)
//   - order: row 1, column 1, row 2, column 2, ...
//   - then the whole board green, a squash, and on the big note the
//     numbers vanish and a check mark pops in
//   - the board (not the picture with its numbers) centred in the popup
//   - "Medium" above "Solved!", in Medium's color
// Laptop + phone, light + dark, Medium and Hard (Hard has cut squares).
// Pictures: win-*.png (frames at several moments).
// Run:  node win_test.js
const { chromium } = require('playwright');
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');
const fs = require('fs');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';
const PUB = JSON.parse(fs.readFileSync('/Users/robertmackay/Projects/Parity Blocks/published.js', 'utf8').split('/*JSON*/')[1].split('/*END*/')[0]);
let failures = 0;
const check = (ok, msg)=>{ console.log((ok ? '  ok   ' : '  FAIL ') + msg); if(!ok) failures++; };

function solution(level){
  const p = PUB[level].puzzle;
  const res = S.analyzePuzzle({ rows:p.rows, cols:p.cols, blocked:p.blocked, removed:p.removed, dotted:p.hintOutline,
    pieces: p.pieces.map(d=>({ name:d.name, cells:d.cells })) });
  return res.tilings.find(t=>t.parity).placements.map(pl=>{
    const r0 = Math.min(...pl.cells.map(c=>c[0])), c0 = Math.min(...pl.cells.map(c=>c[1]));
    return { name:pl.piece, row:r0, col:c0, cells:pl.cells.map(([r,c])=>[r-r0, c-c0]) };
  });
}

(async ()=>{
  const browser = await chromium.launch();
  for(const [w, h, dev] of [[1280, 800, 'laptop'], [390, 844, 'phone']])
  for(const theme of ['light', 'dark'])
  for(const level of ['medium', 'hard']){
    const label = `${dev}-${theme}-${level}`;
    console.log(label);
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, isMobile: dev === 'phone', hasTouch: dev === 'phone' });
    await ctx.addInitScript(t=>{ localStorage.clear(); localStorage.setItem('pb_tutorialSeen', '1'); localStorage.setItem('pb_theme', t); }, theme);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(BASE + 'play.html?level=' + level);
    await page.waitForTimeout(400);
    await page.evaluate(ps=>{
      placedPieces = ps.map((p, i)=>({ id:'t' + i, color: puzzle.pieces.find(d=>d.name === p.name).color, ...p }));
      renderAll();
    }, solution(level));
    const t0 = Date.now();
    const at = async (sec, name)=>{
      const wait = sec*1000 - (Date.now() - t0);
      if(wait > 0) await page.waitForTimeout(wait);
      if(name && theme === 'light') await page.locator('#solved-popup .popup').screenshot({ path: `win-${dev}-${level}-${name}.png` });
    };

    // Order of the bands: row, column, row, column ...
    const order = await page.evaluate(()=>[...document.querySelectorAll('#solved-win .win-band')].map(b=>+b.getAttribute('width') > +b.getAttribute('height') ? 'R' : 'C').join(''));
    const p = await page.evaluate(()=>({ rows: puzzle.rows, cols: puzzle.cols }));
    let want = '';
    for(let i = 0; i < Math.max(p.rows, p.cols); i++){ if(i < p.rows) want += 'R'; if(i < p.cols) want += 'C'; }
    check(order === want, `bands in turns: ${order}`);

    // The bands never go past the grid's squares
    const inside = await page.evaluate(()=>{
      const cells = [...document.querySelectorAll('#solved-win .rb-cell')].map(c=>c.getBoundingClientRect());
      const g = { l: Math.min(...cells.map(r=>r.left)), t: Math.min(...cells.map(r=>r.top)), r: Math.max(...cells.map(r=>r.right)), b: Math.max(...cells.map(r=>r.bottom)) };
      return [...document.querySelectorAll('#solved-win .win-band')].every(b=>{
        const r = b.getBoundingClientRect(); return r.left >= g.l - 0.5 && r.top >= g.t - 0.5 && r.right <= g.r + 0.5 && r.bottom <= g.b + 0.5; });
    });
    check(inside, 'bands stay within the grid');
    const clipped = await page.evaluate(()=>!!document.querySelector('#solved-win [clip-path]'));
    check(clipped, 'bands clipped to the squares (cut squares stay clear)');

    // The board is centred in the popup
    const centre = await page.evaluate(()=>{
      const pop = document.querySelector('#solved-popup .popup').getBoundingClientRect();
      const frame = document.querySelector('#solved-win .rb-frame').getBoundingClientRect();
      return Math.round((frame.left + frame.width/2) - (pop.left + pop.width/2));
    });
    check(Math.abs(centre) <= 2, `board centred in the popup (off by ${centre}px)`);

    // Level above "Solved!", in its color
    const lv = await page.evaluate(()=>{ const l = document.querySelector('#solved-win .win-level'), t = document.querySelector('#solved-win .win-title');
      return l && { text: l.textContent, color: getComputedStyle(l).color, above: l.getBoundingClientRect().bottom <= t.getBoundingClientRect().top + 1,
                    want: getComputedStyle(document.documentElement).getPropertyValue('--color-' + document.querySelector('#solved-win .win-level').classList[1]).trim() }; });
    check(lv && lv.text === level[0].toUpperCase() + level.slice(1) && lv.above, `"${lv && lv.text}" above "Solved!"`);
    const hex = c=>'#' + c.match(/\d+/g).slice(0, 3).map(n=>(+n).toString(16).padStart(2, '0')).join('').toUpperCase();
    check(lv && hex(lv.color) === lv.want.toUpperCase(), `in its level's color (${lv && hex(lv.color)} vs ${lv && lv.want})`);

    await at(0.45, '1-lines');
    await at(0.95, '2-lines');
    await at(1.3, '3-green');
    await at(1.4, '4-squash');
    await at(1.62, '5-check');
    await at(3.2, '6-end');
    const end = await page.evaluate(()=>({
      counts: [...document.querySelectorAll('#solved-win .rb-count')].every(c=>getComputedStyle(c).opacity === '0'),
      check: getComputedStyle(document.querySelector('#solved-win .win-check-big')).opacity,
      cover: getComputedStyle(document.querySelector('#solved-win .win-cover')).opacity,
    }));
    check(end.counts && end.check === '1' && end.cover === '1', 'at the end: no numbers, green board, check mark ' + JSON.stringify(end));
    check(!errors.length, 'no page errors ' + errors.join('; '));
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
