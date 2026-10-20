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
  },

  /* ── Claude-created practice puzzles (2026-10-20) ──
     Made by Claude in the style of the puzzles above, so the user can try
     the app as a player; NOT the user's own. Easy style = like Easy
     Puzzle #1 (6 red X, 2 hidden, the pieces fit one way only); Medium and
     Hard style = like Test Puzzle #1 (4 red X, 2 empty spaces, many ways
     to fit, only one with every row and column even). Each was checked
     with solver.js. Play one: play.html?puzzle=claude-easy-1 (etc.) */
  // 1 way to fit the pieces.
  //   Answer: I [[0,0],[0,1],[0,2],[0,3],[0,4]]  F [[0,5],[1,3],[1,4],[1,5],[2,4]]  L [[1,0],[1,1],[2,1],[3,1],[4,1]]  N [[1,2],[2,2],[3,2],[3,3],[4,3]]  Y [[2,5],[3,5],[4,4],[4,5],[5,5]]  U [[4,0],[4,2],[5,0],[5,1],[5,2]]
  'claude-easy-1': {
    title: 'Claude-created Easy #1',
    rows: 6, cols: 6,
    blocked: [[2,0],[2,3],[3,0],[3,4],[5,3],[5,4]],
    hiddenBlocked: [[2,3],[5,3]],
    hintOutline: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,2],[3,2],[3,3],[4,3]],
    hintText: 'No piece crosses the dotted line.',
    pieces: [
      { name:'I', color:'#5f9e8f', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]] },
      { name:'F', color:'#a8714a', cells:[[0,1],[0,2],[1,0],[1,1],[2,1]] },
      { name:'L', color:'#c9a877', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] },
      { name:'N', color:'#7d6aa8', cells:[[0,1],[1,1],[2,0],[2,1],[3,0]] },
      { name:'Y', color:'#8c6a4a', cells:[[0,1],[1,0],[1,1],[2,1],[3,1]] },
      { name:'U', color:'#a85c4a', cells:[[0,0],[0,2],[1,0],[1,1],[1,2]] },
    ]
  },
  // 1 way to fit the pieces.
  //   Answer: Y [[0,0],[0,1],[0,2],[0,3],[1,1]]  L [[0,4],[0,5],[1,4],[2,4],[3,4]]  V [[1,0],[2,0],[3,0],[3,1],[3,2]]  N [[1,2],[2,2],[2,3],[3,3],[4,3]]  P [[3,5],[4,4],[4,5],[5,4],[5,5]]  U [[4,0],[4,1],[4,2],[5,0],[5,2]]
  'claude-easy-2': {
    title: 'Claude-created Easy #2',
    rows: 6, cols: 6,
    blocked: [[1,3],[1,5],[2,1],[2,5],[5,1],[5,3]],
    hiddenBlocked: [[1,5],[5,1]],
    hintOutline: [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[2,0],[3,0],[3,1],[3,2]],
    hintText: 'No piece crosses the dotted line.',
    pieces: [
      { name:'Y', color:'#8c6a4a', cells:[[0,1],[1,0],[1,1],[2,1],[3,1]] },
      { name:'L', color:'#c9a877', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] },
      { name:'V', color:'#8a9c5a', cells:[[0,0],[1,0],[2,0],[2,1],[2,2]] },
      { name:'N', color:'#7d6aa8', cells:[[0,1],[1,1],[2,0],[2,1],[3,0]] },
      { name:'P', color:'#b8923f', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] },
      { name:'U', color:'#a85c4a', cells:[[0,0],[0,2],[1,0],[1,1],[1,2]] },
    ]
  },
  // 30 ways to fit the pieces, 4 within the outline, 1 with every row and column even.
  //   Answer: L [[0,2],[0,3],[0,4],[0,5],[1,5]]  P [[0,0],[0,1],[1,0],[1,1],[1,2]]  F [[3,5],[4,3],[4,4],[4,5],[5,4]]  V [[3,0],[4,0],[5,0],[5,1],[5,2]]  Z [[2,0],[2,1],[3,1],[4,1],[4,2]]  W [[1,3],[1,4],[2,2],[2,3],[3,2]]
  'claude-medium-1': {
    title: 'Claude-created Medium #1',
    rows: 6, cols: 6,
    blocked: [[2,4],[2,5],[5,3],[5,5]],
    hintOutline: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[1,0],[1,1],[1,2],[1,5]],
    hintText: 'No piece crosses the dotted line.',
    pieces: [
      { name:'L', color:'#c9a877', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] },
      { name:'P', color:'#b8923f', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] },
      { name:'F', color:'#a8714a', cells:[[0,1],[0,2],[1,0],[1,1],[2,1]] },
      { name:'V', color:'#8a9c5a', cells:[[0,0],[1,0],[2,0],[2,1],[2,2]] },
      { name:'Z', color:'#8a5a7a', cells:[[0,0],[0,1],[1,1],[2,1],[2,2]] },
      { name:'W', color:'#a44e6b', cells:[[0,0],[1,0],[1,1],[2,1],[2,2]] },
    ]
  },
  // 78 ways to fit the pieces, 9 within the outline, 1 with every row and column even.
  //   Answer: V [[0,0],[0,1],[0,2],[1,2],[2,2]]  W [[1,0],[2,0],[2,1],[3,1],[3,2]]  P [[0,3],[1,3],[1,4],[2,3],[2,4]]  T [[3,0],[4,0],[4,1],[4,2],[5,0]]  Z [[3,3],[3,4],[4,3],[5,2],[5,3]]  Y [[2,5],[3,5],[4,4],[4,5],[5,5]]
  'claude-hard-1': {
    title: 'Claude-created Hard #1',
    rows: 6, cols: 6,
    blocked: [[0,4],[0,5],[1,1],[1,5]],
    hintOutline: [[0,3],[1,3],[1,4],[2,3],[2,4]],
    hintText: 'No piece crosses the dotted line.',
    pieces: [
      { name:'V', color:'#8a9c5a', cells:[[0,0],[1,0],[2,0],[2,1],[2,2]] },
      { name:'W', color:'#a44e6b', cells:[[0,0],[1,0],[1,1],[2,1],[2,2]] },
      { name:'P', color:'#b8923f', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] },
      { name:'T', color:'#6b8a9c', cells:[[0,0],[0,1],[0,2],[1,1],[2,1]] },
      { name:'Z', color:'#8a5a7a', cells:[[0,0],[0,1],[1,1],[2,1],[2,2]] },
      { name:'Y', color:'#8c6a4a', cells:[[0,1],[1,0],[1,1],[2,1],[3,1]] },
    ]
  },
  // 107 ways to fit the pieces, 16 within the outline, 1 with every row and column even.
  //   Answer: I [[0,0],[0,1],[0,2],[0,3],[0,4]]  T [[0,5],[1,3],[1,4],[1,5],[2,5]]  P [[3,1],[3,2],[3,3],[4,2],[4,3]]  Y [[4,4],[5,2],[5,3],[5,4],[5,5]]  N [[1,0],[1,1],[1,2],[2,2],[2,3]]  L [[2,0],[3,0],[4,0],[5,0],[5,1]]
  'claude-hard-2': {
    title: 'Claude-created Hard #2',
    rows: 6, cols: 6,
    blocked: [[2,4],[3,5],[4,1],[4,5]],
    hintOutline: [[2,0],[3,0],[4,0],[5,0],[5,1]],
    hintText: 'No piece crosses the dotted line.',
    pieces: [
      { name:'I', color:'#5f9e8f', cells:[[0,0],[0,1],[0,2],[0,3],[0,4]] },
      { name:'T', color:'#6b8a9c', cells:[[0,0],[0,1],[0,2],[1,1],[2,1]] },
      { name:'P', color:'#b8923f', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] },
      { name:'Y', color:'#8c6a4a', cells:[[0,1],[1,0],[1,1],[2,1],[3,1]] },
      { name:'N', color:'#7d6aa8', cells:[[0,1],[1,1],[2,0],[2,1],[3,0]] },
      { name:'L', color:'#c9a877', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] },
    ]
  },
};
