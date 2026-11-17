// One color per pentomino, everywhere (user, 2026-11-14 / 2026-11-16: "make
// sure the colors are always linked" after seeing sandbox colors change).
// Fails if a piece shows any color but its letter's (PIECE_COLOR, shapes.js):
//   - the sandbox, while pieces are added to and removed from the puzzle
//   - each published level (the pieces at the top and placed on the board)
//   - every tutorial slide
// Run: node piece_colors_test.js
const { chromium } = require('playwright');
const { BASE, solution, check, finish } = require('./lib');

// Runs in the page: each piece whose color isn't its letter's, as "L #123456"
function wrongColors(){
  const bad = [];
  const fillOf = el => { const f = el && el.querySelector('[fill]:not([fill="none"])'); return f && f.getAttribute('fill'); };
  const want = n => PIECE_COLOR[n] && PIECE_COLOR[n].toLowerCase();
  document.querySelectorAll('.tray-slot').forEach(s => { const n = s.dataset.name, f = fillOf(s);
    if (want(n) && f && f.toLowerCase() !== want(n)) bad.push(`top ${n} ${f}`); });
  if (typeof placedPieces !== 'undefined') placedPieces.forEach(p => {
    if (want(p.name) && String(p.color).toLowerCase() !== want(p.name)) bad.push(`board ${p.name} ${p.color}`); });
  document.querySelectorAll('#picker .pick.on').forEach(el => { const n = el.textContent.trim(), f = fillOf(el);
    if (want(n) && f && f.toLowerCase() !== want(n)) bad.push(`picker ${n} ${f}`); });
  return bad;
}

(async () => {
  const browser = await chromium.launch(); const errors = [];
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('pb_tutorialSeen', '1'));
  page.on('pageerror', e => errors.push(e.message));

  // 1. Sandbox: add and remove pieces, checking after every change
  await page.goto(BASE + 'sandbox.html'); await page.waitForTimeout(400);
  const seen = [];
  for (const name of ['F', 'I', 'L', 'X', 'W', 'Z', 'F', 'T', 'Y', 'U', 'N', 'V', 'P', 'I']) {
    await page.locator('#picker .pick', { hasText: new RegExp('^' + name + '$') }).click(); await page.waitForTimeout(150);
    seen.push(...await page.evaluate(wrongColors));
  }
  check('sandbox: adding / removing 14 times, every piece keeps its color', seen, []);

  // 2. Each published level, its answer placed
  for (const level of ['easy', 'medium', 'hard']) {
    const answer = solution(level);
    await page.goto(BASE + 'play.html?level=' + level); await page.waitForTimeout(300);
    const before = await page.evaluate(wrongColors);
    await page.evaluate(ps => { placedPieces = placedPieces.filter(p => p.locked).concat(ps.map((p, i) => ({ id: 'c' + i, color: puzzle.pieces.find(d => d.name === p.name).color, ...p }))); renderAll(); }, answer);
    check(`${level}: every piece in its own color (top, then on the board)`, before.concat(await page.evaluate(wrongColors)), []);
  }

  // 3. Every tutorial slide
  await page.goto(BASE + 'tutorial.html');
  const slides = await page.evaluate(() => SLIDES.length), bad = [];
  for (let n = 1; n <= slides; n++) {
    await page.goto(BASE + 'tutorial.html?slide=' + n); await page.waitForTimeout(400);
    bad.push(...(await page.evaluate(wrongColors)).map(b => `slide ${n}: ${b}`));
  }
  check('tutorial: every slide\'s pieces in their own colors', bad, []);

  await browser.close();
  finish(errors);
})();
