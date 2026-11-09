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
   section below. analyzePuzzle enumerates EVERY tiling, then runs the
   parity check on each one. analyzeFast (section 7c) does that only when
   there are at most 1,000 tilings; past that it uses a search that checks
   parity as it goes (section 7b) and skips most failing tilings.

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
   config: { rows, cols, blocked: [[r,c],...], removed?: [[r,c],...], prefilled?: [[r,c],...], dotted?: [[r,c],...] }
   `prefilled` squares are covered by pieces that start on the board and
   can't move (the tutorial uses these): no piece can go there, but they
   DO count as filled blocks for the parity check.
   `removed` squares aren't part of the board at all (irregular shapes).
   For solving they behave exactly like blocked squares: no piece can
   go there, and they never count as filled.
   `dotted` is a puzzle's dotted outline (puzzles.js `hintOutline`): a
   piece must sit entirely inside it or entirely outside it.
   Every OPEN cell gets an index 0..openCells.length-1; those indices
   become the DLX cell columns.
   ─────────────────────────────────────────────────────────────────────── */
function makeBoard(config){
  const { rows, cols } = config;
  if(!(rows > 0 && cols > 0)) throw new Error('Board needs rows and cols');
  const key = (r,c)=>r*cols + c;
  const blocked = new Set((config.blocked || []).concat(config.removed || [], config.prefilled || []).map(([r,c])=>key(r,c)));
  const prefilled = (config.prefilled || []).map(rc=>rc.slice());
  const dotted  = new Set((config.dotted  || []).map(([r,c])=>key(r,c)));
  const openIndex = new Map();     // cell key → open-cell index
  const openCells = [];            // open-cell index → [r,c]
  for(let r=0; r<rows; r++) for(let c=0; c<cols; c++){
    if(blocked.has(key(r,c))) continue;
    openIndex.set(key(r,c), openCells.length);
    openCells.push([r,c]);
  }
  return { rows, cols, key, blocked, dotted, openIndex, openCells, prefilled };
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
    const filled = [...used].map(i=>board.openCells[i]).concat(board.prefilled);
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
    return !!opts.stopAfter && total >= opts.stopAfter;   // (analyzeFast stops at 1,001)
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
  if(config.removed && config.removed.length) result.removed = config.removed.map(rc=>rc.slice());
  if(config.prefilled && config.prefilled.length) result.prefilled = config.prefilled.map(rc=>rc.slice());
  if(config.dotted && config.dotted.length) result.dotted = config.dotted.map(rc=>rc.slice());
  if(total > tilings.length) result.tilingsTruncated = true;
  return result;
}

/* ───────────────────────────────────────────────────────────────────────
   7b. PARITY-FIRST SEARCHES (2026-11-08)
   For puzzles with hundreds of thousands of tilings but only a few that
   pass parity. analyzePuzzle builds every tiling and only then checks
   it; these never build most of the failing ones. Two ways, each much
   faster on a different kind of puzzle (parityTilings picks one):
     parityTilingsGaps   chooses the EMPTY squares first. Best with few
                         empty squares (every published puzzle so far:
                         1 to 6). Published Hard: 0.13 s (analyzePuzzle
                         1.6 s); a 6 × 7 board with 7 pieces: 5 ms (24 s).
     parityTilingsScan   fills the board in reading order. Best with many
                         empty squares: a 6 × 6 board with 4 pieces (16
                         empty) takes 0.4 s, where the other takes 4 min.
   Both return { count, tilings, steps }: every parity-passing tiling (up
   to opts.maxStored), in analyzePuzzle's format.

   parityTilingsScan fills the board in reading order (left to right, top to bottom).
   At each open square that isn't covered yet, there are two choices:
   leave it empty (if the puzzle has empty squares to spare), or put an
   unused piece there, in any position whose first square (in reading
   order) is this one. Squares already passed are never touched again, so:
     • once the search passes the last square of a row, that row's count
       is final, and if it's odd, nothing built on it can pass parity:
       the search drops it on the spot;
     • two different ways of filling the top part that leave the same
       situation behind (same pieces used, same squares covered ahead,
       same odd/even rows and columns so far) have exactly the same
       futures, so the number of ways to finish is remembered (`memo`)
       and reused instead of searched again.
   Only odd/even matters, never the exact counts, which is what makes
   so many situations the same.
   A second walk then lists the actual solutions, going only down paths
   the first walk counted as having at least one.
   ─────────────────────────────────────────────────────────────────────── */
