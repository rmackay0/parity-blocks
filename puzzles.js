/* Puzzle definitions, shared by play.html (the public game page) and
   sandbox.html (the admin/building tool). Edit puzzles here only.

   Each entry:
     title          display name (sandbox tab label)
     rows, cols     board size
     blocked        [[row,col],...] cells removed from the board (red X)
     hiddenBlocked  optional subset of `blocked` drawn like a normal cell
     hintOutline    optional [[row,col],...] region traced with a dashed line
     hintText       optional caption for that outline
     pieces         [{name, color, cells}] -- cells are relative [row,col]
                    coordinates from the piece's own top-left corner.
*/
const PUZZLES = {
  'test-puzzle-1': {
    title: 'Test Puzzle #1',
    rows: 6, cols: 6,
    blocked: [[1,1],[1,5],[5,0],[5,5]],
    pieces: [
      { name:'L', color:'#c9a877', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] },
      { name:'I', color:'#5f9e8f', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]] },
      { name:'X', color:'#5f9e8f', cells:[[0,1],[1,0],[1,1],[1,2],[2,1]] },
      { name:'N', color:'#7d6aa8', cells:[[0,1],[0,2],[0,3],[1,0],[1,1]] },
      { name:'P', color:'#b8923f', cells:[[0,0],[0,1],[1,0],[1,1],[1,2]] },
      { name:'U', color:'#a85c4a', cells:[[0,0],[0,2],[1,0],[1,1],[1,2]] },
    ]
  },
  'test-puzzle-2': {
    title: 'Test Puzzle #2',
    rows: 6, cols: 6,
    // Fully covered by design (30 open cells, 6x5=30 piece cells) -- the
    // user supplied this as a complete, pre-solved layout, extracted
    // directly from it (verified: no overlaps, every row/column even).
    blocked: [[0,3],[0,5],[2,0],[2,3],[5,0],[5,5]],
    // Of the 6 blocked cells, only these 4 (the "right side" ones) show
    // the red X -- the other 2 are deliberately unmarked, functionally
    // blocked but indistinguishable from an open cell until you try
    // placing something there. See isVisiblyBlocked().
    hiddenBlocked: [[2,0],[5,0]],
    // A static dashed outline around the combined footprint of the X and
    // T pieces -- a logical anchor ("only these two pieces can cover this
    // region") rather than a full solution reveal.
    hintOutline: [[0,4],[1,3],[1,4],[1,5],[2,4],[2,5],[3,3],[3,4],[3,5],[4,5]],
    hintText: 'No piece crosses the dotted line.',
    pieces: [
      { name:'V', color:'#8a9c5a', cells:[[0,0],[0,1],[0,2],[1,2],[2,2]] },
      { name:'U', color:'#a86f4f', cells:[[0,0],[0,1],[1,1],[2,0],[2,1]] },
      { name:'X', color:'#4f8a7a', cells:[[0,1],[1,0],[1,1],[1,2],[2,1]] },
      { name:'T', color:'#6b8a9c', cells:[[0,2],[1,0],[1,1],[1,2],[2,2]] },
      { name:'N', color:'#6f6a9c', cells:[[0,0],[0,1],[1,1],[1,2],[1,3]] },
      { name:'Z', color:'#8a5a7a', cells:[[0,0],[1,0],[1,1],[1,2],[2,2]] },
    ]
  },
  'easy-puzzle-1': {
    title: 'Easy Puzzle #1',
    rows: 6, cols: 6,
    // Built in the sandbox (2026-10-17). 30 open squares, 30 piece squares:
    // fully covered, exactly one tiling (checked with solver.js).
    blocked: [[0,0],[0,3],[2,0],[2,1],[4,1],[4,3]],
    hiddenBlocked: [[0,0],[0,3]],
    hintOutline: [[0,4],[1,3],[1,4],[2,2],[2,3],[2,4],[3,2],[3,3],[3,4],[4,2]],
    hintText: 'No piece crosses the dotted line.',
    // Tray orientations are the standard ones, not the solution's
    pieces: [
      { name:'P', color:'#b8923f', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] },
      { name:'W', color:'#a44e6b', cells:[[0,0],[1,0],[1,1],[2,1],[2,2]] },
      { name:'I', color:'#5f9e8f', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]] },
      { name:'Z', color:'#8a5a7a', cells:[[0,0],[0,1],[1,1],[2,1],[2,2]] },
      { name:'U', color:'#a85c4a', cells:[[0,0],[0,2],[1,0],[1,1],[1,2]] },
      { name:'Y', color:'#8c6a4a', cells:[[0,1],[1,0],[1,1],[2,1],[3,1]] },
    ]
  }
};
