/* ═══════════════════════════════════════════════════════════════════════
   PARITY BLOCKS: GAME LOGIC
   Shared by play.html (the game) and sandbox.html (the puzzle builder).
   Needs shapes.js loaded first, and the page markup from play.html
   (#tray, #board-wrap, #board, #pieces-layer, #hint-overlay,
   #mark-overlay, #status, #hint-caption, #reflect-btn, #rotate-btn,
   #solved-popup).

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
};

const boardWrapEl   = document.getElementById('board-wrap');
const boardEl       = document.getElementById('board');
const piecesLayerEl = document.getElementById('pieces-layer');
const trayEl        = document.getElementById('tray');
const reflectBtn    = document.getElementById('reflect-btn');
const rotateBtn     = document.getElementById('rotate-btn');

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
let selection = null;         // {kind:'board', id} | {kind:'tray', name} | null
let placedIdCounter = 1;
let solved = false;
let startTime = Date.now();

/* Start a puzzle. opts.keep = true keeps pieces already on the board (and
   tray orientations) for pieces that are still in the puzzle; the
   sandbox uses this when you edit the board you're testing on. */
function loadPuzzle(p, opts){
  opts = opts || {};
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
  if(selection && ((selection.kind==='tray' && !names.has(selection.name)) ||
                   (selection.kind==='board' && !placedPieces.some(q=>q.id===selection.id)))) selection = null;
  if(!opts.keep) selection = null;
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
  if(mode !== 'play') selection = null;
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
  const occ = occupiedExcept(excludeId);
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
  invalidIds = new Set(placedPieces.filter(p=>!fits(p.cells, p.row, p.col, p.id, true)).map(p=>p.id));
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
      + (used.has(def.name) ? ' used' : '')
      + (selection && selection.kind==='tray' && selection.name===def.name ? ' selected' : '');
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
  // A bad drop glows red while you're still placing pieces. Once every
  // piece is down, nothing glows: the message above the board and the
  // highlighter marks explain what's wrong instead (see checkSolved).
  const showInvalid = !boardFull();
  placedPieces.forEach(p=>{
    const wrap = document.createElement('div');
    wrap.className = 'placed-piece'
      + (selection && selection.kind==='board' && selection.id===p.id ? ' selected' : '')
      + (showInvalid && invalidIds.has(p.id) ? ' invalid' : '')
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
  reflectBtn.disabled = rotateBtn.disabled = !selection || gameMode !== 'play';
  if(gameMode === 'play') checkSolved();
  else { markOverlayEl.innerHTML = ''; statusEl.textContent = ''; }
  if(gameHooks.onChange) gameHooks.onChange();
}

// View mode: draw viewTiling's pieces (not the player's), mark odd
// rows/columns with the highlighter and ring the empty squares
function renderView(){
  const t = viewTiling || { pieces:[], oddRows:[], oddCols:[], empty:[], status:'' };
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
  reflectBtn.disabled = rotateBtn.disabled = true;
  drawUnevenMarks(t.oddRows, t.oddCols);
  t.empty.forEach(([r,c])=>{
    markOverlayEl.appendChild(svgEl('circle', { cx: pxPos(c) + CELL/2, cy: pxPos(r) + CELL/2, r: CELL*0.22, class:'empty-ring' }));
  });
  statusEl.textContent = t.status || '';
  statusEl.classList.toggle('good', !!t.good);
}

/* ═══════════════════════════════════════════════════════════════════
   SELECT / ROTATE / REFLECT
═══════════════════════════════════════════════════════════════════ */
function select(sel){ selection = sel; renderAll(); }

function transformSelection(fn){
  if(!selection) return;
  if(selection.kind === 'tray'){
    trayCells[selection.name] = fn(trayCells[selection.name]);
  } else {
    const p = placedPieces.find(pp=>pp.id===selection.id);
    if(!p) return;
    p.cells = fn(p.cells);   // turns in place; goes red if it no longer fits
  }
  renderAll();
}
reflectBtn.addEventListener('click', ()=>transformSelection(reflectCells));
rotateBtn.addEventListener('click', ()=>transformSelection(rotateCells));

/* [BEHAVIOR] Clicking a piece (at the top or on the board):
     one click    → rotate a quarter turn clockwise
     double-click → reflect (mirror left↔right)
   Every double-click starts with a single click, so a click waits
   DOUBLE_CLICK_MS to see whether a second one follows before rotating.
   Clicking also selects the piece, so Reflect/Rotate and R/F still work. */
const DOUBLE_CLICK_MS = 280;
let pendingClick = null;    // { source, timer } while waiting to see if it's a double-click

const sameSource = (a, b) => a && b && a.kind === b.kind &&
  (a.kind === 'tray' ? a.name === b.name : a.id === b.id);

function transformSource(source, fn){
  if(source.kind === 'tray'){
    if(trayCells[source.name]) trayCells[source.name] = fn(trayCells[source.name]);
  } else {
    const p = placedPieces.find(pp=>pp.id===source.id);
    if(p && !p.locked) p.cells = fn(p.cells);
  }
  renderAll();
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
  selection = source;
  if(pendingClick && sameSource(pendingClick.source, source)){
    // second click in time: it's a double-click → reflect instead of rotate
    clearTimeout(pendingClick.timer);
    pendingClick = null;
    transformSource(source, reflectCells);
    return;
  }
  flushPendingClick();
  renderAll();              // show it selected straight away
  pendingClick = { source, timer: setTimeout(()=>{
    pendingClick = null;
    transformSource(source, rotateCells);
  }, DOUBLE_CLICK_MS) };
}

document.addEventListener('keydown', e=>{
  if(e.key==='r' || e.key==='R') transformSelection(rotateCells);
  else if(e.key==='f' || e.key==='F' || e.key==='t' || e.key==='T') transformSelection(reflectCells);
  else if(e.key==='Escape') select(null);
});

// Tapping empty space clears the selection (but not taps on the buttons)
document.addEventListener('pointerdown', e=>{
  if(e.target.closest('.tray-slot, .placed-piece, .controls, .popup')) return;
  if(selection) select(null);
});

/* ═══════════════════════════════════════════════════════════════════
   DRAG
   A press only becomes a drag once the pointer moves a few pixels; a
   press-and-release without moving is a click (rotate; double = reflect).
═══════════════════════════════════════════════════════════════════ */
const DRAG_THRESHOLD = 5;
let press = null;   // {source, startX, startY, grabDR, grabDC, dragging, ghost, cells, color, name}

function onPiecePointerDown(e, source){
  if(gameMode !== 'play') return;
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
    // A click: rotate, or reflect if it's the second click of a double-click
    if(e.type !== 'pointercancel') onPieceClick(p.source);
    return;
  }
  p.ghost.remove();

  const {row, col} = landingSpot(e.clientX, e.clientY, p);
  const offBoard = e.type==='pointercancel' || overTray(e.clientX, e.clientY) || completelyOffBoard(p.cells, row, col);

  if(p.source.kind === 'tray'){
    if(!offBoard){
      const id = 'p' + (placedIdCounter++);
      placedPieces.push({ id, name:p.name, color:p.color, cells:p.cells.map(c=>c.slice()), row, col });
      selection = {kind:'board', id};
    }
  } else {
    const piece = placedPieces.find(pp=>pp.id===p.source.id);
    if(offBoard){
      // Dragged off the board: it goes back to the top, in its current turn
      placedPieces = placedPieces.filter(pp=>pp.id!==piece.id);
      trayCells[piece.name] = piece.cells;
      selection = null;
    } else {
      piece.row = row;
      piece.col = col;
      selection = {kind:'board', id:piece.id};
    }
  }
  renderAll();
}

/* ═══════════════════════════════════════════════════════════════════
   WIN CHECK
   Solved = every piece placed, none overlapping/off-grid/on a gap/across
   a dotted line, and every row and column has an even number of filled
   squares.
   Once every piece is down but it isn't solved, the message above the
   board says what's wrong ("Uneven rows and column", "A piece is on a
   gap", ...). Highlighter strokes on the uneven lines are off by default
   (SHOW_UNEVEN_MARKS below).
═══════════════════════════════════════════════════════════════════ */
const statusEl = document.getElementById('status');
const markOverlayEl = document.getElementById('mark-overlay');

// [CONTENT] Messages for a piece that breaks a placement rule
// [BEHAVIOR] When every piece is placed but it isn't solved, the message
// above the board says what's wrong. Set this to true to also draw red
// highlighter strokes over the uneven rows/columns. (The sandbox's
// solution viewer always shows them.)
const SHOW_UNEVEN_MARKS = false;

const PROBLEM_TEXT = {
  overlap: 'Pieces overlap',
  off:     'A piece is off the board',
  gap:     'A piece is on a fixed gap',
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
  const occ = occupiedExcept(p.id);
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

function checkSolved(){
  markOverlayEl.innerHTML = '';
  if(solved) return;
  if(!boardFull()){ statusEl.textContent = ''; return; }

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
    statusEl.textContent = '';
    const time = formatElapsed(Date.now() - startTime);
    if(gameHooks.onSolved){ gameHooks.onSolved(time); return; }
    document.getElementById('solved-time').textContent = 'Your time: ' + time;
    document.getElementById('solved-popup').hidden = false;
    return;
  }
  if(SHOW_UNEVEN_MARKS) drawUnevenMarks(oddRows, oddCols);
  statusEl.textContent = [unevenMessage(oddRows.length, oddCols.length), ...problems.map(k=>PROBLEM_TEXT[k])]
    .filter(Boolean).join(' · ');
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
