// Checks the Claude-created practice puzzles:
//  1. the sandbox adds them to an existing archive once (not twice; a deleted one stays deleted)
//  2. each one opens on the puzzle page and can be solved by clicking + dragging its answer
// Run: node claude_puzzles_test.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { BASE, ROOT, S, check, finish } = require('./lib');
const key = cells => JSON.stringify(S.normalize(cells));
const rotate = c => { const rows = Math.max(...c.map(x=>x[0]))+1; return S.normalize(c.map(([r,q])=>[q, rows-1-r])); };
const reflect = c => { const cols = Math.max(...c.map(x=>x[1]))+1; return S.normalize(c.map(([r,q])=>[r, cols-1-q])); };

// The answers are written in puzzles.js comments: "Answer: I [[0,0],...]  F [[...]] ..."
const src = fs.readFileSync(path.join(ROOT, 'puzzles.js'), 'utf8');
const answers = {};
for (const m of src.matchAll(/Answer: (.*)\n\s*'(claude-[a-z]+-\d)'/g)) {
  answers[m[2]] = [...m[1].matchAll(/([A-Z]) (\[\[.*?\]\])/g)].map(x => ({ name: x[1], cells: JSON.parse(x[2]) }));
}

(async () => {
  const browser = await chromium.launch(); const errors = [];

  // 1. Sandbox archive
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('pb_archive', JSON.stringify([{ id: 'mine-1', title: 'My own puzzle', savedAt: new Date().toISOString(), notes: '', published: [],
      puzzle: { title: 'My own puzzle', rows: 6, cols: 6, blocked: [], pieces: [] } }])); } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('sandbox: ' + e.message));
  await page.goto(BASE + 'sandbox.html'); await page.waitForTimeout(400);
  const titles = () => page.evaluate(() => [...document.querySelectorAll('#archive-list .arch-item b')].map(b => b.textContent));
  const first = await titles();
  check('archive after first visit: 5 Claude puzzles + the user\'s own', [first.length, first.filter(t => t.startsWith('Claude-created')).length, first.includes('My own puzzle')], [6, 5, true]);
  await page.reload(); await page.waitForTimeout(400);
  check('after a reload (no doubles)', (await titles()).length, 6);
  page.once('dialog', d => d.accept());
  await page.locator('#archive-list .arch-item').first().locator('[data-act=delete]').click();
  await page.reload(); await page.waitForTimeout(400);
  check('deleted one, reloaded: it stays deleted', (await titles()).length, 5);
  await page.screenshot({ path: 'sandbox-claude.png' });
  await ctx.close();

  // 2. Play each on the puzzle page
  for (const [id, answer] of Object.entries(answers)) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    p.on('pageerror', e => errors.push(id + ': ' + e.message));
    await p.addInitScript(() => localStorage.setItem('pb_tutorialSeen', '1'));
    await p.goto(BASE + 'play.html?puzzle=' + id); await p.waitForTimeout(300);
    const info = await p.evaluate(() => ({ title: document.title, xs: document.querySelectorAll('.board-cell.blocked').length }));
    for (const { name, cells } of answer) {
      const slot = p.locator(`.tray-slot[data-name="${name}"]`);
      const start = await p.evaluate(n => trayCells[n], name);
      let plan = null;
      for (let f = 0; f < 2 && !plan; f++) { let c = f ? reflect(start) : start;
        for (let k = 0; k < 4; k++) { if (key(c) === key(cells)) { plan = { f, k }; break; } c = rotate(c); } }
      if (plan.f) { await slot.dblclick(); await p.waitForTimeout(350); }
      for (let i = 0; i < plan.k; i++) { await slot.click(); await p.waitForTimeout(350); }
      const now = await p.evaluate(n => trayCells[n], name);
      const rows = Math.max(...now.map(c => c[0])) + 1, cols = Math.max(...now.map(c => c[1])) + 1;
      const r0 = Math.min(...cells.map(c => c[0])), c0 = Math.min(...cells.map(c => c[1]));
      const from = await slot.boundingBox();
      const to = await p.locator(`.board-cell[data-r="${r0 + Math.floor((rows-1)/2)}"][data-c="${c0 + Math.floor((cols-1)/2)}"]`).boundingBox();
      await p.mouse.move(from.x + from.width/2, from.y + from.height/2); await p.mouse.down();
      for (let i = 1; i <= 8; i++) await p.mouse.move(from.x + from.width/2 + (to.x + to.width/2 - from.x - from.width/2)*i/8, from.y + from.height/2 + (to.y + to.height/2 - from.y - from.height/2)*i/8);
      await p.mouse.up(); await p.waitForTimeout(300);
    }
    check(`${id}: tab title, solved by playing`, [info.title, await p.isVisible('#solved-popup')], ['Parity Blocks: Practice', true]);
    await p.screenshot({ path: `play-${id}.png` });
    await p.close();
  }
  check('found the answers in puzzles.js', Object.keys(answers).length, 5);
  await browser.close();
  finish(errors);
})();
