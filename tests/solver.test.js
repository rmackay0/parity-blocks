/* Solver tests. Run from the project folder with:
     node tests/solver.test.js
   No dependencies. Each check prints ✓ or ✗; the process exits with
   code 1 if anything failed. */
const S = require('../solver.js');

let failed = 0, passed = 0;
function check(name, actual, expected){
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if(a === e){ passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + '\n      expected ' + e + '\n      got      ' + a); }
}
const sortCells = cells => cells.slice().sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
const piece = name => ({ name, cells: S.pentomino(name).cells });

/* ── Orientations ── */
console.log('Orientations');
const expectedOrientations = { F:8, I:2, L:8, N:8, P:8, T:4, U:4, V:4, W:4, X:1, Y:8, Z:4 };
for(const p of S.PENTOMINOES) check(`${p.name} has ${expectedOrientations[p.name]}`, S.orientations(p.cells).length, expectedOrientations[p.name]);
check('63 fixed pentominoes in total (the known count)', S.PENTOMINOES.reduce((n,p)=>n + S.orientations(p.cells).length, 0), 63);

/* ── Parity check on its own ── */
console.log('Parity check');
check('empty board passes', S.checkParity(3, 3, []).pass, true);
check('2x2 block in a 4x4 passes', S.checkParity(4, 4, [[0,0],[0,1],[1,0],[1,1]]).pass, true);
const single = S.checkParity(3, 3, [[1,2]]);
check('one cell: fails its row and column', [single.pass, single.failingRows, single.failingCols], [false, [1], [2]]);
const lshape = S.checkParity(4, 4, [[0,0],[1,0],[1,1]]);   // row 0:1, row 1:2, col 0:2, col 1:1
check('L tromino: row 0 and col 1 fail', [lshape.failingRows, lshape.failingCols], [[0], [1]]);
const fullRow = S.checkParity(2, 5, [[0,0],[0,1],[0,2],[0,3],[0,4]]);
check('full row of 5: row odd, every column odd', [fullRow.failingRows, fullRow.failingCols], [[0], [0,1,2,3,4]]);

/* ── Tiny boards you can check by hand ── */
console.log('Tiny boards');
const count = cfg => S.analyzePuzzle(cfg).totalTilings;
check('I on a 1x5 board: 1 tiling', count({ rows:1, cols:5, pieces:[piece('I')] }), 1);
check('I on a 1x6 board: 2 tilings (start at col 0 or 1)', count({ rows:1, cols:6, pieces:[piece('I')] }), 2);
check('I on a 2x2 board: doesn’t fit, 0 tilings', count({ rows:2, cols:2, pieces:[piece('I')] }), 0);
check('X on a 3x3 board: 1 tiling', count({ rows:3, cols:3, pieces:[piece('X')] }), 1);
check('X on a 3x3 with the centre blocked: 0', count({ rows:3, cols:3, blocked:[[1,1]], pieces:[piece('X')] }), 0);
check('X on a 5x5 board: 9 tilings (3x3 positions)', count({ rows:5, cols:5, pieces:[piece('X')] }), 9);
check('L on a 2x5 board: 8 (4 lying-down orientations x 2 positions)', count({ rows:2, cols:5, pieces:[piece('L')] }), 8);
check('two I pieces on a 2x5 board: 2 (which I goes on top)', count({ rows:2, cols:5, pieces:[piece('I'), piece('I')] }), 2);
const iOn1x5 = S.analyzePuzzle({ rows:1, cols:5, pieces:[piece('I')] });
check('I on 1x5 fails parity (5 cells in the row)', [iOn1x5.paritySolutions, iOn1x5.tilings[0].failingRows], [0, [0]]);
const iOn1x6 = S.analyzePuzzle({ rows:1, cols:6, pieces:[piece('I')] });
const gapsByStart = {};
iOn1x6.tilings.forEach(t=>{ gapsByStart[t.placements[0].cells[0][1]] = t.gaps; });
check('gaps: I starting at col 0 of a 1x6 leaves [0,5] empty', gapsByStart[0], [[0,5]]);
check('gaps: I starting at col 1 leaves [0,0] empty', gapsByStart[1], [[0,0]]);
check('dotted outline: I on 1x6 must stay inside cols 0-4 → 1 tiling',
  count({ rows:1, cols:6, dotted:[[0,0],[0,1],[0,2],[0,3],[0,4]], pieces:[piece('I')] }), 1);
