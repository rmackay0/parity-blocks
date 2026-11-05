/* ═══════════════════════════════════════════════════════════════════════
   PARITY BLOCKS: GAME LOGIC
   Shared by play.html (the game) and sandbox.html (the puzzle builder).
   Needs shapes.js loaded first, and the page markup from play.html
   (#tray, #board-wrap, #board, #pieces-layer, #hint-overlay,
   #mark-overlay, #status, #hint-caption, #solved-popup).

   loadPuzzle(puzzle) starts (or restarts) a puzzle. A puzzle is an
   entry shaped like those in puzzles.js.

   Modes (the sandbox switches between them; the game is always 'play'):
     'play'  normal game
     'edit'  pieces can't be touched; clicking a board square calls
             gameHooks.onCellClick(r, c) so the builder can change it
     'view'  shows a solver tiling (setViewTiling) instead of the
             player's pieces, with odd rows/columns and empty squares
             marked; nothing can be moved
═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   SETUP
═══════════════════════════════════════════════════════════════════ */
let puzzle = null;
let gameMode = 'play';
let viewTiling = null;        // {pieces:[{name,color,cells,row,col}], status, oddRows, oddCols, empty:[[r,c]]}
const gameHooks = {
  onCellClick: null,          // edit mode: (r, c) => {}
  onChange: null,             // after any move by the player
  onSolved: null,             // (timeStr) => {}  replaces the "Solved!" popup (the tutorial uses this)
  onDragStart: null,          // (source) => {}   a piece started being dragged
  onTransform: null,          // ('rotate' | 'reflect') => {}  a piece was rotated or reflected
  onPlace: null,              // () => {}  a piece was put on the grid from the top
  onMark: null,               // () => {}  squares were highlighted / cleared (see HIGHLIGHTER)
  onHighlighter: null,        // (on) => {}  the pencil was turned on / off
  piecesAllowed: null,        // () => bool  false = pieces can't be picked up or turned yet (the tutorial)
};

/* [BEHAVIOR] Settings a page can change after loading this file:
     explain          a wrong finished board gets a written explanation after
                      EXPLAIN_DELAY_MS. The puzzle page turns it off (user,
                      2026-10-20: "in game there should only be red glow, no
                      telling why"); the tutorial and the sandbox keep it.
     lockWhenSolved   once solved, pieces can't be moved or turned. The puzzle
                      page turns it on; the sandbox leaves it off so a placed
                      solution can still be moved around to test ideas.
     distinctColors   pieces take their colors from PIECE_PALETTE (below)
                      instead of the puzzle's own colors. The tutorial turns
                      it off to keep its hand-picked colors.
     showCaption      show the puzzle's caption (hintText) under the board.
                      The puzzle page turns it off (the user removed "No
                      piece crosses the dotted line."; the rules say it). */
const gameSettings = { explain: true, lockWhenSolved: false, distinctColors: true, showCaption: true };

/* [COLORS] Piece colors, given out in the order the puzzle lists its
   pieces, so no two pieces in a puzzle look alike. They're the Woodblock
   colors (INKS in shapes.js); the first six are the ones the user picked
   (a puzzle usually has six pieces). */
const PIECE_PALETTE = [
  INKS.indigo, INKS.gold, INKS.vermilion, INKS.moss, INKS.sakura, INKS.asagi,
  INKS.wisteria, INKS.persimmon, INKS.sky, INKS.plum, INKS.pine, INKS.slate,
];
// Each piece's color in puzzle p, as { name: color }
function pieceColors(p){
  const colors = {};
  p.pieces.forEach((d, i)=>{ colors[d.name] = gameSettings.distinctColors ? PIECE_PALETTE[i % PIECE_PALETTE.length] : d.color; });
  return colors;
}

const boardWrapEl   = document.getElementById('board-wrap');
const boardEl       = document.getElementById('board');
const piecesLayerEl = document.getElementById('pieces-layer');
const trayEl        = document.getElementById('tray');
const boardOuterEl  = document.getElementById('board-outer');

function cssPx(name){
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}
const cssNum = cssPx;   // same parsing; for unitless settings like --highlight-thickness

let CELL = 48;   // board square size, recomputed by fitBoard() to fill the space
let GAP = 4;

// Each piece's current orientation in the tray, keyed by name. Rotating a
// tray piece changes it here; it's the orientation the piece is placed in.
let trayCells = {};
let placedPieces = [];        // {id, name, color, cells, row, col}
let invalidIds = new Set();   // pieces overlapping, off-grid, or on a dotted square
let keyPieceId = null;        // piece just turned with R / E (see Keyboard shortcuts)
let placedIdCounter = 1;
let solved = false;
let startTime = Date.now();

/* Start a puzzle. opts.keep = true keeps pieces already on the board (and
   tray orientations) for pieces that are still in the puzzle; the
   sandbox uses this when you edit the board you're testing on. */
function loadPuzzle(p, opts){
  opts = opts || {};
  // (A copy with the pieces' display colors; the puzzle passed in isn't changed)
  const colors = pieceColors(p);
  p = Object.assign({}, p, { pieces: p.pieces.map(d=>Object.assign({}, d, { color: colors[d.name] })) });
  puzzle = p;
  dottedRegion = new Set((p.hintOutline || []).map(([r,c])=>r+','+c));
  removedSet = new Set((p.removed || []).map(([r,c])=>r+','+c));
  const names = new Set(p.pieces.map(d=>d.name));
  const oldTray = trayCells;
  trayCells = {};
  p.pieces.forEach(def=>{
    trayCells[def.name] = (opts.keep && oldTray[def.name]) ? oldTray[def.name] : def.cells.map(c=>c.slice());
  });
  // Pieces that start on the board and can't be moved (puzzle.fixedPieces:
  // [{name, color, cells, row, col}]). They count as filled blocks.
  const fixed = (p.fixedPieces || []).map((f,i)=>({ id:'fixed'+i, name:f.name, color:f.color,
    cells:f.cells.map(c=>c.slice()), row:f.row, col:f.col, locked:true }));
  if(opts.keep){
    const mine = placedPieces.filter(q=>!q.locked && names.has(q.name));
    mine.forEach(q=>{ q.color = p.pieces.find(d=>d.name===q.name).color; });
    placedPieces = fixed.concat(mine);
  } else {
    placedPieces = fixed;
    startTime = Date.now();
    marks = {};          // (a fresh start clears the highlighter too)
    lockedMarks = new Set();
  }
  if(!opts.keep || !placedPieces.some(q=>q.id===keyPieceId)) keyPieceId = null;
  solved = false;
  const caption = document.getElementById('hint-caption');
  caption.textContent = p.hintText || '';
  caption.hidden = !p.hintText || !gameSettings.showCaption;
  renderTray();          // tray + caption first, so the board sizes itself to the space left
  setupBoard();
  renderAll();
}

function setGameMode(mode){
  gameMode = mode;
  document.body.classList.toggle('editing', mode === 'edit');
  document.body.classList.toggle('viewing', mode === 'view');
  if(mode !== 'play') keyPieceId = null;
  if(puzzle){ setupBoard(); renderAll(); }
}

function setViewTiling(t){
  viewTiling = t;
  if(puzzle && gameMode === 'view') renderAll();
}

