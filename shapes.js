/* Shared piece geometry and drawing, used by play.html and rules.js.
   Cells are [row, col] pairs relative to a piece's top-left corner. */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ── Geometry ── */
function normalize(cells){
  const minR = Math.min(...cells.map(c=>c[0]));
  const minC = Math.min(...cells.map(c=>c[1]));
  return cells.map(([r,c])=>[r-minR, c-minC]);
}
function bounds(cells){
  return { rows: Math.max(...cells.map(c=>c[0]))+1, cols: Math.max(...cells.map(c=>c[1]))+1 };
}
function rotateCells(cells){
  const {rows} = bounds(cells);
  return normalize(cells.map(([r,c])=>[c, rows-1-r]));
}
function reflectCells(cells){
  const {cols} = bounds(cells);
  return normalize(cells.map(([r,c])=>[r, cols-1-c]));
}
function hasCellAt(cells, r, c){ return cells.some(([cr,cc])=>cr===r && cc===c); }

/* ═══════════════════════════════════════════════════════════════════
   PIECE DRAWING
   A piece is one SVG: a single fill, thin divider lines between its own
   squares, and one traced outline (no per-square borders, which showed
   hairline seams on high-DPI screens). Same approach as the sandbox.
═══════════════════════════════════════════════════════════════════ */
function buildPieceRects(cells, size, gap){
  const rects = [];
  cells.forEach(([r,c])=>{
    const x = c*(size+gap), y = r*(size+gap);
    rects.push([x, y, x+size, y+size]);
    if(hasCellAt(cells, r, c+1)) rects.push([x+size, y, x+size+gap, y+size]);
    if(hasCellAt(cells, r+1, c)) rects.push([x, y+size, x+size, y+size+gap]);
    if(hasCellAt(cells, r, c+1) && hasCellAt(cells, r+1, c) && hasCellAt(cells, r+1, c+1)){
      rects.push([x+size, y+size, x+size+gap, y+size+gap]);
    }
  });
  return rects;
}
function buildFillPath(cells, size, gap){
  return buildPieceRects(cells, size, gap).map(([x0,y0,x1,y1])=>`M${x0},${y0} H${x1} V${y1} H${x0} Z`).join(' ');
}
function buildOutlinePath(cells, size, gap){
  const rects = buildPieceRects(cells, size, gap);
  const xsSet = new Set(), ysSet = new Set();
  rects.forEach(([x0,y0,x1,y1])=>{ xsSet.add(x0); xsSet.add(x1); ysSet.add(y0); ysSet.add(y1); });
  const xs = [...xsSet].sort((a,b)=>a-b), ys = [...ysSet].sort((a,b)=>a-b);
  const nx = xs.length-1, ny = ys.length-1;
  const occ = Array.from({length:ny}, (_,iy)=>Array.from({length:nx}, (_,ix)=>{
    const cx = (xs[ix]+xs[ix+1])/2, cy = (ys[iy]+ys[iy+1])/2;
    return rects.some(([x0,y0,x1,y1])=>cx>x0 && cx<x1 && cy>y0 && cy<y1);
  }));
  const occAt = (iy,ix)=>iy>=0 && iy<ny && ix>=0 && ix<nx && occ[iy][ix];
  const next = new Map(), key = (x,y)=>x+','+y;
  for(let iy=0; iy<ny; iy++) for(let ix=0; ix<nx; ix++){
    if(!occ[iy][ix]) continue;
    const x0=xs[ix], x1=xs[ix+1], y0=ys[iy], y1=ys[iy+1];
    if(!occAt(iy-1,ix)) next.set(key(x0,y0), [x1,y0]);
    if(!occAt(iy,ix+1)) next.set(key(x1,y0), [x1,y1]);
    if(!occAt(iy+1,ix)) next.set(key(x1,y1), [x0,y1]);
    if(!occAt(iy,ix-1)) next.set(key(x0,y1), [x0,y0]);
  }
  const visited = new Set(), loops = [];
  for(const startKey of next.keys()){
    if(visited.has(startKey)) continue;
    const pts = [];
    let cur = startKey, guard = 0;
    do {
      visited.add(cur);
      pts.push(cur.split(',').map(Number));
      const n = next.get(cur);
      if(!n) break;
      cur = key(n[0], n[1]);
    } while(cur !== startKey && ++guard < 10000);
    if(pts.length >= 3) loops.push(pts);
  }
  return loops.map(pts=>{
    const n = pts.length;
    const kept = pts.filter((p,i)=>{
      const a = pts[(i-1+n)%n], b = pts[(i+1)%n];
      return (p[0]-a[0])*(b[1]-p[1]) - (p[1]-a[1])*(b[0]-p[0]) !== 0;
    });
    return 'M'+kept.map(p=>p.join(',')).join('L')+'Z';
  }).join(' ');
}
function buildDividers(cells, size, gap){
  const segs = [];
  cells.forEach(([r,c])=>{
    const x = c*(size+gap), y = r*(size+gap);
    if(hasCellAt(cells, r, c+1)) segs.push(`M${x+size+gap/2},${y} V${y+size}`);
    if(hasCellAt(cells, r+1, c)) segs.push(`M${x},${y+size+gap/2} H${x+size}`);
  });
  return segs.join(' ');
}
function svgPath(d, attrs){
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  Object.entries(attrs).forEach(([k,v])=>p.setAttribute(k, v));
  return p;
}
function buildPieceShape(cells, color, size, gap){
  const {rows, cols} = bounds(cells);
  const w = cols*size + (cols-1)*gap, h = rows*size + (rows-1)*gap;
  const box = document.createElement('div');
  box.style.position = 'relative';
  box.style.width = w + 'px';
  box.style.height = h + 'px';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.classList.add('piece-svg');
  svg.style.position = 'absolute';
  svg.style.overflow = 'visible';
  svg.appendChild(svgPath(buildFillPath(cells, size, gap), { fill: color }));
  const dividers = buildDividers(cells, size, gap);
  if(dividers) svg.appendChild(svgPath(dividers, { fill:'none', stroke:'rgba(0,0,0,0.25)', 'stroke-width':'1.5' }));
  svg.appendChild(svgPath(buildOutlinePath(cells, size, gap), { fill:'none', stroke:'rgba(0,0,0,0.45)', 'stroke-width':'2', 'stroke-linejoin':'round' }));
  box.appendChild(svg);

  // Invisible per-square hit areas, so a drag knows which square was grabbed
  cells.forEach(([r,c])=>{
    const blk = document.createElement('div');
    blk.className = 'blk';
    blk.dataset.dr = r;
    blk.dataset.dc = c;
    Object.assign(blk.style, {
      position:'absolute', left: c*(size+gap)+'px', top: r*(size+gap)+'px',
      width: size+'px', height: size+'px'
    });
    box.appendChild(blk);
  });
  return box;
}

