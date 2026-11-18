// No tutorial slide needs scrolling on a laptop (user, 2026-11-18: "There
// shouldn't be a scroll bar anywhere on a 13 in laptop"). 13" laptop windows
// in Firefox (1440×780, 1280×680) and a 1280×800 laptop in Chromium; slide 1
// with both goals open. (Phones: phone_layout_check.) Run: node laptop_fit_test.js
const { chromium, firefox } = require('playwright');
const { BASE, check, finish } = require('./lib');

const SIZES = [['firefox', 1440, 780], ['firefox', 1280, 680], ['chromium', 1280, 800]];

(async () => {
  const errors = [], engines = { chromium, firefox }, browsers = {};
  for (const [eng, w, h] of SIZES) {
    const browser = browsers[eng] = browsers[eng] || await engines[eng].launch();
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const label = `${eng} ${w}×${h}`;
    page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
    await page.goto(BASE + 'tutorial.html'); await page.waitForTimeout(500);
    const slides = await page.evaluate(() => SLIDES.length), bad = [];
    for (let i = 0; i < slides; i++) {
      await page.evaluate(n => showSlide(n), i); await page.waitForTimeout(700);
      if (i === 0) { await page.click('#goal1 .showme'); await page.click('#goal2 .showme'); await page.waitForTimeout(700); }
      const over = await page.evaluate(() => { const b = document.querySelector('.tut-body'); return b.scrollHeight - b.clientHeight; });
      if (over > 0) bad.push(`slide ${i + 1}: ${over}px`);
    }
    check(`${label}: no slide needs scrolling`, bad, []);
    await page.close();
  }
  for (const b of Object.values(browsers)) await b.close();
  finish(errors);
})();