function parityTilingsScan(config, opts){
  opts = opts || {};
  const maxStored = opts.maxStored || 200000;
  const board = makeBoard(config);
  const pieces = config.pieces.map(p=>({ name: p.name, cells: p.cells || pentomino(p.name).cells }));
  const P = pieces.length, N = board.openCells.length, R = board.rows, C = board.cols;
  const FULL = (1 << P) - 1;

  // Placements grouped by their first square in reading order (open-cell
  // indices are already in reading order: makeBoard goes row by row)
  const byFirst = Array.from({ length: N }, ()=>[]);
  let span = 0;                      // furthest any placement reaches past its first square
  pieces.forEach((piece, pi)=>{
    for(const idx of placementsFor(board, piece.cells)){
      const cells = idx.slice().sort((a,b)=>a - b);
      byFirst[cells[0]].push({ piece: pi, bit: 1 << pi, cells });
      span = Math.max(span, cells[cells.length-1] - cells[0]);
    }
  });
  const cellRow = board.openCells.map(rc=>rc[0]), cellCol = board.openCells.map(rc=>rc[1]);
  const rowLast = new Array(R).fill(-1);          // last open square of each row
  board.openCells.forEach(([r], i)=>{ rowLast[r] = i; });

  // The search's state (changed as pieces go down, undone on the way back)
  const occ = new Uint8Array(N);
  const rowPar = new Uint8Array(R), colPar = new Uint8Array(C);
  board.prefilled.forEach(([r,c])=>{ rowPar[r] ^= 1; colPar[c] ^= 1; });
  let used = 0;
  const stack = [];                  // placements down so far (for listing solutions)
  const memo = new Map();
  const MEMO_LIMIT = 3000000;        // (forget everything past this, to save memory)
  const found = [];
  let steps = 0, lastReport = Date.now();
  const branchIdx = [0, 0], branchLen = [1, 1];   // (progress: where the first two choices are)

  function place(pl, on){
    for(const k of pl.cells){ occ[k] = on; rowPar[cellRow[k]] ^= 1; colPar[cellCol[k]] ^= 1; }
    used ^= pl.bit;
    if(on) stack.push(pl); else stack.pop();
  }
  // Everything that decides the future, packed into a short string
  function stateKey(i, r0, gapsLeft){
    let rowBits = 0, colBits = 0;
    for(let r=r0; r<R; r++) if(rowPar[r]) rowBits |= 1 << (r - r0);
    for(let c=0; c<C; c++) if(colPar[c]) colBits |= 1 << c;
    let s = String.fromCharCode(i, used, gapsLeft, rowBits, colBits);
    const end = Math.min(N, i + span + 1);
    for(let k=i; k<end; k+=15){
      let chunk = 0;
      for(let b=0; b<15 && k+b<end; b++) if(occ[k+b]) chunk |= 1 << b;
      s += String.fromCharCode(chunk);
    }
    return s;
  }
  function tick(){
    if((++steps & 4095) !== 0) return;
    if(opts.shouldCancel && opts.shouldCancel()){ const e = new Error('Cancelled'); e.name = 'Cancelled'; throw e; }
    if(opts.onProgress && Date.now() - lastReport >= (opts.progressMs || 100)){
      lastReport = Date.now();
      opts.onProgress({ phase: 'parity', steps, fraction: Math.min(1, branchIdx[0]/branchLen[0] + branchIdx[1]/(branchLen[0]*branchLen[1])) });
    }
  }

  // How many parity-passing ways to finish from here (listing = also record them)
  function walk(i, r0, gapsLeft, listing, depth){
    while(i < N && occ[i]) i++;
    while(r0 < R && rowLast[r0] < i){ if(rowPar[r0]) return 0; r0++; }   // a finished row is odd
    if(i === N){
      if(used !== FULL) return 0;
      for(let c=0; c<C; c++) if(colPar[c]) return 0;
      if(listing && found.length < maxStored) found.push(stack.slice());
      return 1;
    }
    const key = listing ? null : stateKey(i, r0, gapsLeft);
    if(!listing){ const m = memo.get(key); if(m !== undefined) return m; }
    tick();
    const options = byFirst[i];
    // (progress counts only the listing walk's top two levels: it visits everything once, in order)
    const track = listing && depth < 2;
    if(track){ branchLen[depth] = options.length + 1; branchIdx[depth] = 0; if(depth === 0) branchIdx[1] = 0; }
    let total = 0;
    // (listing: only go where counting found something)
    const go = (next, gaps)=>{
      const n = walk(next, r0, gaps, false, depth + 1);
      if(listing && n > 0 && found.length < maxStored) walk(next, r0, gaps, true, depth + 1);
      total += n;
    };
    if(gapsLeft > 0) go(i + 1, gapsLeft - 1);          // leave square i empty
    for(const pl of options){
      if(track){ branchIdx[depth]++; if(depth === 0) branchIdx[1] = 0; }
      if(used & pl.bit) continue;
      let free = true;
      for(const k of pl.cells) if(occ[k]){ free = false; break; }
      if(!free) continue;
      place(pl, 1);
      go(i + 1, gapsLeft);
      place(pl, 0);
    }
    if(!listing){
      if(memo.size >= MEMO_LIMIT) memo.clear();
      memo.set(key, total);
    }
    return total;
  }

  const gaps = N - 5*P;
  let count = 0;
  if(gaps >= 0 && pieces.every(p=>p.cells.length === 5)){
    count = walk(0, 0, gaps, true, 0);
  }

  // Same tiling format as analyzePuzzle
  const tilings = found.map((pls, index)=>{
    const usedCells = new Set();
    pls.forEach(pl=>pl.cells.forEach(k=>usedCells.add(k)));
    return {
      index, parity: true,
      gaps: board.openCells.filter((_, k)=>!usedCells.has(k)).map(rc=>rc.slice()),
      failingRows: [], failingCols: [],
      placements: pls.slice().sort((a,b)=>a.piece - b.piece).map(pl=>({
        piece: pieces[pl.piece].name,
        cells: pl.cells.map(k=>board.openCells[k].slice()).sort((a,b)=>a[0]-b[0] || a[1]-b[1]),
      })),
    };
  });
  return { count, tilings, steps };
}