/* ── Highlighter stroke ──
   A hand-drawn-looking marker stroke along a straight horizontal or vertical
   line from (x0,y0) to (x1,y1), `thickness` wide: straight ends and
   slightly wavy edges. `seed` varies the wobble so
   neighboring strokes don't look identical. Returns an SVG path string. */
function buildHighlighterPath(x0, y0, x1, y1, thickness, seed){
  let s = (seed * 9301 + 49297) % 233280;
  const rand = ()=>{ s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  const vertical = x0 === x1;
  const a0 = vertical ? y0 : x0, a1 = vertical ? y1 : x1;   // along the line
  const mid = vertical ? x0 : y0;                            // the line's position
  // slant: how much the ends are cut at an angle (0 = straight ends)
  const h = thickness / 2, slant = 0, wob = thickness * 0.14;
  const pt = (along, across)=>vertical ? `${mid+across},${along}` : `${along},${mid+across}`;
  const am = (a0 + a1) / 2;
  return 'M' + pt(a0 + slant, -h + rand()*wob)
    + ' Q' + pt(am, -h + rand()*wob*2) + ' ' + pt(a1, -h + rand()*wob)
    + ' L' + pt(a1 - slant, h + rand()*wob)
    + ' Q' + pt(am, h + rand()*wob*2) + ' ' + pt(a0, h + rand()*wob)
    + ' Z';
}
