// The cloud / playtest features, against stand-ins for GitHub and for the
// server (/api/playtest), so nothing real is uploaded. 2026-11-05; folders,
// the Trash and friends' uploads 2026-11-20.
//   - sandbox, OWNER (token): Save keeps every selected piece (even with
//     pieces on the grid); ☁ uploads (again = replace, newest first);
//     "Upload to" picks a folder (+ New folder…); ✕ moves to the Trash
//   - sandbox, FRIEND (no token): the list comes from the server; ☁ adds a
//     NEW puzzle; no server at all = view only
//   - playtest.html: folder buttons, boxes newest first with empty boards;
//     ⋯ moves a puzzle to a folder / the Trash; every folder's Trash button
//     opens the one Trash, Put back returns it; friends can't rename or
//     delete, the owner can; a box opens play.html, tab "Playtest"
//   - tab titles never show a puzzle's own name; published.js has none
//   - the sandbox board goes up to 16 × 16
// Needs the site served over http (fetch doesn't work on file://):
//   run from the project folder:  python3 -m http.server 8765
//   then here:                    node cloud_test.js        (tests/run.js does both)
const { chromium } = require('playwright');
const fs = require('fs');
const ops = require('../../playtest-ops.js');
const BASE = 'http://localhost:8765/';
let failures = 0;
const check = (ok, msg)=>{ console.log((ok ? '  ok   ' : '  FAIL ') + msg); if(!ok) failures++; };
const OWNER = { token:'test', repo:'rmackay0/parity-blocks', branch:'main' };

