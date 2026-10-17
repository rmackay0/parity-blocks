/* ═══════════════════════════════════════════════════════════════════════
   PARITY BLOCKS SOLVER
   ═══════════════════════════════════════════════════════════════════════

   Pure JavaScript: no DOM, no libraries, no network. The same file runs in
   three places:

     • Node, for the tests:      const S = require('./solver.js')
     • A web page:               <script src="solver.js"></script>  → window.ParitySolver
     • A Web Worker:             built from this file's own source text by
                                 ParitySolver.createWorker() (see the end)

   WHAT IT SOLVES
   A puzzle is a rows × cols board, some cells blocked, and a set of pieces
   (pentominoes). A TILING places every piece exactly once, rotated or
   reflected freely, on open cells, with no overlaps. Pieces don't have to
   cover every open cell; the open cells left over are the "gaps" (the
   analyzer page calls them "empty cells"). A tiling PASSES PARITY when
   every row and every column has an even number of filled cells.
   A good puzzle has many tilings but exactly one that passes parity.

   HOW IT SOLVES IT: EXACT COVER
   "Use every piece once, never use a cell twice" is an exact cover problem,
   which Donald Knuth's Algorithm X solves; Dancing Links (DLX) is the data
   structure that makes Algorithm X fast. Both are explained at the DLX
   section below. We enumerate EVERY tiling, then run the parity check on
   each one.

   The whole module lives inside one function, ParitySolverModule, so that
   createWorker() can turn that function's source code into a worker
   without fetching any file (fetching doesn't work when the game is
   opened straight from disk with file://).
   ═══════════════════════════════════════════════════════════════════════ */

function ParitySolverModule(root){
'use strict';

/* ───────────────────────────────────────────────────────────────────────
   1. THE 12 PENTOMINOES
   Standard names. `cells` are [row, col] offsets in one arbitrary starting
   orientation; orientations() generates the rest. `color` is the default
   used for puzzles made by the puzzle finder.
   ─────────────────────────────────────────────────────────────────────── */
const PENTOMINOES = [
  { name:'F', color:'#9c7350', cells:[[0,1],[0,2],[1,0],[1,1],[2,1]] },
  { name:'I', color:'#5f9e8f', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]] },
  { name:'L', color:'#c9a877', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] },
  { name:'N', color:'#7d6aa8', cells:[[0,1],[1,1],[2,0],[2,1],[3,0]] },
  { name:'P', color:'#b8923f', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] },
  { name:'T', color:'#6b8a9c', cells:[[0,0],[0,1],[0,2],[1,1],[2,1]] },
  { name:'U', color:'#a85c4a', cells:[[0,0],[0,2],[1,0],[1,1],[1,2]] },
  { name:'V', color:'#8a9c5a', cells:[[0,0],[1,0],[2,0],[2,1],[2,2]] },
  { name:'W', color:'#a44e6b', cells:[[0,0],[1,0],[1,1],[2,1],[2,2]] },
  { name:'X', color:'#4f8a7a', cells:[[0,1],[1,0],[1,1],[1,2],[2,1]] },
  { name:'Y', color:'#8c6a4a', cells:[[0,1],[1,0],[1,1],[2,1],[3,1]] },
  { name:'Z', color:'#8a5a7a', cells:[[0,0],[0,1],[1,1],[2,1],[2,2]] },
];
function pentomino(name){
  const p = PENTOMINOES.find(q=>q.name === name);
  if(!p) throw new Error('Unknown pentomino: ' + name);
  return p;
}

/* ───────────────────────────────────────────────────────────────────────
   2. ORIENTATIONS
   A piece can be rotated 0/90/180/270° and optionally reflected: 8 ways.
   Symmetric pieces repeat themselves, so we normalize each version
   (shift it so its top-left is at [0,0], sort its cells) and keep only
   distinct ones. Result: X → 1, I → 2, T/U/V/W/Z → 4, F/L/N/P/Y → 8.
   ─────────────────────────────────────────────────────────────────────── */