check('dotted outline on cols 0-2: the I always crosses it → 0 tilings',
  count({ rows:1, cols:6, dotted:[[0,0],[0,1],[0,2]], pieces:[piece('I')] }), 0);

/* ── Irregular boards (removed squares) ── */
console.log('Irregular boards');
check('X on a 3x3 with a corner removed: still 1 tiling (X never uses corners)',
  count({ rows:3, cols:3, removed:[[0,0]], pieces:[piece('X')] }), 1);
check('I on a 1x6 with the last square removed: only 1 tiling left',
  count({ rows:1, cols:6, removed:[[0,5]], pieces:[piece('I')] }), 1);
check('removed squares appear in the JSON as "removed"',
  S.analyzePuzzle({ rows:1, cols:6, removed:[[0,5]], pieces:[piece('I')] }).removed, [[0,5]]);

/* ── Pre-placed (prefilled) blocks ── */
console.log('Prefilled blocks');
// 1x6 row: block [0,0] already filled. I fits only at cols 1-5 → row has 6 filled → passes parity.
const pre = S.analyzePuzzle({ rows:1, cols:6, prefilled:[[0,0]], pieces:[piece('I')] });
check('prefilled square can\u2019t be covered: 1 tiling', pre.totalTilings, 1);
check('prefilled block counts toward its row: 6 blocks, row is even (would be 5 and odd if not counted)', pre.tilings[0].failingRows, []);
check('each column has 1 block, so every column is odd', pre.tilings[0].failingCols, [0,1,2,3,4,5]);

/* ── The real test case (Hard puzzle) ── */
console.log('Test puzzle: 6x6, blocked [1,1] [1,5] [5,0] [5,5], pieces L I X N P U');
const hardBoard = { rows:6, cols:6, blocked:[[1,1],[1,5],[5,0],[5,5]] };
const hard = S.analyzePuzzle(Object.assign({}, hardBoard, { pieces:['L','I','X','N','P','U'].map(piece) }));
check('74 total tilings', hard.totalTilings, 74);
check('exactly 1 passes parity', hard.paritySolutions, 1);
const sol = hard.tilings.find(t=>t.parity);
check('its gaps are [4,0] and [4,1]', sol.gaps, [[4,0],[4,1]]);
const expected = {
  L: [[0,0],[1,0],[2,0],[3,0],[3,1]],
  I: [[0,1],[0,2],[0,3],[0,4],[0,5]],
  X: [[1,2],[2,1],[2,2],[2,3],[3,2]],
  U: [[1,3],[1,4],[2,4],[3,3],[3,4]],
  N: [[2,5],[3,5],[4,4],[4,5],[5,4]],
  P: [[4,2],[4,3],[5,1],[5,2],[5,3]],
};
for(const name of Object.keys(expected)){
  const pl = sol.placements.find(p=>p.piece === name);
  check(`${name} placement`, sortCells(pl.cells), sortCells(expected[name]));
}
check('every non-passing tiling lists at least one failing row or column',
  hard.tilings.filter(t=>!t.parity).every(t=>t.failingRows.length + t.failingCols.length > 0), true);
check('every tiling leaves open cells - 5 x pieces gaps (32 - 30 = 2)',
  hard.tilings.every(t=>t.gaps.length === 2), true);

/* ── The puzzle finder ── */
console.log('Puzzle finder (924 combinations of 6, takes a few seconds)');
const found = S.findPuzzles(hardBoard, 6);
check('checks all 924 combinations', found.combinationsChecked, 924);
check('74 combinations have exactly one parity solution', found.qualifying.length, 74);
check('the Hard puzzle’s own set (I L N P U X) is among them',
  found.qualifying.some(q=>q.pieces.join('') === 'ILNPUX'), true);
check('sorted by total tilings, most first',
  found.qualifying.every((q,i,a)=>i === 0 || a[i-1].totalTilings >= q.totalTilings), true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