/* EMPTY SQUARES FIRST (parityTilingsGaps). A tiling passes parity exactly when its
   empty squares leave every row and column even. So: list only the sets
   of empty squares that do that, and for each one ask whether the pieces
   can fill all the other open squares exactly (an ordinary tiling with no
   empty squares left to choose, which is a quick question).
   The sets are listed square by square in reading order, and a set is
   abandoned as soon as it can't work: a finished row is uneven, or the
   empty squares left to place can't fix every uneven row and column (each
   one needs at least one more, and the count has to come out odd/even
   the right way). Best when the puzzle has few empty squares. */
function parityTilingsGaps(config, opts){
  opts = opts || {};
  const maxStored = opts.maxStored || 200000;
  const board = makeBoard(config);
  const pieces = config.pieces.map(p=>({ name: p.name, cells: p.cells || pentomino(p.name).cells }));
  const P = pieces.length, N = board.openCells.length, R = board.rows, C = board.cols;
  const G = N - 5*P;                                 // how many empty squares every tiling has
  const empty = { count: 0, tilings: [], steps: 0 };
  if(G < 0 || pieces.some(p=>p.cells.length !== 5)) return empty;

  // One matrix where every open square must be covered; making a square
  // empty = covering its column first (that also removes every placement
  // that uses it)
  const dlx = new DLX(P + N, 0);
  const info = [];
  pieces.forEach((piece, pi)=>{
    for(const idx of placementsFor(board, piece.cells)){
      dlx.addRow(info.length, [pi, ...idx.map(i=>P + i)]);
      info.push({ piece: pi, cells: idx });
    }
  });

  // Which rows / columns need an odd number of empty squares
  const cellRow = board.openCells.map(rc=>rc[0]), cellCol = board.openCells.map(rc=>rc[1]);
  const needRow = new Uint8Array(R), needCol = new Uint8Array(C);
  board.openCells.forEach(([r,c])=>{ needRow[r] ^= 1; needCol[c] ^= 1; });
  board.prefilled.forEach(([r,c])=>{ needRow[r] ^= 1; needCol[c] ^= 1; });
  const rowLast = new Array(R).fill(-1);
  board.openCells.forEach(([r], i)=>{ rowLast[r] = i; });
  const gapRow = new Uint8Array(R), gapCol = new Uint8Array(C);

  const chosen = [], found = [];
  let count = 0, steps = 0, lastReport = Date.now(), cancelled = false;
  const branchIdx = [0, 0], branchLen = [1, 1];
  function tick(){
    if((++steps & 1023) !== 0) return;
    if(opts.shouldCancel && opts.shouldCancel()){ const e = new Error('Cancelled'); e.name = 'Cancelled'; throw e; }
    if(opts.onProgress && Date.now() - lastReport >= (opts.progressMs || 100)){
      lastReport = Date.now();
      opts.onProgress({ phase: 'parity', steps, fraction: Math.min(1, branchIdx[0]/branchLen[0] + branchIdx[1]/(branchLen[0]*branchLen[1])) });
    }
  }
  // These empty squares work for parity: can the pieces fill the rest exactly?
  function tryTiling(){
    for(const k of chosen) dlx.cover(P + k + 1);
    dlx.search(ids=>{
      count++;
      if(found.length < maxStored) found.push(ids);
      return false;
    }, { shouldCancel: opts.shouldCancel });
    for(let j=chosen.length-1; j>=0; j--) dlx.uncover(P + chosen[j] + 1);
  }
  function pick(k, left, r0, depth){
    tick();
    while(r0 < R && rowLast[r0] < k){ if(gapRow[r0] !== needRow[r0]) return; r0++; }   // a finished row is uneven
    let rowsOff = 0, colsOff = 0;
    for(let r=r0; r<R; r++) if(gapRow[r] !== needRow[r]) rowsOff++;
    for(let c=0; c<C; c++) if(gapCol[c] !== needCol[c]) colsOff++;
    if(rowsOff > left || colsOff > left || (left - rowsOff) % 2 || (left - colsOff) % 2) return;
    if(left === 0){ tryTiling(); return; }
    const last = N - left;
    if(depth < 2){ branchLen[depth] = last - k + 1; branchIdx[depth] = 0; }
    for(let x=k; x<=last; x++){
      if(depth < 2) branchIdx[depth] = x - k;
      // (skipping past the end of an uneven row can't work)
      if(r0 < R && x > rowLast[r0] && gapRow[r0] !== needRow[r0]) break;
      gapRow[cellRow[x]] ^= 1; gapCol[cellCol[x]] ^= 1; chosen.push(x);
      pick(x + 1, left - 1, r0, depth + 1);
      gapRow[cellRow[x]] ^= 1; gapCol[cellCol[x]] ^= 1; chosen.pop();
    }
  }
  pick(0, G, 0, 0);

  const tilings = found.map((ids, index)=>{
    const usedCells = new Set();
    ids.forEach(id=>info[id].cells.forEach(k=>usedCells.add(k)));
    return {
      index, parity: true,
      gaps: board.openCells.filter((_, k)=>!usedCells.has(k)).map(rc=>rc.slice()),
      failingRows: [], failingCols: [],
      placements: ids.map(id=>info[id]).sort((a,b)=>a.piece - b.piece).map(pl=>({
        piece: pieces[pl.piece].name,
        cells: pl.cells.map(k=>board.openCells[k].slice()).sort((a,b)=>a[0]-b[0] || a[1]-b[1]),
      })),
    };
  });
  return { count, tilings, steps };
}