function normalize(cells){
  const minR = Math.min(...cells.map(c=>c[0]));
  const minC = Math.min(...cells.map(c=>c[1]));
  return cells.map(([r,c])=>[r-minR, c-minC])
              .sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
}
const rotate90 = cells => cells.map(([r,c])=>[c, -r]);   // quarter turn
const reflect  = cells => cells.map(([r,c])=>[r, -c]);   // mirror left↔right

function orientations(cells){
  const seen = new Set(), out = [];
  let shape = cells;
  for(let flip=0; flip<2; flip++){
    for(let turn=0; turn<4; turn++){
      const n = normalize(shape);
      const key = n.map(c=>c.join(',')).join(';');
      if(!seen.has(key)){ seen.add(key); out.push(n); }
      shape = rotate90(shape);
    }
    shape = reflect(shape);
  }
  return out;
}

/* ───────────────────────────────────────────────────────────────────────
   3. THE BOARD
   config: { rows, cols, blocked: [[r,c],...], dotted?: [[r,c],...] }
   `dotted` is a puzzle's dotted outline (puzzles.js `hintOutline`): a
   piece must sit entirely inside it or entirely outside it.
   Every OPEN cell gets an index 0..openCells.length-1; those indices
   become the DLX cell columns.
   ─────────────────────────────────────────────────────────────────────── */
function makeBoard(config){
  const { rows, cols } = config;
  if(!(rows > 0 && cols > 0)) throw new Error('Board needs rows and cols');
  const key = (r,c)=>r*cols + c;
  const blocked = new Set((config.blocked || []).map(([r,c])=>key(r,c)));
  const dotted  = new Set((config.dotted  || []).map(([r,c])=>key(r,c)));
  const openIndex = new Map();     // cell key → open-cell index
  const openCells = [];            // open-cell index → [r,c]
  for(let r=0; r<rows; r++) for(let c=0; c<cols; c++){
    if(blocked.has(key(r,c))) continue;
    openIndex.set(key(r,c), openCells.length);
    openCells.push([r,c]);
  }
  return { rows, cols, key, blocked, dotted, openIndex, openCells };
}

/* ───────────────────────────────────────────────────────────────────────
   4. PLACEMENTS
   Every orientation at every position. A placement is kept only if all
   five cells are on the board and open, and (if the board has a dotted
   outline) it doesn't straddle it. Returns arrays of open-cell indices.
   ─────────────────────────────────────────────────────────────────────── */
function placementsFor(board, pieceCells){
  const out = [];
  for(const shape of orientations(pieceCells)){
    const h = Math.max(...shape.map(c=>c[0])) + 1;
    const w = Math.max(...shape.map(c=>c[1])) + 1;
    for(let r=0; r<=board.rows-h; r++) for(let c=0; c<=board.cols-w; c++){
      const idx = [];
      let ok = true, inside = 0;
      for(const [dr,dc] of shape){
        const k = board.key(r+dr, c+dc);
        const i = board.openIndex.get(k);
        if(i === undefined){ ok = false; break; }   // blocked cell
        if(board.dotted.has(k)) inside++;
        idx.push(i);
      }
      if(!ok) continue;
      if(inside !== 0 && inside !== shape.length) continue;   // crosses the dotted line
      out.push(idx);
    }
  }
  return out;
}

