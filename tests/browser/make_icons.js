// Makes the PNG / ICO copies of the tab icon (assets/favicon.svg):
//   assets/favicon-32.png        tab icon for browsers that prefer PNG
//   assets/apple-touch-icon.png  iPhone home screen / Safari (180 × 180, on the page's celadon)
//   favicon.ico                  the file browsers ask for on their own (16 + 32 px inside)
// Run:  node make_icons.js     (rerun whenever favicon.svg changes)
const { chromium } = require('playwright');
const fs = require('fs');
const ROOT = '/Users/robertmackay/Projects/Parity Blocks/';
const svg = fs.readFileSync(ROOT + 'assets/favicon.svg', 'utf8').replace(/<!--[\s\S]*?-->/, '');

// One picture of the icon, size × size px; background '' = see-through
async function render(page, size, background, inset){
  const html = `<html><body style="margin:0;background:${background || 'transparent'}">
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">
      <div style="width:${size - 2*inset}px;height:${size - 2*inset}px">${svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ')}</div>
    </div></body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  return page.screenshot({ omitBackground: !background, clip: { x:0, y:0, width:size, height:size } });
}

// An .ico file holding PNG pictures (all browsers read PNGs inside .ico)
function ico(pngs){
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i)=>{
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e); head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map(p=>p.data)]);
}

(async ()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const p16 = await render(page, 16, '', 0), p32 = await render(page, 32, '', 0);
  fs.writeFileSync(ROOT + 'assets/favicon-32.png', p32);
  fs.writeFileSync(ROOT + 'assets/apple-touch-icon.png', await render(page, 180, '#E3EFED', 30));
  fs.writeFileSync(ROOT + 'favicon.ico', ico([{ size:16, data:p16 }, { size:32, data:p32 }]));
  await browser.close();
  console.log('Made assets/favicon-32.png, assets/apple-touch-icon.png, favicon.ico');
})();
