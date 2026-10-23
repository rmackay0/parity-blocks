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
                      it off to keep its hand-picked colors. */
const gameSettings = { explain: true, lockWhenSolved: false, distinctColors: true };

/* [COLORS] Piece colors, given out in the order the puzzle lists its
   pieces, so no two pieces in a puzzle look alike. The first six are six
   different color families (a puzzle usually has six pieces). */
const PIECE_PALETTE = [
  '#4f9a8e',   // teal
  '#c49a3c',   // gold
  '#7e68b0',   // purple
  '#b45a46',   // brick red
  '#789e4e',   // green
  '#b0577f',   // rose
  '#5f7fb5',   // blue
  '#c9a877',   // tan
  '#8c6a4a',   // brown
  '#6b8a9c',   // slate
  '#9d8fc4',   // lavender
  '#a8714a',   // copper
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
let invalidIds = new Set();   // pieces overlapping, off-grid, or on a blocked square
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
  }
  if(!opts.keep || !placedPieces.some(q=>q.id===keyPieceId)) keyPieceId = null;
  solved = false;
  const caption = document.getElementById('hint-caption');
  caption.textContent = p.hintText || '';
  caption.hidden = !p.hintText;
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

function isBlocked(r, c){ return puzzle.blocked.some(([br,bc])=>br===r && bc===c); }
function isVisiblyBlocked(r, c){
  if(!isBlocked(r, c)) return false;
  return !(puzzle.hiddenBlocked || []).some(([hr,hc])=>hr===r && hc===c);
}
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
// visibleOnly: ignore hidden gaps (puzzle.hiddenBlocked). Used for anything
// the player SEES -- the red glow and the green/red drop preview -- so a
// hidden gap is never given away. A piece on a hidden gap still stops the
// puzzle from counting as solved (see checkSolved).
function fits(cells, row, col, excludeId, visibleOnly){
  return fitsAgainst(cells, row, col, occupiedExcept(excludeId), visibleOnly);
}
// Same check, against a given set of taken squares ("r,c")
function fitsAgainst(cells, row, col, occ, visibleOnly){
  const blocked = visibleOnly ? isVisiblyBlocked : isBlocked;
  return !crossesDottedLine(cells, row, col) && cells.every(([r,c])=>{
    const rr = row+r, cc = col+c;
    return inBounds(rr, cc) && !blocked(rr, cc) && !occ.has(rr+','+cc);
  });
}
function coversHiddenGap(p){
  return p.cells.some(([r,c])=>isBlocked(p.row+r, p.col+c) && !isVisiblyBlocked(p.row+r, p.col+c));
}
function completelyOffBoard(cells, row, col){
  return cells.every(([r,c])=>!inBounds(row+r, col+c));
}
// Rechecked for every piece after each change, so moving one piece off
// another clears the red state on both.
function recomputeValidity(){
  invalidIds = new Set(placedPieces.filter(p=>!fitsAgainst(p.cells, p.row, p.col, occupiedBefore(p.id), true)).map(p=>p.id));
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
  CELL = Math.max(20, Math.floor(Math.min(byW, byH, cssPx('--board-max-cell'))));
}