/* ───────────────────────────────────────────────────────────────────────
   5. DANCING LINKS (Algorithm X)

   THE EXACT COVER MATRIX
   Picture a table. Each ROW is one candidate placement ("L, this
   orientation, at row 2 col 0"). Each COLUMN is a constraint:
     • one column per PIECE: "the L is placed". The row for an L placement
       has a 1 in the L column.
     • one column per OPEN CELL: "cell (2,0) is used". The row has a 1 in
       each of the five cells the placement covers.
   A tiling is a set of rows with exactly one 1 in every piece column
   (each piece placed once) and at most one 1 in every cell column (no
   overlap).

   PRIMARY vs SECONDARY COLUMNS (why gaps are allowed)
   Plain exact cover demands exactly one 1 in EVERY column, which would
   force every open cell to be filled: no gaps. So the cell columns are
   SECONDARY: "at most once". Algorithm X only ever *chooses* primary
   columns to satisfy. Secondary columns are never chosen, so nothing
   forces them to be covered (that's a gap), but when a chosen row does
   use a cell, that cell's column is still covered, which deletes every
   other row using that cell (that's "no overlap").

   ALGORITHM X, in words
     If every primary column is covered → found a tiling.
     Otherwise pick an uncovered primary column c (the piece with the
     FEWEST remaining placements: the "fewest options" heuristic prunes
     dead ends early). For each row r with a 1 in column c:
       put r in the partial solution,
       cover every column r touches (removing all conflicting rows),
       recurse,
       uncover them again in reverse order (backtrack), and try the next r.

   DANCING LINKS: making "remove" and "put back" cheap
   Every 1 in the matrix is a node in four circular doubly linked lists:
   left/right through its row, up/down through its column. Each column
   has a header node; the primary headers are linked left/right in a ring
   starting at the root node (secondary headers stay out of that ring,
   which is exactly why Algorithm X never chooses them).
   Removing node x from a list:   R[L[x]] = R[x];  L[R[x]] = L[x]
   x's own L[x]/R[x] are left untouched, so it still "remembers" its
   neighbours and putting it back is:  R[L[x]] = x;  L[R[x]] = x
   Undoing removals in exact reverse order restores the whole matrix
   perfectly: the links "dance" out and back in. No copying, no searching.

   cover(c):   unlink header c from the header ring, then for every row i
               in column c, unlink each OTHER node j of row i from its own
               column. Row i (which conflicts with whatever just claimed c)
               becomes invisible to the rest of the search.
   uncover(c): the exact mirror image, walking every list in reverse.

   Storage: plain number arrays indexed by node id (fast; no objects).
   Node 0 is the root, nodes 1..numColumns are column headers, the rest
   are the 1s.
   ─────────────────────────────────────────────────────────────────────── */
function DLX(numPrimary, numSecondary){
  const nCols = numPrimary + numSecondary;
  this.L = []; this.R = []; this.U = []; this.D = [];
  this.C = [];       // C[node]   = its column header
  this.rowOf = [];   // rowOf[node] = the caller's row id
  this.size = [];    // size[header] = how many 1s left in that column
  // root
  this.L[0] = 0; this.R[0] = 0; this.U[0] = 0; this.D[0] = 0; this.C[0] = 0;
  for(let h=1; h<=nCols; h++){
    this.U[h] = h; this.D[h] = h; this.C[h] = h; this.size[h] = 0;
    if(h <= numPrimary){
      // primary header: append to the ring after the last one
      this.L[h] = this.L[0]; this.R[h] = 0;
      this.R[this.L[0]] = h; this.L[0] = h;
    } else {
      // secondary header: a ring of its own, outside the root ring
      this.L[h] = h; this.R[h] = h;
    }
  }
}

// Add one row. `columns` are 0-based column numbers (primaries first).
DLX.prototype.addRow = function(rowId, columns){
  let first = -1;
  for(const col of columns){
    const h = col + 1, x = this.L.length;
    // vertical: insert just above the header (= at the bottom of the column)
    this.U[x] = this.U[h]; this.D[x] = h;
    this.D[this.U[h]] = x; this.U[h] = x;
    this.C[x] = h; this.rowOf[x] = rowId; this.size[h]++;
    // horizontal: insert at the end of this row's ring
    if(first < 0){ first = x; this.L[x] = x; this.R[x] = x; }
    else { this.L[x] = this.L[first]; this.R[x] = first; this.R[this.L[first]] = x; this.L[first] = x; }
  }
};

DLX.prototype.cover = function(c){
  const { L, R, U, D, C, size } = this;
  R[L[c]] = R[c]; L[R[c]] = L[c];                 // header leaves the ring
  for(let i=D[c]; i!==c; i=D[i]){                  // each row in this column...
    for(let j=R[i]; j!==i; j=R[j]){                //   ...each other node in that row
      D[U[j]] = D[j]; U[D[j]] = U[j];              //   leaves its column
      size[C[j]]--;
    }
  }
};

