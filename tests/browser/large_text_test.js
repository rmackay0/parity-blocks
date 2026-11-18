// Large text reaches every bit of text (2026-11-16; the user found slide 3's
// first line staying small). Opens each tutorial slide twice, Standard and
// Large text, side by side at the same moments, and fails on any visible text
// that isn't bigger in Large. Also the rules popup and the puzzle page's
// messages. Laptop and phone.
// Run: node large_text_test.js        (SLIDE=3 for one slide)
const { chromium } = require('playwright');
const { BASE, check, finish } = require('./lib');

// Runs in the page: font size of every visible element with its own text,
// keyed by a path that's the same in both windows
function sizes(scope){
  const out = {};
  const roots = scope.map(s => document.querySelector(s)).filter(Boolean);
  const pathOf = el => { const parts = [];
    for (let e = el; e && e !== document.body; e = e.parentElement)
      parts.unshift(e.id ? '#' + e.id : e.tagName.toLowerCase() + ':' + [...e.parentElement.children].indexOf(e));
    return parts.join('>'); };
  for (const root of roots) for (const el of root.querySelectorAll('*')) {
    // Only reading text grows: titles and buttons stay the same (the rule in
    // tutorial.html's Large text styles)
    if (el.closest('svg, [hidden], .sr-only, button, a, h1, h2, h3, [class*="title"]')) continue;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    // (a word inside a sentence, e.g. a teal term, goes with its sentence)
    if (el.parentElement && getComputedStyle(el.parentElement).fontSize === cs.fontSize
        && [...el.parentElement.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    // (arrows, ▾, step numbers: no words to read)
    if (!/[a-z]{2}/i.test(el.textContent)) continue;
    out[pathOf(el)] = { px: parseFloat(cs.fontSize), text: el.textContent.trim().slice(0, 50) };
  }
  return out;
}
const SCOPE = ['.tut-body', '#spot', '.rules-popup', '#status', '#solved-popup'];

(async () => {
  const browser = await chromium.launch(); const errors = [];
  const only = process.env.SLIDE ? +process.env.SLIDE : 0;
  for (const [w, h, device, touch] of [[1280, 860, 'laptop', false], [390, 844, 'phone', true]]) {
    // Two windows, Standard and Large, doing the same things
    const pages = [];
    for (const large of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
      await ctx.addInitScript(l => { localStorage.setItem('pb_tutorialSeen', '1'); localStorage.setItem('pb_largeText', l ? '1' : '0'); }, large);
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(`${device}${large ? ' large' : ''}: ${e.message}`));
      pages.push(page);
    }
    const both = f => Promise.all(pages.map(f));
    // Compare now: text in Large must be bigger than in Standard, or already
    // big (BIG px or more: headings)
    const BIG = 24;
    const seen = new Set();
    const compare = async (where) => {
      const [std, big] = await both(p => p.evaluate(sizes, SCOPE));
      for (const [k, s] of Object.entries(std)) {
        const b = big[k];
        if (!b || b.px > s.px || b.px >= BIG || seen.has(k)) continue;
        seen.add(k);
        check(`${device} ${where}: "${s.text}" in Large text (px; Standard ${s.px})`, b.px, `more than ${s.px}`);
      }
      return Object.keys(std).length;
    };

    // The tutorial, slide by slide, a few moments into each
    await both(p => p.goto(BASE + 'tutorial.html'));
    const slides = await pages[0].evaluate(() => SLIDES.length);
    let compared = 0;
    for (let n = 1; n <= slides; n++) {
      if (only && n !== only) continue;
      await both(p => p.goto(BASE + 'tutorial.html?slide=' + n));
      // (many moments: some labels, like slide 5's "Counting the squares",
      // only show for a second or two)
      let was = 0;
      for (const t of [600, 1500, 2500, 3500, 5000, 7000, 9000]) {
        await pages[0].waitForTimeout(t - was); was = t;
        compared += await compare(`slide ${n}`);
        // Get past popups so the text under them is seen too
        await both(async p => { if (await p.isVisible('#spot-ok')) await p.click('#spot-ok'); });
      }
      // (2026-11-18) slide 7: Show me (the count), Continue, the popup steps,
      // then the right way ("Parity achieved!" and its Next)
      if (await pages[0].isVisible('#ways-btn')) {
        await both(p => p.click('#ways-btn')); await pages[0].waitForTimeout(1500);
        compared += await compare(`slide ${n} the ways playing`);
        await both(async p => { if (await p.isVisible('#ff-btn')) await p.click('#ff-btn'); });
        await pages[0].waitForTimeout(2500);
        await both(p => p.click('#ways-btn')); await pages[0].waitForTimeout(500);
        for (let k = 0; k < 2; k++) { await both(p => p.click('#spot-ok')); await pages[0].waitForTimeout(500); }
        compared += await compare(`slide ${n} the choice`);
        await both(p => p.click('#way-choices .way-btn:nth-child(2)')); await pages[0].waitForTimeout(800);
        compared += await compare(`slide ${n} parity achieved`);
      }
      // Pick slides: pick the right grid, then see the message
      if (await pages[0].evaluate(() => SLIDES[current].kind === 'pick')) {
        await both(p => p.evaluate(() => PICK_BOARDS.find(b => b.right).btn.click()));
        await pages[0].waitForTimeout(6000);
        compared += await compare(`slide ${n} after picking`);
      }
    }
    check(`${device}: compared text on the slides`, compared > 50, true);

    if (!only) {
      // The rules popup on the start screen
      await both(p => p.goto(BASE + 'index.html'));
      await both(p => p.click('.rules-top')); await pages[0].waitForTimeout(300);
      await compare('rules popup');
      // The puzzle page's Solved popup
      await both(p => p.goto(BASE + 'play.html?level=easy'));
      await pages[0].waitForTimeout(300);
      await compare('puzzle page');
    }
    await Promise.all(pages.map(p => p.context().close()));
  }
  await browser.close();
  finish(errors);
})();
