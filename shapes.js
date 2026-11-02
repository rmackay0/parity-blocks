/* Shared piece geometry and drawing, used by play.html and rules.js.
   Cells are [row, col] pairs relative to a piece's top-left corner. */

const SVG_NS = 'http://www.w3.org/2000/svg';

/* [COLORS] Piece colors: the "Woodblock" palette (user's pick, 2026-11-02),
   colors from Japanese woodblock prints. The first six are the ones the
   user saw and liked; the rest are extras in the same spirit, for puzzles
   with more pieces. The game hands them out in PIECE_PALETTE order
   (game.js); the rules pictures and the tutorial pick them by name.
   The level colors (Easy moss, Medium gold, Hard wisteria) are here too.
   (Kelly's contrast colors were used before this.) */
const INKS = {
  indigo:     '#2B4C7E',
  gold:       '#E8B33B',
  vermilion:  '#E2483D',
  moss:       '#7BA05B',
  sakura:     '#F2A7B8',   // cherry blossom
  asagi:      '#3E8E9E',   // pale indigo-teal
  wisteria:   '#8E6FB0',
  persimmon:  '#EC8A3D',
  sky:        '#86AED6',
  plum:       '#A0507A',
  pine:       '#4E7D5B',
  slate:      '#8A97A8',
};

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
    // (a line runs half a gap past the block only where four blocks meet,
    // so lines there join up with no break; never into an empty inside
    // corner, e.g. round the middle of an X, where it showed as a blob)
    if(hasCellAt(cells, r, c+1)){
      const up = hasCellAt(cells, r-1, c) && hasCellAt(cells, r-1, c+1);
      const dn = hasCellAt(cells, r+1, c) && hasCellAt(cells, r+1, c+1);
      segs.push(`M${x+size+gap/2},${up ? y - gap/2 : y} V${dn ? y + size + gap/2 : y + size}`);
    }
    if(hasCellAt(cells, r+1, c)){
      const lf = hasCellAt(cells, r, c-1) && hasCellAt(cells, r+1, c-1);
      const rt = hasCellAt(cells, r, c+1) && hasCellAt(cells, r+1, c+1);
      segs.push(`M${lf ? x - gap/2 : x},${y+size+gap/2} H${rt ? x + size + gap/2 : x + size}`);
    }
  });
  return segs.join(' ');
}
function svgPath(d, attrs){
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  Object.entries(attrs).forEach(([k,v])=>p.setAttribute(k, v));
  return p;
}
/* A darker shade of a '#rrggbb' color (amount 0–1 toward black), for a
   piece's own lines. Anything else (e.g. a CSS variable) gets a see-through
   black instead. */