DLX.prototype.uncover = function(c){
  const { L, R, U, D, C, size } = this;
  for(let i=U[c]; i!==c; i=U[i]){                  // reverse order of cover()
    for(let j=L[i]; j!==i; j=L[j]){
      size[C[j]]++;
      D[U[j]] = j; U[D[j]] = j;                    // node rejoins its column
    }
  }
  R[L[c]] = c; L[R[c]] = c;                        // header rejoins the ring
};

/* Enumerate every solution.
   onSolution(rowIds) is called for each; return true from it to stop early.
   opts.onProgress({steps, solutions, fraction}) is called roughly every
   opts.progressMs milliseconds. opts.shouldCancel() → true aborts with an
   error named 'Cancelled'.
   `fraction` estimates progress from where the search is in its first two
   levels of choices. */
DLX.prototype.search = function(onSolution, opts){
  opts = opts || {};
  const self = this, { R, D, C, size, rowOf } = this;
  const partial = [];
  const branchIdx = [], branchLen = [];
  let steps = 0, solutions = 0, stopped = false;
  let lastReport = Date.now();
  const progressMs = opts.progressMs || 100;

  function report(){
    let f = 0, scale = 1;
    for(let k=0; k<Math.min(2, branchLen.length); k++){
      if(!branchLen[k]) break;
      scale /= branchLen[k];
      f += branchIdx[k] * scale;
    }
    opts.onProgress({ steps, solutions, fraction: Math.min(1, f) });
  }

  function recurse(depth){
    if(R[0] === 0){                     // every primary column covered
      solutions++;
      if(onSolution(partial.slice())) stopped = true;
      return;
    }
    // Fewest-options heuristic: the primary column with the smallest size
    let c = R[0], best = size[c];
    for(let j=R[c]; j!==0 && best>0; j=R[j]) if(size[j] < best){ c = j; best = size[j]; }
    if(best === 0) return;              // some piece has nowhere left to go

    self.cover(c);
    branchLen[depth] = best; branchIdx[depth] = 0;
    for(let r=D[c]; r!==c && !stopped; r=D[r]){
      if((++steps & 2047) === 0){
        if(opts.shouldCancel && opts.shouldCancel()){ const e = new Error('Cancelled'); e.name = 'Cancelled'; throw e; }
        if(opts.onProgress && Date.now() - lastReport >= progressMs){ lastReport = Date.now(); report(); }
      }
      partial.push(rowOf[r]);
      for(let j=R[r]; j!==r; j=R[j]) self.cover(C[j]);
      recurse(depth + 1);
      for(let j=self.L[r]; j!==r; j=self.L[j]) self.uncover(C[j]);
      partial.pop();
      branchIdx[depth]++;
    }
    branchLen.length = depth;           // forget deeper levels' counters
    self.uncover(c);
  }
  recurse(0);
  if(opts.onProgress){ branchIdx.length = 0; branchLen.length = 0; opts.onProgress({ steps, solutions, fraction: 1 }); }
  return solutions;
};

/* ───────────────────────────────────────────────────────────────────────
   6. PARITY CHECK
   filledCells: [[r,c], ...]. Counts filled cells in every row and column;
   blocked cells and gaps simply aren't in the list, so they count as
   unfilled. Passes when every count is even.
   ─────────────────────────────────────────────────────────────────────── */
function checkParity(rows, cols, filledCells){
  const rowCount = new Array(rows).fill(0), colCount = new Array(cols).fill(0);
  for(const [r,c] of filledCells){ rowCount[r]++; colCount[c]++; }
  const failingRows = [], failingCols = [];
  rowCount.forEach((n,r)=>{ if(n % 2) failingRows.push(r); });
  colCount.forEach((n,c)=>{ if(n % 2) failingCols.push(c); });
  return { pass: !failingRows.length && !failingCols.length, failingRows, failingCols, rowCount, colCount };
}

/* ───────────────────────────────────────────────────────────────────────
   7. ANALYZE ONE PUZZLE
   config: { rows, cols, blocked, dotted?, pieces: [{name, cells}] }
   Returns the JSON format the analyzer downloads:
     { gridSize, blocked, pieces, totalTilings, paritySolutions,
       solveTimeMs, tilings: [{ index, parity, gaps, failingRows,
       failingCols, placements: [{piece, cells}] }] }
   (plus `dotted` when the puzzle has a dotted outline, and
   `tilingsTruncated: true` if there were more than opts.maxStored tilings;
   counting still covers all of them).
   ─────────────────────────────────────────────────────────────────────── */
