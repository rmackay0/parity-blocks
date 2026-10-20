// Makes new puzzles in the style of the user's published ones, using solver.js.
// Run: node make_puzzles.js   (prints the puzzles as puzzles.js entries)
//
// Styles, matched to the user's puzzles (see puzzle_stats.js):
//   easy   6 red X (2 of them hidden), the pieces fill the board exactly and
//          fit ONE way only; 10-square outline around 2 pieces of the answer
//   medium 4 red X (2 empty spaces), 15–40 ways to fit, 1 even; 10-square outline
//   hard   4 red X (2 empty spaces), 60–150 ways to fit, 1 even (like Test
//          Puzzle #1: 74); 5-square outline around 1 piece, ~8–20 ways inside it
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');

// Same colours the site uses for each piece letter
const COLOR = { F:'#a8714a', I:'#5f9e8f', L:'#c9a877', N:'#7d6aa8', P:'#b8923f', T:'#6b8a9c',
                U:'#a85c4a', V:'#8a9c5a', W:'#a44e6b', X:'#4f8a7a', Y:'#8c6a4a', Z:'#8a5a7a' };

// A seeded random generator, so the same run gives the same puzzles
let seed = 20261020;
function rand(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const pick = arr => arr[Math.floor(rand() * arr.length)];

function randomBlocked(n){
  const cells = new Set();
  while (cells.size < n) cells.add(Math.floor(rand() * 6) + ',' + Math.floor(rand() * 6));
  return [...cells].map(s => s.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
const key = ([r, c]) => r + ',' + c;
const touches = (a, b) => a.some(([r, c]) => b.some(([r2, c2]) => Math.abs(r - r2) + Math.abs(c - c2) === 1));

function analyze(blocked, names, dotted){
  return S.analyzePuzzle({ rows: 6, cols: 6, blocked, dotted: dotted || [],
    pieces: names.map(n => ({ name: n, cells: S.pentomino(n).cells })) });
}

// Drop 6 different random pieces onto the 6×6 grid without overlapping
// (random spot, random turn), giving up and restarting if one won't fit.
// Returns the piece names and the 6 squares left uncovered, or null.
const NAMES = S.PENTOMINOES.map(p => p.name);
//   It fills the grid square by square in reading order: the first square
//   still open either gets a random unused piece that covers it, or is left
//   empty (at most 6 times). If it gets stuck it backs up and tries
//   something else (with a step limit so one bad start can't take forever).
const SHAPES = Object.fromEntries(NAMES.map(n => [n, S.orientations(S.pentomino(n).cells)]));
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
function randomLayout(){
  const grid = Array.from({ length: 6 }, () => Array(6).fill(null));   // null = open, 'piece name', or '.' = left empty
  const names = [], left = [];
  let steps = 0;
  function fill(){
    if (++steps > 4000) return false;
    let at = null;
    for (let r = 0; r < 6 && !at; r++) for (let c = 0; c < 6; c++) if (grid[r][c] === null){ at = [r, c]; break; }
    if (!at) return names.length === 6 && left.length === 6;
    const options = [];
    for (const n of NAMES) if (!names.includes(n)) for (const cells of SHAPES[n]) {
      // anchor the shape's first square (reading order) on the open square
      const [fr, fc] = cells[0];
      const abs = cells.map(([r, c]) => [at[0] + r - fr, at[1] + c - fc]);
      if (abs.every(([r, c]) => r >= 0 && r < 6 && c >= 0 && c < 6 && grid[r][c] === null)) options.push([n, abs]);
    }
    shuffle(options);
    if (left.length < 6) options.splice(Math.floor(rand() * (options.length + 1)), 0, null);   // "leave it empty"
    for (const opt of options) {
      if (opt === null){ grid[at[0]][at[1]] = '.'; left.push(at); if (fill()) return true; left.pop(); grid[at[0]][at[1]] = null; continue; }
      const [n, abs] = opt;
      if (names.length >= 6) continue;
      abs.forEach(([r, c]) => grid[r][c] = n); names.push(n);
      if (fill()) return true;
      names.pop(); abs.forEach(([r, c]) => grid[r][c] = null);
    }
    return false;
  }
  return fill() ? { names, left: left.map(rc => rc.slice()) } : null;
}

// Try layouts until one gives a puzzle of this style
function make(style, avoid){
  for (let attempt = 0; attempt < 20000; attempt++) {
    const layout = randomLayout();
    if (!layout || avoid.has(layout.names.slice().sort().join(''))) continue;
    // Easy: every leftover square is a red X. Otherwise: 4 of the 6 are red X
    // and the other 2 are the answer's empty spaces
    let blocked = layout.left;
    if (style !== 'easy') {
      const keep = layout.left.slice().sort(() => rand() - 0.5);
      blocked = keep.slice(0, 4).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }
    const range = { easy: [1, 1], medium: [15, 40], hard: [60, 150] }[style];
    const full = analyze(blocked, layout.names);
    if (full.paritySolutions !== 1 || full.totalTilings < range[0] || full.totalTilings > range[1]) continue;
    const choice = { pieces: layout.names };
    const answer = full.tilings.find(t => t.parity);

    // The dotted outline: around 2 touching pieces of the answer (10
    // squares), or 1 piece (5 squares) for hard
    let outline = null, inside = null;
    if (style === 'hard') {
      const tries = answer.placements.map(p => ({ cells: p.cells, n: analyze(blocked, choice.pieces, p.cells).totalTilings }))
        .filter(o => o.n >= 8 && o.n <= 20);
      if (!tries.length) continue;
      const o = pick(tries); outline = o.cells; inside = o.n;
    } else {
      const pairs = [];
      const pl = answer.placements;
      for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++)
        if (touches(pl[i].cells, pl[j].cells)) pairs.push(pl[i].cells.concat(pl[j].cells));
      const tries = pairs.map(cells => ({ cells, n: analyze(blocked, choice.pieces, cells).totalTilings }))
        .filter(o => style === 'easy' || (o.n >= 3 && o.n <= 12));
      if (!tries.length) continue;
      const o = pick(tries); outline = o.cells; inside = o.n;
    }
    outline.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    // Easy style hides 2 of the 6 red X squares (like the user's Easy and Medium)
    const hidden = style === 'easy' ? [blocked[1], blocked[4]] : [];

    // Double-check the finished puzzle from scratch: exactly one even answer
    const check = analyze(blocked, choice.pieces, outline);
    if (check.paritySolutions !== 1) continue;
    avoid.add(choice.pieces.slice().sort().join(''));
    return { style, blocked, hidden, outline, pieces: choice.pieces,
             tilings: full.totalTilings, tilingsInOutline: inside, answer: check.tilings.find(t => t.parity) };
  }
  throw new Error('No ' + style + ' puzzle found');
}

const avoid = new Set();
const made = ['easy', 'easy', 'medium', 'hard', 'hard'].map(style => make(style, avoid));
const counts = {};
made.forEach(p => {
  counts[p.style] = (counts[p.style] || 0) + 1;
  const Style = p.style[0].toUpperCase() + p.style.slice(1);
  const id = `claude-${p.style}-${counts[p.style]}`;
  console.log(`  // Claude-created (2026-10-20), ${p.style} style: ${p.tilings} way(s) to fit the pieces,` +
              ` ${p.tilingsInOutline} within the outline, exactly 1 with every row and column even (checked with solver.js).`);
  console.log(`  //   Answer: ${p.answer.placements.map(pl => pl.piece + ' ' + JSON.stringify(pl.cells)).join('  ')}`);
  console.log(`  '${id}': {`);
  console.log(`    title: 'Claude-created ${Style} #${counts[p.style]}',`);
  console.log(`    rows: 6, cols: 6,`);
  console.log(`    blocked: ${JSON.stringify(p.blocked)},`);
  if (p.hidden.length) console.log(`    hiddenBlocked: ${JSON.stringify(p.hidden)},`);
  console.log(`    hintOutline: ${JSON.stringify(p.outline)},`);
  console.log(`    hintText: 'No piece crosses the dotted line.',`);
  console.log(`    pieces: [`);
  p.pieces.forEach(n => console.log(`      { name:'${n}', color:'${COLOR[n]}', cells:${JSON.stringify(S.pentomino(n).cells)} },`));
  console.log(`    ]`);
  console.log(`  },`);
});
