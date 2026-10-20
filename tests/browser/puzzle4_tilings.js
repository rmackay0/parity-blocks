// Lists every way to fit the final tutorial slide's pieces, and which
// pieces land inside the dotted outline in each.  Run: node puzzle4_tilings.js
const S = require('/Users/robertmackay/Projects/Parity Blocks/solver.js');

// Same as PUZZLE_4 in tutorial.html (fixed pieces count as prefilled blocks)
const outline = [[3,1],[3,2],[4,2],[4,3],[4,4],[4,5],[3,5],[5,3],[5,4],[5,5]];
const config = {
  rows: 6, cols: 6,
  blocked: [[3,4]],
  prefilled: [[0,4],[0,5],[1,5],[2,4],[2,5], [1,2],[2,1],[2,2],[2,3],[3,3]],
  dotted: outline,
  pieces: [
    { name:'W', cells:[[0,0],[0,1],[1,1],[1,2],[2,2]] },
    { name:'P', cells:[[0,0],[1,0],[1,1],[2,0],[2,1]] },
    { name:'N', cells:[[0,0],[1,0],[2,0],[2,1],[3,1]] },
    { name:'V', cells:[[0,0],[1,0],[2,0],[2,1],[2,2]] },
  ],
};
const inOutline = new Set(outline.map(([r,c])=>r+','+c));
const result = S.analyzePuzzle(config);
console.log('tilings:', result.totalTilings, '| pass parity:', result.paritySolutions);
result.tilings.forEach(t=>{
  const inside = t.placements.filter(p=>p.cells.every(([r,c])=>inOutline.has(r+','+c))).map(p=>p.piece);
  console.log(`#${t.index} parity ${t.parity ? 'PASS' : 'fail'} | in outline: ${inside.join(' ')} | empty spaces: ${JSON.stringify(t.gaps)}`);
});
// The squares each piece covers in the first (wrong) arrangement
result.tilings[0].placements.forEach(p=>console.log('  #0', p.piece, JSON.stringify(p.cells)));
