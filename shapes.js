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
  box.className = 'piece-box';
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

/* ── Static board pictures ──
   Used by the rules popup (rules.js) and the puzzle analyzer
   (analyzer.html). Styled by the rb-* classes in rules.css. */
function svgEl(tag, attrs, parent){
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([k,v])=>el.setAttribute(k, v));
  if(parent) parent.appendChild(el);
  return el;
}

function drawPiece(parent, cells, color, x, y, cell, gap){
  const g = svgEl('g', { transform:`translate(${x},${y})` }, parent);
  svgEl('path', { d: buildFillPath(cells, cell, gap), fill: color }, g);
  const div = buildDividers(cells, cell, gap);
  if(div) svgEl('path', { d: div, class:'rb-divider' }, g);
  svgEl('path', { d: buildOutlinePath(cells, cell, gap), class:'rb-outline' }, g);
  return g;
}

// The red "not allowed" sign: a circle with one diagonal slash (like 🚫).
// (Not an X, which would look like a fixed gap.) Returns the group so
// callers can animate it.
function drawNoMark(parent, cx, cy, radius){
  const g = svgEl('g', { class:'rb-nomark' }, parent);
  svgEl('circle', { cx, cy, r: radius, class:'rb-no' }, g);
  const k = radius * Math.SQRT1_2;   // where the slash meets the circle
  svgEl('path', { d:`M${cx-k},${cy-k} L${cx+k},${cy+k}`, class:'rb-no-x' }, g);
  return g;
}

/* Split squares [[r,c]] into groups of squares joined by a side, e.g. two
   dotted squares next to each other get one dotted line around both. */
function groupSquares(cells){
  const left = new Set(cells.map(([r,c])=>r+','+c)), groups = [];
  cells.forEach(([r,c])=>{
    if(!left.has(r+','+c)) return;
    const group = [], todo = [[r,c]];
    left.delete(r+','+c);
    while(todo.length){
      const [a,b] = todo.pop();
      group.push([a,b]);
      [[a+1,b],[a-1,b],[a,b+1],[a,b-1]].forEach(([x,y])=>{
        if(left.has(x+','+y)){ left.delete(x+','+y); todo.push([x,y]); }
      });
    }
    groups.push(group);
  });
  return groups;
}

/* Dotted lines (the dotted area and the dotted squares), drawn so that:
   • each line runs down the middle of the gap between squares;
   • where two dotted shapes touch they share ONE line, never two side by
     side (every edge is drawn once, whichever shapes it belongs to);
   • every straight run starts and ends with a dash, so corners look neat.
   regions  a list of shapes, each a list of squares [[r,c]]
   step     square size + gap (px); gap: the gap between squares (px)
   ox, oy   where square (0,0)'s top-left corner is drawn
   look     { stroke, width, dash, space } */
function drawDottedLines(parent, regions, step, gap, ox, oy, look){
  // Each edge of a square is a unit edge on the grid lines: 'h,row line,col'
  // (horizontal) or 'v,col line,row' (vertical). A shape's border edges are
  // those whose neighbour isn't in the same shape.
  const edges = new Set();
  regions.forEach(cells=>{
    const inside = new Set(cells.map(([r,c])=>r+','+c));
    cells.forEach(([r,c])=>{
      if(!inside.has((r-1)+','+c)) edges.add(`h,${r},${c}`);
      if(!inside.has((r+1)+','+c)) edges.add(`h,${r+1},${c}`);
      if(!inside.has(r+','+(c-1))) edges.add(`v,${c},${r}`);
      if(!inside.has(r+','+(c+1))) edges.add(`v,${c+1},${r}`);
    });
  });
  // Join unit edges that continue in a straight line into one run
  const runs = [];
  ['h', 'v'].forEach(dir=>{
    const byLine = {};
    edges.forEach(e=>{ const [d, line, at] = e.split(','); if(d === dir) (byLine[line] = byLine[line] || []).push(+at); });
    Object.entries(byLine).forEach(([line, ats])=>{
      ats.sort((a,b)=>a-b);
      let start = ats[0], prev = ats[0];
      ats.slice(1).concat([null]).forEach(a=>{
        if(a === prev + 1){ prev = a; return; }
        runs.push({ dir, line: +line, from: start, to: prev + 1 });
        start = prev = a;
      });
    });
  });
  // Grid line k sits in the middle of the gap before square k
  const at = k => k*step - gap/2;
  const w = look.width, dash = look.dash, space = look.space;
  runs.forEach(run=>{
    const len = (run.to - run.from) * step;
    // Stretch the pattern slightly so the run starts and ends on a dash.
    // (Square line ends make each dash w longer, so the pattern allows for it.)
    const n = Math.max(1, Math.round((len + space) / (dash + space)));
    const k = (len + space) / (n * (dash + space));
    const d = run.dir === 'h'
      ? `M${ox + at(run.from)},${oy + at(run.line)} H${ox + at(run.to)}`
      : `M${ox + at(run.line)},${oy + at(run.from)} V${oy + at(run.to)}`;
    svgEl('path', { d, fill:'none', stroke: look.stroke, 'stroke-width': w, 'stroke-linecap':'square',
      'stroke-dasharray': `${Math.max(1, dash*k - w)} ${space*k + w}`, class:'dotted-line' }, parent);
  });
}