/* ═══════════════════════════════════════════════════════════════════
   BOARD RULES  (piece shapes and drawing are in shapes.js)
═══════════════════════════════════════════════════════════════════ */

/* A dotted square (puzzle.blocked): a single square with a dotted line
   around it. No piece can go on it (a piece can't cross a dotted line, and
   no piece fits inside one square). It looks like any other square, and
   it stays that way when the puzzle is finished. (Older puzzles may also
   list some of them in hiddenBlocked; those are drawn dotted too now.) */
function isBlocked(r, c){ return puzzle.blocked.some(([br,bc])=>br===r && bc===c); }
function inBounds(r, c){ return r>=0 && c>=0 && r<puzzle.rows && c<puzzle.cols && !removedSet.has(r+','+c); }

function occupiedExcept(excludeId){
  const set = new Set();
  placedPieces.forEach(p=>{
    if(p.id === excludeId) return;
    p.cells.forEach(([r,c])=>set.add((p.row+r)+','+(p.col+c)));
  });
  return set;
}
// A dotted outline (puzzle.hintOutline) is a wall: a piece must sit
// entirely inside it or entirely outside it, never across it.
let dottedRegion = new Set();   // set by loadPuzzle
// Squares cut out of the board (puzzle.removed), for irregular shapes.
// They aren't part of the board at all: a piece there is off the board.
let removedSet = new Set();
function crossesDottedLine(cells, row, col){
  if(!dottedRegion.size) return false;
  const inside = cells.map(([r,c])=>dottedRegion.has((row+r)+','+(col+c)));
  return inside.some(Boolean) && !inside.every(Boolean);
}
function fits(cells, row, col, excludeId){
  return fitsAgainst(cells, row, col, occupiedExcept(excludeId));
}
// Same check, against a given set of taken squares ("r,c")
function fitsAgainst(cells, row, col, occ){
  return !crossesDottedLine(cells, row, col) && cells.every(([r,c])=>{
    const rr = row+r, cc = col+c;
    return inBounds(rr, cc) && !isBlocked(rr, cc) && !occ.has(rr+','+cc);
  });
}
function completelyOffBoard(cells, row, col){
  return cells.every(([r,c])=>!inBounds(row+r, col+c));
}
// Rechecked for every piece after each change, so moving one piece off
// another clears the red state on both.
function recomputeValidity(){
  invalidIds = new Set(placedPieces.filter(p=>!fitsAgainst(p.cells, p.row, p.col, occupiedBefore(p.id))).map(p=>p.id));
}

/* [BEHAVIOR] When two pieces overlap, only the one moved most recently
   glows red (it's the one causing the problem). placedPieces is kept in
   the order pieces were last placed / moved / turned (bringToEnd), and a
   piece only counts as overlapping the pieces BEFORE it. (The newest piece
   is also drawn on top.) */
function occupiedBefore(id){
  const set = new Set();
  for(const p of placedPieces){
    if(p.id === id) break;
    p.cells.forEach(([r,c])=>set.add((p.row+r)+','+(p.col+c)));
  }
  return set;
}
function bringToEnd(p){
  if(!p || p.locked) return;
  placedPieces = placedPieces.filter(q=>q !== p).concat(p);
}

function pxPos(i){ return i*(CELL+GAP); }

/* ═══════════════════════════════════════════════════════════════════
   BOARD
═══════════════════════════════════════════════════════════════════ */
// Make the board as large as the space between the pieces and the buttons
// allows, capped at --board-max-cell per square.
function fitBoard(){
  GAP = cssPx('--board-gap');
  const pad = cssPx('--board-pad');
  const availW = Math.min(boardWrapEl.clientWidth, window.innerWidth - 32) - 2*pad;
  const availH = boardWrapEl.clientHeight - 2*pad;
  const byW = (availW - (puzzle.cols-1)*GAP) / puzzle.cols;
  const byH = (availH - (puzzle.rows-1)*GAP) / puzzle.rows;
  // (never below 10px; 20 was the floor until boards could be 16 × 16, which
  // then ran off the sides of a phone)
  CELL = Math.max(10, Math.floor(Math.min(byW, byH, cssPx('--board-max-cell'))));
}

function setupBoard(){
  fitBoard();
  boardEl.style.gridTemplateColumns = `repeat(${puzzle.cols}, ${CELL}px)`;
  boardEl.style.gridTemplateRows = `repeat(${puzzle.rows}, ${CELL}px)`;
  boardEl.style.gap = GAP + 'px';
  boardEl.innerHTML = '';
  for(let r=0; r<puzzle.rows; r++) for(let c=0; c<puzzle.cols; c++){
    const cell = document.createElement('div');
    // (A dotted square looks like any other square; its dotted line is
    // drawn by renderHint)
    cell.className = 'board-cell' + (removedSet.has(r+','+c) ? ' removed' : '');
    cell.dataset.r = r;
    cell.dataset.c = c;
    paintMark(cell);                 // (highlighted squares stay highlighted)
    boardEl.appendChild(cell);
  }
  renderFrame();
  renderHint();
}

/* Irregular boards: instead of a rectangle, the dark frame is drawn as the
   outline of the squares that exist, widened by the frame thickness
   (a thick stroke with rounded joins), so it hugs the board's shape. */
function renderFrame(){
  const outer = document.getElementById('board-outer');
  let frame = document.getElementById('board-frame');
  const irregular = removedSet.size > 0;
  outer.classList.toggle('irregular', irregular);
  if(!irregular){ if(frame) frame.remove(); return; }
  if(!frame){
    frame = document.createElementNS(SVG_NS, 'svg');
    frame.id = 'board-frame';
    frame.setAttribute('aria-hidden', 'true');
    outer.insertBefore(frame, outer.firstChild);
  }
  const cells = [];
  for(let r=0; r<puzzle.rows; r++) for(let c=0; c<puzzle.cols; c++) if(!removedSet.has(r+','+c)) cells.push([r,c]);
  const pad = cssPx('--board-pad');
  frame.setAttribute('width', puzzle.cols*CELL + (puzzle.cols-1)*GAP);
  frame.setAttribute('height', puzzle.rows*CELL + (puzzle.rows-1)*GAP);
  frame.innerHTML = '';
  if(cells.length) frame.appendChild(svgPath(buildFillPath(cells, CELL, GAP), {
    class: 'frame-shape', 'stroke-width': 2*pad, 'stroke-linejoin': 'round',
  }));
}

// Edit mode: clicking a square hands it to the sandbox
boardEl.addEventListener('pointerdown', e=>{
  if(gameMode !== 'edit' || !gameHooks.onCellClick) return;
  const cell = e.target.closest('.board-cell');
  if(cell){ e.preventDefault(); gameHooks.onCellClick(+cell.dataset.r, +cell.dataset.c); }
});

// [COLORS] How the board's dotted lines look (px): white dashes down the
// black gaps between squares, as wide as the gap (black and white, user
// 2026-11-02). None is drawn on the board's own edge (onBoard): the frame
// is already a wall there, and a line in it stuck out past the grid.
const BOARD_DOTTED = { stroke: 'var(--color-dotted)', dash: 9, space: 6,
  onBoard: (r, c)=>inBounds(r, c) };

