# Parity Blocks — App Review (2026-10-20)

A review of the whole player-facing app: the start screen, the puzzle
page, the rules popup, the tutorial and the Archive. Every screen was
tried on a laptop (1280 × 800) and a phone (390 × 844). The game code
was read, and the solver was run on the three published puzzles.

Items 1–4 are **done** (see "Done" below). Items 5–17 are still open.

**What already works well:** the board never moves, wrong boards glow
red calmly instead of scolding, the tutorial flows nicely, the colors
are consistent everywhere, and the Archive looks good on a phone.

---

## Done (2026-10-20)

1. **Empty spaces now turn dark in the real game.** The tutorial says
   the leftover squares turn dark once all the pieces are on the grid,
   but only the tutorial used to do it. Now the puzzle page does too,
   whether the board is solved or wrong, and they go back to normal when
   a piece is picked up (`markEmptySpaces` in game.js).
2. **A solved board is locked and says so.** After solving, pieces can't
   be dragged, tapped or turned with R/E (`gameSettings.lockWhenSolved`,
   on for the puzzle page only, so the sandbox can still move a placed
   solution around). The empty space where the pieces were now says
   "✓ Solved in 2:31".
3. **Reopening a solved puzzle shows it finished.** The solved board is
   saved (marked solved), so coming back shows the finished puzzle, its
   time and the dark empty spaces, with no popup. Reset says "Play
   again?" on a solved puzzle. **One star per puzzle:** solving the same
   puzzle again, after Reset or on another day, adds no new star
   (`recordSolve` in progress.js).
4. **Every puzzle's pieces have clearly different colors.** The game now
   colors pieces from a fixed list (`PIECE_PALETTE` in game.js) in the
   order the puzzle lists them. The first six are six different color
   families: teal, gold, purple, brick red, green and rose. This applies
   to every puzzle, old or new, including sandbox archive copies. The
   sandbox's solution views use the same colors. The tutorial keeps its
   own colors, except F changed from brown to blue so it no longer
   matches the brown Y beside it.

Tests: `tests/browser/solved_state_test.js` checks all four on a laptop
and a phone. The other browser tests and the solver tests still pass.

---

## Still to do

### Puzzle design

5. **Easy and Medium can only be fitted together one way**, so the even
   rows and columns rule, which is the whole idea of the game, never
   matters in them. Hard has 13 ways to fit the pieces and 1 real
   solution.

   | Puzzle | Ways to fit the pieces | Real solutions |
   |---|---|---|
   | Easy   | 1  | 1 |
   | Medium | 1  | 1 |
   | Hard   | 13 | 1 |

   When making new puzzles, check how many ways the pieces fit in the
   sandbox analyzer, not just that there's 1 solution. A rough starting
   point: a handful of ways for Easy, a few dozen for Medium, many for
   Hard. (A new Medium is already planned; Easy needs the same check.)
6. **Hidden permanent empty spaces aren't explained anywhere.** Easy and
   Medium each have 2. A piece sitting on one never glows, so a board
   that was otherwise right would just quietly fail to solve. None of the
   current puzzles allow that (checked with the solver), but a future one
   could. Options: have the sandbox's Publish check warn about it, make
   the board's frame glow red when it happens, or drop hidden spaces.

### Playing on a phone

7. **Your finger hides the piece while you drag it.** The piece sits
   centered under your finger, so you can't see it or the green and red
   squares showing where it will land. Lifting it about one square above
   the finger on touch screens is the standard fix, and probably the
   biggest single phone improvement.
8. **The pieces at the top are tiny on phones** (13px squares). They wrap
   onto two rows with one piece left alone on the second, while about
   130px of empty space sits above the board. Bigger pieces in a neat
   3 × 2 layout would be easier to grab.
9. **Every tap waits a quarter second before rotating**, because it's
   checking for a double-tap. You notice it when rotating several times.
   The piece could rotate straight away instead, and undo that rotation
   and reflect if a second tap follows.
- **The tutorial's empty-spaces slide (slide 3) scrolls on an iPhone SE.**
  About 108px on a 375 × 667 screen; an iPhone 14 needs none. Slides 1,
  5 and 6 also scroll a little there (23–37px).

### Screens

10. **The puzzle page doesn't say which puzzle you're on.** A small
    "Hard" label in that level's color at the top would help.
11. **The browser tab shows internal names**, like "Parity Blocks: Test
    Puzzle #2". It should say "Parity Blocks · Medium".
12. **The start screen doesn't show progress.** A small ✓ on Easy,
    Medium or Hard once it's solved would give players a reason to come
    back.
13. **The Solved popup is plain.** It could offer a "Next: Hard" button,
    plus a Share button that copies something like
    "Parity Blocks · Oct 20 · Hard ✓ 2:31". That's how daily puzzles
    spread.
14. **The green and red squares shown while dragging are hard to tell
    apart for red-green colorblind players** (about 1 in 12 men). A
    second sign on the red squares, such as stripes or a small ✕, would
    fix it.

### Site polish

15. **There's no link preview or home-screen icon.** The pages have no
    description, preview image, Apple touch icon or web manifest. Texting
    the link shows a bare web address, and "Add to Home Screen" on an
    iPhone uses a screenshot instead of the logo. Both are quick to add.
16. **The tutorial's glows and animations ignore the phone's Reduce
    Motion setting.**
17. **Small cleanups.** The notes at the top of `play.html` still
    describe the old Reflect/Rotate buttons, the F key and Esc. The
    `Pixelify_Sans` font folder is published to the site but no longer
    used.

---

## Suggested order

Keep #5 in mind when making the new Medium (and revisit Easy). Then
#7 and #8 together (dragging on phones), then #10–#13 (small screen
improvements that make the daily habit feel finished).
