/* ═══════════════════════════════════════════════════════════════════
   RULES POPUP
   Shared by index.html and play.html. Needs shapes.js loaded first, and
   rules.css for its look.

   Opens:
     • automatically the first time someone visits (either page), and
     • whenever anything with a data-open-rules attribute is clicked
       (the "Rules" buttons).

   [CONTENT] The wording is in RULES_TEXT just below. The example boards
   in the pictures are in EXAMPLE further down. They're a made-up board,
   deliberately NOT one of the real puzzles, so the pictures never give a
   solution away.
═══════════════════════════════════════════════════════════════════ */
(function(){

const RULES_TEXT = {
  title: 'How to Play',
  goalsHeading: 'Goals',
  goal1: 'Place every piece.',
  goal2: 'Make sure that every row and every column has an even number of blocks in it.',
  goal2Hint: 'Hint: pay more attention to the evenness of the empty blocks.',
  checkRows: 'Check rows',
  checkCols: 'Check columns',
  allEven: 'All even: solved!',
  rulesHeading: 'Rules',
  reflect: 'Pieces can be reflected.',
  rotate: 'Pieces can be rotated.',
  gap: 'You can’t place a piece on a gap.',
  dotted: 'You can’t place a piece across a dotted perimeter.',
  ok: 'Got it',
};

// [BEHAVIOR] Remembers that this visitor has seen the rules, so the popup
// only opens by itself once. Clear this key (or rename it) to show it to
// everyone again, e.g. after changing the rules.
const SEEN_KEY = 'pb_rulesSeen';

/* ── Example boards (6x6). Each piece: color, cells, top-left row/col ── */
const EX_P = { color:'#b8923f', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] };
const EX_U = { color:'#a85c4a', cells:[[0,0],[0,2],[1,0],[1,1],[1,2]] };
const EX_T = { color:'#5a7d8c', cells:[[0,0],[0,1],[0,2],[1,1],[2,1]] };
const EX_V = { color:'#8a9c5a', cells:[[0,0],[0,1],[0,2],[1,0],[2,0]] };
const EXAMPLE = {
  // Every row and column has an even number of filled blocks
  solved: [ {...EX_P, row:0, col:4}, {...EX_U, row:4, col:0}, {...EX_T, row:3, col:2}, {...EX_V, row:2, col:1} ],
  // Same pieces, V moved up-left one square: rows 2 & 5 and columns 1 & 4 go odd
  wrong:  [ {...EX_P, row:0, col:4}, {...EX_U, row:4, col:0}, {...EX_T, row:3, col:2}, {...EX_V, row:1, col:0} ],
};
const F_PIECE = { color:'#7d6aa8', cells:[[0,1],[0,2],[1,0],[1,1],[2,1]] };

/* ═══════════════════════════════════════════════════════════════════
   DRAWING HELPERS
═══════════════════════════════════════════════════════════════════ */
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

// The red "not allowed" mark: a circle with a cross through it
function drawNoMark(parent, cx, cy, radius){
  svgEl('circle', { cx, cy, r: radius, class:'rb-no' }, parent);
  const k = radius * 0.5;
  svgEl('path', { d:`M${cx-k},${cy-k} L${cx+k},${cy+k} M${cx+k},${cy-k} L${cx-k},${cy+k}`, class:'rb-no-x' }, parent);
}

/* A small picture of a board.
   opts: rows, cols, cell, pieces, gaps [[r,c]], show: 'rows' | 'cols' | 'solved',
         dotted [[r,c]] region, noMarkOn (a piece to draw the red mark over) */
function miniBoard(opts){
  const { rows, cols, cell, pieces = [], gaps = [], show = null, dotted = null } = opts;
  const gap = 3, pad = 6, label = 18;
  const step = cell + gap;
  const boardW = cols*cell + (cols-1)*gap + 2*pad;
  const boardH = rows*cell + (rows-1)*gap + 2*pad;
  const rightLabels  = show === 'rows' || show === 'solved';
  const bottomLabels = show === 'cols' || show === 'solved';
  // Room for counts on both sides whenever any are shown, so pictures
  // side by side are the same size and their captions line up
  const w = boardW + (show ? label : 0);
  const h = boardH + (show ? label : 0);
  const svg = svgEl('svg', { width: w, height: h, viewBox:`0 0 ${w} ${h}`, 'aria-hidden':'true' });

  svgEl('rect', { x:0, y:0, width:boardW, height:boardH, rx:8, class:'rb-frame' }, svg);
  const isGap = (r,c)=>gaps.some(([gr,gc])=>gr===r && gc===c);
  for(let r=0; r<rows; r++) for(let c=0; c<cols; c++){
    const x = pad + c*step, y = pad + r*step;
    if(isGap(r,c)){
      svgEl('rect', { x:x+0.5, y:y+0.5, width:cell-1, height:cell-1, rx:3, class:'rb-gap' }, svg);
      const k = cell*0.28;
      svgEl('path', { d:`M${x+cell/2-k},${y+cell/2-k} L${x+cell/2+k},${y+cell/2+k} M${x+cell/2+k},${y+cell/2-k} L${x+cell/2-k},${y+cell/2+k}`, class:'rb-gap-x' }, svg);
    } else {
      svgEl('rect', { x, y, width:cell, height:cell, rx:3, class:'rb-cell' }, svg);
    }
  }

  pieces.forEach(p=>drawPiece(svg, p.cells, p.color, pad + p.col*step, pad + p.row*step, cell, gap));

  if(dotted){
    const minR = Math.min(...dotted.map(c=>c[0])), minC = Math.min(...dotted.map(c=>c[1]));
    const rel = dotted.map(([r,c])=>[r-minR, c-minC]);
    svgEl('path', { d: buildOutlinePath(rel, cell, gap), class:'rb-dotted', transform:`translate(${pad + minC*step},${pad + minR*step})` }, svg);
  }

  // Count filled blocks per row/column and mark each green (even) or red (odd)
  if(show){
    const filled = new Set();
    pieces.forEach(p=>p.cells.forEach(([r,c])=>filled.add((p.row+r)+','+(p.col+c))));
    const rowCount = r=>{ let n=0; for(let c=0;c<cols;c++) if(filled.has(r+','+c)) n++; return n; };
    const colCount = c=>{ let n=0; for(let r=0;r<rows;r++) if(filled.has(r+','+c)) n++; return n; };
    const cls = n=>(n % 2 ? 'rb-odd' : 'rb-even');

    if(show === 'rows') for(let r=0; r<rows; r++){
      svgEl('rect', { x:pad-3, y:pad + r*step - 1.5, width:boardW - 2*pad + 6, height:cell+3, rx:4, class:'rb-band '+cls(rowCount(r)) }, svg);
    }
    if(show === 'cols') for(let c=0; c<cols; c++){
      svgEl('rect', { x:pad + c*step - 1.5, y:pad-3, width:cell+3, height:boardH - 2*pad + 6, rx:4, class:'rb-band '+cls(colCount(c)) }, svg);
    }
    if(show === 'solved') svgEl('rect', { x:1.5, y:1.5, width:boardW-3, height:boardH-3, rx:7, class:'rb-solved' }, svg);

    if(rightLabels) for(let r=0; r<rows; r++){
      const t = svgEl('text', { x: boardW + label/2, y: pad + r*step + cell/2, 'text-anchor':'middle', 'dominant-baseline':'central', class:'rb-count '+cls(rowCount(r)) }, svg);
      t.textContent = rowCount(r);
    }
    if(bottomLabels) for(let c=0; c<cols; c++){
      const t = svgEl('text', { x: pad + c*step + cell/2, y: boardH + label/2, 'text-anchor':'middle', 'dominant-baseline':'central', class:'rb-count '+cls(colCount(c)) }, svg);
      t.textContent = colCount(c);
    }
  }

  if(opts.noMarkOn){
    const p = opts.noMarkOn, b = bounds(p.cells);
    const cx = pad + p.col*step + (b.cols*step - gap)/2;
    const cy = pad + p.row*step + (b.rows*step - gap)/2;
    drawNoMark(svg, cx, cy, cell*0.8);
  }
  return svg;
}

function pieceOnly(cells, color, cell){
  const gap = 3, b = bounds(cells);
  const w = b.cols*cell + (b.cols-1)*gap, h = b.rows*cell + (b.rows-1)*gap;
  const svg = svgEl('svg', { width:w+4, height:h+4, viewBox:`-2 -2 ${w+4} ${h+4}`, 'aria-hidden':'true' });
  drawPiece(svg, cells, color, 0, 0, cell, gap);
  return svg;
}

function arrowSvg(curved){
  const svg = svgEl('svg', { width:60, height:44, viewBox:'0 0 60 44', 'aria-hidden':'true' });
  if(curved){
    // clockwise arc with an arrowhead at its end
    svgEl('path', { d:'M12 30 A18 18 0 1 1 46 28', class:'rb-arrow' }, svg);
    svgEl('path', { d:'M38 24 L46 28 L49 19', class:'rb-arrow' }, svg);
  } else {
    svgEl('path', { d:'M8 22 H50 M41 13 L50 22 L41 31', class:'rb-arrow' }, svg);
  }
  return svg;
}

function figure(content, caption){
  const fig = document.createElement('figure');
  fig.className = 'rules-figure';
  fig.appendChild(content);
  if(caption){
    const fc = document.createElement('figcaption');
    fc.textContent = caption;
    fig.appendChild(fc);
  }
  return fig;
}

function item(parent, texts, visuals, rowClass){
  const div = document.createElement('div');
  div.className = 'rules-item';
  texts.forEach(([text, cls, num])=>{
    const p = document.createElement('p');
    if(cls) p.className = cls;
    if(num){ const s = document.createElement('span'); s.className = 'rules-num'; s.textContent = num; p.appendChild(s); }
    p.appendChild(document.createTextNode(text));
    div.appendChild(p);
  });
  const row = document.createElement('div');
  row.className = 'rules-visuals' + (rowClass ? ' ' + rowClass : '');
  visuals.forEach(v=>row.appendChild(v));
  div.appendChild(row);
  parent.appendChild(div);
}

/* ═══════════════════════════════════════════════════════════════════
   POPUP
═══════════════════════════════════════════════════════════════════ */
let backdrop = null, lastFocus = null;

function build(){
  const T = RULES_TEXT;
  backdrop = document.createElement('div');
  backdrop.className = 'rules-backdrop';
  backdrop.hidden = true;
  const popup = document.createElement('div');
  popup.className = 'rules-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-labelledby', 'rules-title');
  popup.tabIndex = -1;   // focused on open, so keyboard scrolling works
  backdrop.appendChild(popup);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'rules-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = '&times;';
  close.addEventListener('click', closeRules);
  popup.appendChild(close);

  const h2 = document.createElement('h2');
  h2.id = 'rules-title';
  h2.textContent = T.title;
  popup.appendChild(h2);

  // Goals
  const goals = document.createElement('h3');
  goals.textContent = T.goalsHeading;
  popup.appendChild(goals);
  item(popup, [[T.goal1, null, '1.']], [
    figure(miniBoard({ rows:6, cols:6, cell:24, pieces:EXAMPLE.solved })),
  ]);
  item(popup, [[T.goal2, null, '2.'], [T.goal2Hint, 'rules-hint']], [
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.wrong,  show:'rows'   }), T.checkRows),
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.wrong,  show:'cols'   }), T.checkCols),
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.solved, show:'solved' }), T.allEven),
  ], 'three');

  // Rules
  const rules = document.createElement('h3');
  rules.textContent = T.rulesHeading;
  popup.appendChild(rules);
  item(popup, [[T.reflect]], [
    figure(pieceOnly(F_PIECE.cells, F_PIECE.color, 22)),
    figure(arrowSvg(false)),
    figure(pieceOnly(reflectCells(F_PIECE.cells), F_PIECE.color, 22)),
  ]);
  item(popup, [[T.rotate]], [
    figure(pieceOnly(F_PIECE.cells, F_PIECE.color, 22)),
    figure(arrowSvg(true)),
    figure(pieceOnly(rotateCells(F_PIECE.cells), F_PIECE.color, 22)),
  ]);
  item(popup, [[T.gap]], [
    figure(miniBoard({ rows:1, cols:1, cell:44, gaps:[[0,0]] })),
  ]);
  // Half inside the dotted square, half outside
  const crossing = { color:'#5f9e8f', cells:[[0,0],[0,1],[0,2],[1,1]], row:2, col:1 };
  item(popup, [[T.dotted]], [
    figure(miniBoard({ rows:5, cols:5, cell:26, pieces:[crossing],
      dotted:[[1,1],[1,2],[2,1],[2,2]], noMarkOn: crossing })),
  ]);

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'rules-ok';
  ok.textContent = T.ok;
  ok.addEventListener('click', closeRules);
  popup.appendChild(ok);

  // Clicking the dimmed area outside the popup closes it
  backdrop.addEventListener('click', e=>{ if(e.target === backdrop) closeRules(); });
  document.body.appendChild(backdrop);
}

function openRules(){
  if(!backdrop) build();
  lastFocus = document.activeElement;
  backdrop.hidden = false;
  const popup = backdrop.querySelector('.rules-popup');
  popup.scrollTop = 0;
  popup.focus({ preventScroll:true });
}

function closeRules(){
  if(!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  try { localStorage.setItem(SEEN_KEY, '1'); } catch(e){}
  if(lastFocus && lastFocus.focus) lastFocus.focus();
}

document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && backdrop && !backdrop.hidden){ e.stopImmediatePropagation(); closeRules(); }
}, true);

document.addEventListener('click', e=>{
  const btn = e.target.closest && e.target.closest('[data-open-rules]');
  if(btn){ e.preventDefault(); openRules(); }
});

// First visit: show the rules once, on whichever page they land on
let seen = false;
try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch(e){}
if(!seen) openRules();

window.ParityRules = { open: openRules, close: closeRules };

})();