/* Which search to use. "Empty squares first" looks at about
   C(open squares, empty squares) / 2^(rows + columns − 1) sets of empty
   squares, so it's used while that's at most about 260,000 (2^18);
   otherwise the reading-order search. (Measured: 6 × 6 with 6 pieces
   = 2^10 sets → empty squares first, 0.4 s; 6 × 6 with 4 pieces = 2^22
   sets → reading order, 0.4 s instead of 4 min.)
   An odd number of blocks in all can never make every row even, so then
   there's nothing to search. Result: { count, tilings, steps, method }. */
function parityTilings(config, opts){
  const board = makeBoard(config);
  const P = config.pieces.length, N = board.openCells.length, G = N - 5*P;
  if(G < 0 || (5*P + board.prefilled.length) % 2) return { count: 0, tilings: [], steps: 0, method: 'odd' };
  let log2Sets = 1 - board.rows - board.cols;
  for(let k=0; k<G; k++) log2Sets += Math.log2((N - k) / (k + 1));
  const method = log2Sets <= 18 ? 'gaps' : 'scan';
  const result = (method === 'gaps' ? parityTilingsGaps : parityTilingsScan)(config, opts);
  result.method = method;
  return result;
}

/* ───────────────────────────────────────────────────────────────────────
   7c. ANALYZE, FAST (the sandbox uses this; user, 2026-11-08: "when there
   are more than 1000 tilings, i don't need to know the exact number")
   First looks for up to 1,001 tilings the ordinary way. With 1,000 or
   fewer, that IS the full answer (every tiling, exactly as analyzePuzzle).
   With more, totalTilings is null, tilingsMoreThan is 1000, and tilings
   lists only the parity-passing ones, found by parityTilings.
   ─────────────────────────────────────────────────────────────────────── */