// The dotted lines: around the puzzle's dotted area (hintOutline), if it
// has one, and around the dotted squares (puzzle.blocked; squares that
// share a side are one shape). They run down the middle of the gaps
// between squares, and shapes that touch share one line (see
// drawDottedLines in shapes.js).
function renderHint(){
  const overlay = document.getElementById('hint-overlay');
  overlay.innerHTML = '';
  const shapes = (puzzle.hintOutline && puzzle.hintOutline.length ? [puzzle.hintOutline] : [])
    .concat(groupSquares(puzzle.blocked || []));
  if(!shapes.length) return;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', puzzle.cols*CELL + (puzzle.cols-1)*GAP);
  svg.setAttribute('height', puzzle.rows*CELL + (puzzle.rows-1)*GAP);
  Object.assign(svg.style, { position:'absolute', left:'0', top:'0', overflow:'visible' });
  drawDottedLines(svg, shapes, CELL + GAP, GAP, 0, 0, BOARD_DOTTED);
  overlay.appendChild(svg);
}

/* ═══════════════════════════════════════════════════════════════════
   RENDERING
═══════════════════════════════════════════════════════════════════ */
function renderTray(){
  const size = cssPx('--tray-cell');
  const used = new Set(placedPieces.filter(p=>!p.locked).map(p=>p.name));
  trayEl.innerHTML = '';
  puzzle.pieces.forEach(def=>{
    const cells = trayCells[def.name];
    // Every slot is a square big enough for the piece in any orientation,
    // so rotating doesn't make the row jump around.
    const longest = Math.max(...Object.values(bounds(cells)));
    const slotPx = longest*size + (longest-1)*2;
    const slot = document.createElement('div');
    slot.className = 'tray-slot'
      + (used.has(def.name) ? ' used' : '');
    slot.style.width = slot.style.height = (slotPx + 12) + 'px';
    slot.dataset.name = def.name;
    slot.appendChild(buildPieceShape(cells, def.color, size, 2));
    slot.addEventListener('pointerdown', e=>onPiecePointerDown(e, {kind:'tray', name:def.name}));
    trayEl.appendChild(slot);
  });
  placeHighlighterTool();
}

function boardFull(){ return placedPieces.filter(p=>!p.locked).length === puzzle.pieces.length; }

function renderBoardPieces(){
  piecesLayerEl.querySelectorAll('.placed-piece').forEach(el=>el.remove());
  // A piece that breaks a placement rule glows red. Once every piece is
  // down, the written explanation follows a few seconds later (see
  // checkSolved).
  const full = boardFull();
  placedPieces.forEach(p=>{
    const bad = full ? !p.locked && !!pieceProblem(p) : invalidIds.has(p.id);
    const wrap = document.createElement('div');
    wrap.className = 'placed-piece'
      + (bad ? ' invalid' : '')
      + (p.locked ? ' locked' : '');
    wrap.style.left = pxPos(p.col) + 'px';
    wrap.style.top = pxPos(p.row) + 'px';
    wrap.dataset.id = p.id;
    wrap.appendChild(buildPieceShape(p.cells, p.color, CELL, GAP));
    wrap.addEventListener('pointerdown', e=>onPiecePointerDown(e, {kind:'board', id:p.id}));
    piecesLayerEl.appendChild(wrap);
  });
}

function renderAll(){
  if(!puzzle) return;
  if(gameMode === 'view'){ renderView(); return; }
  statusEl.classList.remove('good');
  // A lifted copy with no piece being held must never stay on the board
  if(!press || !press.ghost) piecesLayerEl.querySelectorAll('.ghost').forEach(g=>g.remove());
  recomputeValidity();
  renderTray();
  renderBoardPieces();
  if(gameMode === 'play') checkSolved();
  else { markOverlayEl.innerHTML = ''; cancelExplain(); statusEl.textContent = ''; boardOuterEl.classList.remove('uneven'); }
  playPendingFeel();       // (the landing / turning animation, on the freshly drawn piece)
  if(gameHooks.onChange) gameHooks.onChange();
}

// View mode: draw viewTiling's pieces (not the player's), mark odd
// rows/columns with the highlighter and (sandbox only) ring the squares
// no piece covers
function renderView(){
  const t = viewTiling || { pieces:[], oddRows:[], oddCols:[], empty:[], status:'' };
  cancelExplain();
  boardOuterEl.classList.remove('uneven');
  trayEl.querySelectorAll('.tray-slot').forEach(el=>el.classList.add('used'));
  piecesLayerEl.querySelectorAll('.placed-piece').forEach(el=>el.remove());
  t.pieces.forEach(p=>{
    const wrap = document.createElement('div');
    wrap.className = 'placed-piece';
    wrap.style.left = pxPos(p.col) + 'px';
    wrap.style.top = pxPos(p.row) + 'px';
    wrap.appendChild(buildPieceShape(p.cells, p.color, CELL, GAP));
    piecesLayerEl.appendChild(wrap);
  });
  drawUnevenMarks(t.oddRows, t.oddCols);
  // (The squares themselves stay as they are)
  if(t.rings !== false)       // the tutorial turns the rings off
    (t.empty || []).forEach(([r,c])=>{
      markOverlayEl.appendChild(svgEl('circle', { cx: pxPos(c) + CELL/2, cy: pxPos(r) + CELL/2, r: CELL*0.22, class:'empty-ring' }));
    });
  statusEl.textContent = t.status || '';
  statusEl.classList.toggle('good', !!t.good);
}

