// The parity-first searches (solver.js parityTilingsScan, parityTilingsGaps,
// and analyzeFast, which picks one) must find EXACTLY the same parity
// solutions as the full search (analyzePuzzle). Checks random puzzles (cut
// corners, dotted areas, prefilled squares), then times one big puzzle both ways.
// Run with:  node tests/parity_fast_check.js
const S = require('../solver.js');

let failures = 0;
const names = S.PENTOMINOES.map(p=>p.name);
let seed = 12345;
const rand = n=>{ seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const pick = (list, k)=>{ const a = list.slice(), out = []; while(out.length < k) out.push(a.splice(rand(a.length), 1)[0]); return out; };
// A tiling written as text, so two lists can be compared regardless of order
const text = t=>t.placements.map(p=>p.piece + ':' + p.cells.map(c=>c.join(',')).join(' ')).sort().join(' | ');

for(let n=0; n<40; n++){
  // (small enough that the full search stores every tiling: it keeps only
  // the first 200,000, which would make the comparison wrong)
  const rows = 5 + rand(2), cols = 5 + rand(2);
  const config = { rows, cols, blocked:[], removed:[], dotted:[], prefilled:[], pieces: pick(names, 3 + rand(2)).map(name=>({ name })) };
  if(rand(2)) config.removed.push([0,0], [rows-1, cols-1]);
  if(rand(3) === 0) for(let r=1; r<3; r++) for(let c=1; c<4; c++) config.dotted.push([r,c]);
  if(rand(4) === 0) config.prefilled.push([rows-1, 0]);
  const full = S.analyzePuzzle(config, { maxStored: 5000000 });
  const want = JSON.stringify(full.tilings.filter(t=>t.parity).map(text).sort());
  for(const [name, fn] of [['scan', S.parityTilingsScan], ['gaps', S.parityTilingsGaps], ['chosen', S.parityTilings]]){
    const fast = fn(config);
    const ok = fast.count === full.paritySolutions && JSON.stringify(fast.tilings.map(text).sort()) === want;
    if(!ok) failures++;
    if(!ok || n < 3) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${rows}x${cols} ${config.pieces.map(p=>p.name).join('')}: ${full.totalTilings} tilings, parity ${full.paritySolutions} (found ${fast.count})`);
  }
}
console.log(failures ? `${failures} differences on the random puzzles` : 'all 40 random puzzles match (both searches)');

// Fixed pieces on the board (the tutorial's prefilled squares) count as blocks
// (4 pieces + 2 fixed squares = 22 blocks: an even total, so there can be solutions)
const pre = { rows:5, cols:6, blocked:[], prefilled:[[4,0],[4,1]], pieces:['F','L','N','P'].map(name=>({ name })) };
const preFull = S.analyzePuzzle(pre, { maxStored: 5000000 });
for(const [name, fn] of [['scan', S.parityTilingsScan], ['gaps', S.parityTilingsGaps]]){
  const r = fn(pre), ok = r.count === preFull.paritySolutions;
  if(!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} with fixed squares: ${r.count} (want ${preFull.paritySolutions})`);
}

// analyzeFast: small puzzles give the full answer; big ones say "more than 1000"
const small = S.analyzeFast({ rows:5, cols:5, blocked:[], pieces:['F','W','T'].map(name=>({ name })) });
const smallFull = S.analyzePuzzle({ rows:5, cols:5, blocked:[], pieces:['F','W','T'].map(name=>({ name })) });
const smallOk = small.totalTilings === smallFull.totalTilings && small.tilings.length === smallFull.tilings.length && smallFull.totalTilings <= 1000;
if(!smallOk) failures++;
console.log(`${smallOk ? 'ok  ' : 'FAIL'} small puzzle exact: ${small.totalTilings} tilings`);

// Timing, on the user's kind of puzzle
const big = { rows:6, cols:6, blocked:[], pieces:['F','L','N','P','T','U'].map(name=>({ name })) };
let t = Date.now();
const before = S.analyzePuzzle(big, { maxStored: 1000000 });
const slow = Date.now() - t;
t = Date.now();
const after = S.analyzeFast(big);
const quick = Date.now() - t;
const bigOk = after.totalTilings === null && after.tilingsMoreThan === 1000 && after.paritySolutions === before.paritySolutions
  && JSON.stringify(after.tilings.map(text).sort()) === JSON.stringify(before.tilings.filter(x=>x.parity).map(text).sort());
if(!bigOk) failures++;
console.log(`${bigOk ? 'ok  ' : 'FAIL'} 6x6 FLNPTU: ${before.totalTilings} tilings, ${before.paritySolutions} pass parity`);
console.log(`     old way ${slow} ms, new way ${quick} ms`);

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);