function analyzeFast(config, opts){
  opts = opts || {};
  const limit = opts.exactUpTo || 1000;
  const t0 = Date.now();
  const first = analyzePuzzle(config, Object.assign({}, opts, { stopAfter: limit + 1 }));
  if(first.totalTilings <= limit){ first.solveTimeMs = Date.now() - t0; return first; }
  const par = parityTilings(config, opts);
  const result = Object.assign({}, first, {
    totalTilings: null,
    tilingsMoreThan: limit,
    paritySolutions: par.count,
    solveTimeMs: Date.now() - t0,
    tilings: par.tilings,
    searchMethod: par.method,        // 'gaps', 'scan' or 'odd' (see parityTilings)
  });
  delete result.tilingsTruncated;
  if(par.count > par.tilings.length) result.tilingsTruncated = true;
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
      const filled = board.prefilled.slice();
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
     → { type:'analyzeFast', config }    ← the same, from analyzeFast (progress
                                           has phase:'parity' once it switches)
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
      else if(msg.type === 'analyzeFast') result = analyzeFast(msg.config, { onProgress, maxStored: msg.maxStored });
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
  DLX, checkParity, analyzePuzzle, parityTilings, parityTilingsScan, parityTilingsGaps, analyzeFast, combinations, findPuzzles, createWorker,
};
}

// Expose the module: module.exports in Node, window.ParitySolver in a page.
(function(){
  const g = typeof globalThis !== 'undefined' ? globalThis : self;
  if(typeof module !== 'undefined' && module.exports){ module.exports = ParitySolverModule(g); return; }
  if(typeof g.importScripts === 'function' && typeof g.document === 'undefined') return;  // worker: already started by "(source)(self)"
  g.ParitySolver = ParitySolverModule(g);
})();