/* ═══════════════════════════════════════════════════════════════════
   FEEL: small animations that give the pieces some weight
   (user, 2026-11-02: "microanimations to convey heft", so placing a piece
   is satisfying)
     press    a piece squeezes a little under your finger / the mouse
     lift     picked up, it grows a little and casts a bigger shadow, and
              leans the way you move it, like something with weight
     land     dropped, it settles into its squares: a quick slide, a small
              squash and bounce, and the board gives a tiny thud
     shake    landed where it can't go: a short shake as it turns red
     turn     rotating spins it a quarter turn; reflecting flips it over
     return   sent back to the top, it pops back into its place
   Nothing moves for players who ask their device for less motion.
   [BEHAVIOR] the numbers below set how strong each one is.
═══════════════════════════════════════════════════════════════════ */
const FEEL = {
  lift: 1.06,          // how much bigger a held piece looks
  maxTilt: 6,          // most a held piece leans while moving (degrees)
  tiltPerSpeed: 5,     // lean per (px per ms) of movement
  landMs: 240,         // the drop: slide + squash + settle
  thudPx: 1.5,         // how far the board dips when a piece lands
  turnMs: 200,         // rotate / reflect
};
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function animate(el, frames, opts){
  if(!el || REDUCED_MOTION || !el.animate) return null;
  return el.animate(frames, opts);
}
// An animation to play on the piece once renderAll() has redrawn it:
//   {type:'land', id, dx, dy, tilt, origin}   {type:'turn', how, source}
//   {type:'return', name}
let pendingFeel = null;
function boardPieceEl(id){ return piecesLayerEl.querySelector(`.placed-piece[data-id="${id}"]`); }
function trayPieceEl(name){ return trayEl.querySelector(`.tray-slot[data-name="${name}"] .piece-box`); }
function playPendingFeel(){
  const f = pendingFeel;
  pendingFeel = null;
  if(!f || gameMode !== 'play') return;
  if(f.type === 'land'){
    const el = boardPieceEl(f.id);
    if(!el) return;
    el.style.transformOrigin = f.origin;
    animate(el, [
      { transform:`translate(${f.dx}px, ${f.dy}px) rotate(${f.tilt}deg) scale(${FEEL.lift})` },
      { transform:'translate(0, 0) rotate(0deg) scale(0.965)', offset:0.55 },
      { transform:'scale(1.012)', offset:0.8 },
      { transform:'none' },
    ], { duration: FEEL.landMs, easing:'cubic-bezier(.25,.8,.35,1)' });
    // (the shadow shrinks on the drawing itself, which has room for it: see
    // buildPieceShape; on the outer box it spilled outside and could leave marks)
    animate(el.querySelector('.piece-svg'), [
      { filter:'drop-shadow(0 10px 9px var(--color-shadow))' },
      { filter:'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25))', offset:0.55 },
      { filter:'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25))' },
    ], { duration: FEEL.landMs, easing:'cubic-bezier(.25,.8,.35,1)' });
    animate(boardOuterEl, [ { transform:'none' }, { transform:`translateY(${FEEL.thudPx}px)` }, { transform:'none' } ],
      { duration: 170, delay: FEEL.landMs * 0.45, easing:'ease-out' });
    if(el.classList.contains('invalid'))
      animate(el, [ { transform:'none' }, { transform:'translateX(-4px)' }, { transform:'translateX(4px)' },
                    { transform:'translateX(-3px)' }, { transform:'translateX(2px)' }, { transform:'none' } ],
        { duration: 300, delay: FEEL.landMs, easing:'ease-in-out' });
  } else if(f.type === 'turn'){
    const box = f.source.kind === 'tray' ? trayPieceEl(f.source.name) : (boardPieceEl(f.source.id) || {}).firstChild;
    spinPiece(box, f.how);
  } else if(f.type === 'return'){
    animate(trayPieceEl(f.name), [ { transform:'scale(0.5)', opacity:0 }, { transform:'scale(1.08)', opacity:1, offset:0.7 }, { transform:'none' } ],
      { duration: 260, easing:'ease-out' });
  }
}
// The turn itself: the new shape starts turned back to where the old one
// was, then swings into place (its svg turns, so a lift on the box stays)
function spinPiece(box, how){
  const svg = box && box.querySelector('.piece-svg');
  if(!svg) return;
  const frames = how === 'reflect'
    ? [ { transform:'scaleX(-1)' }, { transform:'scaleX(1.06)', offset:0.75 }, { transform:'none' } ]
    : [ { transform:'rotate(-90deg)' }, { transform:'rotate(7deg)', offset:0.72 }, { transform:'none' } ];
  animate(svg, frames, { duration: FEEL.turnMs, easing:'ease-out' });
}

/* ═══════════════════════════════════════════════════════════════════
   ROTATE / REFLECT
   There's no "selected piece": you act on a piece by clicking it,
   dragging it, or pointing at it and pressing a key.
═══════════════════════════════════════════════════════════════════ */
/* [BEHAVIOR] Clicking a piece (at the top or on the board):
     one click    → rotate a quarter turn clockwise
     double-click → reflect (mirror left↔right)
   Every double-click starts with a single click, so a click waits
   DOUBLE_CLICK_MS to see whether a second one follows before rotating. */
const DOUBLE_CLICK_MS = 280;
let pendingClick = null;    // { source, timer } while waiting to see if it's a double-click