function analyzePuzzle(config, opts){
  opts = opts || {};
  const maxStored = opts.maxStored || 200000;
  const t0 = Date.now();
  const board = makeBoard(config);
  const pieces = config.pieces.map(p=>({ name: p.name, cells: p.cells || pentomino(p.name).cells }));

  // Matrix rows: one per placement. Columns: pieces 0..P-1, then cells.
  const P = pieces.length;
  const dlx = new DLX(P, board.openCells.length);
  const rowInfo = [];
  pieces.forEach((piece, pi)=>{
    for(const idx of placementsFor(board, piece.cells)){
      dlx.addRow(rowInfo.length, [pi, ...idx.map(i=>P + i)]);
      rowInfo.push({ piece: pi, cells: idx });
    }
  });

  const tilings = [];
  let total = 0, passing = 0;
  dlx.search(rowIds=>{
    const placements = rowIds.map(id=>rowInfo[id]).sort((a,b)=>a.piece - b.piece);
    const used = new Set();
    placements.forEach(pl=>pl.cells.forEach(i=>used.add(i)));
    const filled = [...used].map(i=>board.openCells[i]);
    const parity = checkParity(board.rows, board.cols, filled);
    if(parity.pass) passing++;
    if(tilings.length < maxStored){
      tilings.push({
        index: total,
        parity: parity.pass,
        gaps: board.openCells.filter((_, i)=>!used.has(i)).map(rc=>rc.slice()),
        failingRows: parity.failingRows,
        failingCols: parity.failingCols,
        placements: placements.map(pl=>({
          piece: pieces[pl.piece].name,
          cells: pl.cells.map(i=>board.openCells[i].slice()).sort((a,b)=>a[0]-b[0] || a[1]-b[1]),
        })),
      });
    }
    total++;
    return false;
  }, opts);

  const result = {
    gridSize: [board.rows, board.cols],
    blocked: (config.blocked || []).map(rc=>rc.slice()),
    pieces: pieces.map(p=>p.name),
    totalTilings: total,
    paritySolutions: passing,
    solveTimeMs: Date.now() - t0,
    tilings,
  };
  if(config.dotted && config.dotted.length) result.dotted = config.dotted.map(rc=>rc.slice());
  if(total > tilings.length) result.tilingsTruncated = true;
  return result;
}

/* ───────────────────────────────────────────────────────────────────────
   8. PUZZLE FINDER
   For one board, try every combination of n pentominoes out of 12
   (C(12,6) = 924) and keep the combinations with EXACTLY ONE
   parity-passing tiling, sorted by total tilings, most first (more
   tilings to wade through = harder puzzle).
   Placements are computed once per pentomino and reused for every
   combination. A combination is abandoned as soon as a second parity
   solution turns up, since it can't qualify any more.
   ─────────────────────────────────────────────────────────────────────── */
function combinations(n, k){
  const out = [], combo = [];
  (function pick(start){
    if(combo.length === k){ out.push(combo.slice()); return; }
    for(let i=start; i<=n-(k-combo.length); i++){ combo.push(i); pick(i+1); combo.pop(); }
  })(0);
  return out;
}

