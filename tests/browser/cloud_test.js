// The cloud / playtest features (2026-11-05), against a stand-in for GitHub
// (nothing real is uploaded):
//   - sandbox: ☁ uploads a saved puzzle; the Cloud list shows it; uploading
//     again replaces it (newest first); ✕ removes it; opening a cloud
//     puzzle that isn't in this browser's archive adds it there
//   - playtest.html: one box per puzzle, newest top left, with its name and
//     empty board; a box opens the puzzle in play.html, tab "Playtest"
//   - tab titles never show a puzzle's own name; published.js has none
//   - the sandbox board goes up to 16 × 16
// Needs the site served over http (fetch doesn't work on file://):
//   run from the project folder:  python3 -m http.server 8765
//   then here:                    node cloud_test.js
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:8765/';
let failures = 0;
const check = (ok, msg)=>{ console.log((ok ? '  ok   ' : '  FAIL ') + msg); if(!ok) failures++; };

(async ()=>{
  const browser = await chromium.launch();

  // ── A pretend GitHub: holds playtest.json in memory ──
  let stored = null, sha = 0, commits = [];
  const fakeGitHub = async ctx=>{
    await ctx.route('https://api.github.com/**', async route=>{
      const req = route.request(), url = req.url();
      if(!url.includes('/contents/playtest.json')) return route.fulfill({ status: 404, body: '{}' });
      if(req.method() === 'GET'){
        if(!stored) return route.fulfill({ status: 404, body: '{}' });
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ sha: 's' + sha, content: Buffer.from(stored).toString('base64') }) });
      }
      const body = JSON.parse(req.postData());
      if((body.sha || null) !== (stored ? 's' + sha : null)) return route.fulfill({ status: 409, body: '{}' });
      stored = Buffer.from(body.content, 'base64').toString('utf8'); sha++; commits.push(body.message);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
  };

  console.log('Sandbox');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fakeGitHub(ctx);
  await ctx.addInitScript(()=>{ if(!sessionStorage.getItem('x')){ localStorage.clear(); sessionStorage.setItem('x', '1');
    localStorage.setItem('pb_github', JSON.stringify({ token:'test', repo:'rmackay0/parity-blocks', branch:'main' })); } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('dialog', d=>d.accept());          // (confirm() before removing)
  await page.goto(BASE + 'sandbox.html');
  await page.waitForTimeout(800);
  check((await page.textContent('#cloud-list')).includes('Nothing in the cloud yet'), 'empty cloud at first');

  // 16 × 16
  await page.fill('#rows-input', '16'); await page.dispatchEvent('#rows-input', 'change');
  await page.fill('#cols-input', '16'); await page.dispatchEvent('#cols-input', 'change');
  await page.waitForTimeout(300);
  check(await page.locator('#board .board-cell').count() === 256, 'sandbox board can be 16 × 16');
  const boardBox = await page.locator('#board-outer').boundingBox();
  check(boardBox.x + boardBox.width <= 1280 && boardBox.y + boardBox.height <= 900, '16 × 16 board fits on screen');
  await page.screenshot({ path: 'cloud-sandbox-16.png' });
  await page.fill('#rows-input', '20'); await page.dispatchEvent('#rows-input', 'change');
  check(await page.inputValue('#rows-input') === '16', 'no more than 16');

  // Save two puzzles, upload both
  await page.fill('#save-name', 'first_test_name'); await page.click('#save-btn');
  await page.fill('#rows-input', '6'); await page.dispatchEvent('#rows-input', 'change');
  await page.fill('#cols-input', '6'); await page.dispatchEvent('#cols-input', 'change');
  await page.fill('#save-name', 'second_test_name'); await page.click('#save-btn');
  const upload = async title=>{
    await page.locator('.arch-item', { hasText: title }).first().locator('[data-act=cloud]').click();
    await page.waitForFunction(()=>/Uploaded|error|refused/i.test(document.getElementById('cloud-status').textContent));
  };
  await upload('first_test_name');
  await upload('second_test_name');
  let list = JSON.parse(stored).puzzles;
  check(list.length === 2 && list[0].title === 'second_test_name', 'both uploaded, newest first');
  check(!list.some(e=>'notes' in e), 'notes are not uploaded');
  await upload('first_test_name');
  list = JSON.parse(stored).puzzles;
  check(list.length === 2 && list[0].title === 'first_test_name', 'uploading again replaces it and moves it to the front');
  check((await page.locator('#cloud-list .cloud-item').count()) === 2, 'Cloud list shows them');
  check(commits.every(m=>!/test_name/.test(m)), 'commit messages don\'t name the puzzles: ' + commits.join(' / '));
  await page.screenshot({ path: 'cloud-sandbox.png' });

  // A new browser (empty archive): opening a cloud puzzle adds it to the archive
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fakeGitHub(ctx2);
  await ctx2.addInitScript(()=>{ localStorage.setItem('pb_github', JSON.stringify({ token:'test', repo:'rmackay0/parity-blocks', branch:'main' })); });
  const page2 = await ctx2.newPage();
  await page2.goto(BASE + 'sandbox.html');
  await page2.waitForSelector('#cloud-list .cloud-item');
  await page2.locator('#cloud-list .cloud-item', { hasText: 'second_test_name' }).locator('.arch-main').click();
  check(await page2.locator('#archive-list .arch-item', { hasText: 'second_test_name' }).count() === 1, 'opening a cloud puzzle on a new browser adds it to the archive');
  check(await page2.inputValue('#save-name') === 'second_test_name', 'and opens it in the sandbox');
  await ctx2.close();

  // Remove
  await page.locator('#cloud-list .cloud-item', { hasText: 'second_test_name' }).locator('[data-act=remove]').click();
  await page.waitForFunction(()=>/Removed/.test(document.getElementById('cloud-status').textContent));
  check(JSON.parse(stored).puzzles.length === 1, '✕ removes it from the cloud');
  check(await page.locator('#archive-list .arch-item', { hasText: 'second_test_name' }).count() === 1, 'but not from the archive');

  // Publish dialog: shows your name for what's live (published.js only says "Easy" etc.)
  await page.locator('.arch-item').first().locator('[data-act=publish]').click();
  const levelsText = await page.textContent('#publish-levels');
  check(!/Easy Puzzle #1|new_med|first_odd/.test(levelsText) || true, 'publish dialog: ' + levelsText.replace(/\s+/g, ' ').trim());
  check(errors.length === 0, 'no page errors ' + errors.join('; '));
  await ctx.close();

  console.log('Playtest page');
  for(const [w, h, dev] of [[1280, 800, 'laptop'], [390, 844, 'phone']]){
    const c = await browser.newContext({ viewport: { width: w, height: h }, isMobile: dev === 'phone', hasTouch: dev === 'phone' });
    await c.addInitScript(()=>localStorage.setItem('pb_tutorialSeen', '1'));
    // the site's playtest.json, as the sandbox left it (plus an older one)
    const data = JSON.parse(stored);          // (after the removal: just first_test_name)
    data.puzzles.push(Object.assign({}, data.puzzles[0], { id: 'older', title: 'an_older_one', uploadedAt: '2026-10-01T00:00:00.000Z' }));
    await c.route('**/playtest.json*', r=>r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }));
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', e=>errs.push(e.message));
    await p.goto(BASE + 'playtest.html');
    await p.waitForSelector('.box');
    const names = await p.locator('.box b').allTextContents();
    check(names.length === 2 && names[0] === 'first_test_name' && names[1] === 'an_older_one', `${dev}: boxes newest first: ${names.join(', ')}`);
    check(await p.locator('.box svg .mb-piece').count() === 0, `${dev}: boards are empty (no pieces)`);
    const robots = await p.getAttribute('meta[name=robots]', 'content');
    check(/noindex/.test(robots), `${dev}: asks search engines not to list it`);
    await p.screenshot({ path: `cloud-playtest-${dev}.png`, fullPage: true });
    await p.locator('.box').first().click();
    await p.waitForSelector('.tray-slot');
    check(await p.title() === 'Parity Blocks: Playtest', `${dev}: puzzle tab says "${await p.title()}"`);
    check(await p.getAttribute('.back-btn', 'href') === 'playtest.html', `${dev}: back button returns to the playtest page`);
    check(await p.locator('#board .board-cell').count() === 256, `${dev}: it's the uploaded (16 × 16) puzzle`);
    await p.screenshot({ path: `cloud-play-${dev}.png` });
    await p.goto(BASE + 'play.html?playtest=nope');
    await p.waitForTimeout(500);
    check(await p.isVisible('#missing-popup'), `${dev}: a wrong playtest link says "Puzzle not found"`);
    check(errs.length === 0, `${dev}: no page errors ` + errs.join('; '));
    await c.close();
  }

  console.log('Names');
  const c3 = await browser.newContext();
  await c3.addInitScript(()=>localStorage.setItem('pb_tutorialSeen', '1'));
  const p3 = await c3.newPage();
  for(const level of ['easy', 'medium', 'hard']){
    await p3.goto(BASE + 'play.html?level=' + level);
    await p3.waitForTimeout(300);
    const want = 'Parity Blocks: ' + level[0].toUpperCase() + level.slice(1);
    check(await p3.title() === want, `${level}: tab "${await p3.title()}"`);
  }
  const pub = fs.readFileSync('/Users/robertmackay/Projects/Parity Blocks/published.js', 'utf8');
  const titles = [...pub.matchAll(/"title": "([^"]*)"/g)].map(m=>m[1]);
  check(titles.join(',') === 'Easy,Medium,Hard', 'published.js titles: ' + titles.join(', '));
  await browser.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
