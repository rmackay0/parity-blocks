// The moon / sun button (2026-11-02): top left of the start screen and the
// puzzle page; switches dark mode at any time, and the choice carries over
// to other pages. On a laptop and a phone.
// Run with:  node theme_toggle_test.js   (pictures: toggle-*.png in this folder)
const { chromium } = require('playwright');
const BASE = 'file:///Users/robertmackay/Projects/Parity%20Blocks/';

let failures = 0;
function check(label, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (expected ' + JSON.stringify(want) + ')'}`);
}

(async ()=>{
  const browser = await chromium.launch(), errors = [];
  for(const [w, h, label, touch] of [[1280, 800, 'laptop', false], [390, 844, 'phone', true]]){
    const ctx = await browser.newContext({ viewport:{ width:w, height:h }, hasTouch:touch, isMobile:touch });
    await ctx.addInitScript(()=>localStorage.setItem('pb_tutorialSeen', '1'));
    const page = await ctx.newPage();
    page.on('pageerror', e=>errors.push(label + ': ' + e.message));
    const dark = ()=>page.evaluate(()=>document.documentElement.classList.contains('dark'));
    const box = sel=>page.locator(sel).first().boundingBox();

    await page.goto(BASE + 'index.html'); await page.waitForTimeout(300);
    const b = await box('[data-theme-toggle]');
    check(`${label} start screen: button at the top left`, b.x < 40 && b.y < 40, true);
    check(`${label} start screen: light to begin with`, await dark(), false);
    await page.click('[data-theme-toggle]');
    check(`${label} start screen: dark after a tap`, await dark(), true);
    await page.waitForTimeout(400);       // (colors fade over ~0.15 s)
    await page.screenshot({ path:`toggle-${label}-start.png` });

    await page.goto(BASE + 'play.html?level=easy'); await page.waitForTimeout(300);
    check(`${label} puzzle page: still dark`, await dark(), true);
    const back = await box('.back-btn'), t = await box('.top-left [data-theme-toggle]');
    check(`${label} puzzle page: button just right of the back arrow`, t.x > back.x + back.width && t.x - (back.x + back.width) < 20 && Math.abs(t.y - back.y) < 2, true);
    await page.click('.top-left [data-theme-toggle]');
    check(`${label} puzzle page: light after a tap`, await dark(), false);
    check(`${label} puzzle page: says what it would do`, await page.getAttribute('.top-left [data-theme-toggle]', 'aria-label'), 'Switch to dark mode');
    await page.waitForTimeout(400);
    check(`${label} puzzle page: squares turned light`, await page.evaluate(()=>getComputedStyle(document.querySelector('.board-cell')).backgroundColor), 'rgb(251, 251, 248)');
    await page.screenshot({ path:`toggle-${label}-play.png` });
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
  console.log(failures ? failures + ' FAILED' : 'all passed');
})();