function findPuzzles(boardConfig, n, opts){
  opts = opts || {};
  const t0 = Date.now();
  const board = makeBoard(boardConfig);
  const allPlacements = PENTOMINOES.map(p=>placementsFor(board, p.cells));
  const combos = combinations(PENTOMINOES.length, n);
  const qualifying = [];
  let lastReport = 0;

  combos.forEach((combo, ci)=>{
    if(opts.shouldCancel && opts.shouldCancel()){ const e = new Error('Cancelled'); e.name = 'Cancelled'; throw e; }
    if(opts.onProgress && (Date.now() - lastReport >= (opts.progressMs || 100))){
      lastReport = Date.now();
      opts.onProgress({ checked: ci, combinations: combos.length, found: qualifying.length, fraction: ci / combos.length });
    }
    // A piece with no legal placement at all can't be in any tiling
    if(combo.some(pi=>!allPlacements[pi].length)) return;

    const dlx = new DLX(n, board.openCells.length);
    const rowCells = [];
    combo.forEach((pi, k)=>{
      for(const idx of allPlacements[pi]){
        dlx.addRow(rowCells.length, [k, ...idx.map(i=>n + i)]);
        rowCells.push(idx);
      }
    });
    let total = 0, passing = 0;
    dlx.search(rowIds=>{
      total++;
      const filled = [];
      rowIds.forEach(id=>rowCells[id].forEach(i=>filled.push(board.openCells[i])));
      if(checkParity(board.rows, board.cols, filled).pass) passing++;
      return passing > 1;          // stop: this combination can't qualify
    });
    if(passing === 1) qualifying.push({ pieces: combo.map(pi=>PENTOMINOES[pi].name), totalTilings: total });
  });

  qualifying.sort((a,b)=>b.totalTilings - a.totalTilings || a.pieces.join('').localeCompare(b.pieces.join('')));
  if(opts.onProgress) opts.onProgress({ checked: combos.length, combinations: combos.length, found: qualifying.length, fraction: 1 });
  return {
    gridSize: [board.rows, board.cols],
    blocked: (boardConfig.blocked || []).map(rc=>rc.slice()),
    pieceCount: n,
    combinationsChecked: combos.length,
    qualifying,
    solveTimeMs: Date.now() - t0,
  };
}

/* ───────────────────────────────────────────────────────────────────────
   9. RUNNING IN A WEB WORKER
   A worker is a separate thread, so a long search can't freeze the page.

   In the PAGE: createWorker() takes this whole module function's source
   (Function.prototype.toString), wraps it as "(source)(self)", and starts
   a worker from it as a Blob URL. No file is fetched, so it works offline
   and from file://. Cancelling = worker.terminate(), which stops it
   instantly.

   In the WORKER: the module notices it's inside a worker (importScripts
   exists, document doesn't) and listens for jobs:
     → { type:'analyze', config }        ← progress… then { type:'result', result }
     → { type:'find', board, n }         ← progress… then { type:'result', result }
     ← { type:'error', message } if something throws
   ─────────────────────────────────────────────────────────────────────── */
function createWorker(){
  const source = '(' + ParitySolverModule.toString() + ')(self);';
  const url = URL.createObjectURL(new Blob([source], { type:'text/javascript' }));
  const worker = new Worker(url);
  const terminate = worker.terminate.bind(worker);
  worker.terminate = ()=>{ terminate(); URL.revokeObjectURL(url); };
  return worker;
}

const insideWorker = typeof root.importScripts === 'function' && typeof root.document === 'undefined';
if(insideWorker){
  root.onmessage = e=>{
    const msg = e.data || {};
    const onProgress = p=>root.postMessage(Object.assign({ type:'progress' }, p));
    try {
      let result;
      if(msg.type === 'analyze') result = analyzePuzzle(msg.config, { onProgress, maxStored: msg.maxStored });
      else if(msg.type === 'find') result = findPuzzles(msg.board, msg.n, { onProgress });
      else throw new Error('Unknown job type: ' + msg.type);
      root.postMessage({ type:'result', result });
    } catch(err){
      root.postMessage({ type:'error', message: String(err && err.message || err) });
    }
  };
}

return {
  PENTOMINOES, pentomino, normalize, orientations, makeBoard, placementsFor,
  DLX, checkParity, analyzePuzzle, combinations, findPuzzles, createWorker,
};
}

// Expose the module: module.exports in Node, window.ParitySolver in a page.
(function(){
  const g = typeof globalThis !== 'undefined' ? globalThis : self;
  if(typeof module !== 'undefined' && module.exports){ module.exports = ParitySolverModule(g); return; }
  if(typeof g.importScripts === 'function' && typeof g.document === 'undefined') return;  // worker: already started by "(source)(self)"
  g.ParitySolver = ParitySolverModule(g);
})();