function setupBoard(){
  fitBoard();
  boardEl.style.gridTemplateColumns = `repeat(${puzzle.cols}, ${CELL}px)`;
  boardEl.style.gridTemplateRows = `repeat(${puzzle.rows}, ${CELL}px)`;
  boardEl.style.gap = GAP + 'px';
  boardEl.style.fontSize = (CELL/40) + 'rem';   // scales the blocked-square X
  boardEl.innerHTML = '';
  for(let r=0; r<puzzle.rows; r++) for(let c=0; c<puzzle.cols; c++){
    const cell = document.createElement('div');
    // Hidden gaps look like open squares in the game; the sandbox shows
    // them (class hidden-gap) everywhere except while play-testing
    const hidden = isBlocked(r,c) && !isVisiblyBlocked(r,c);
    cell.className = 'board-cell' + (removedSet.has(r+','+c) ? ' removed' : '')
      + (isVisiblyBlocked(r,c) ? ' blocked' : '')
      + (hidden && gameMode !== 'play' ? ' hidden-gap' : '');
    cell.dataset.r = r;
    cell.dataset.c = c;
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

// Optional dashed outline around a region (puzzle #2). Its caption is set
// once at start, before the board measures how much room it has.
function renderHint(){
  const overlay = document.getElementById('hint-overlay');
  overlay.innerHTML = '';
  if(!puzzle.hintOutline || !puzzle.hintOutline.length) return;
  const minR = Math.min(...puzzle.hintOutline.map(c=>c[0]));
  const minC = Math.min(...puzzle.hintOutline.map(c=>c[1]));
  const rel = puzzle.hintOutline.map(([r,c])=>[r-minR, c-minC]);
  const {rows, cols} = bounds(rel);
  const w = cols*CELL + (cols-1)*GAP, h = rows*CELL + (rows-1)*GAP;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  Object.assign(svg.style, { position:'absolute', left: pxPos(minC)+'px', top: pxPos(minR)+'px', overflow:'visible' });
  svg.appendChild(svgPath(buildOutlinePath(rel, CELL, GAP), {
    fill:'none', stroke:'var(--color-accent)', 'stroke-width':'3', 'stroke-dasharray':'7 5', 'stroke-linejoin':'round'
  }));
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
}

function boardFull(){ return placedPieces.filter(p=>!p.locked).length === puzzle.pieces.length; }

function renderBoardPieces(){
  piecesLayerEl.querySelectorAll('.placed-piece').forEach(el=>el.remove());
  // A piece that breaks a placement rule glows red. Once every piece is
  // down, only pieces breaking a rule the player can see glow (a piece on
  // a hidden gap stays secret); the written explanation follows a few
  // seconds later (see checkSolved).
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
  recomputeValidity();
  renderTray();
  renderBoardPieces();
  if(gameMode === 'play') checkSolved();
  else { markOverlayEl.innerHTML = ''; cancelExplain(); statusEl.textContent = ''; boardOuterEl.classList.remove('uneven'); }
  if(gameHooks.onChange) gameHooks.onChange();
}

// View mode: draw viewTiling's pieces (not the player's), mark odd
// rows/columns with the highlighter and ring the empty squares
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
  // Empty spaces in a finished board: dark like a permanent empty space, with a ring
  boardEl.querySelectorAll('.gap-dark').forEach(el=>el.classList.remove('gap-dark'));
  t.empty.forEach(([r,c])=>{
    const cell = boardEl.querySelector(`.board-cell[data-r="${r}"][data-c="${c}"]`);
    if(cell) cell.classList.add('gap-dark');
    if(t.rings !== false)     // the tutorial turns the rings off
      markOverlayEl.appendChild(svgEl('circle', { cx: pxPos(c) + CELL/2, cy: pxPos(r) + CELL/2, r: CELL*0.22, class:'empty-ring' }));
  });
  statusEl.textContent = t.status || '';
  statusEl.classList.toggle('good', !!t.good);
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
      press.ghost.appendChild(buildPieceShape(press.cells, press.color, CELL, GAP));
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
  e.preventDefault();
  e.stopPropagation();
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
  press = { source, startX:e.clientX, startY:e.clientY, grabDR, grabDC, cells, color, name, dragging:false, ghost:null };
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
  press.ghost.appendChild(buildPieceShape(press.cells, press.color, CELL, GAP));
  piecesLayerEl.appendChild(press.ghost);
  if(press.source.kind === 'board'){
    const el = piecesLayerEl.querySelector(`.placed-piece[data-id="${press.source.id}"]`);
    if(el) el.style.visibility = 'hidden';
  }
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

function onPointerMove(e){
  if(!press) return;
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
  const ok = fits(press.cells, row, col, excludeId, true);
  press.cells.forEach(([r,c])=>{
    const el = boardEl.querySelector(`.board-cell[data-r="${row+r}"][data-c="${col+c}"]`);
    if(el) el.classList.add(ok ? 'hl-valid' : 'hl-invalid');
  });
}

function onPointerUp(e){
  if(!press) return;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  const p = press;
  press = null;
  clearHighlights();

  if(!p.dragging){
    // A click: rotate, or reflect if it's the second click of a double-click.
    // (Not if R/E was pressed while holding it: that already turned it.)
    if(e.type !== 'pointercancel' && !p.keyUsed) onPieceClick(p.source);
    return;
  }
  p.ghost.remove();

  const {row, col} = landingSpot(e.clientX, e.clientY, p);
  const offBoard = e.type==='pointercancel' || overTray(e.clientX, e.clientY) || completelyOffBoard(p.cells, row, col);

  if(p.source.kind === 'tray'){
    if(!offBoard){
      const id = 'p' + (placedIdCounter++);
      placedPieces.push({ id, name:p.name, color:p.color, cells:p.cells.map(c=>c.slice()), row, col });
      if(gameHooks.onPlace) gameHooks.onPlace();
    } else if(p.keyUsed) trayCells[p.name] = p.cells;   // keep a turn made mid-drag
  } else {
    const piece = placedPieces.find(pp=>pp.id===p.source.id);
    piece.cells = p.cells;                              // (R/E may have turned it mid-drag)
    if(offBoard){
      // Dragged off the board: it goes back to the top, in its current turn
      placedPieces = placedPieces.filter(pp=>pp.id!==piece.id);
      trayCells[piece.name] = piece.cells;
    } else {
      piece.row = row;
      piece.col = col;
      bringToEnd(piece);
    }
  }
  renderAll();
}

/* ═══════════════════════════════════════════════════════════════════
   WIN CHECK
   Solved = every piece placed, none overlapping/off-grid/on a gap/across
   a dotted line, and every row and column has an even number of filled
   squares.
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
  gap:     'A piece is on a permanent empty space',
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
  if(abs.some(([r,c])=>isVisiblyBlocked(r,c))) return 'gap';   // hidden gaps stay secret
  if(abs.some(([r,c])=>occ.has(r+','+c))) return 'overlap';
  if(crossesDottedLine(p.cells, p.row, p.col)) return 'dotted';
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

/* [BEHAVIOR] Once every piece is on the grid, the squares left over (the
   empty spaces) turn dark, like permanent empty spaces, as the tutorial
   teaches. Picking a piece back up turns them back to normal. */
function markEmptySpaces(full){
  boardEl.querySelectorAll('.gap-dark').forEach(el=>el.classList.remove('gap-dark'));
  if(!full) return;
  const covered = new Set();
  placedPieces.forEach(p=>p.cells.forEach(([r,c])=>covered.add((p.row+r)+','+(p.col+c))));
  boardEl.querySelectorAll('.board-cell').forEach(el=>{
    const r = +el.dataset.r, c = +el.dataset.c;
    if(inBounds(r,c) && !isVisiblyBlocked(r,c) && !covered.has(r+','+c)) el.classList.add('gap-dark');
  });
}

function checkSolved(){
  markOverlayEl.innerHTML = '';
  boardOuterEl.classList.remove('uneven');
  markEmptySpaces(boardFull());
  boardOuterEl.classList.toggle('locked', solved && gameSettings.lockWhenSolved);
  if(solved) return;
  if(!boardFull()){ explainLater(''); return; }

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
  // A piece on a hidden gap silently prevents solving: no glow, no message
  const onHiddenGap = placedPieces.some(coversHiddenGap);

  if(!oddRows.length && !oddCols.length && !problems.length && !onHiddenGap){
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
  // (A piece on a hidden gap alone shows nothing: hidden gaps stay secret.)
  if(!problems.length && (oddRows.length || oddCols.length)) boardOuterEl.classList.add('uneven');
  explainLater([unevenMessage(oddRows.length, oddCols.length), ...problems.map(k=>PROBLEM_TEXT[k])]
    .filter(Boolean).join(' · '));
}
const solvedCloseBtn = document.getElementById('solved-close');
if(solvedCloseBtn) solvedCloseBtn.addEventListener('click', ()=>{
  document.getElementById('solved-popup').hidden = true;
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
