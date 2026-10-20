// How hard are the user's published puzzles? For each: how many ways the
// pieces fit (tilings), with and without the dotted outline, and how many
// of those pass the even rows/columns rule.  Run: node puzzle_stats.js
const fs = require('fs');
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');
const src = fs.readFileSync('/Users/robertmackay/Projects/Parity Blocks/published.js', 'utf8');
const P = JSON.parse(src.slice(src.indexOf('/*JSON*/') + 8, src.indexOf('/*END*/')));

for (const [level, entry] of Object.entries(P)) {
  if (!entry) continue;
  const p = entry.puzzle;
  const base = { rows: p.rows, cols: p.cols, blocked: p.blocked, pieces: p.pieces.map(x => ({ name: x.name, cells: x.cells })) };
  const plain = S.analyzePuzzle(base);
  const dotted = S.analyzePuzzle({ ...base, dotted: p.hintOutline || [] });
  const open = p.rows * p.cols - p.blocked.length;
  console.log(`${level.padEnd(6)} ${p.title.padEnd(16)} red X ${p.blocked.length} (hidden ${(p.hiddenBlocked || []).length}), empty spaces in answer ${open - 30}, outline ${(p.hintOutline || []).length} squares`
    + ` | tilings without outline ${plain.totalTilings} (pass ${plain.paritySolutions}) | with outline ${dotted.totalTilings} (pass ${dotted.paritySolutions})`);
}