function shadeColor(color, amount){
  const m = /^#([0-9a-f]{6})$/i.exec(color || '');
  if(!m) return 'rgba(0,0,0,0.45)';
  const n = parseInt(m[1], 16), k = 1 - amount;
  const ch = s=>Math.round(((n >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/* [COLORS] How a piece looks (user, 2026-11-02: a line separating each
   block, clean lines; then "simplify the look a lot"):
     • one flat fill in the piece's color;
     • a thin line between neighbouring blocks, and one outline round the
       whole piece, both a darker shade of the piece's own color;
     • (innerSquares: true adds a lighter square inside each block; tried
       and turned off for a simpler look.)
   All lines sit on whole pixels so they stay sharp. */
const PIECE_LOOK = {
  innerSquares: false,
  inset: 0.2,           // inner square's margin, as a fraction of a block
  insetFill: 'rgba(255,255,255,0.17)',
  lineShade: 0.32,      // how much darker the lines are than the piece
  outline: 1.5,         // outline width (px; kept fine, easier on the eyes)
  divider: 1.5,         // line between blocks (px; at most the gap between squares)
};
// Draw a piece's fill, inner squares and lines into an SVG element
function drawPieceParts(parent, cells, color, size, gap){
  const line = shadeColor(color, PIECE_LOOK.lineShade);
  parent.appendChild(svgPath(buildFillPath(cells, size, gap), { fill: color, class:'piece-fill' }));
  const ins = Math.max(2, Math.round(size * PIECE_LOOK.inset));
  if(PIECE_LOOK.innerSquares && size - 2*ins >= 4){
    const sq = cells.map(([r,c])=>{
      const x = c*(size+gap) + ins, y = r*(size+gap) + ins, s = size - 2*ins;
      return `M${x},${y} h${s} v${s} h${-s} Z`;
    }).join(' ');
    parent.appendChild(svgPath(sq, { fill: PIECE_LOOK.insetFill }));
  }
  const dividers = buildDividers(cells, size, gap);
  if(dividers) parent.appendChild(svgPath(dividers, { fill:'none', stroke: line,
    'stroke-width': Math.max(1, Math.min(PIECE_LOOK.divider, gap || PIECE_LOOK.divider)) }));
  parent.appendChild(svgPath(buildOutlinePath(cells, size, gap), { fill:'none', stroke: line,
    'stroke-width': PIECE_LOOK.outline, 'stroke-linejoin':'miter', class:'piece-outline' }));
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
  drawPieceParts(svg, cells, color, size, gap);
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
  drawPieceParts(g, cells, color, cell, gap);   // (same look as the game's pieces)
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
   • each runs down the middle of the gap between squares, as wide as it;
   • where two dotted shapes touch they share ONE line, never two side by
     side (every edge is drawn once, whichever shapes it belongs to);
   • where dotted lines meet, the point is filled; flat ends, no rounding.
   regions  a list of shapes, each a list of squares [[r,c]]
   step     square size + gap (px); gap: the gap between squares (px)
   ox, oy   where square (0,0)'s top-left corner is drawn
   look     { stroke, width (default: the gap), dash, space, onBoard }
            onBoard  (r, c) => is that square part of the board? A line along
                     the board's own edge isn't drawn: the frame is already a
                     wall, and a line there stuck out past the grid. */
function drawDottedLines(parent, regions, step, gap, ox, oy, look){
  // Each edge of a square is a unit edge on the grid lines: 'h,row line,col'
  // (horizontal) or 'v,col line,row' (vertical). A shape's border edges are
  // those whose neighbour isn't in the same shape (and is on the board).
  const edges = new Set();
  const on = look.onBoard || (()=>true);
  regions.forEach(cells=>{
    const inside = new Set(cells.map(([r,c])=>r+','+c));
    const edge = (r, c, key)=>{ if(!inside.has(r+','+c) && on(r, c)) edges.add(key); };
    cells.forEach(([r,c])=>{
      edge(r-1, c, `h,${r},${c}`);
      edge(r+1, c, `h,${r+1},${c}`);
      edge(r, c-1, `v,${c},${r}`);
      edge(r, c+1, `v,${c+1},${r}`);
    });
  });
  // Each edge is drawn on its own, down the middle of the gap between two
  // squares, with flat (not rounded) ends:
  //   • it runs on over the little gap squares where gaps cross, so where
  //     two dotted lines meet (a corner, or two edges in a row) that point
  //     is filled in;
  //   • but not past the board's edge: there it stops level with the
  //     squares, so nothing juts out into the frame;
  //   • the same dash pattern on every edge, stretched to start and end on
  //     a dash.
  const cell = step - gap;
  const w = look.width || gap, dash = look.dash, space = look.space;
  const at = k => k*step - gap/2;            // the middle of the gap before square k
  const dashG = svgEl('g', {}, parent);
  [...edges].sort().forEach(e=>{
    const [dir, lineS, alongS] = e.split(',');
    const line = +lineS, along = +alongS;
    // Is there board on the far side of each end's crossing? (the squares
    // either side of this grid line, one step further along)
    const beyond = dir === 'h'
      ? [ on(line-1, along-1) || on(line, along-1), on(line-1, along+1) || on(line, along+1) ]
      : [ on(along-1, line-1) || on(along-1, line), on(along+1, line-1) || on(along+1, line) ];
    const from = along*step - (beyond[0] ? gap : 0);
    const to = along*step + cell + (beyond[1] ? gap : 0);
    const len = to - from;
    const n = Math.max(1, Math.round((len + space) / (dash + space)));
    const k = (len + space) / (n * (dash + space));
    const d = dir === 'h' ? `M${ox + from},${oy + at(line)} H${ox + to}` : `M${ox + at(line)},${oy + from} V${oy + to}`;
    svgEl('path', { d, fill:'none', stroke: look.stroke, 'stroke-width': w, 'stroke-linecap':'butt',
      'stroke-dasharray': `${dash*k} ${space*k}`, class:'dotted-line' }, dashG);
  });
}

// [COLORS] How dotted lines look in the small pictures (rules popup, tutorial slide 3, sandbox)
// (white dashes in the black gaps, like the board's)
const PICTURE_DOTTED = { stroke: 'var(--rules-dotted, #fff)', dash: 5, space: 3 };

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
  // gap = between squares, pad = the frame round the board (separate
  // rounded squares, like the game's); label = room for the counts
  const gap = 3, pad = 6, label = 26;
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

  // (Each piece in its own group, class mb-piece, so the Solved popup can
  // drop them in one by one: animating the group itself would undo the
  // translate that puts the piece in place)
  pieces.forEach(p=>drawPiece(svgEl('g', { class:'mb-piece' }, svg), p.cells, p.color, pad + p.col*step, pad + p.row*step, cell, gap));

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
  const onBoard = (r,c)=>r>=0 && c>=0 && r<rows && c<cols && !removed.has(r+','+c);
  if(dottedShapes.length) drawDottedLines(svg, dottedShapes, step, gap, pad, pad, Object.assign({ onBoard }, PICTURE_DOTTED));

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