// [COLORS] How dotted lines look in the small pictures (rules popup, tutorial slide 3, sandbox)
const PICTURE_DOTTED = { stroke: 'var(--rules-dotted, #d99a4e)', width: 3, dash: 6, space: 4 };

/* A picture of a board, as an <svg>.
   opts:
     rows, cols, cell   board size and square size in px
     pieces             [{cells, color, row, col}]
     gaps               [[r,c]] dotted squares (blocked: a dotted line around each)
     removed            [[r,c]] squares that aren't part of the board (left
                        out; the frame follows the board's shape)
     show               'rows' | 'cols': green/red highlighter on every row or
                        column, with counts.  'solved': counts only.
                        'odd': red highlighter on odd rows AND columns only,
                        counts on both sides (used by the analyzer).
     markEmpty          true: draw a ring in every open square no piece covers
     dotted             [[r,c]] region to trace with a dotted line
     noMarkOn           a piece that breaks a rule: draws the red "not allowed"
                        sign over the whole picture */
function miniBoard(opts){
  const { rows, cols, cell, pieces = [], gaps = [], show = null, dotted = null } = opts;
  const removed = new Set((opts.removed || []).map(([r,c])=>r+','+c));
  const gap = 3, pad = 6, label = 26;   // label = space for the row/column counts
  const step = cell + gap;
  const boardW = cols*cell + (cols-1)*gap + 2*pad;
  const boardH = rows*cell + (rows-1)*gap + 2*pad;
  const rightLabels  = show === 'rows' || show === 'solved' || show === 'odd';
  const bottomLabels = show === 'cols' || show === 'solved' || show === 'odd';
  // Room for counts on both sides whenever any are shown, so pictures
  // side by side are the same size and their captions line up
  // m = margin around the board so highlighter strokes can run past its edge
  const m = show ? 8 : 0;
  const w = boardW + (show ? label : 0) + 2*m;
  const h = boardH + (show ? label : 0) + 2*m;
  const outer = svgEl('svg', { width: w, height: h, viewBox:`0 0 ${w} ${h}`, 'aria-hidden':'true' });
  const svg = svgEl('g', { transform:`translate(${m},${m})` }, outer);

  if(removed.size){
    // irregular board: a frame that hugs the existing squares
    const present = [];
    for(let r=0; r<rows; r++) for(let c=0; c<cols; c++) if(!removed.has(r+','+c)) present.push([r,c]);
    if(present.length) svgEl('path', { d: buildFillPath(present, cell, gap), class:'rb-frame', stroke:'currentColor',
      'stroke-width': 2*pad, 'stroke-linejoin':'round', transform:`translate(${pad},${pad})`, style:'color:var(--rules-board)' }, svg);
  } else {
    svgEl('rect', { x:0, y:0, width:boardW, height:boardH, rx:8, class:'rb-frame' }, svg);
  }
  const isGap = (r,c)=>gaps.some(([gr,gc])=>gr===r && gc===c);
  for(let r=0; r<rows; r++) for(let c=0; c<cols; c++){
    const x = pad + c*step, y = pad + r*step;
    if(removed.has(r+','+c)) continue;
    svgEl('rect', { x, y, width:cell, height:cell, rx:3, class:'rb-cell' }, svg);
  }

  pieces.forEach(p=>drawPiece(svg, p.cells, p.color, pad + p.col*step, pad + p.row*step, cell, gap));

  if(opts.markEmpty){
    const covered = new Set();
    pieces.forEach(p=>p.cells.forEach(([r,c])=>covered.add((p.row+r)+','+(p.col+c))));
    for(let r=0; r<rows; r++) for(let c=0; c<cols; c++){
      if(isGap(r,c) || removed.has(r+','+c) || covered.has(r+','+c)) continue;
      svgEl('circle', { cx: pad + c*step + cell/2, cy: pad + r*step + cell/2, r: cell*0.22, class:'rb-empty' }, svg);
    }
  }

  // The dotted area and the dotted squares (squares that share a side are one shape)
  const dottedShapes = (dotted && dotted.length ? [dotted] : []).concat(groupSquares(gaps));
  if(dottedShapes.length) drawDottedLines(svg, dottedShapes, step, gap, pad, pad, PICTURE_DOTTED);

  // Count filled blocks per row/column and mark each green (even) or red (odd)
  if(show){
    const filled = new Set();
    pieces.forEach(p=>p.cells.forEach(([r,c])=>filled.add((p.row+r)+','+(p.col+c))));
    const rowCount = r=>{ let n=0; for(let c=0;c<cols;c++) if(filled.has(r+','+c)) n++; return n; };
    const colCount = c=>{ let n=0; for(let r=0;r<rows;r++) if(filled.has(r+','+c)) n++; return n; };
    const cls = n=>(n % 2 ? 'rb-odd' : 'rb-even');

    // Highlighter strokes, same look as the game (buildHighlighterPath in
    // shapes.js), running a little past the board's edge
    const thick = cell * 0.65, over = m;
    const rowMark = r=>{ const y = pad + r*step + cell/2;
      svgEl('path', { d: buildHighlighterPath(-over, y, boardW+over, y, thick, r+1), class:'rb-hl '+cls(rowCount(r)) }, svg); };
    const colMark = c=>{ const x = pad + c*step + cell/2;
      svgEl('path', { d: buildHighlighterPath(x, -over, x, boardH+over, thick, c+11), class:'rb-hl '+cls(colCount(c)) }, svg); };
    if(show === 'rows')   for(let r=0; r<rows; r++) rowMark(r);
    if(show === 'cols')   for(let c=0; c<cols; c++) colMark(c);
    if(show === 'odd'){
      for(let r=0; r<rows; r++) if(rowCount(r) % 2) rowMark(r);
      for(let c=0; c<cols; c++) if(colCount(c) % 2) colMark(c);
    }
    // 'solved' draws no strokes, just the all-green counts

    if(rightLabels) for(let r=0; r<rows; r++){
      const t = svgEl('text', { x: boardW + m + label/2, y: pad + r*step + cell/2, 'text-anchor':'middle', 'dominant-baseline':'central', class:'rb-count '+cls(rowCount(r)) }, svg);
      t.textContent = rowCount(r);
    }
    if(bottomLabels) for(let c=0; c<cols; c++){
      const t = svgEl('text', { x: pad + c*step + cell/2, y: boardH + m + label/2, 'text-anchor':'middle', 'dominant-baseline':'central', class:'rb-count '+cls(colCount(c)) }, svg);
      t.textContent = colCount(c);
    }
  }

  // The sign covers the whole picture (not just the piece), so it never
  // seems to point at one square in particular
  if(opts.noMarkOn) drawNoMark(svg, boardW/2, boardH/2, Math.min(boardW, boardH)/2 - 2);
  return outer;
}
