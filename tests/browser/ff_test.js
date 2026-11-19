// Fast forward ▸▸ (2026-11-17; was skip_test): on each tutorial slide that
// plays an animation, a round ▸▸ button sits just right of it while it
// plays; pressing it plays the rest faster (not a jump to the end): the
// slide still finishes properly, ▸▸ goes away, Next is ready.
// Laptop and phone. Run: node ff_test.js
const { chromium, webkit } = require('playwright');
const { BASE, check, finish } = require('./lib');

(async () => {
  const errors = [];
  // (WebKit too, since 2026-11-19: Safari on iPhones and Macs)
  for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  for (const [w, h, dev, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]]) {
    const device = `${engine.name()} ${dev}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${device}: ${e.message}`));
    const shown = () => page.isVisible('#ff-btn');
    const nextReady = () => page.evaluate(() => document.getElementById('next-btn').classList.contains('ready'));
    // Is ▸▸ right of (or tucked into the corner of) the given element?
    const beside = sel => page.evaluate(sel => {
      const b = document.getElementById('ff-btn').getBoundingClientRect(), r = document.querySelector(sel).getBoundingClientRect();
      const midY = b.top + b.height / 2;
      // (right of it, or astride its bottom edge at the right when there's no room)
      return (b.left >= r.right - b.width - 14) && midY >= r.top - 4 && midY <= r.bottom + b.height;
    }, sel);
    // Press ▸▸ and wait for it to go (the animation over); seconds taken
    // (2026-11-19, user: on slide 1's Tiling ▸▸ "turns on for a second and
    // then turns itself off". So every frame after the press is watched:
    // ▸▸ must stay on until it goes for good, never flick back to normal
    // speed or hide and come back. `states` = each change seen, in order;
    // the right answer is ['on', 'hidden'].)
    let states = [];
    const fastForward = async () => {
      const t0 = Date.now();
      await page.click('#ff-btn');
      states = await page.evaluate(() => new Promise(done => {
        const b = document.getElementById('ff-btn'), seen = [];
        let hiddenSince = null;
        const tick = () => {
          const s = b.hidden ? 'hidden' : b.classList.contains('active') ? 'on' : 'off';
          if (seen[seen.length - 1] !== s) seen.push(s);
          const now = performance.now();
          hiddenSince = s === 'hidden' ? (hiddenSince || now) : null;
          if (hiddenSince && now - hiddenSince > 1200) return done(seen);    // (gone for good)
          if (seen.length > 8) return done(seen);
          requestAnimationFrame(tick);
        };
        tick();
      }));
      return (Date.now() - t0 - 1200) / 1000;
    };
    const steady = label => check(`${device} ${label}: ▸▸ stays on until the end`, states, ['on', 'hidden']);

    // Slide 1: the Tiling drags (≈7 s at normal speed)
    await page.goto(BASE + 'tutorial.html?slide=1'); await page.waitForTimeout(400);
    check(`${device} slide 1: no ▸▸ before anything plays`, await shown(), false);
    await page.click('#goal1 .showme'); await page.waitForTimeout(1000);
    check(`${device} slide 1: ▸▸ shows beside the pieces while they move`, [await shown(), await beside('#goal-board')], [true, true]);
    const s1 = await fastForward();
    steady('slide 1 Tiling');
    check(`${device} slide 1: fast forward plays the rest quickly (< 2.5 s)`, s1 < 2.5, true);
    check(`${device} slide 1: then all six pieces on the grid, no copies left, ▸▸ gone`,
      [await page.evaluate(() => document.querySelectorAll('#goal-board .mb-piece.ia-on').length), await page.evaluate(() => document.querySelectorAll('.drag-ghost').length), await shown()], [6, 0, false]);
    check(`${device} slide 1: no pointer on the moving pieces`, await page.evaluate(() => !document.querySelector('.drag-pointer')), true);
    await page.click('#goal2 .showme'); await page.waitForTimeout(800);
    await fastForward();
    steady('slide 1 Parity');
    check(`${device} slide 1: both goals played: Next ready`, await nextReady(), true);

    // (2026-11-18, user: ▸▸ only on animations over 5 s that people wait
    // through, not ones they learn from)
    // Slide 2: the words animation is read, not waited through: no ▸▸
    await page.goto(BASE + 'tutorial.html?slide=2'); await page.waitForTimeout(500);   // (no welcome popup since 2026-11-18)
    let seen2 = false;
    for (let k = 0; k < 8; k++) { await page.waitForTimeout(500); seen2 = seen2 || await shown(); }
    check(`${device} slide 2: no ▸▸ while the words play`, seen2, false);

    // Slide 3: the wrong grid's count (stops at its first odd line): no ▸▸;
    // then the right grid's full count: ▸▸ beside the grids
    await page.goto(BASE + 'tutorial.html?slide=3'); await page.waitForTimeout(500);
    await page.evaluate(() => PICK_BOARDS.find(b => !b.right).btn.click()); await page.waitForTimeout(600);
    check(`${device} slide 3: no ▸▸ while the wrong grid is counted`, await shown(), false);
    await page.waitForFunction(() => !document.getElementById('ff-btn').hidden, null, { timeout: 15000 }).catch(() => {});
    check(`${device} slide 3: ▸▸ beside the grids while the right one is counted`, [await shown(), await beside('#pick-boards > :last-child')], [true, true]);
    // (2026-11-19, user: after ▸▸ the success message popped in twice in
    // Safari) watch its animations: none may start over, none sped up
    await page.evaluate(() => {
      window.__badge = { restarted: false, fast: false };
      const last = new Map(), t0 = performance.now();
      const tick = () => {
        const b = document.querySelector('#pick-msg .win-badge');
        if (b) [b, ...b.querySelectorAll('*')].flatMap(e => e.getAnimations()).forEach(a => {
          // (Safari can read a little past the end, then settle on the end
          // as it finishes: not a restart)
          if (a.playState !== 'finished' && a.currentTime < (last.get(a) || 0) - 1) window.__badge.restarted = true;
          if (a.playbackRate !== 1) window.__badge.fast = true;
          last.set(a, a.currentTime);
        });
        if (performance.now() - t0 < 20000) requestAnimationFrame(tick);
      };
      tick();
    });
    const s3 = await fastForward();
    steady('slide 3');
    await page.waitForTimeout(1500);
    check(`${device} slide 3: the success message pops in once, at normal speed`, await page.evaluate(() => window.__badge), { restarted: false, fast: false });
    check(`${device} slide 3: fast forward is quick (< 3 s)`, s3 < 3, true);
    check(`${device} slide 3: then Next ready, ▸▸ gone`, [await nextReady(), await shown()], [true, false]);

    // Slide 7 (2026-11-18): "Show me" plays the 17 ways (≈ 9 s): ▸▸ just
    // right of the count; the popup demos after it go with words: no ▸▸
    await page.goto(BASE + 'tutorial.html?slide=6'); await page.waitForTimeout(500);   // (8 slides since 2026-11-18)
    await page.click('#spot-ok'); await page.waitForTimeout(1800);
    check(`${device} slide 6: no ▸▸ before Show me`, await shown(), false);
    await page.click('#ways-btn'); await page.waitForTimeout(800);
    check(`${device} slide 6: ▸▸ beside the count while the ways play`, [await shown(), await beside('#demo-count')], [true, true]);
    const s7 = await fastForward();
    steady('slide 6');
    check(`${device} slide 6: fast forward is quick (< 3 s), then Continue`,
      [s7 < 3, await page.evaluate(() => /Continue/.test(document.getElementById('ways-btn').textContent))], [true, true]);
    await page.click('#ways-btn');
    let seen7 = false;
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 4; j++) { await page.waitForTimeout(400); seen7 = seen7 || await shown(); }
      if (await page.isVisible('#spot-ok')) await page.click('#spot-ok');
    }
    check(`${device} slide 6: no ▸▸ during the popup demos`, seen7, false);

    // (the "don't place a piece over" slide was removed 2026-11-18)
    await ctx.close();
  }
  await browser.close();
  }
  finish(errors);
})();