(async ()=>{
  const browser = await chromium.launch();

  // ── playtest.json, held here; GitHub (owner) and the server (friends) both change it ──
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
  // The server, as api/playtest.js does it (always as a friend)
  const fakeServer = async ctx=>{
    await ctx.route('**/api/playtest*', async route=>{
      const req = route.request();
      const data = ops.normalize(stored ? JSON.parse(stored) : {});
      if(req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      try {
        const out = ops.apply(data, JSON.parse(req.postData()), { owner: false });
        stored = JSON.stringify(out.data); sha++; commits.push(out.message);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: out.result, data: out.data }) });
      } catch(e){ return route.fulfill({ status: e.status || 500, contentType: 'application/json', body: JSON.stringify({ error: e.message }) }); }
    });
  };
  const stored$ = ()=>ops.normalize(JSON.parse(stored));
  const fresh = (ctx, gh)=>ctx.addInitScript(gh=>{ if(!sessionStorage.getItem('x')){ localStorage.clear(); sessionStorage.setItem('x', '1');
    localStorage.setItem('pb_tutorialSeen', '1'); if(gh) localStorage.setItem('pb_github', JSON.stringify(gh)); } }, gh);

  console.log('Sandbox (owner)');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fakeGitHub(ctx);
  await fresh(ctx, OWNER);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  let promptAnswer = '';
  page.on('dialog', d=>d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept());
  await page.goto(BASE + 'sandbox.html');
  await page.waitForTimeout(800);
  check((await page.textContent('#cloud-list')).includes('Nothing in the cloud yet'), 'empty cloud at first');
  check(/owner/.test(await page.textContent('#cloud-who')), 'says you’re the owner');

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

  // Save keeps every selected piece, even with one piece on the grid
  await page.evaluate(()=>{ placedPieces = [Object.assign({ id:'t1', row:0, col:0 }, draft.pieces[0])]; renderAll(); });
  await page.fill('#save-name', 'first_test_name'); await page.click('#save-btn');
  const saved = await page.evaluate(()=>({ n: archive[0].puzzle.pieces.length, want: draft.pieces.length }));
  check(saved.n === saved.want && saved.n > 1, `Save keeps all ${saved.want} selected pieces with one on the grid (saved ${saved.n})`);
  await page.evaluate(()=>{ placedPieces = []; renderAll(); });
  await page.fill('#rows-input', '6'); await page.dispatchEvent('#rows-input', 'change');
  await page.fill('#cols-input', '6'); await page.dispatchEvent('#cols-input', 'change');
  await page.fill('#save-name', 'second_test_name'); await page.click('#save-btn');
  const upload = async (pg, title)=>{
    await pg.locator('#archive-list .arch-item', { hasText: title }).first().locator('[data-act=cloud]').click();
    await pg.waitForFunction(()=>/Uploaded|error|refused|isn’t|aren’t/i.test(document.getElementById('cloud-status').textContent));
  };
  await upload(page, 'first_test_name');
  await upload(page, 'second_test_name');
  let list = stored$().puzzles;
  check(list.length === 2 && list[0].title === 'second_test_name' && list.every(p=>p.folder === 'inbox'), 'both uploaded to the Inbox, newest first');
  check(!list.some(e=>'notes' in e), 'notes are not uploaded');
  await upload(page, 'first_test_name');
  list = stored$().puzzles;
  check(list.length === 2 && list[0].title === 'first_test_name', 'uploading again replaces it and moves it to the front');
  check((await page.locator('#cloud-list .cloud-item').count()) === 2, 'Cloud list shows them');

  // A new folder from "Upload to", then upload into it
  promptAnswer = 'Hard ones';
  await page.selectOption('#cloud-folder', '__new');
  await page.waitForFunction(()=>/Made the folder/.test(document.getElementById('cloud-status').textContent));
  const hard = stored$().folders.find(f=>f.name === 'Hard ones');
  check(!!hard && await page.inputValue('#cloud-folder') === hard.id, '"+ New folder…" makes a folder and picks it');
  await upload(page, 'second_test_name');
  check(stored$().puzzles.find(p=>p.title === 'second_test_name').folder === hard.id, 'the upload goes into the chosen folder');
  check(/Hard ones/.test(await page.textContent('#cloud-status')), 'and says where it went');
  check(commits.every(m=>!/test_name|Hard ones/.test(m)), 'commit messages don\'t name puzzles or folders: ' + [...new Set(commits)].join(' / '));
  await page.screenshot({ path: 'cloud-sandbox.png' });

  // A new browser (empty archive): opening a cloud puzzle adds it to the archive
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fakeGitHub(ctx2);
  await fresh(ctx2, OWNER);
  const page2 = await ctx2.newPage();
  await page2.goto(BASE + 'sandbox.html');
  await page2.waitForSelector('#cloud-list .cloud-item');
  await page2.locator('#cloud-list .cloud-item', { hasText: 'second_test_name' }).locator('.arch-main').click();
  check(await page2.locator('#archive-list .arch-item', { hasText: 'second_test_name' }).count() === 1, 'opening a cloud puzzle on a new browser adds it to the archive');
  check(await page2.inputValue('#save-name') === 'second_test_name', 'and opens it in the sandbox');
  check(await page2.inputValue('#cloud-folder') === 'inbox', 'a new browser uploads to the Inbox at first');
  await ctx2.close();

  // ✕ = to the Trash (not deleted)
  await page.locator('#cloud-list .cloud-item', { hasText: 'first_test_name' }).locator('[data-act=remove]').click();
  await page.waitForFunction(()=>/Moved/.test(document.getElementById('cloud-status').textContent));
  const tr = stored$().puzzles.find(p=>p.title === 'first_test_name');
  check(stored$().puzzles.length === 2 && tr.trashed, '✕ moves it to the Trash (still there)');
  check((await page.locator('#cloud-list .cloud-item').count()) === 1, 'and it leaves the Cloud list');
  check(await page.locator('#archive-list .arch-item', { hasText: 'first_test_name' }).count() === 1, 'but not the archive');
  check(errors.length === 0, 'no page errors ' + errors.join('; '));
  await ctx.close();

  console.log('Sandbox (friend)');
  {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await fakeServer(c);
    await fresh(c, null);
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', e=>errs.push(e.message));
    await p.goto(BASE + 'sandbox.html');
    await p.waitForSelector('#cloud-list .cloud-item');
    check((await p.locator('#cloud-list .cloud-item').count()) === 1, 'a friend sees the cloud list (through the server)');
    check(!/owner/.test(await p.textContent('#cloud-who')), 'not as the owner');
    await p.locator('#cloud-list .cloud-item').first().locator('.arch-main').click();      // (into this archive)
    await upload(p, 'second_test_name');
    const mine = stored$().puzzles.filter(x=>x.title === 'second_test_name');
    check(mine.length === 2, 'a friend’s upload of the same puzzle adds a new one (nothing overwritten)');
    check(errs.length === 0, 'no page errors ' + errs.join('; '));
    await c.close();
  }
  {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await fresh(c, null);
    await c.route('**/playtest.json*', r=>r.fulfill({ status: 200, contentType: 'application/json', body: stored }));
    const p = await c.newPage();
    await p.goto(BASE + 'sandbox.html');       // (no server: python's http.server answers /api with 404)
    await p.waitForSelector('#cloud-list .cloud-item');
    check(/View only/.test(await p.textContent('#cloud-status')), 'no server: the list still shows, "View only"');
    check(await p.locator('#cloud-list [data-act=remove]:visible').count() === 0, 'and has no ✕');
    await c.close();
  }

  console.log('Playtest page');
  // An older puzzle too, for the order
  { const d = stored$(); d.puzzles.push(Object.assign({}, d.puzzles.find(x=>!x.trashed && x.folder === 'inbox'), { id: 'older', title: 'an_older_one', uploadedAt: '2026-10-01T00:00:00.000Z' })); stored = JSON.stringify(d); }
  for(const [w, h, dev] of [[1280, 800, 'laptop'], [390, 844, 'phone']]){
    const c = await browser.newContext({ viewport: { width: w, height: h }, isMobile: dev === 'phone', hasTouch: dev === 'phone' });
    await fakeServer(c);
    await fresh(c, null);
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', e=>errs.push(e.message));
    await p.goto(BASE + 'playtest.html');
    await p.waitForSelector('.box');
    // (the laptop run renames and moves things, so the phone run checks against what's stored then)
    const now = stored$();
    const chips = await p.locator('#folders .chip').allTextContents();
    check(now.folders.every(f=>chips.some(t=>t.startsWith(f.name))) && chips.some(t=>/New folder/.test(t)), `${dev}: folder buttons: ${chips.join(' | ')}`);
    const names = await p.locator('#grid .box b').allTextContents();
    const want = now.puzzles.filter(x=>x.folder === 'inbox' && !x.trashed).sort((a, b)=>b.uploadedAt.localeCompare(a.uploadedAt)).map(x=>x.title);
    check(names.join() === want.join() && !names.includes('first_test_name') && (dev === 'phone' || names[names.length - 1] === 'an_older_one'),
      `${dev}: Inbox boxes newest first, trashed one not shown: ${names.join(', ')}`);
    check(await p.locator('.box svg .mb-piece').count() === 0, `${dev}: boards are empty (no pieces)`);
    check(/noindex/.test(await p.getAttribute('meta[name=robots]', 'content')), `${dev}: asks search engines not to list it`);
    check(await p.isHidden('#delete-folder'), `${dev}: friends get no Delete folder`);
    await p.screenshot({ path: `cloud-playtest-${dev}.png`, fullPage: true });

    if(dev === 'laptop'){
      // ⋯ → move to Hard ones
      await p.locator('#grid .card', { hasText: 'an_older_one' }).locator('.more').click();
      check(await p.locator('#dlg-body button', { hasText: /Rename|Delete/ }).count() === 0, 'a friend’s ⋯ has no Rename / Delete');
      await p.screenshot({ path: 'cloud-playtest-menu.png' });
      await p.locator('#dlg-body button', { hasText: 'Hard ones' }).click();
      await p.waitForSelector('#dlg', { state: 'hidden' });
      check(stored$().puzzles.find(x=>x.id === 'older').folder === hard.id, '⋯ moves a puzzle to another folder');
      // Rename the folder
      await p.locator('#folders .chip', { hasText: 'Hard ones' }).click();
      await p.click('#rename-folder');
      await p.fill('#dlg-body input', 'Tough');
      await p.locator('#dlg-buttons button', { hasText: 'Save' }).click();
      await p.waitForSelector('#dlg', { state: 'hidden' });
      check(stored$().folders.find(f=>f.id === hard.id).name === 'Tough' && await p.textContent('#folder-name') === 'Tough', 'a friend can rename a folder');
      // To the Trash; the folder's Trash button opens the one Trash
      await p.locator('#grid .card', { hasText: 'an_older_one' }).locator('.more').click();
      await p.locator('#dlg-body button', { hasText: 'Move to the Trash' }).click();
      await p.waitForSelector('#dlg', { state: 'hidden' });
      check(stored$().puzzles.find(x=>x.id === 'older').trashed, 'Move to the Trash');
      check(/Trash \(2\)/.test(await p.textContent('#trash-link')), 'the folder’s Trash button counts everything in the Trash: ' + await p.textContent('#trash-link'));
      await p.locator('#folders .chip', { hasText: 'Inbox' }).click();
      check(/Trash \(2\)/.test(await p.textContent('#trash-link')), 'the Inbox’s Trash button leads to the same Trash');
      await p.click('#trash-link');
      const inTrash = await p.locator('#grid .box b').allTextContents();
      check(await p.textContent('#folder-name') === 'Trash' && inTrash.includes('an_older_one') && inTrash.includes('first_test_name'), 'the one Trash holds both: ' + inTrash.join(', '));
      check(/from Tough/.test(await p.locator('#grid .card', { hasText: 'an_older_one' }).textContent()), 'and says which folder each came from');
      await p.screenshot({ path: 'cloud-playtest-trash.png', fullPage: true });
      await p.locator('#grid .card', { hasText: 'an_older_one' }).locator('.more').click();
      await p.locator('#dlg-body button', { hasText: 'Put back in Tough' }).click();
      await p.waitForSelector('#dlg', { state: 'hidden' });
      const back = stored$().puzzles.find(x=>x.id === 'older');
      check(!back.trashed && back.folder === hard.id, 'Put back returns it to its folder');
      check(/Back to Inbox/.test(await p.textContent('#trash-link')), 'the Trash’s Back goes to the folder you came from');
      // New folder from the page
      await p.click('#new-folder');
      await p.fill('#dlg-body input', 'Ideas');
      await p.locator('#dlg-buttons button', { hasText: 'Create' }).click();
      await p.waitForSelector('#dlg', { state: 'hidden' });
      check(stored$().folders.some(f=>f.name === 'Ideas') && await p.textContent('#folder-name') === 'Ideas', 'a friend can make a folder (and lands in it)');
      await p.locator('#folders .chip', { hasText: 'Inbox' }).click();
    }

    await p.locator('#grid .box').first().click();
    await p.waitForSelector('.tray-slot');
    check(await p.title() === 'Parity Blocks: Playtest', `${dev}: puzzle tab says "${await p.title()}"`);
    check(await p.getAttribute('.back-btn', 'href') === 'playtest.html', `${dev}: back button returns to the playtest page`);
    await p.screenshot({ path: `cloud-play-${dev}.png` });
    await p.goto(BASE + 'play.html?playtest=nope');
    await p.waitForTimeout(500);
    check(await p.isVisible('#missing-popup'), `${dev}: a wrong playtest link says "Puzzle not found"`);
    check(errs.length === 0, `${dev}: no page errors ` + errs.join('; '));
    await c.close();
  }

  // A just-uploaded puzzle not yet in the site's playtest.json: play.html asks the server
  {
    const c = await browser.newContext();
    await fakeServer(c);
    await fresh(c, null);
    await c.route('**/playtest.json*', r=>r.fulfill({ status: 200, contentType: 'application/json', body: '{"puzzles":[]}' }));
    const p = await c.newPage();
    await p.goto(BASE + 'play.html?playtest=older');
    await p.waitForSelector('.tray-slot', { timeout: 5000 }).catch(()=>{});
    check(await p.locator('.tray-slot').count() > 0, 'a puzzle the site’s copy doesn’t have yet opens from the server');
    await c.close();
  }

  console.log('Playtest page (owner)');
  {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await fakeGitHub(c);
    await fresh(c, OWNER);
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', e=>errs.push(e.message));
    await p.goto(BASE + 'playtest.html');
    await p.waitForSelector('.box');
    check(/Owner/.test(await p.textContent('#who')), 'says you’re the owner');
    await p.locator('#folders .chip', { hasText: 'Tough' }).click();
    check(await p.isVisible('#delete-folder'), 'the owner gets Delete folder');
    await p.locator('#grid .card', { hasText: 'an_older_one' }).locator('.more').click();
    await p.locator('#dlg-body button', { hasText: 'Rename…' }).click();
    await p.fill('#dlg-body input', 'renamed_one');
    await p.locator('#dlg-buttons button', { hasText: 'Save' }).click();
    await p.waitForSelector('#dlg', { state: 'hidden' });
    check(stored$().puzzles.find(x=>x.id === 'older').title === 'renamed_one', 'the owner can rename a puzzle');
    await p.locator('#grid .card', { hasText: 'renamed_one' }).locator('.more').click();
    await p.locator('#dlg-body button', { hasText: 'Delete forever…' }).click();
    check(/forever\?/.test(await p.textContent('#dlg-title')), 'deleting asks first');
    await p.locator('#dlg-buttons button', { hasText: 'Delete forever' }).click();
    await p.waitForSelector('#dlg', { state: 'hidden' });
    check(!stored$().puzzles.some(x=>x.id === 'older'), 'and deletes it for good');
    await p.click('#delete-folder');
    await p.locator('#dlg-buttons button', { hasText: 'Delete folder' }).click();
    await p.waitForSelector('#dlg', { state: 'hidden' });
    const d = stored$();
    check(!d.folders.some(f=>f.id === hard.id) && d.puzzles.every(x=>x.folder !== hard.id), 'deleting a folder moves its puzzles to the Inbox');
    check(await p.textContent('#folder-name') === 'Inbox', 'and shows the Inbox');
    check(errs.length === 0, 'no page errors ' + errs.join('; '));
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