// Backup for iPhones (the CSS touch-action usually does it): a second tap
// soon after the first must never zoom the page. Buttons, links and form
// fields are left alone so tapping them twice still works.
let lastTouchEnd = 0;
document.addEventListener('touchend', e=>{
  const now = Date.now();
  if(now - lastTouchEnd < 350 && !e.target.closest('button, a, input, select, textarea, summary, label')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

const sameSource = (a, b) => a && b && a.kind === b.kind &&
  (a.kind === 'tray' ? a.name === b.name : a.id === b.id);

function transformSource(source, fn){
  pendingFeel = { type:'turn', how: fn === reflectCells ? 'reflect' : 'rotate', source };
  if(source.kind === 'tray'){
    if(trayCells[source.name]) trayCells[source.name] = fn(trayCells[source.name]);
  } else {
    const p = placedPieces.find(pp=>pp.id===source.id);
    if(p && !p.locked){ p.cells = fn(p.cells); bringToEnd(p); }   // turns in place; goes red if it no longer fits
  }
  renderAll();
  if(gameHooks.onTransform) gameHooks.onTransform(fn === reflectCells ? 'reflect' : 'rotate');
}

// Do a waiting single-click's rotate right now (e.g. another piece got clicked)
function flushPendingClick(){
  if(!pendingClick) return;
  clearTimeout(pendingClick.timer);
  const src = pendingClick.source;
  pendingClick = null;
  transformSource(src, rotateCells);
}

function onPieceClick(source){
  if(pendingClick && sameSource(pendingClick.source, source)){
    // second click in time: it's a double-click → reflect instead of rotate
    clearTimeout(pendingClick.timer);
    pendingClick = null;
    transformSource(source, reflectCells);
    return;
  }
  flushPendingClick();
  pendingClick = { source, timer: setTimeout(()=>{
    pendingClick = null;
    transformSource(source, rotateCells);
  }, DOUBLE_CLICK_MS) };
}

/* [BEHAVIOR] Keyboard shortcuts (the only two; the user removed the
   letter and arrow keys since there's no selected piece for them to act on):
     R   rotate      E   reflect
   They act on the piece you're holding or dragging, or else the piece
   under the mouse. Ignored while typing in a text box, and when
   Cmd/Ctrl/Alt is held (so Cmd+R still reloads the page). */
document.addEventListener('keydown', e=>{
  if(e.metaKey || e.ctrlKey || e.altKey) return;
  if(e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if(gameMode !== 'play' || !puzzle) return;
  if(solved && gameSettings.lockWhenSolved) return;
  if(gameHooks.piecesAllowed && !gameHooks.piecesAllowed()) return;
  const k = e.key.toLowerCase();
  if(k === 'r' || k === 'e'){ e.preventDefault(); keyTransform(k === 'r' ? rotateCells : reflectCells); }
});

// Where the mouse is, so R / E know which piece it's pointing at. A piece
// turned with a key stays the keys' piece (keyPieceId) until the mouse
// moves, even if turning it took it out from under the mouse.
let mouseX = null, mouseY = null;
document.addEventListener('pointermove', e=>{
  if(e.pointerType !== 'mouse') return;
  if(e.clientX === mouseX && e.clientY === mouseY) return;   // browsers sometimes send a move without one
  mouseX = e.clientX; mouseY = e.clientY;
  keyPieceId = null;
});
document.addEventListener('pointerdown', ()=>{ keyPieceId = null; });

// The piece the keys act on (when nothing is being held), as a source
// like {kind:'board', id} or {kind:'tray', name}, or null
function keyTarget(){
  if(keyPieceId && placedPieces.some(q=>q.id===keyPieceId)) return { kind:'board', id: keyPieceId };
  if(mouseX === null) return null;
  const el = document.elementFromPoint(mouseX, mouseY);
  if(!el) return null;
  const slot = el.closest('.tray-slot');
  if(slot && !slot.classList.contains('used')) return { kind:'tray', name: slot.dataset.name };
  const placed = el.closest('.placed-piece');
  if(placed && placed.dataset.id) return { kind:'board', id: placed.dataset.id };
  return null;
}

// R / E: if a piece is being held or dragged, turn THAT piece; otherwise
// the piece the keys act on
function keyTransform(fn){
  if(press){
    press.keyUsed = true;               // so letting go doesn't also count as a click
    if(press.dragging){
      press.cells = fn(press.cells);
      clampGrab(press);
      press.ghost.innerHTML = '';
      press.ghost.appendChild(liftedShape(press));
      spinPiece(press.ghost.firstChild, fn === reflectCells ? 'reflect' : 'rotate');
      if(press.lastX !== undefined) onPointerMove({ clientX: press.lastX, clientY: press.lastY });
      if(gameHooks.onTransform) gameHooks.onTransform(fn === reflectCells ? 'reflect' : 'rotate');
    } else {
      transformSource(press.source, fn);
      press.cells = press.source.kind === 'tray' ? trayCells[press.name]
                  : (placedPieces.find(q=>q.id===press.source.id) || {}).cells || press.cells;
      clampGrab(press);
    }
    return;
  }
  flushPendingClick();
  const target = keyTarget();
  if(!target) return;
  if(target.kind === 'board') keyPieceId = target.id;   // stays the keys' piece even if it turns out from under the mouse
  transformSource(target, fn);
}
function clampGrab(pr){
  const b = bounds(pr.cells);
  pr.grabDR = Math.min(pr.grabDR, b.rows - 1);
  pr.grabDC = Math.min(pr.grabDC, b.cols - 1);
}

/* ═══════════════════════════════════════════════════════════════════
   DRAG
   A press only becomes a drag once the pointer moves a few pixels; a
   press-and-release without moving is a click (rotate; double = reflect).
═══════════════════════════════════════════════════════════════════ */
const DRAG_THRESHOLD = 5;
let press = null;   // {source, startX, startY, grabDR, grabDC, dragging, ghost, cells, color, name}

function onPiecePointerDown(e, source){
  if(gameMode !== 'play') return;
  if(solved && gameSettings.lockWhenSolved) return;                     // a solved puzzle stays as it is
  if(e.button !== undefined && e.button !== 0) return;
  if(source.kind === 'board' && (placedPieces.find(q=>q.id===source.id) || {}).locked) return;   // fixed piece
  if(gameHooks.piecesAllowed && !gameHooks.piecesAllowed()){ e.preventDefault(); return; }       // (not yet: the tutorial)
  e.preventDefault();
  e.stopPropagation();
  // One piece at a time. A second finger while one is held is ignored; a
  // press whose finger-up never arrived (iPhone Safari can lose it) is
  // cancelled first. Before this, the old press was simply forgotten and
  // its lifted copy stayed on the board: the "duplicated piece" a player
  // saw on an iPhone (2026-11-05).
  if(press){
    if(press.pointerId !== undefined && press.pointerId !== e.pointerId && press.fresh()) return;
    cancelPress();
  }
  // A different piece's click is still waiting: apply its rotate first
  if(pendingClick && !sameSource(pendingClick.source, source)) flushPendingClick();
  let cells, color, name, grabDR, grabDC;
  if(source.kind === 'tray'){
    const def = puzzle.pieces.find(d=>d.name===source.name);
    cells = trayCells[def.name]; color = def.color; name = def.name;
    const b = bounds(cells);
    grabDR = Math.floor((b.rows-1)/2);
    grabDC = Math.floor((b.cols-1)/2);
  } else {
    const p = placedPieces.find(pp=>pp.id===source.id);
    cells = p.cells; color = p.color; name = p.name;
    const blk = e.target.closest('.blk');
    grabDR = blk ? +blk.dataset.dr : 0;
    grabDC = blk ? +blk.dataset.dc : 0;
  }
  press = { source, startX:e.clientX, startY:e.clientY, grabDR, grabDC, cells, color, name, dragging:false, ghost:null,
            pointerId: e.pointerId, lastSeen: performance.now(),
            // (still being moved recently: a real second finger, not a lost one)
            fresh(){ return performance.now() - this.lastSeen < 1500; } };
  // Feel: the piece squeezes a little under the finger / mouse
  press.pressedEl = source.kind === 'tray' ? trayPieceEl(source.name) : (boardPieceEl(source.id) || {}).firstChild;
  if(press.pressedEl) press.pressedEl.classList.add('pressed');
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function beginDrag(){
  // Clicked this piece and then started dragging it before the click's
  // rotate happened: rotate now, and drag the rotated shape
  if(pendingClick && sameSource(pendingClick.source, press.source)){
    flushPendingClick();
    if(press.source.kind === 'tray') press.cells = trayCells[press.name];
    else { const p = placedPieces.find(pp=>pp.id===press.source.id); if(p) press.cells = p.cells; }
    const b = bounds(press.cells);
    press.grabDR = Math.min(press.grabDR, b.rows-1);
    press.grabDC = Math.min(press.grabDC, b.cols-1);
  }
  press.dragging = true;
  if(gameHooks.onDragStart) gameHooks.onDragStart(press.source);
  press.ghost = document.createElement('div');
  press.ghost.className = 'ghost';
  press.ghost.appendChild(liftedShape(press, true));
  piecesLayerEl.appendChild(press.ghost);
  if(press.pressedEl) press.pressedEl.classList.remove('pressed');
  if(press.source.kind === 'board'){
    const el = boardPieceEl(press.source.id);
    if(el) el.style.visibility = 'hidden';
  } else {
    // (its spot at the top stays, faded, until the piece lands somewhere)
    const slot = trayEl.querySelector(`.tray-slot[data-name="${press.name}"]`);
    if(slot) slot.classList.add('lifting');
  }
  press.tilt = 0; press.tiltTarget = 0;
  if(!REDUCED_MOTION) requestAnimationFrame(leanLoop);
}

// The held piece, drawn at board size and lifted (bigger, with a shadow:
// see .lifted in game.css). It grows from the square you're holding.
function liftedShape(pr, growIn){
  const box = buildPieceShape(pr.cells, pr.color, CELL, GAP);
  box.classList.add('lifted');
  if(growIn) box.classList.add('lift-in');
  box.style.transformOrigin = grabOrigin(pr);
  return box;
}
function grabOrigin(pr){ return `${pr.grabDC*(CELL+GAP) + CELL/2}px ${pr.grabDR*(CELL+GAP) + CELL/2}px`; }

// Feel: while held, the piece leans the way it's moving and swings back
// upright when it stops, as if it had some weight
function leanLoop(){
  if(!press || !press.dragging || !press.ghost) return;
  press.tiltTarget *= 0.85;                                 // eases off when you stop moving
  press.tilt += (press.tiltTarget - press.tilt) * 0.3;
  press.ghost.style.transformOrigin = grabOrigin(press);
  press.ghost.style.transform = `rotate(${press.tilt.toFixed(2)}deg)`;
  requestAnimationFrame(leanLoop);
}

// Where the piece would land for this pointer position (snapped to the grid)
function landingSpot(clientX, clientY, grab){
  const rect = boardEl.getBoundingClientRect();
  const col = Math.floor((clientX - rect.left) / (CELL+GAP));
  const row = Math.floor((clientY - rect.top) / (CELL+GAP));
  return { row: row - grab.grabDR, col: col - grab.grabDC };
}

function clearHighlights(){
  boardEl.querySelectorAll('.hl-valid, .hl-invalid').forEach(el=>el.classList.remove('hl-valid','hl-invalid'));
}

function overTray(clientX, clientY){
  const r = trayEl.getBoundingClientRect();
  return clientX>=r.left && clientX<=r.right && clientY>=r.top && clientY<=r.bottom;
}

/* Stop a press without doing anything: the piece stays (or goes back)
   exactly where it was, and its lifted copy is removed. For a press the
   browser cancels (iPhone Safari does when it takes over the touch) or
   one whose finger-up was lost. */
function cancelPress(){
  if(!press) return;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  const p = press;
  press = null;
  clearHighlights();
  if(p.pressedEl) p.pressedEl.classList.remove('pressed');
  if(p.ghost) p.ghost.remove();
  renderAll();          // (redraws the piece it came from, and sweeps up any stray lifted copy)
}
// Leaving the page or the window mid-drag also cancels it
window.addEventListener('blur', cancelPress);
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) cancelPress(); });

// (another finger's events, while one piece is held, are ignored)
const otherPointer = e=>press && press.pointerId !== undefined && e.pointerId !== undefined && e.pointerId !== press.pointerId;

function onPointerMove(e){
  if(!press || otherPointer(e)) return;
  press.lastSeen = performance.now();
  // Sideways speed (px per ms), for the lean while dragging
  const now = performance.now();
  if(press.lastX !== undefined && press.lastT && now > press.lastT && press.tiltTarget !== undefined){
    const v = (e.clientX - press.lastX) / (now - press.lastT);
    press.tiltTarget = Math.max(-FEEL.maxTilt, Math.min(FEEL.maxTilt, v * FEEL.tiltPerSpeed));
  }
  press.lastT = now;
  press.lastX = e.clientX; press.lastY = e.clientY;   // so R/E mid-drag can redraw in place
  if(!press.dragging){
    if(Math.hypot(e.clientX-press.startX, e.clientY-press.startY) < DRAG_THRESHOLD) return;
    beginDrag();
  }
  // Ghost follows the pointer smoothly; the highlighted squares show where
  // it will snap to.
  const rect = boardEl.getBoundingClientRect();
  press.ghost.style.left = (e.clientX - rect.left - press.grabDC*(CELL+GAP) - CELL/2) + 'px';
  press.ghost.style.top  = (e.clientY - rect.top  - press.grabDR*(CELL+GAP) - CELL/2) + 'px';

  clearHighlights();
  if(overTray(e.clientX, e.clientY)) return;
  const {row, col} = landingSpot(e.clientX, e.clientY, press);
  const excludeId = press.source.kind==='board' ? press.source.id : null;
  const ok = fits(press.cells, row, col, excludeId);
  press.cells.forEach(([r,c])=>{
    const el = boardEl.querySelector(`.board-cell[data-r="${row+r}"][data-c="${col+c}"]`);
    if(el) el.classList.add(ok ? 'hl-valid' : 'hl-invalid');
  });
}

function onPointerUp(e){
  if(!press || otherPointer(e)) return;
  // The browser took the touch away (not the player letting go): put
  // everything back as it was, rather than dropping the piece anywhere
  if(e.type === 'pointercancel'){ cancelPress(); return; }
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  const p = press;
  press = null;
  clearHighlights();
  if(p.pressedEl) p.pressedEl.classList.remove('pressed');

  if(!p.dragging){
    // A click: rotate, or reflect if it's the second click of a double-click.
    // (Not if R/E was pressed while holding it: that already turned it.)
    if(e.type !== 'pointercancel' && !p.keyUsed) onPieceClick(p.source);
    return;
  }
  // Where the held piece was when let go, so the landing can start there
  const ghostX = parseFloat(p.ghost.style.left) || 0, ghostY = parseFloat(p.ghost.style.top) || 0;
  p.ghost.remove();

  const {row, col} = landingSpot(e.clientX, e.clientY, p);
  const offBoard = e.type==='pointercancel' || overTray(e.clientX, e.clientY) || completelyOffBoard(p.cells, row, col);
  const land = id=>{ pendingFeel = { type:'land', id, dx: ghostX - pxPos(col), dy: ghostY - pxPos(row), tilt: p.tilt || 0, origin: grabOrigin(p) }; };

  if(p.source.kind === 'tray'){
    if(!offBoard){
      const id = 'p' + (placedIdCounter++);
      placedPieces.push({ id, name:p.name, color:p.color, cells:p.cells.map(c=>c.slice()), row, col });
      land(id);
      if(gameHooks.onPlace) gameHooks.onPlace();
    } else {
      if(p.keyUsed) trayCells[p.name] = p.cells;        // keep a turn made mid-drag
      pendingFeel = { type:'return', name:p.name };
    }
  } else {
    const piece = placedPieces.find(pp=>pp.id===p.source.id);
    piece.cells = p.cells;                              // (R/E may have turned it mid-drag)
    if(offBoard){
      // Dragged off the board: it goes back to the top, in its current turn
      placedPieces = placedPieces.filter(pp=>pp.id!==piece.id);
      trayCells[piece.name] = piece.cells;
      pendingFeel = { type:'return', name:piece.name };
    } else {
      piece.row = row;
      piece.col = col;
      bringToEnd(piece);
      land(piece.id);
    }
  }
  renderAll();
}

/* ═══════════════════════════════════════════════════════════════════
   WIN CHECK
   Solved = every piece placed, none overlapping/off-grid/across a dotted
   line (or on a dotted square), and every row and column has an even
   number of filled squares.
   Once every piece is down but it isn't solved, it glows red straight
   away (the rule-breaking pieces, or the board's frame if it's only the
   rows/columns), and if nothing moves for EXPLAIN_DELAY_MS the message
   above the board says what's wrong ("Uneven rows and columns", "Pieces
   overlap", ...). Highlighter strokes on the uneven lines are off by
   default (SHOW_UNEVEN_MARKS below).
═══════════════════════════════════════════════════════════════════ */
const statusEl = document.getElementById('status');
const markOverlayEl = document.getElementById('mark-overlay');

// [BEHAVIOR] How long a wrong finished board just glows red before the
// written explanation appears (the user may change this; 0 = explain
// straight away). Any move restarts the wait. (Whether it appears at all:
// gameSettings.explain, at the top.)
const EXPLAIN_DELAY_MS = 3000;
let explainTimer = null, explainKey = '';
function cancelExplain(){ clearTimeout(explainTimer); explainTimer = null; explainKey = ''; }
// Show `msg` once the board has stayed the same for EXPLAIN_DELAY_MS
// ('' clears it). A re-draw with nothing moved (e.g. resizing the window)
// leaves the message, or the wait, as it is.
function explainLater(msg){
  const key = msg + '|' + JSON.stringify(placedPieces.map(p=>[p.id, p.row, p.col, p.cells]));
  if(key === explainKey) return;
  cancelExplain();
  explainKey = key;
  statusEl.textContent = '';
  if(!msg || !gameSettings.explain) return;
  if(EXPLAIN_DELAY_MS <= 0){ statusEl.textContent = msg; return; }
  explainTimer = setTimeout(()=>{ if(gameMode === 'play' && !solved) statusEl.textContent = msg; }, EXPLAIN_DELAY_MS);
}

// [CONTENT] Messages for a piece that breaks a placement rule
// [BEHAVIOR] When every piece is placed but it isn't solved, the message
// above the board says what's wrong. Set this to true to also draw red
// highlighter strokes over the uneven rows/columns. (The sandbox's
// solution viewer always shows them.)
const SHOW_UNEVEN_MARKS = false;

const PROBLEM_TEXT = {
  overlap: 'Pieces overlap',
  off:     'A piece is off the board',
  dotted:  'A piece crosses a dotted line',
};

function formatElapsed(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
}

// "Uneven row", "Uneven rows", "Uneven row and columns", ...
function unevenMessage(rowCount, colCount){
  const parts = [];
  if(rowCount) parts.push(rowCount === 1 ? 'row' : 'rows');
  if(colCount) parts.push(colCount === 1 ? 'column' : 'columns');
  return parts.length ? 'Uneven ' + parts.join(' and ') : '';
}

// Which placement rule a piece breaks (null if it's fine)
function pieceProblem(p){
  const occ = occupiedBefore(p.id);      // overlaps count against the newer piece only
  const abs = p.cells.map(([r,c])=>[p.row+r, p.col+c]);
  if(abs.some(([r,c])=>!inBounds(r,c))) return 'off';
  if(abs.some(([r,c])=>occ.has(r+','+c))) return 'overlap';
  if(abs.some(([r,c])=>isBlocked(r,c)) || crossesDottedLine(p.cells, p.row, p.col)) return 'dotted';
  return null;
}

function drawUnevenMarks(oddRows, oddCols){
  markOverlayEl.innerHTML = '';
  const w = puzzle.cols*CELL + (puzzle.cols-1)*GAP;
  const h = puzzle.rows*CELL + (puzzle.rows-1)*GAP;
  markOverlayEl.setAttribute('width', w);
  markOverlayEl.setAttribute('height', h);
  const thick = CELL * cssNum('--highlight-thickness');
  const over = cssPx('--highlight-overhang');
  oddRows.forEach(r=>{
    const y = pxPos(r) + CELL/2;
    markOverlayEl.appendChild(svgPath(buildHighlighterPath(-over, y, w+over, y, thick, r+1), { class:'highlight' }));
  });
  oddCols.forEach(c=>{
    const x = pxPos(c) + CELL/2;
    markOverlayEl.appendChild(svgPath(buildHighlighterPath(x, -over, x, h+over, thick, c+11), { class:'highlight' }));
  });
}

function checkSolved(){
  markOverlayEl.innerHTML = '';
  boardOuterEl.classList.remove('uneven');
  boardOuterEl.classList.toggle('locked', solved && gameSettings.lockWhenSolved);
  if(solved) return;
  // (a board with no pieces at all, like the tutorial's highlighter
  // practice, is never "solved")
  if(!boardFull() || !puzzle.pieces.length){ explainLater(''); return; }

  // Count filled squares on the board (overlapping squares count once)
  const filled = new Set();
  placedPieces.forEach(p=>p.cells.forEach(([r,c])=>{
    if(inBounds(p.row+r, p.col+c)) filled.add((p.row+r)+','+(p.col+c));
  }));
  const oddRows = [], oddCols = [];
  for(let r=0; r<puzzle.rows; r++){
    let n = 0;
    for(let c=0; c<puzzle.cols; c++) if(filled.has(r+','+c)) n++;
    if(n % 2) oddRows.push(r);
  }
  for(let c=0; c<puzzle.cols; c++){
    let n = 0;
    for(let r=0; r<puzzle.rows; r++) if(filled.has(r+','+c)) n++;
    if(n % 2) oddCols.push(c);
  }

  const problems = [...new Set(placedPieces.map(pieceProblem).filter(Boolean))];

  if(!oddRows.length && !oddCols.length && !problems.length){
    solved = true;
    boardOuterEl.classList.toggle('locked', gameSettings.lockWhenSolved);
    cancelExplain();
    statusEl.textContent = '';
    const time = formatElapsed(Date.now() - startTime);
    if(gameHooks.onSolved){ gameHooks.onSolved(time); return; }
    document.getElementById('solved-time').textContent = 'Your time: ' + time;
    document.getElementById('solved-popup').hidden = false;
    return;
  }
  if(SHOW_UNEVEN_MARKS) drawUnevenMarks(oddRows, oddCols);
  // Only the rows/columns are wrong: no piece glows, so the board's frame does
  if(!problems.length && (oddRows.length || oddCols.length)) boardOuterEl.classList.add('uneven');
  explainLater([unevenMessage(oddRows.length, oddCols.length), ...problems.map(k=>PROBLEM_TEXT[k])]
    .filter(Boolean).join(' · '));
}
const solvedCloseBtn = document.getElementById('solved-close');
if(solvedCloseBtn) solvedCloseBtn.addEventListener('click', ()=>{
  document.getElementById('solved-popup').hidden = true;
});

/* ═══════════════════════════════════════════════════════════════════
   HIGHLIGHTER (user, 2026-11-05)
   An optional tool for picturing ideas. The pencil button turns it on
   (its background shades); a dot beside it shows the color, and its ▾
   opens the four colors. While it's on, tapping a square highlights it;
   tapping it again clears it; tapping it with another color switches it
   to that color. Dragging across squares does the same to each one.
   Pieces still move as usual, and cover the highlights under them.
   The page puts an empty <div id="hl-tool"> where the tool goes; this
   builds it, and places it above and to the right of the rightmost piece
   in the top row of pieces (placeHighlighterTool).
   [COLORS] the four colors are --hl-0 … --hl-3 in game.css.
═══════════════════════════════════════════════════════════════════ */
const HIGHLIGHT_COLOR_COUNT = 4;
let marks = {};             // "r,c" → color number (0-3)
let lockedMarks = new Set(); // "r,c" highlights that can't be cleared or changed (the tutorial's given ones)
let highlighting = false;   // the pencil is on
let markColor = 0;          // the color in use (0 = the first, the default)
const hlToolEl = document.getElementById('hl-tool');

function getMarks(){ return Object.assign({}, marks); }
// Highlights the player can't clear or recolor, e.g. ['0,0', '2,1']
function setLockedMarks(keys){ lockedMarks = new Set(keys || []); }
function setMarks(m){
  marks = {};
  Object.keys(m || {}).forEach(k=>{ const i = +m[k]; if(i >= 0 && i < HIGHLIGHT_COLOR_COUNT) marks[k] = i; });
  if(puzzle) renderMarks();
}
function renderMarks(){
  boardEl.querySelectorAll('.board-cell').forEach(cell=>paintMark(cell));
}
function paintMark(cell){
  const i = marks[cell.dataset.r + ',' + cell.dataset.c];
  cell.classList.toggle('marked', i !== undefined);
  if(i !== undefined) cell.style.setProperty('--mark', `var(--hl-${i})`);
  else cell.style.removeProperty('--mark');
}

function setHighlighting(on){
  highlighting = !!on;
  document.body.classList.toggle('highlighting', highlighting);
  if(!hlToolEl) return;
  hlToolEl.querySelector('.hl-pencil').classList.toggle('on', highlighting);
  hlToolEl.querySelector('.hl-pencil').setAttribute('aria-pressed', highlighting ? 'true' : 'false');
  hlToolEl.querySelector('.hl-color').classList.toggle('shown', highlighting);
  if(!highlighting) showColorMenu(false);
}
function setMarkColor(i){
  markColor = i;
  if(!hlToolEl) return;
  hlToolEl.querySelector('.hl-dot').style.background = `var(--hl-${i})`;
  hlToolEl.querySelectorAll('.hl-swatch').forEach((b, j)=>b.setAttribute('aria-checked', j === i ? 'true' : 'false'));
}
function showColorMenu(open){
  if(!hlToolEl) return;
  hlToolEl.querySelector('.hl-menu').hidden = !open;
  hlToolEl.querySelector('.hl-color').setAttribute('aria-expanded', open ? 'true' : 'false');
}

// Build the tool (pencil, color dot + ▾, the menu of colors)
if(hlToolEl){
  hlToolEl.innerHTML =
    `<button type="button" class="hl-pencil" aria-pressed="false" aria-label="Highlighter" title="Highlighter">`
    + `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4.5 19.5 L5.6 15 L15.6 5 a1.7 1.7 0 0 1 2.4 0 L19 6 a1.7 1.7 0 0 1 0 2.4 L9 18.4 Z M13.8 6.8 L17.2 10.2 M5.6 15 L9 18.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg></button>`
    + `<button type="button" class="hl-color" aria-label="Highlighter color" aria-expanded="false" title="Color">`
    + `<span class="hl-dot"></span><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
    + `<div class="hl-menu" role="radiogroup" aria-label="Highlighter colors" hidden>`
    + Array.from({ length: HIGHLIGHT_COLOR_COUNT }, (_, i)=>
        `<button type="button" class="hl-swatch" role="radio" aria-label="Color ${i+1}" style="background:var(--hl-${i})"></button>`).join('')
    + `</div>`;
  hlToolEl.querySelector('.hl-pencil').addEventListener('click', ()=>{
    setHighlighting(!highlighting);
    if(gameHooks.onHighlighter) gameHooks.onHighlighter(highlighting);
  });
  hlToolEl.querySelector('.hl-color').addEventListener('click', ()=>showColorMenu(hlToolEl.querySelector('.hl-menu').hidden));
  hlToolEl.querySelectorAll('.hl-swatch').forEach((b, i)=>b.addEventListener('click', ()=>{ setMarkColor(i); showColorMenu(false); }));
  // (tapping anywhere else closes the color menu)
  document.addEventListener('pointerdown', e=>{ if(!hlToolEl.contains(e.target)) showColorMenu(false); });
  setMarkColor(0);
}

/* Above and to the right of the rightmost piece in the top row of pieces
   (user, 2026-11-05), kept on screen. Called whenever the pieces are
   drawn and when the window changes size. */
function placeHighlighterTool(){
  if(!hlToolEl || hlToolEl.hidden || !hlToolEl.offsetParent) return;
  const slots = [...trayEl.querySelectorAll('.tray-slot')];
  let right, highest;
  if(slots.length){
    // (The pieces' spaces differ in height and are centred on their row, so
    // the top row is every space that starts above the end of the shortest
    // one in it; the pieces themselves are what the tool must stay clear of)
    const rects = slots.map(s=>({ slot: s.getBoundingClientRect(), piece: s.querySelector('.piece-box').getBoundingClientRect() }));
    const firstEnd = Math.min(...rects.map(r=>r.slot.bottom));
    const topRow = rects.filter(r=>r.slot.top < firstEnd);
    right = Math.max(...topRow.map(r=>r.piece.right));
    highest = Math.min(...topRow.map(r=>r.piece.top));
  } else {
    // No pieces (the tutorial's practice board): above the board's right
    // edge, where the pieces' row starts
    const w = hlToolEl.offsetWidth;
    right = boardOuterEl.getBoundingClientRect().right - w;
    highest = trayEl.getBoundingClientRect().top + hlToolEl.offsetHeight;
  }
  // gameSettings.hlOffset nudges it (px; the tutorial puts it a little
  // higher and further right, user 2026-11-05)
  const nudge = gameSettings.hlOffset || { x: 0, y: 0 };
  const holder = hlToolEl.offsetParent.getBoundingClientRect();
  const w = hlToolEl.offsetWidth, h = hlToolEl.offsetHeight;
  const left = Math.max(0, Math.min(right - holder.left + 2 + nudge.x, holder.width - w));
  hlToolEl.style.left = left + 'px';
  hlToolEl.style.top = Math.max(0, highest - holder.top - h - 4 + nudge.y) + 'px';
}

/* Tapping / dragging over squares while the pencil is on. The first
   square decides what the whole drag does: highlight in this color, or
   clear (if that square already had this color). */
let paint = null;    // { clear, done:Set } during a highlighting drag
function canHighlight(){ return highlighting && gameMode === 'play' && puzzle && !(solved && gameSettings.lockWhenSolved); }
function markCell(cell){
  const k = cell.dataset.r + ',' + cell.dataset.c;
  if(paint.done.has(k) || cell.classList.contains('removed') || lockedMarks.has(k)) return;
  paint.done.add(k);
  if(paint.clear) delete marks[k]; else marks[k] = markColor;
  paintMark(cell);
}
function cellAt(x, y){
  const el = document.elementFromPoint(x, y);
  return el && el.closest ? el.closest('#board .board-cell') : null;
}
boardEl.addEventListener('pointerdown', e=>{
  if(!canHighlight() || (e.button !== undefined && e.button !== 0)) return;
  const cell = e.target.closest('.board-cell');
  if(!cell || cell.classList.contains('removed')) return;
  e.preventDefault();
  if(lockedMarks.has(cell.dataset.r + ',' + cell.dataset.c)) return;   // (a given highlight stays)
  paint = { clear: marks[cell.dataset.r + ',' + cell.dataset.c] === markColor, done: new Set() };
  markCell(cell);
  const move = ev=>{ const c = cellAt(ev.clientX, ev.clientY); if(c) markCell(c); };
  const up = ()=>{
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    paint = null;
    if(gameHooks.onMark) gameHooks.onMark();
    if(gameHooks.onChange) gameHooks.onChange();     // (the puzzle page saves the highlights)
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
});

/* ═══════════════════════════════════════════════════════════════════
   START
═══════════════════════════════════════════════════════════════════ */
// The page calls loadPuzzle() to start (see play.html / sandbox.html)
let resizeTimer = null;
window.addEventListener('resize', ()=>{
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(()=>{ if(puzzle){ setupBoard(); renderAll(); } }, 100);
});
