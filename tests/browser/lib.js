// Shared bits for the browser tests (2026-11-16).
//   const T = require('./lib');
//   T.check('label', got, want)   → prints "ok   label: got" or "FAIL label: got (expected want)"
//   T.solution('hard')            → the published puzzle's answer, as game pieces
//   T.finish(errors)              → prints the summary; the test exits 1 if anything failed
// The runner (tests/run.js) reads only the exit code: 0 = passed.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'file://' + ROOT.split(path.sep).map(encodeURIComponent).join('/') + '/';
const S = require(path.join(ROOT, 'solver.js'));

// The three published puzzles (published.js), keyed easy / medium / hard
const src = fs.readFileSync(path.join(ROOT, 'published.js'), 'utf8');
const PUB = JSON.parse(src.split('/*JSON*/')[1].split('/*END*/')[0]);

// The answer to a published puzzle, as game pieces {name, cells, row, col}
// (cells start at 0,0; row / col = where the piece's corner goes)
function solution(level){
  const p = PUB[level].puzzle;
  const res = S.analyzePuzzle({ rows: p.rows, cols: p.cols, blocked: p.blocked, removed: p.removed,
    dotted: p.hintOutline, pieces: p.pieces.map(d => ({ name: d.name, cells: d.cells })) });
  const answer = res.tilings.find(t => t.parity);
  if(!answer) throw new Error(`published ${level} has no solution`);
  return answer.placements.map(pl => {
    const r0 = Math.min(...pl.cells.map(c => c[0])), c0 = Math.min(...pl.cells.map(c => c[1]));
    return { name: pl.piece, row: r0, col: c0, cells: pl.cells.map(([r, c]) => [r - r0, c - c0]) };
  });
}

let failures = 0;
function check(label, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ' (expected ' + JSON.stringify(want) + ')'}`);
  return ok;
}

// Call once at the end. `errors` = the page errors the test collected.
function finish(errors = []){
  if(errors.length){ failures++; console.log('PAGE ERRORS:\n' + errors.join('\n')); }
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exitCode = failures ? 1 : 0;
}

module.exports = { ROOT, BASE, S, PUB, solution, check, finish };
