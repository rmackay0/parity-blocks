# Parity Blocks — Handoff Notes

## START HERE (updated 2026-11-12)

**Status: everything is committed AND pushed** (2026-11-12, with the
user's OK), including the slide 6 popup split below.

**Ask the user next time (2026-11-11):**
- How the rewritten highlighter slides (5 and 6) play for testers.
- Which of the three side notes to do next (see "User's notes for later"
  under "Still open"): sandbox Analyze using only pieces on the board, the
  red glow on the red piece, dotted line strands (offer a mock-up page of
  ways to draw them).

**Older questions (2026-11-06):**
- How the new phone tutorial behaves on their real iPhone: slide 6's
  popup hint + Hint button, the solved note by the grid, the last slide's
  "Make sure…" popup, glows no longer cut off.
- Do they want our own always-visible thin scroll bar on phones (offered;
  iOS only shows its own while scrolling)?
- Still not perfect: iPhone SE slide 6 starts scrolled ~11px (top of the
  note slightly hidden); Large text on small phones: slide 2 scrolls a
  little, and the last slide's solved note covers the grid's bottom on an SE.
- Still open from before: the iPhone fixes (stuck piece copy, marks beside
  the board) on real Safari; a "that's right" moment on slide 6; Medium's
  gold text on white; pre-existing `next_level_test` / `share_test` failures.

**2026-11-11/12: slide 6 split into a two-part popup** (pushed 2026-11-12, with the user's OK)
- User: "too many instructions in one block". Slide 6 now opens dark
  with a "Got it" popup in two parts (`HL_POPUP`, shown with `showHint`,
  the grid lit, over the grid on phones; `.spot.instant` = no fade-in):
  1) "Find the empty spaces first. On a 6×6 grid…", 2) "1st: … 2nd: …".
  After the last Got it (`afterHighlighterPopup`) a short reminder fades
  in beside the board (`HL_NOTE`: "Rule: Every row and column has an even
  number of empty spaces." / "1st: Highlight the 2 missing empty
  spaces." / "2nd: Fit the pieces."), the highlighter glows, and the 90 s
  hint clock starts. "(0 counts as an even number.)" moved from popup 1
  to the end of the hint (`HL_HINT`), user's request. The old 5 s dark (`tut-dim`, `HL_DARK_MS`, `.raised`)
  is gone. Reminder wording is Claude's: confirm with the user.
- Phones: slide 6 now needs no scrolling except on an SE (47px, was 98px;
  390×664 was 31px, now 0). Tests updated: tutorial_test, hl_hint_test,
  phone_layout_check, glow_clip_test (all pass).
- Tried and dropped (user, 2026-11-12): a glowing picture of the
  highlighter button beside popup 2's "1st" line. Don't re-add it.
- Still open: with Large text, slide 6 scrolls 35–108px on phones
  (the same or worse before this change, so not new).

**2026-11-11: highlighter slides rewritten** (pushed, with the user's OK)
- Testers found the highlighter explainer confusing ("omit needless
  words"; show it's crucial, not an extra). Slide 5: one message ("Use the
  highlighter to mark empty spaces. Tap it to turn it on."), no color
  step, grid visible from the start; "Tap a highlighted square again to
  clear it." Slide 6: the user's new board (I Z T Y fixed, N P to place in
  the user's chosen orientations, neither the solution's), 4 empty spaces
  given, the player finds 2 ((3,5), (5,5)). Note: "Find the empty spaces
  first. On a 6×6 grid like this, every row and column needs an even
  number of empty spaces (0 counts as an even number)." / "1st: Highlight
  the two missing empty spaces." / "2nd: Fit the pieces onto the grid."
  Dark 5 s. Payoff: both found → ✓ on 1st, the pieces' squares glow twice
  (this answers the old "nothing confirms a correct highlight" question).
  Hint: "Find a row with only one highlighted square. It needs one more."
  Slide 7 hint part 2 shortened. Tests updated: tutorial_test,
  hl_hint_test, glow_clip_test (all pass).
- Side notes from the user for later: see "User's notes for later" under
  "Still open" (sandbox Analyze uses only pieces on the board; red glow on
  red piece; dotted line strands).

**2026-11-08: sandbox colors + live counts + faster Analyze** (all pushed, with the user's OK)
- Panel piece icons now use the game's colors (`pieceColors(draft)`, in
  puzzle order), the same as the tray and board; pieces not in the
  puzzle are grey (`PICKER_GREY`). They used solver.js's old colors.
- **Counts** button (top right of the sandbox, remembered in
  `pb_sandboxCounts`): block count beside every row (right) and column
  (below), red = odd, green = even, faint 0; updates after every move and
  also shows the solution being viewed. game.js `gameSettings.liveCounts`
  / `setLiveCounts(on)` / `renderLiveCounts` / `blockCounts` (checkSolved
  uses it too); the board shrinks by `LIVE_COUNT_ROOM` on each side.
  Test: `sandbox_counts_test.js`.
- **Faster Analyze** (user: "when there are more than 1000 tilings, i
  don't need to know the exact number"). solver.js `analyzeFast`: finds
  up to 1,001 tilings the old way; ≤ 1,000 = the full old answer (flip
  through every tiling). More = `totalTilings: null`,
  `tilingsMoreThan: 1000`, only parity-passing tilings listed (sandbox
  shows "1,000+", the "Parity-passing only" box locked with a note).
  `parityTilings` picks one of two searches: `parityTilingsGaps` (choose
  the empty squares first, then exact-fill the rest; best with few empty
  squares, every published puzzle has 1–6) or `parityTilingsScan`
  (reading order, drops a row as soon as it's finished odd; best with
  many empty squares). Odd total of blocks = no search at all.
  Timings: 6 × 6 FLNPTU 4.8 s → 0.4 s; published Hard 1.6 s → 0.13 s;
  6 × 7 FLNPTUV 24 s → 5 ms; 6 × 6 FLNP (16 empty) 0.4 s with scan (4 min
  with gaps). Extremes stay slow: 7 × 7 FLNPTUWY 2.7 min (92,680
  solutions), 8 × 8 with all 12 pieces ~2 h. The sandbox's Analyze, 👁
  reveal and publish check use it; analyzer.html still uses analyzePuzzle.
  Tests: `tests/parity_fast_check.js` (both searches vs analyzePuzzle on
  40 random puzzles + timing), `tests/browser/sandbox_analyze_test.js`.

**2026-11-06: tutorial on phones, glows never cut off** (tutorial.html)
- Phones, on solving (slides 2, 4, 6, 7): nothing on the slide is cleared
  or moves while it counts. The solved note floats in `#win-float`
  (`planPhoneWin`): just above the column counts if it fits on screen
  (slides 2/4/6), else under the grid; if that runs off the bottom, the
  grid slides up (`#board-wrap` transform) into the empty pieces' row; last
  resort (Large text, SE) it covers the grid's bottom. The highlighter fades.
- Slide 6: the highlighter glows until tapped (`glowing`, was twice).
  Phones: the 90 s hint is a popup over the grid (`showLessonHint`) with
  Got it, then a small Hint button (`#hl-hint-btn`) at the left end of the
  pieces' row brings it back; no scrolling.
- Last slide on phones: "Make sure…" is a Got it popup at the start (the
  slide shows only pieces + grid). The popup code (`showHint(steps, i,
  onClose)`) now takes any list of steps; `over: true` = over the grid.
- Slides 2 and 4 on phones: shorter, closer step boxes, tighter glow.
- Glows: `.tut-body` reaches `--edge-room` (24px) behind the header and the
  Back/Next bar (which sit on top), padded the same, so nothing that
  glows is clipped at its edges; scroll-hint.js reads `--edge-room`. Use
  `visibleArea()` (header bottom → footer top) to ask what's on screen.
  New test: `glow_clip_test.js` (every glow, laptops + phones, Large text).
- Tests updated: tutorial_test (badge anywhere, glowing, phone popups),
  hl_hint_test (phone popup + Hint button), scroll_hint_test (Large text,
  since slide 1 no longer scrolls on an SE).
- Answered: phones' scroll bars are the phone's own (iOS shows a thin one
  only while scrolling; pages can't make it stay). We could draw our own.

**Earlier status: everything is committed AND pushed** (2026-11-05 evening, with
the user's OK): the "notes fr claude v1" PDF work and the chat requests
after it. See the 2026-11-05 (evening) section just below.
**Ask the user next time:** how the iPhone fixes (stuck piece copy, marks
beside the board) behave on real Safari; whether slide 6 needs a
"that's right" moment after highlighting the correct square.

**2026-11-05 (evening): highlighter, playtest cloud, names hidden, fixes**
(user's PDF "notes_fr_claude_v1" + a chat request)
- **Sandbox boards up to 16 × 16** (was 12). game.js's smallest square is
  now 10px (was 20) so a 16 × 16 fits a phone. Only 12 pieces exist (60
  blocks), so big boards need many pieces.
- **Highlighter** (game.js "HIGHLIGHTER", CSS in game.css): pencil button
  in `<div id="hl-tool">` (play.html, tutorial slides 5–6); shaded when on;
  a dot + ▾ beside it opens 4 colors (`--hl-0..3`, light + dark). Tap =
  highlight, again = clear, other color = switch; dragging paints. Placed
  by `placeHighlighterTool()` above and to the right of the rightmost
  piece in the top row (user's choice). Highlights (`marks`, color numbers)
  are saved with the board (`marks` in pb_progress), cleared by Reset.
  Hooks: `onMark`, `onHighlighter`, `piecesAllowed`. Test: `highlighter_test.js`.
- **Tutorial slide 5 replaced** by the highlighter lesson (user's board:
  W Z N I fixed, F + Y to place; `PUZZLE_HL`, `HL_GIVEN`, `HL_GOAL` (2,3)).
  Note line → board comes in → 5 squares highlighted → steps; pieces
  locked (`piecesAllowed`) until (2,3) is highlighted in any color, trying
  nudges step 1. Phones: note above the board, scrolls to show the board.
  Fixed piece colors avoid the highlighter colors (the user's picture had
  yellow I / light blue Z). The old empty-spaces slide code is gone.
  Wording adapted by Claude (user allowed it): confirm with the user.
- **Playtest cloud**: `playtest.json` (in the repo) + `playtest.html`
  (unlinked, noindex; boxes newest first: name, empty board, date →
  `play.html?playtest=<id>`, tab "Playtest", back → playtest.html).
  Sandbox: ☁ on an archive entry uploads (same GitHub token; again =
  replace, moves to front); "Cloud" section lists them (open = copy, and
  adds to this browser's archive if missing; ✕ removes). Notes are NOT
  uploaded (public file). Every upload is a commit on main, so `git
  fetch` before committing. Test: `cloud_test.js` (needs `python3 -m
  http.server 8765` in the project folder; fakes GitHub).
- **Internal names hidden**: tab = "Parity Blocks: Easy/Medium/Hard"
  (Practice / Playtest otherwise); published.js titles are just the level
  (Publish writes `LEVEL_NAME`; the dialog shows the archive's name via
  archiveId); publish commit messages say "Publish a new Hard puzzle".
  Old commit messages in git history still contain names.
- **Tab icon**: new `assets/favicon.svg` (cropped grid, new name beats
  cached icons) + `favicon-32.png`, `apple-touch-icon.png`, `/favicon.ico`
  (made by `tests/browser/make_icons.js`).
- **Marks beside the board (Safari)**: piece SVGs were exactly piece-sized
  with `overflow: visible`, so outlines/shadows drew outside their box and
  Safari didn't always repaint them. Now the SVG has `PIECE_ROOM` (30px)
  round it (pointer-events none), the landing shadow animates on the SVG,
  and the ghost has `will-change`. `trails_test.js` (Chromium/WebKit/
  Firefox, laptop/phone, light/dark) was clean before AND after: headless
  screenshots repaint everything, so it can't show the bug. Needs the
  user's real Safari / iPhone check.
- **Later the same evening (user's chat notes):**
  - Rules popup title ("How to Play") now Lilita One, 2.3rem (rules.css
    `--rules-title-font`; the font is @imported at the top of rules.css).
  - Highlighter cursor = a small pencil (data-URI SVG, game.css).
  - Tutorial is now **7 slides**: 5 = meet the highlighter (only it +
    a popup `#hl-bubble` at first, glowing; then an empty grid
    `PUZZLE_EMPTY`; Next once anything is highlighted), 6 = use it
    (`PUZZLE_HL`; page dark except the note `HL_NOTE` for 3.5 s (`HL_DARK_MS`), then the
    highlighter glows twice; `HL_GIVEN` locked via `setLockedMarks`;
    pieces free). The grid no longer flashes before the text (hiding is
    instant: `.later-in:not(.shown)` has no transition). Tutorial nudges
    the highlighter up/right (`gameSettings.hlOffset`). Never says "pencil".
  - **CHECK IN WITH THE USER:** slide 6 gives no confirmation that the
    right square was highlighted; the user worried players may want one.
  - **Duplicated piece on iPhone Safari (friend's report):** a drag's
    lifted copy (`.ghost`) was left behind when a second touch began
    before the first ended (the old press was forgotten) or Safari lost /
    cancelled the touch. Now: one drag at a time by pointerId, a stale
    press is cancelled (`cancelPress`), pointercancel / blur / hidden page
    put the piece back, and renderAll sweeps stray ghosts. `ghost_test.js`
    fails on the old code, passes now (Chromium + WebKit).
- **New win animation** (celebrate.js `solvedCelebration`, user's spec):
  green bands (`.win-band`) exactly the grid's size, clipped to the
  squares, in turns row 1, col 1, row 2, col 2…, counts popping in; then
  the whole board green (`.win-cover`), a subtle squash-and-bounce, and
  on the big note (1.46 s) the numbers pop away and the check pops in.
  The board itself is centred (stage margin = the counts' room). The
  level ("Medium", `.win-level` in `--color-medium` etc.) sits above
  "Solved!" (play.html passes `level`). Timings `WIN_*` at the top of
  that section. Test: `win_test.js` (frames: win-*.png).
- **Tutorial hints (user):** slide 6's last sentence ("In this
  particular puzzle there needs to be either 2 or 0 empty spaces…") is now
  a hint (`HL_HINT`) that pops into the note after 90 s (`HL_HINT_MS`)
  unless row 3 col 4 is highlighted or it's solved (`hl_hint_test.js`,
  fake clock). Final slide's Hint: spotlights the dotted area + the empty
  space in its notch (`hintSquare` [3,4] = row 4 col 5), highlights that
  square for good (locked), new text "The highlighted square is one of
  six empty spaces…" (old two-point text gone). User wrote "(use the
  highlighting tool)"; Claude wrote "(Use the highlighter tool.)".
- **Phones (later still):** `scroll-hint.js` = a bobbing ▾ at the bottom
  of the tutorial / rules while there's more below (tap = scroll; phones
  only; `scroll_hint_test.js`). Highlighter 10px clear of the pieces
  (iPhone mini). **Tutorial redone for phones** ("Phones: less scrolling"
  block at the END of tutorial.html's styles, so it wins): message line
  hidden, one-row header (moon, Large text, title, ✕; dots below),
  slimmer Back/Next (the old phone footer sizes were ignored: they came
  before the base rules), highlighter at the right end of the pieces' row
  (`gameSettings.hlBeside`, phones only; tray `padding-right: 76px`),
  slide 1's 12 pieces in 2 rows of 6 (11px squares). `phone_layout_check.js`
  now also measures Safari-sized screens: 0px scrolling on every slide on
  iPhone 14 / mini; iPhone SE in Safari (375 × 553): slides 3, 6, 7 scroll
  12–39px (was 175–199px on the worst).
- Still failing, unrelated (same before these changes): `next_level_test`
  (Hard: "room between the time and the buttons"), `share_test` (times
  out on #solved-share).

**The look right now, at a glance (2026-11-02/03 redesign; the dated
sections below have the history and the reasons)**
- Pages: celadon background #E3EFED; dark mode #0E1C1F (moon / sun button
  top left of the start screen and the puzzle page; theme.js).
- Pieces: "Woodblock" colors, `INKS` in shapes.js (indigo, gold,
  vermilion, moss, sakura, asagi + extras); flat color with fine darker
  lines between blocks and round the outside (`PIECE_LOOK`).
- Board: the original layout (rounded squares, 4px gaps, 10px frame) made
  soft: light frame #DCDFE6 + off-white squares in light mode, dark in
  dark mode; vermilion dotted lines in the gaps, never along the board's
  edge, meeting points filled.
- Start screen: logo = black-and-white 3 × 3 grid with a dotted P
  pentomino (glows softly in dark mode); title in Lilita One; buttons in
  Geo; levels Easy teal #3E8E9E / Medium gold #E8B33B / Hard vermilion
  #E2483D, rounded pills; Tutorial a smaller plain button; Archive hidden.
- Buttons elsewhere: fine ink border, 4px corners.
- Piece animations (press, lift + lean, landing thud, shake, spin/flip):
  `FEEL` in game.js. Win animation in the Solved popup (`solvedCelebration`,
  celebrate.js): rows + columns counted in green, then the board turns
  green with a check (hides the solution); background blurred. Share button: "Parity Blocks 🟨 Medium / day · time".
- Design mock-up pages (claude.ai artifacts, private to the user):
  "Parity Blocks Palettes" (3 rounds of color/style directions) and
  "Parity Blocks Front Page" (13 logos, 13 fonts, 4 combined screens).

**What this is:** a static site (no build, no server). Repo
`rmackay0/parity-blocks` on GitHub → Vercel auto-deploys every push to
`main` → live at https://parity-blocks.vercel.app (user may also attach a
Namecheap domain). The older `rmackay0/polyominoes-app` repo is the
previous project; don't push there.

**File map**
| File | What it is |
|---|---|
| `index.html` | Splash: dark-mode button (top-left), logo, title, Easy/Medium/Hard (→ `play.html?level=…`), Tutorial button (→ tutorial.html), Rules (top-right). The Archive button (calendar of solved days) is hidden in a comment; its popup code is still there |
| `play.html` | The puzzle page. Loads `published.js` + `progress.js` + `game.js`; first visit opens the tutorial in an iframe overlay; back + dark-mode buttons top left; Reset button (asks first); saves the board as you play; Solved popup with win animation, Share (`shareText`, `LEVEL_ICON`), next level |
| `progress.js` | A player's progress in localStorage only: unfinished boards (`pb_progress`) and solves (`pb_completed`) for the Archive calendar |
| `game.js` / `game.css` | The game itself, shared by play.html, sandbox.html and tutorial.html. `gameSettings` at the top: `explain`, `lockWhenSolved`, `distinctColors`, `showCaption` |
| `theme.js` | Light / dark mode (2026-11-02). Light is the default; `html.dark` = dark. Loaded first in each page's `<head>`. Any `[data-theme-toggle]` button (the moon / sun) switches it; `ParityTheme.makeButton()` = the "Dark mode" text button next to Large text (rules popup, tutorial). Saved in `localStorage.pb_theme` |
| `celebrate.js` | `solvedCelebration()` = the win animation in the Solved popup (2026-11-02). Also the solved badge (green check + title + text) used for every success message; `solvedBadge(title, text, {animate, sound, stack})`. play.html calls `enableSolvedSound()` → jingle `assets/solved.mp3` (new one 2026-10-24, big note at 1.46 s), animation timed to it; tutorial = no sound, quicker. Sound unlocks on the first real tap (touchend/pointerup/click/keydown) |
| `assets/` | `logo.svg` (logo + favicon), `solved.mp3` (the user's jingle) |
| `tutorial.html` | Interactive 6-slide tutorial (real mini puzzles via game.js); slide list in the comment at its top, all wording/options in `SLIDES` (slide 5 = highlighter, its note in `HL_LINES`) |
| `playtest.html` / `playtest.json` | Unlinked playtest page + the cloud puzzles the sandbox uploads (2026-11-05) |
| `APP_REVIEW.md` | Whole-app review (2026-10-20): its "Done" and "Still to do" sections are the to-do list |
| `tests/browser/` | Playwright checks (see Testing below); `tutorial_test.js` plays all 6 slides, `next_level_test.js` the Solved popup, `look_screens.js` screenshots of every page (laptop/phone × light/dark; `ONLY=phone-dark` for one), `feel_test.js` the piece animations, `share_test.js`, `theme_toggle_test.js` |
| `published.js` | `PUBLISHED = {easy, medium, hard}` → full puzzle copies. Written by the sandbox's Publish button (GitHub API commit). Keep the `/*JSON*/…/*END*/` markers |
| `puzzles.js` | `PUZZLES` registry (test puzzles; analyzer/sandbox read it) |
| `shapes.js` | Shared geometry + SVG drawing (`miniBoard`, `drawPiece`, `drawNoMark`, highlighter, `drawDottedLines` + `groupSquares` for every dotted line) |
| `rules.js` / `rules.css` | Rules popup (Rules button); "Play the tutorial" button on puzzle pages |
| `solver.js` | DLX exact-cover solver + parity check + puzzle finder (pure JS; Node + browser + Worker); `analyzeFast` + the two parity-first searches (2026-11-08) |
| `sandbox.html` | Admin puzzle builder: archive (localStorage), notes, publish, analyze & flip through solutions, Shape/Dotted area editing (no Dotted square mode since 2026-11-03), dark-mode button by the title |
| `analyzer.html` | Admin analyzer + puzzle finder |
| `sandbox-classic.html` | The original free-form sandbox (old, mostly described further down) |
| `tests/solver.test.js` | `node tests/solver.test.js` — 52 checks |

**Rules for working with this user (follow these)**
- **Pushing:** commits are fine without asking, but **every push needs the
  user's explicit OK**, each time. They often say "before you push: …" —
  that means keep committing, don't push yet.
- **Before committing:** `git fetch` and check `git log HEAD..origin/main`.
  The sandbox's Publish button commits `published.js` straight to GitHub,
  so origin can be ahead; rebase local commits on top (`git pull --rebase`
  or `git rebase origin/main`) — never force-push.
- **Readable work:** the user is learning bash. Use Edit/Write for file
  changes, short single-purpose Bash commands with plain descriptions,
  test scripts in files (not long inline commands); explain pipes etc.
- **Specs come as PDFs** ("instructions v1/v2/v3") with notes beside
  screenshots; follow them closely, flag any typos/ambiguities briefly.
- Vocabulary below (block / piece / dotted square) is mandatory.

**2026-11-03 (latest): one dotted rule only (user request)**
- Why: the user's 8 × 8 sandbox puzzle had 20 touching *dotted squares*,
  which look exactly like a 20-square dotted area, so their correct
  solution was refused and Analyze found nothing (36 open squares for 50).
- Rules popup: the "can't place a piece on a dotted square" rule and its
  picture are gone; the one rule now reads "You can't place a piece
  across a dotted line." (was "…dotted perimeter").
- Sandbox: the "Dotted square" mode is gone. Old puzzles (published Easy
  has 6 as `blocked`; the new 8 × 8 Hard has none) still load and play the same; under the
  one rule they're consistent anyway (no piece fits inside a line round 1
  or 2 squares). In Dotted mode, clicking an old dotted square opens it;
  the board note shows "N old dotted squares" while any are left. The
  game, solver and tutorial still handle `blocked` unchanged.
- Sandbox has a dark-mode button (moon / sun) right of its title.
- Test: `sandbox_dotted_test.js` (also screenshots sandbox-light/dark).

**2026-11-03 (later): new win animation, solution hidden (user request)**
- User: no confetti; a screenshot of the Solved popup (to share a time)
  mustn't show the whole solution. `solvedCelebration` (celebrate.js) now:
  the popup's board picture shows the pieces in place from the start; on
  the jingle's notes (0.11–1.25 s) a green highlighter sweeps along each
  row, then each column, each count popping in beside it (miniBoard's new
  `show:'count'`, strokes/counts tagged `data-row` / `data-col`); on the
  big note (1.46 s) a green cover (`.win-cover`, a copy of the frame so cut
  boards keep their shape) fills the board and a white check draws across
  it. The counts stay beside the green board. Seal + confetti are gone.
- The Solved popup's backdrop blurs the real board (`#solved-popup`
  backdrop-filter 36px, game.css): Claude's addition, since on laptops the
  board behind the popup showed most of the solution. Easy to undo.
- `solved_state_test.js` checks the 12 strokes and the cover + check.

**2026-11-03: start screen tidied**
- **Archive button hidden** (user: "for now"). The calendar popup and its
  code are still in index.html; the button line is in a comment next to
  Tutorial. `progress_test.js`'s calendar checks will fail until it's back.
- Page background celadon #E3EFED (dark #0E1C1F), on every page; the
  logo has no teal square behind it any more. Dark mode: a soft light glow
  round the logo (`html.dark .logo`).
- Layout: two groups, `.brand` (logo, title, tagline; close together) and
  `.actions` (levels + Tutorial), with 44px between them; the stack sits a
  little above the middle (more padding at the bottom). Logo
  clamp(110px, 30vw, 140px), title clamp(2.6rem, 11vw, 4.4rem), level
  buttons 280 × 54, Tutorial a narrower 180 × 44.

**2026-11-02 (end): front page = "Warm and friendly" (user's pick)**
- Picked from the artifact "Parity Blocks Front Page" (13 pentomino logos,
  13 title fonts, 4 combined front pages W/X/Y/Z): combo Z.
- **Logo** (`assets/logo.svg`, the user's own design; replaced combo Z's
  V + square, then a 4 × 4 "Pb" of two P pentominoes): a black-and-white
  3 × 3 grid on a teal rounded square. A P pentomino is drawn only as a
  dotted outline (white inside, no lines); the other four squares are an
  ordinary solid grid; the dotted line replaces the grid line where they
  meet. Each dotted edge starts and ends on a dash.
- **Title font: Lilita One** (index.html `--font-logo`; `--title-boldness`
  0, letter-spacing 0.01em). **Buttons keep Geo** (user: "keep the font
  used in the buttons the same"). Only the start screen's title changed.
- **Levels: Easy asagi teal #3E8E9E, Medium gold #E8B33B, Hard vermilion
  #E2483D**, rounded (pill) buttons with no border and a soft darker band
  along the bottom (start screen + "Play Medium/Hard →"). Shared results
  use squares now: 🟦 🟨 🟥 (play.html `LEVEL_ICON`).
- Not chosen but on the page if the user wants to revisit: Hanko seal
  logos, P-for-Parity, Dela Gothic One, Shippori Mincho, difficulty pips.
  Avoid a red plus on white or a white plus on red (Red Cross / Swiss flag).

**2026-11-02 (very latest): "Woodblock" look applied (user's pick)**
- Chosen from 3 rounds of palette mock-ups (artifact "Parity Blocks
  Palettes": round 3 had 11 directions; user liked Riso most, then picked
  Woodblock: "color palette is great, but we need to vastly improve the
  grid"). The user will give notes next.
- **Colors** (Japanese woodblock prints): piece palette `INKS` in
  shapes.js (indigo, gold, vermilion, moss, sakura, asagi + 6 extras;
  replaces Kelly). Levels: Easy moss #7BA05B (white text), Medium gold
  #E8B33B (ink text), Hard wisteria #8E6FB0 (white text). Page paper
  #F5F5F2, ink text #1F2330, accent indigo #2B4C7E. Dark mode: ink-blue
  #12151D page.
- **Grid made easy on the eyes** (the mock-up's dark frame + stark white +
  heavy ink lines were "very hard on the eyes"): light board in light mode
  (frame #DCDFE6, squares #FBFBF8, no square edges, soft shadow), dark
  board in dark mode; vermilion dotted lines in the 4px gaps; piece lines
  thinner (1.5px) in a darker shade of each piece (`PIECE_LOOK`).
- **Buttons:** a fine ink border (2px), 4px corners, a soft shade along
  the bottom. Main buttons ink, plain ones paper. The level dots are gone.
- Logo in moss / gold / wisteria. Tutorial glow is indigo.
- **Dark mode any time:** a round moon / sun button at the top left of the
  start screen (fixed, mirroring Rules) and the puzzle page (right of the
  back arrow). Any `[data-theme-toggle]` button works (theme.js); styled
  as `.theme-toggle` in rules.css. The tutorial keeps its "Dark mode" text
  button at its top left. Test: `theme_toggle_test.js` (screenshots need a
  short wait: colors fade over ~0.15 s).
- Possible clash to watch: the vermilion piece and the vermilion dotted
  lines (and the red "wrong" glow).

**2026-11-02 (latest): the ORIGINAL grid is back, in greys**
- The crossword grid (thin lines, square cells) was tried and dropped: the
  user found it "much harder to read". Black-and-white was tried next, then
  the user asked for "multiple colors… monochromatic". The board is the
  original one again: separate rounded squares (4px corners, 1px edge)
  with 4px gaps, on a 12px frame with rounded corners and a soft shadow.
  The original browns are now greys, the SAME in light and dark mode:
  frame #1c1c1c, squares #424242 (edge #4e4e4e), dotted lines #cfcfcf,
  drop previews dark green / dark red as before (game.css top; rules.css
  `--rules-board/cell/dotted` for the pictures).
- **Dotted lines: light grey dashes down the gaps**, as wide as the gap
  (`--color-dotted`, `--rules-dotted`). Drawn one edge at a time by
  `drawDottedLines`, flat ends; each edge runs on over the gap crossing at
  each end so meeting points are filled, but never past the board's edge
  (none drawn along the edge: no jutting into the frame). Board dash 9 /
  space 6; pictures 5 / 3.
- **Pieces:** flat color + a darker line between blocks and round the
  outside; the lighter inner squares are off (`PIECE_LOOK.innerSquares`),
  user: "simplify the look a lot".
- **Logo** = just three pieces, no background (user): a green P, a yellow
  domino, a purple domino (the level colors), fitted into a 3 × 3 square.
  (SVG comments can't contain two dashes in a row: that broke the logo once.)
- In the two sections below, the grid / dotted-line / inner-square
  details are out of date; the rest (themes, colors, animations, win
  popup, Share) still stands.

**2026-11-02 (later): new look (user's design notes + Kelly color chart)**
- **Light mode by default, dark mode optional.** Every color is a CSS
  variable in `:root` (light) with an `html.dark { … }` block under it, in
  game.css, rules.css, index.html and tutorial.html. Dark is a neutral
  near-black (the user's reviewer disliked the brown). The "Dark mode" /
  "Light mode" button sits next to "Large text" (both in `.view-btns`,
  rules.css); on phones the tutorial puts them on their own row.
- **Style:** a clean, light newspaper-games feel. The user showed the LA
  Times Games page as a reference, then said **don't copy exact grid
  proportions, button placement, typography, color combinations,
  achievement language or screen flows from LA Times or NYT**. So: no
  outlined pill buttons and no rainbow strip. Buttons are solid rounded
  "keys" with a darker edge underneath (dark = main, light grey =
  plain). The level colors are light tints of the Kelly green, orange and
  purple (`--color-easy/medium/hard`: #8fd1ad, #f9bf7a, #c3a3cc). Fonts
  are unchanged (the user said text and fonts are fine).
- **Grid = crossword / sudoku style:** square cells, 2px lines
  (`--board-gap`), 4px border (`--board-pad`), no rounded corners. Dotted
  lines are **red** (`--color-dotted`). Each one replaces the grid line it
  runs along (`look.under` in `drawDottedLines`), and none is drawn on the
  board's own edge (`look.onBoard`), so nothing sticks out past the grid.
  The pictures (`miniBoard`, tutorial `dontPicture`) match. (The rules'
  dotted-square picture is now 3 × 3, since a 1 × 1 board would show no line.)
- **Pieces:** Kelly's colors of maximum contrast (`KELLY` in shapes.js,
  minus white, black, greenish yellow, yellowish brown; red kept last
  because red means "wrong"). `PIECE_PALETTE` in game.js, the tutorial's
  `COLOR`, the rules' examples and the 12-piece picture all use them.
  Look (`PIECE_LOOK` + `drawPieceParts` in shapes.js, shared by the game
  and the pictures): flat fill, a lighter square inside each block, a line
  between blocks and an outline in a darker shade of the piece's color.
- **Piece animations ("heft")**, game.js `FEEL`: press = squeeze; held =
  lifted (bigger, soft shadow) and leans the way it moves; drop = slides
  into its squares with a squash/bounce while the board dips 1.5px;
  wrong spot = a short shake; rotate = spin, reflect = flip; back to the
  top = pops in. All skipped with "reduce motion". Test: `feel_test.js`.
- **Win animation, in the Solved popup** (the user preferred it there, not
  on the grid): `solvedCelebration` in celebrate.js. A small picture of
  the solved board; each piece drops in on one of the jingle's notes
  (0.11–1.25 s); on the big note (1.46 s) the board pops and glows green,
  a check seal stamps onto its corner, little blocks in the pieces' colors
  burst out; then "Solved!" and the time (counting up). The tutorial
  still uses the older `solvedBadge`.
- **Logo** (`assets/logo.svg`) redrawn in the new style.
- **Level colors = green / yellow / purple** (user: like 🟢🟡🟣 "but not
  exactly"), so a shared result's circle matches the level. Each start
  button has a round dot in the full Kelly color (`.level-dot`); Medium
  changed from orange to yellow (`--color-medium` #f6d76b, in game.css AND
  index.html).
- **Share button** in the Solved popup (play.html, `shareText`): "Parity
  Blocks 🟡 Medium" / "Mon, Nov 2 · 3:41" / the site link (online only).
  Phones: share sheet (`navigator.share`); laptops: copied, button says
  "Copied!" for 2 s. Practice puzzles (`?puzzle=`) share the title, no
  circle. Test: `share_test.js`.
- Screenshots: `tests/browser/look_screens.js` (laptop + phone, light + dark).
- Tests updated for the new look: `solved_state_test.js` (popup has the
  win animation), `next_level_test.js` (new level colors),
  `game_features_test.js` (the "empty" drag starts on the 4px border).
- **iPhone SE (375 × 667):** the tutorial now scrolls 35–75px on slides
  1, 2, 4–6 (the extra button row). iPhone 14 still needs no scrolling.

**2026-10-29: cut boards use the blocks rule too (confirmed by the user)**
Every board, cut or not, needs an even number of BLOCKS in each row and
column; removed squares never count. An "empty spaces" rule for cut
boards was tried and undone the same day: the user's puzzle that seemed
wrongly rejected really had 5 blocks in a row/column. Don't change it.

**2026-10-27: empty spaces removed, dotted squares instead (user request)**
- "Empty spaces" and "permanent empty spaces" are gone from the game,
  rules and tutorial. The old red-X squares (`puzzle.blocked`) are now
  **dotted squares**: a normal-looking square with its own dotted line
  (drawn by `renderHint` in game.js; `miniBoard` draws them the same way).
  No piece can go on one; a piece there glows red like one crossing a
  dotted line ('dotted' problem). Solver/data unchanged (`blocked`).
- **Uncovered squares never change color** (the dark `.gap-dark` squares
  and `markEmptySpaces` are gone).
- **Hidden ones** (`hiddenBlocked`, Easy had 2) are now shown dotted like
  the rest (user's choice). game.js ignores `hiddenBlocked`; the sandbox's
  "Dotted square" mode just toggles open ↔ dotted and no longer writes it.
- **Dotted squares that share a side get one dotted line** around them
  together (`groupSquares` in shapes.js; game + pictures).
- **All dotted lines are drawn by `drawDottedLines`** (shapes.js): each
  line runs down the middle of the gap between squares; shapes that touch
  share ONE line (each grid edge drawn once, never two lines side by side);
  each straight run starts and ends on a dash. Board look: `BOARD_DOTTED`
  in game.js (4px, a bit bolder than before); pictures: `PICTURE_DOTTED`.
- **Jingle on phones fixed (untested on a real iPhone):** the sound was
  unlocked on `pointerdown`, which phones don't count as a tap; now it
  unlocks on touchend / pointerup / click / keydown, retrying until it
  works (celebrate.js). An iPhone on silent still plays no sound.
- Tutorial slide 4: dotted squares (3,3) and (4,3) (under the F's dotted
  area) removed at the user's request; still one solution, the same one.
  Slide 5 waits 1.5 s longer before the pieces fade (`EMPTY_FADE_MS`
  3400; the steps after it moved by the same amount).
- **Tutorial is 6 slides**: the old slides 5–7 (empty spaces explained,
  counted, and the drag-four-empty-spaces puzzle) were removed. Slide 3
  now has three pictures (dotted line, edge, another piece) in one row;
  on phones the third sits centred under the first two (user: "a dotted
  line is all we need").
- **New slide 5** (user's spec, same day): slide 4's solved board, same
  place; a note beside it line by line (`EMPTY_LINES`): "Look at the
  empty spaces…", then the empty spaces (uncovered + dotted squares) light
  up and stay lit while the pieces and dotted lines fade; "Since the grid
  is even (6 × 6 blocks)…", then the empty spaces are counted; "If the
  grid is even (4 × 4, 6 × 6, 8 × 8, etc.)…", then Next lights up (~14 s).
  On phones the note is below the board, so the slide scrolls gently to
  each new line. "Empty space" is used again here (user's wording).
- **Final slide (6)**: its dotted square at (3,4) was removed (still one
  solution, the same one; checked with solver.js). Its hint now lights up
  the dotted area. Hint text reworded by Claude (not yet confirmed by the
  user): "The dotted area must be completely filled by two pieces." /
  "Knowing this about the dotted area, which squares have to be left
  uncovered so that every row and column has an even number of blocks?"
- Rules popup: the empty-spaces hint under goal 2 is gone; "You can't
  place a piece on a dotted square." with a dotted-square picture.
- Tests updated: `solved_state_test.js` (squares all look the same; no
  dotted line drawn twice), `tutorial_test.js` (6 slides, incl. slide 5's
  timings). New `dotted_squares_screens.js` takes screenshots.
  `play_test.js` was already out of date (it plays the old Medium, which
  had a U piece); not fixed.

**Earlier sessions (history)**
- 2026-11-02/03 session: the whole redesign summarised at the top of
  START HERE; everything pushed.
- 2026-10-29 session: the user built an 8×8 puzzle with 3 corners cut in
  the sandbox and thought it was wrongly rejected; it really had 5 blocks
  in the bottom row and right column. Rule unchanged (see the 2026-10-29
  note above). The 2026-10-27 "Ask the user" items below are still open.
- 2026-10-27 session: everything was committed and pushed.
- 2026-10-27 session: everything in the section just above (empty spaces
  removed, dotted squares, shared dotted lines, 6-slide tutorial with the
  new empty-spaces slide 5, jingle fix for phones).
- 2026-10-24 session (details in "Timer, badge, new jingle" below):
  - **Timer fixed**: only time with the puzzle on screen counts (no
    background tab, sleep or tutorial time). It had shown 96:45 for a
    quick Easy.
  - **"Solved in" box above the board removed**; time is only in the popup.
  - **New jingle** (`assets/solved.mp3`), animation retimed to it. Not
    yet heard by the user with the animation; ask how it feels.
  - **New Medium** published by the user ("new_med-second_made"): 36 ways
    to fit, 1 solution (Hard: 13). That's fine: the user says tilings
    aren't a difficulty measure (more tilings can still mean a clearer
    solution). Don't suggest remaking puzzles on tiling counts alone.
  - **Sharing a time without spoiling the answer**: options written up
    in APP_REVIEW.md #13; user hasn't picked one. Claude recommended a
    Share button in the Solved popup that copies a text line.
- 2026-10-23 session (all from the user's PDFs "instructions for claude on
  parity blocks" and "instructions for claude v6", plus chat requests;
  details in the dated sections just below):
  - (Superseded 2026-10-27, now 6 slides.) Tutorial rebuilt to **8 slides**: block counting on slides 2, 4, 8
    (25% faster; other text fades while counting) with a "Solved!"
    badge; slide 5 explains empty spaces on its own; slide 6 removes the
    pieces and counts the empty spaces; slide 7 is a new puzzle where you
    drag four single empty spaces (Hint after 3 min, nothing glows);
    final slide's Hint appears once all pieces are placed but uneven.
    The tutorial never writes what's wrong, it only glows red.
  - **Solved badge** (`celebrate.js`) for every success message; the
    puzzle page plays the user's jingle with the checkmark animation.
  - **Solved popup** on the puzzle page: "Play Medium →" after Easy,
    "Play Hard →" after Medium, in the start screen's level colors; Menu
    and Close always plain.
  - Puzzle page shows no caption under the board; back arrow centred.
- Easy still needs remaking (only 1 way to fit); see APP_REVIEW.md #5.

**Open items / ideas for next session**
- **Ask the user (2026-11-03):** now that it's live, do the jingle, the win
  animation, Share and dark mode work on their phone? Do the piece
  animations feel heavy enough (or too much: tune `FEEL` in game.js)?
- **Small follow-ups offered, not done:** in dark mode the plain buttons
  (Rules, Tutorial) and board squares are a slightly bluer dark (#1F2533)
  than the teal-black page; could tint them to match. The favicon is the
  same logo file and may be hard to read at tab size. The vermilion piece
  shares its red with the dotted lines and the "wrong" glow.
- `tests/browser/progress_test.js` expects the Archive button, so its
  calendar checks fail while Archive is hidden.
- The tutorial and the rules popup still use Geo for headings (only the
  start screen's title is Lilita One); ask if they want them to match.
- **Ask the user (from 2026-10-27):** does the jingle now play on their
  phone? Is the reworded final-slide hint OK? How do the bolder dotted
  lines and slide 5 feel?
- `tests/browser/play_test.js` still plays the old Medium; update it to
  the published puzzles (or have it use the solver like
  solved_state_test.js does).
- **The to-do list is APP_REVIEW.md "Still to do"** (puzzle design, phone
  dragging, screens, site polish).
- **Reopening a solved puzzle shows no time anywhere** now that the
  "Solved in" box is gone; ask if they want it shown somewhere quieter.
- **The timer still counts thinking time with the page open but idle**
  (on purpose). If long idle stretches cause odd times, consider pausing
  after a few minutes without any input.
- **Puzzle variety:** Easy fits together only one way (solver), so the
  even rule never decides anything; new Medium 36 ways / 1 solution, Hard
  13 ways / 1 solution. Check "ways to fit" when making new puzzles.
- Untested on a real iPhone: the jingle (unlocked silently on the first
  real tap, `unlockSolvedSound`; fixed 2026-10-27, see above), and the
  double-tap zoom guard.
- Phones: tutorial slide 5's note sits below the board (~180px on a
  390 × 844 screen), so that slide scrolls itself to each new line. Large
  text and the iPhone SE not re-measured since the 6-slide rebuild.
- The rules popup still says "You can't place a piece across a dotted
  perimeter." (the user removed only the caption under the board; ask if
  they want that line changed too).
- Archive calendar only shows stars; past days can't be replayed because
  published.js keeps only the current three puzzles. Replaying would need
  a history of published puzzles (e.g. keep each publish, keyed by date).
- Practice puzzles opened by link (`?puzzle=`) save progress but earn no
  stars (only Easy/Medium/Hard do).
- The admin sandbox still says "gap"/"fixed gap" in its own labels (user
  said that's fine).

**Timer, badge, new jingle (2026-10-24)**
- Timer bug: it was wall-clock time since the page opened, so a tab left
  open in the background (or a sleeping laptop, or the tutorial) added
  minutes, and the save carried them over (user saw 96:45 on a quick
  Easy). Now play.html's `timerTick()` (every second, on visibilitychange,
  and when the tutorial opens/closes) adds time that shouldn't count to
  `startTime`: hidden tab, tutorial open, or a gap over 5 s (asleep).
  Thinking time with the page open still counts.
- The "Solved in m:ss" badge above the board is gone (user); the time
  shows only in the Solved popup. (Reopening a solved puzzle shows no time.)
- New jingle (was "Output 1-2-3-4.mp3", now `assets/solved.mp3`): notes at
  0.11, 0.51, 0.70, 0.88, 1.08, 1.25 s, big last note 1.46 s. Animation
  retimed in game.css (circle 0.11 s, check 0.15–1.08 s, press 1.16 s,
  pop + text 1.44–1.49 s). Tutorial's `.quick` timings unchanged.

**Review fixes (2026-10-20/22, APP_REVIEW.md items 1–4)**
- game.js `gameSettings` (now at the top): `explain`, `lockWhenSolved`
  (play.html turns it on; sandbox leaves it off so placed solutions can
  still be moved), `distinctColors` (tutorial turns it off).
- Empty spaces go dark (`.gap-dark`) in the real game once every piece is
  on the grid (`markEmptySpaces`), solved or not.
- Solved board: locked (`#board-outer.locked`), ~~"✓ Solved in m:ss" in
  the empty pieces area~~ (removed 2026-10-24), and it's saved with `solved: true` so reopening shows it finished (no
  popup). Reset on a solved puzzle says "Play again?".
- One star per puzzle: `recordSolve(level, title, ms, puzzleKey)` skips a
  puzzleKey already recorded.
- Piece colors come from `PIECE_PALETTE` (game.js) in puzzle order, not
  the puzzle's stored colors; `pieceColors(p)` is also used by the
  sandbox's solution views. Tutorial keeps its own `COLOR` map (F is now
  blue).

**Puzzle page + tutorial polish (2026-10-23, end of day):**
- Solved popup: 26px between the badge and the buttons; after Easy a
  "Play Medium →" button (start screen's orange), after Medium "Play
  Hard →" (purple), above Menu / Close. Menu and Close are always plain
  and identical (user: the only colorful button is Play Medium / Hard). `#solved-next` set in play.html's onSolved (only if that level
  is published). Test: `tests/browser/next_level_test.js`.
- Puzzle captions are no longer shown on the puzzle page
  (`gameSettings.showCaption = false` in play.html): the user removed
  "No piece crosses the dotted line." The data still has hintText.
- Tutorial: `gameSettings.explain = false`, so mistakes only glow red.
- Back button (play.html, sandbox.html): a drawn SVG chevron, exactly
  centred (the ‹ character sat off-centre).

**Tutorial timing/look tweaks (2026-10-23, latest):** slide 3's pictures
start 33% sooner (heading lit 1.07 s, first picture 1.27 s); slide 4 ends
with the same "Solved!" badge as slide 2; slide 5 holds each kind of (later cut 20%: lines at 0.24 s / 2.48 s, done 4.72 s)
empty space 1 s longer; slide 6 waits 2 s more before counting
(`EMPTY_COUNT_MS` 4800) and its note sits 16px further from the row
counts (laptop); slide 7 has nothing glowing (`noGlow`, even the Hint
button) and its empty spaces are bigger (30px / 24px phones,
`html.big-tray`) on a labelled box ("Empty spaces", `trayLabel`).
Final hint shortened to the user's two new points.

**Tutorial now 8 slides (2026-10-23, later):** the empty-spaces
explanation is its own slide 5 (`quiet` + `explainEmpty`: slide 4's
board, same place, only that note); slide 6 is the empty-space count
(`quiet` + `emptyCount`). Counting is 25% faster (490 ms per line). While
a solved board is counted, all other text fades (`.play.counting`; the
note beside the board is cleared for the badge). **No sound in the
tutorial** (user): only pages that call `enableSolvedSound()` (play.html)
load/play the jingle; without sound the badge uses `.quick` timings.

**Solved badge + v6 tweaks (2026-10-23, "instructions for claude v6" PDF)**
- `celebrate.js` (loaded by play.html + tutorial.html; styles "Solved
  badge" in game.css): `solvedBadge(title, text, {animate, stack, plain})`
  = green check circle + title + text in one box. `animate` plays
  `assets/solved.mp3` (the user's jingle, was "Output 1-2.mp3") and
  times the animation to it: circle 0.16 s, check draws 0.2–0.95 s,
  "pressed" (shrinks) from 1.3 s, pops out + text on the big last note
  (1.62 s). The first tap unlocks the sound silently (iPhones). Used for
  every success message: tutorial slides 2, 6, 7 (`solvedTitle` +
  `solvedNote`), the puzzle page's Solved popup (`#solved-win`, stacked)
  and the "Solved in 2:31" badge (static). The sandbox keeps its old popup.
- Slide 6's empty spaces look exactly like a permanent one (no X):
  `body.empty-space-pieces` (set by loadPuzzle) hides the piece SVG and
  styles `.piece-box` (new class from buildPieceShape) like `.blocked`.
- New wording: slide 4's two lines, slide 5's "When counting empty
  spaces, count these together.", the fun fact, and slide 7's hint (two
  numbered points; `hintText` is now HTML).

**Tutorial v6 (2026-10-22, "instructions for claude on parity blocks" PDF)**
— 7 slides; see the comment at the top of tutorial.html. v5's
empty-spaces slide is gone (and `PUZZLE_2_SOLVED`, `showRecap`, `.dim`).
Slide 2 now counts the blocks on solving (then "Solved! Every row and
column has an even number of blocks." beside the board). Slide 4 (reflect)
counts, then `explainEmptySpaces` (user's wording, squares glow). Slide 5
(`quiet: true`, `PUZZLE_3_SOLVED`): same board in the exact same place
(slide 4's steps are rendered but faded, so nothing moves), pieces fade
(`#pieces-layer.gone`), note + count of empty spaces (`countedSquares`).
Slide 6: new `PUZZLE_E`, four single empty spaces to drag; game.js
`puzzle.piecesAreEmptySpaces` counts the permanent ones with them and
skips darkening; Hint after 3 min (`hintAfterMs`); "Great work!" box
(`solvedCard`). Slide 7's Hint now appears once every piece is placed
with no rule broken but it's uneven (`hintWhenUneven`, replacing
`hintWhenInside`). Hint wording per slide is `hintText` in SLIDES.
**Open:** the user's slide-6 hint text stopped mid-sentence ("two of
the"); Claude finished it (comment in SLIDES) — confirm with the user.
Phones scroll a little on slides 4–6 (note below the board); Large text
on a laptop scrolls ~250–290px on those slides.

**Tutorial v5: empty-spaces slide (2026-10-20, "claude notes v4" PDF)** — *replaced by v6*
now 6 slides. Slide 1 no longer explains permanent empty spaces, and
slide 2 no longer shows an empty-space note after solving (just "Solved!"
and Next). New slide 3 (`kind: 'recap'`, `showRecap`): slide 2's solved
board (`PUZZLE_2_SOLVED`, its only solution) in view mode with no tray; it
dims (`#board-outer.dim`), then a highlighted note under it appears line
by line — empty spaces (dark square picture) → permanent empty spaces
(red X picture) → "count both kinds the same" — while the matching board
squares glow (`.sq-ring` in `#tut-overlay`; empty → Xs → all six). Next
lights up after the last line (~4.2 s). Phones use a slightly smaller
board on this slide so the note fits; Large text scrolls a little.

**Saving progress + Archive (2026-10-20)** — progress.js, localStorage
only (the user wanted no data collected). play.html saves the board on
every change and on leaving (pieces, tray turns, time so far) under a key
that includes the puzzle's publishedAt, so a newly published puzzle starts
fresh; time away doesn't count; solving or Reset clears it. Solving an
Easy/Medium/Hard puzzle records `{date (player's local day), level, title,
timeMs}`. The splash Archive button opens a month calendar (‹ ›, can't go
past this month) with a star per difficulty solved that day: teal Easy,
orange Medium, purple Hard (the button colors).
- **Phone tutorial layout (2026-10-20):** tighter header/footer/row
  spacing at ≤760px. (The slide-2 empty-space note that used to sit above
  the board on phones is gone — see Tutorial v5.) Normal text on an iPhone 14
  needs no scrolling on any slide; iPhone SE and Large text still scroll
  a little on slides 4–5 (and slide 1 is just long text).
- Letter/arrow keys removed (user: no selected state, so they make no
  sense); only R / E remain. Real puzzles (play.html) set
  `gameSettings.explain = false`: mistakes only glow red, no message, and
  the message area is hidden. Tutorial + sandbox still explain after 3 s.
- Claude-created practice puzzles: `claude-*` entries in puzzles.js
  (answers in comments), added once to the sandbox archive with a note
  (`pb_claudeOffered`). Playable via play.html?puzzle=claude-easy-1 etc.
- **Large text** (2026-10-19): a "Large text" button (bold label) at the
  top left of the tutorial and the rules popup; turns on
  `html.large-text` (bigger reading text only) and becomes "Standard
  text". Shared setting `localStorage.pb_largeText`. Styles: rules.css
  (`.text-size-btn`, rules popup sizes) and tutorial.html (`html.large-text …`).
  The rules' rotate/reflect lines also say "tap" on touchscreens now.
- **Tutorial v3 + new game features** (all tested; committed & pushed
  together with Large text — see git log):
  game.js — keyboard shortcuts R rotate / E reflect only (the letter and
  arrow keys were removed 2026-10-20); they act on the held piece or the
  one under the mouse, also while holding/dragging; ignored in text boxes
  and with Cmd/Ctrl/Alt. Hook `onPlace`, finished-board empty spaces drawn
  dark (`.gap-dark`), ring pulse animation (`.pulse`).
  **No selecting at all** (user, 2026-10-19: "i dont want selected or
  unselected pieces to be a concept at all in this game"). No box select,
  no outline on a "selected" piece, no Esc, and the Reflect/Rotate
  buttons under the board were removed (click = rotate, double-click =
  reflect does that job). R/E act on: the held piece → else `keyPieceId`
  (the piece just turned by a key, so it stays the target if turning
  moved it out from under the mouse; cleared when the mouse moves or
  anything is pressed) → else the piece under the mouse (`keyTarget()`).
  sandbox-classic.html still has its own old selection model; untouched.
- **Tutorial v4 (2026-10-20, from a friend's playtest notes the user
  adopted)** — see the comment at the top of tutorial.html for the slide
  list. Going Back resets a slide but Next stays green.
  - Slide 1 explains permanent empty spaces (red X) before they appear;
    fun fact mentions triominoes.
  - Slides 2 and 4 use a two-step note (`steps` in SLIDES): "Click a
    piece or press R to rotate it" → "Then drag it onto the grid" (slide
    4: double-click / E to reflect). The first undone step glows. Slide 4
    also says "You can also rotate and reflect pieces once they're on the
    grid." The keyboard note and "Optional shortcuts" dropdown are gone.
  - Slide 2 no longer has a popup (it "felt like I did something wrong"):
    "Solved!" in green (the calm empty-space note that followed was
    replaced by its own slide in v5). No rings ("o's") on empty spaces in the
    tutorial (`rings: false` in the view tiling).
  - Slide 3: heading glows 1.6 s and the first animation starts as the
    glow fades (~1.9 s; user found 3.2 s too late), then 2 s per picture;
    the piece in the permanent-empty-space picture is see-through.
  - Final slide: only the orange note ("Make sure there is an even number
    of blocks in each row AND column.") — it glows strongly for 2.5 s as
    soon as the slide opens (user found waiting for a move too delayed). The old "Useful strategy" line was replaced by
    a **Hint** button: when W and P are both inside the outline (always
    wrong — every such tiling fails, checked with solver.js) it fades in
    glowing; it darkens the page except the permanent empty space(s)
    (`showHint`, SVG mask) with the user's explanation text.
  - Row/column counting is slower (650 ms each, a pause between rows and
    columns) and each number pops in.
  - Refresh resumes: the current slide is in sessionStorage
    `pb_tutorialSlide` (cleared on close/finish); play.html reopens the
    tutorial if it's set.
- **Overlaps blame the newest piece (2026-10-20):** only the piece moved
  most recently glows red. `placedPieces` is kept in last-moved order
  (`bringToEnd`), and overlap is checked only against earlier pieces
  (`occupiedBefore`). Newest piece also draws on top.
- **Red "not allowed" sign covers the whole picture** (tutorial slide 3
  and the rules popup), so it never seems to cross out one square (it
  used to cross the permanent empty space's X). Slide 3's "edge" example
  now hangs off the LEFT edge, and on phones the 2 × 2 pictures shrink to
  fit the screen.
- **Phone layout gotcha:** an element with a grid-area that doesn't exist
  in the phone template (e.g. `n-trayr` → "trayr") silently adds an extra
  grid column + gap, pushing the board off-centre. Empty ones are now
  `display: none`; keep it that way.
- **Calmer error messages (2026-10-20), puzzle page AND tutorial:** a
  wrong finished board glows red straight away — rule-breaking pieces
  glow, or the board frame (`#board-outer.uneven`) if only rows/columns
  are odd — and the message above the board only appears after
  `EXPLAIN_DELAY_MS` (3000, game.js) with no move. The user said this
  might change; 0 restores the old instant messages.
- **The board must never move** (user request 2026-10-19): the message
  above it (`#status`) has a fixed 2-line height (`--status-line`), wraps
  long messages, and grows upward if it ever needs a 3rd line; in the
  tutorial it's exactly the board's width. Don't put anything else
  between the tray and the board whose size depends on its content.
  (The puzzle page now hides `#status` entirely — see "only glow red".)

**Testing** — `node tests/solver.test.js` for the solver. Browser checks
are Playwright scripts, saved in **`tests/browser/`** (copied there at the
end of the 2026-10-20 session). Run them from that folder, e.g.
`cd tests/browser` then `node tutorial_test.js` (`LARGE=1 node
tutorial_test.js` for Large text); they save screenshots there (ignored
by git). **One-time setup in a new session:** in `tests/browser`, run
`npm install --no-save playwright` and then `npx playwright install
chromium` (node_modules is git-ignored). Until then they fail with
"Cannot find module 'playwright'". Scripts: `tutorial_test.js` (plays
all 8 tutorial slides on desktop + phone, checking timings, that the
board never moves, colors and hints; ~2.5 min), `next_level_test.js`
(Solved popup: Play Medium/Hard buttons + colors, spacing, no caption,
back arrow centred), `solved_state_test.js` (locked solved board, badge,
one star per puzzle), `play_test.js` (solves Easy/Hard
through the UI), `click_test.js` (click = rotate, double-click = reflect),
`game_features_test.js` (R/E incl. while holding and pointing; letter and
arrow keys do nothing),
`progress_test.js` (board saved/restored, Reset, solves recorded, Archive
calendar), `claude_puzzles_test.js` (practice puzzles in the sandbox
archive + solvable by playing), `make_puzzles.js` (the generator used for
them: lays out 6 random pieces square by square, then checks with the
solver — much faster than findPuzzles on random boards),
`board_still_test.js` (long messages never move the board),
`tame_errors_test.js` (red glow first, message after 3 s),
`overlap_test.js` (only the newest overlapping piece glows),
`phone_layout_check.js` (board centred, nothing within 12px of the sides),
`rules_text_test.js` (rules popup + Large text on laptop/phone; shared
with the tutorial), `fonts_screens.js` (screenshots). `LARGE=1 node
tutorial_test.js` replays the tutorial with Large text on. The user wants
both laptop and phone checked before pushes. Tips: mark the tutorial seen with
`localStorage.setItem('pb_tutorialSeen','1')` in an init script before
testing play.html; game state (`placedPieces`, `trayCells`, `puzzle`,
`keyPieceId`, `CELL`) are globals readable via page.evaluate.

## Words to use (user's decision, updated 2026-10-27) — in ALL player-facing text

| Word | Means |
|---|---|
| **block** | one square of a piece |
| **piece** | a pentomino |
| **dotted square** | a square with its own dotted line; no piece can go on it (code: `blocked`). Was "permanent empty space" (red X) until 2026-10-27 |

"Permanent empty space" is no longer used (removed 2026-10-27). "Empty
space" appears only on tutorial slide 5 (a square no piece covers,
dotted squares included). Don't say "cell", "gap", "fixed gap" or "blocked square" to
players. (Code and the analyzer still say gap / fixed gap internally;
that's fine.)

## Working style with this user

The user is learning bash: make file changes with the Edit/Write tools
(small readable diffs), keep Bash commands short and single-purpose, and
put test scripts in files rather than long inline commands. Explain any
unusual command syntax (pipes, redirects) when you use it.

## Interactive tutorial (2026-10-19)

`tutorial.html` replaces the rules popup as the first-visit popup on the
puzzle page. play.html shows it in an `<iframe>` overlay when
`localStorage.pb_tutorialSeen` isn't set (set on X / Esc / Finish; the
iframe posts `{type:'pb-tutorial-close'}` to the parent). The Rules popup
gets a "Play the tutorial" button wherever `window.openTutorial` exists.
On the splash, the button under Easy/Medium/Hard is **Tutorial** (a link to
tutorial.html as a full page; ✕/Finish return to index.html and set
`pb_tutorialSeen`); Rules stays in the top-right corner.
Five slides (v2 of the user's spec, 2026-10-19): objectives + the 12
pentominoes; drag/rotate (notes glow until the player drags / rotates;
on solving, a popup next to the ringed gaps introduces **gap** vs **fixed
gap** with animated pictures and an OK that turns green first); "don't
place a piece over" as its own animated slide; reflect; the parity puzzle
(on solving, rows then columns flash green one by one with counts that
stay; only then "Finish ✓" turns green). game.js has `gameHooks.onDragStart`
and `gameHooks.onTransform` for the glowing notes. The "not allowed" sign
(`drawNoMark` in shapes.js) is a circle with ONE diagonal slash, not an X
(an X reads as a fixed gap). Slides 2–4 run on game.js itself, using two new features:
`puzzle.fixedPieces` (pre-placed, unmovable pieces that count as filled)
and `gameHooks.onSolved` (replaces the Solved! popup). "Tap" vs "Click"
wording is chosen with `(hover: none) and (pointer: coarse)`. Each
tutorial puzzle is verified with solver.js, which now accepts `prefilled`
squares (can't be covered, but count as filled for parity).
Future (not built): save players' progress with no data collection
beyond what progress needs; the suggested approach is browser-only
(localStorage), no accounts.

## Parity Blocks redesign (started 2026-10-16) — read first

The site now launches on a **splash screen** (`index.html`): logo, an info
(i) button that opens a rules popup, and Easy / Medium / Hard buttons. The
old sandbox app described in the rest of this document was moved unchanged
to **`sandbox.html`** (kept as the admin/puzzle-building tool) — every
reference below to `index.html` now means `sandbox.html`.

- `index.html` is annotated for non-developer editing: search for the tags
  `[FONTS]`, `[COLORS]`, `[POSITIONING]`, `[IMAGES]`, `[CONTENT]`,
  `[BEHAVIOR]`. Nearly all tunables are CSS variables in its `:root` block.
- Images live in `assets/` (`assets/logo.svg` is a placeholder mark: a 4×4
  board where every row/column is even). It's also the favicon.
- Fonts: Fredoka (display) + Nunito (body) via Google Fonts.
- Difficulty buttons read `DIFFICULTY_LINKS` in the script: Medium →
  `play.html?puzzle=test-puzzle-2`, Hard → `play.html?puzzle=test-puzzle-1`,
  Easy is `null` ("coming soon" toast) until there's an easy puzzle.
- **Rules popup** (`rules.js` + `rules.css`, added 2026-10-16, spec'd by
  the user): shared by both pages. Opens automatically **only on the puzzle
  page** (play.html loads it with `data-auto-open`; the splash doesn't), and
  only if the player has never closed it before (`localStorage.pb_rulesSeen`,
  set on close) — so a new player sees it right after picking a difficulty.
  Also opens from
  any `[data-open-rules]` element — a "Rules" pill top-right on both pages
  plus a second "Rules" button under the difficulty buttons on the splash.
  Content: Goals (1. place every piece + finished-board picture; 2. every
  row/column even + hint about empty blocks + three pictures: Check rows /
  Check columns on a wrong board, All even on the solved one) and Rules
  (reflect, rotate, no piece on a gap, no piece across a dotted perimeter),
  each with an SVG picture. The example board is a made-up 6×6 with P/U/T/V
  pentominoes — deliberately not a real puzzle so the pictures never spoil
  a solution. Wording lives in `RULES_TEXT` at the top of rules.js. The
  old splash (i) button and its popup were removed.
- **Mistake display in play.html (2026-10-16, user request; strokes turned
  OFF in the game 2026-10-17 at the user's request: message only, via
  `SHOW_UNEVEN_MARKS = false` in game.js; sandbox viewer + rules pictures
  still draw them)**: while
  placing, a bad drop still glows red. Once **every piece is placed**,
  pieces never glow red (the user found the last-placed piece glowing
  misleading — it looked like "the" problem). Instead: uneven rows/columns
  get a red **highlighter stroke** (`buildHighlighterPath` in shapes.js —
  straight ends, slight wobble, drawn over the pieces, overhanging the grid by
  `--highlight-overhang`), and `#status` above the board says
  "Uneven row/rows/column/columns", joined with "and", plus any placement
  problem ("Pieces overlap", "A piece is on a gap", "A piece crosses a
  dotted line", "A piece is off the board") without saying which piece.
  The rules popup's Check pictures use the same strokes (green lighter
  than red; the solved picture shows only green counts). The old
  cell-outline `.parity-odd` style is gone.
- **Dotted perimeter is now a real rule in play.html** (was only a visual
  hint): a piece must sit wholly inside or wholly outside
  `puzzle.hintOutline`, else it's invalid/red (`crossesDottedLine`). The
  sandbox does NOT enforce this.
- **`shapes.js`** holds the shared piece geometry + SVG drawing
  (`rotateCells`, `reflectCells`, `buildOutlinePath`, `buildPieceShape`…),
  used by play.html and rules.js. The sandbox still has its own copy.
- **Irregular boards (2026-10-19)**: optional `puzzle.removed: [[r,c]]`
  = squares cut out of the board entirely (not the same as `blocked`, which
  is an X square that's still part of the board). game.js treats them as
  out of bounds (`inBounds`), hides them (`.board-cell.removed`) and draws
  the frame as an SVG that hugs the remaining squares (`renderFrame`,
  `#board-frame`, `#board-outer.irregular`). solver.js merges `removed`
  into blocked (and echoes it in the JSON); `miniBoard` takes `removed` too.
  Sandbox: new **Shape** click mode (click to cut / click a dashed ghost to
  restore; to extend past the edge raise Rows/Columns, then cut). Clear
  board also restores cut squares. Carried through save/publish/export.
- **Publishing, archive, reset (2026-10-17, user decisions: publish via
  GitHub, archive in the browser, reset on the game page)**:
  - **`published.js`** holds `PUBLISHED = {easy, medium, hard}`, each
    `{archiveId, publishedAt, puzzle}` with a FULL puzzle copy, between
    `/*JSON*/ … /*END*/` markers (the sandbox parses between them; don't
    remove them, and never write `*/` inside its header comment). The
    splash links are now `play.html?level=easy|medium|hard`;
    `play.html?puzzle=<id>` (puzzles.js) still works.
  - **Publish** (sandbox archive ↑ button): reads published.js through the
    GitHub contents API, replaces one level, PUTs it back with the user's
    fine-grained token (Contents read/write on parity-blocks), stored only
    in `localStorage.pb_github`. Vercel redeploys from that commit. Runs a
    solver check first and warns if not exactly one solution.
    **Consequence for local work: publishing commits to origin/main from
    the browser, so always `git pull` before committing locally.**
  - **Archive** (`localStorage.pb_archive`): saved puzzles with savedAt,
    notes (✎ popup), and publish stamps; a stamp is "live" when
    PUBLISHED[level] still has that archiveId+publishedAt. Opening an entry
    copies it into the draft. Seeded from puzzles.js + published.js on
    first run. Export/Import backup = JSON file (import skips duplicate
    ids).
  - **Reveal** (archive eye icon): solves the saved puzzle in a worker and
    shows its parity solution(s) in a popup (miniBoard; arrows if several;
    says when there are 0 or many). Doesn't touch the draft; "Show on board"
    opens a copy and runs Analyze.
  - **Reset** on the game page: small button left of Rules, asks "Start
    over?" first, then `loadPuzzle(puzzle)` (clears pieces, restarts timer).
- **New sandbox = puzzle builder (2026-10-17, user chose this over
  restyling the old one)**: `sandbox.html` is now built on the game's own
  code so it looks identical. play.html's inline CSS/JS were moved to
  shared **`game.css`** and **`game.js`** (play.html just calls
  `loadPuzzle(PUZZLES[id])`). game.js gained `loadPuzzle(p, {keep})`,
  `setGameMode('play'|'edit'|'view')`, `setViewTiling(t)` and
  `gameHooks.onCellClick`; the game itself only ever uses 'play'.
  Builder panel: start from blank/any puzzle, rows/cols (3–12), click mode
  Play / Block squares (cycles open → X → hidden gap → open) / Dotted area
  (+ caption), pick any of the 12 pentominoes, Analyze (worker) and flip
  through tilings ON the main board (view mode: odd rows/cols highlighted,
  empty squares ringed, arrow keys), "Place these pieces" to play-test a
  tiling, export a puzzles.js entry or the analysis JSON. Draft autosaves
  to `localStorage.pb_sandboxDraft`. Hidden gaps are shown (dashed,
  "hidden") in edit/view mode, never in play mode.
  The old sandbox (infinite grid, custom pieces, checkerboards, undo…) is
  unchanged as **`sandbox-classic.html`**; most of this document's older
  sections describe that file.
- **Solver + analyzer (built 2026-10-17)** — supersedes the "Solver (not
  built yet)" plan further down (it ended up in-browser on an admin page,
  not a Node-only script, at the user's request).
  - `solver.js`: pure JS, no deps, heavily commented for learning. DLX
    (Algorithm X): one PRIMARY column per piece (exactly once), one
    SECONDARY column per open cell (at most once → empty cells allowed),
    fewest-options heuristic, enumerates ALL tilings, then parity-checks
    each. Hidden blocked cells are just `blocked`; placements crossing a
    `hintOutline` are excluded (matches the game). `findPuzzles` tries
    every C(12,n) pentomino set on a board. Wrapped in one function
    (`ParitySolverModule`) so `createWorker()` can build a Web Worker
    from its own source via a Blob URL (works from file://, offline).
    Exports for Node (`require`) and as `window.ParitySolver`.
  - `analyzer.html`: admin page (not linked from the game). Analyze with
    progress/cancel, summary + verdict, step through tilings (parity-only
    filter, empty cells ringed, odd rows/cols highlighted), Download JSON
    in the user's format, puzzle finder (click to load; shows a
    paste-ready `puzzles.js` entry). Terminology: the JSON says "gaps",
    the screen says "empty cells", because the game/rules popup already
    uses "gap" for an X square.
  - `miniBoard`/`svgEl`/`drawPiece` moved from rules.js to shapes.js
    (shared with the analyzer); new `show:'odd'` and `markEmpty` options.
  - Tests: `node tests/solver.test.js` (46 checks: orientations, parity,
    tiny hand-checkable boards, the Hard puzzle = 74 tilings / 1 parity
    solution with exact placements, finder = 74 qualifying sets of 924).
  - Findings: Hard = 74 tilings, 1 parity solution. Medium has only ONE
    tiling at all (30 open cells, 30 piece cells), so its parity rule
    never actually decides anything.
- **`puzzles.js`** holds `PUZZLES` (moved out of the sandbox 2026-10-16) and
  is loaded by both `play.html` and `sandbox.html` via `<script src>` —
  edit puzzles there only.
- **`play.html`** is the public game page: a standalone, much smaller
  rewrite rather than the sandbox with things hidden. (Since 2026-10-19
  there are no Reflect/Rotate buttons and no selecting — see START HERE.)
  Original layout (per user):
  pieces at the top with **no labels**, a large centered board (squares sized
  to fill the space between, capped by `--board-max-cell`), and **Reflect
  (left) / Rotate (right)** buttons below. Interaction: drag from the top
  to place; tap a piece (board or top) to select it for Reflect/Rotate
  (R/F/Esc keys too); drag a placed piece off the board or back to the top
  to remove it (it returns in its current orientation). Same placement
  rules as the sandbox (bad drops allowed but shown red; validity is
  rechecked for every piece after each change), same win condition and
  odd-row/column red outline, hidden blocked cells and hint outline/caption
  supported. No visible timer; the "Solved!" popup shows the time. No
  undo, trash zone, multi-select, or duplicate — deliberately left out to
  keep it simple.
- Unlike the sandbox's modals, the rules popup also closes on Escape and
  backdrop click (standard for a public landing page).

A single-file HTML/CSS/JS puzzle app (`index.html`, no build step, no
dependencies). Drag polyomino pieces onto a grid, design your own shapes,
rotate/flip/duplicate/delete them (single or multi-select), undo, toggle a
checkerboard overlay with live counts, box-select with a marquee, and
(optionally) let the grid grow as you place pieces near its edges, or resize
it manually by typing a number — no Apply button needed.

Read `index.html` top to bottom before changing anything — it's organized
into clearly commented sections (CSS, then a big `<script>` split into
CONSTANTS, FIXED PIECE SETS, STATE, BOARD SETUP, SOLID SHAPE RENDERING,
RENDERING, PALETTE RENDERING, DRAG, SELECTION/ROTATE/etc, KEYBOARD CONTROLS,
GRID SIZE, TRAY CONTROLS, CUSTOM PIECE EDITOR, HOW TO PLAY, INIT).

## Public "puzzle mode" direction (in progress, started 2026-10-15)

This app is being adapted into a public-facing deployment modeled on NYT
Games — land directly on a specific daily puzzle, no sandbox navigation —
while **keeping the current free-form sandbox** as the internal/admin tool
for building and testing those puzzle configs (not being replaced).
Confirmed decisions so far, all from direct user conversation (none of this
is derivable from the code yet, since most of it isn't built):

- **Grid shape customization** = a rectangular grid with specific cells
  blocked out per puzzle (holes), not a free-form painted outline. Simplest
  data model: board bounds + a list of blocked cells.
- **Win condition** (confirmed 2026-10-15 — **not** classic exact-cover,
  don't assume "every cell must be covered"): a puzzle is solved when (1)
  every piece in that puzzle's given set has been placed on the board, validly
  (no overlaps, nothing off-grid or on a blocked cell, none left in the tray),
  AND (2) every row and every column has an **even number of covered cells**.
  Empty cells are fine — the board does not need to be fully covered. Count
  **individual covered squares**, not pieces: e.g. a U-pentomino placed so
  its top edge covers 2 squares of one row and its bottom edge covers 3
  squares of the row below adds 2 to that row's tally and 3 to the next
  row's — not "1" to each. This is cheap to check live (just tally covered
  cells per row/column after each placement and test evenness) — no solver
  needed for in-app feedback.
- **Solver** (not built yet): an **offline Node script**, never shipped to
  players, that enumerates valid full-piece-set placements for a given
  board+piece-set config and checks which satisfy the row/column-parity win
  condition above — used by the admin to confirm a puzzle is actually
  solvable (and ideally how many solutions it has) before publishing it.
  Deliberately not an in-app feature, to keep the public bundle small and
  the solution out of the page source.
- **Sequencing** (user's choice, given the size of this): How to Play modal
  (done), piece-visual rework (done), grid-shape data model (done), then
  the solver (not started). Mobile optimization is explicitly deferred to a
  later phase.
- **How puzzle mode is entered — resolved 2026-10-15**: **tabs**, not a
  URL param/route. A tab bar at the top of the app lists "Sandbox" plus
  one tab per entry in the `PUZZLES` registry; clicking a puzzle tab swaps
  the shared board/tray UI over to that puzzle's fixed config. See "Puzzle
  tabs" below for the full mechanism. This was built directly off a
  concrete request ("make a tab titled test puzzle #1"), not a separate
  architecture discussion — it's the answer to what used to be an open
  question here.
- Still open / not yet decided: whether this ever needs more than a
  same-page tab bar (e.g. a real URL per puzzle for sharing/bookmarking a
  specific one) if the puzzle list grows large, and whether "Sandbox"
  itself stays visible/accessible in the eventual public deployment or
  only exists for admin use. Don't assume an answer — ask before building
  further on this.

## What's implemented

- **Pieces**: 11 standard (mono/domino/2 trominoes/7 tetrominoes) + 12
  classic pentominoes (fixed shapes, `STANDARD_PIECES` / `PENTOMINO_PIECES`)
  + user-defined custom pieces (`customPieces`, drawn in a modal editor,
  persisted to `localStorage`).
- **Rendering**: every piece — tray preview, drag ghost, and placed piece —
  goes through `buildSolidShape()`, which renders one `<path>` fill + one
  `<path>` outline stroke for the whole piece, rather than per-cell
  bordered divs. This was a deliberate fix for a real bug: per-cell borders
  showed hairline seams on high-DPI displays, and jagged "flag" artifacts at
  concave corners (T/S/Z pieces). The outline is traced via a fine-grid
  rasterization boundary-walk, not per-cell borders. See `buildPieceRects` /
  `buildFillPath` / `buildOutlinePath`.
  **Connected square units** (added 2026-10-15, part of the public
  puzzle-mode direction above): a piece needs to visibly read as joined
  unit squares, not a solid blob, so `buildInternalDividers()` adds a third
  `<path>` — thin stroke-only lines (`rgba(0,0,0,0.25)`, 1.5px) down the
  middle of every swallowed internal gap between two orthogonally-adjacent
  same-piece cells. It's still all vector strokes inside the same SVG, so
  it does **not** reintroduce the old hairline-seam bug — the outer
  silhouette is still the one smooth `buildOutlinePath()` trace, drawn on
  top, completely unaffected by the interior lines. Draw order in
  `buildSolidShape()`: fill → dividers → outer outline.
- **Grid model**: NOT a fixed `gridSize` — it's an absolute-coordinate
  rectangle (`gridMinRow/gridMaxRow/gridMinCol/gridMaxCol`). This is what
  lets Infinite Grid mode expand just one side without ever shifting
  existing pieces' stored `anchorRow`/`anchorCol` — only the rendering
  offset (`pxRow`/`pxCol`) and bounds checks use the offset. Max manual grid
  size is 20×20.
- **Grid resize — manual, no Apply button**: `#grid-size-input` resizes live.
  Typing + Enter, typing + blur, and the native spinner/arrow-key
  interactions all trigger `attemptGridResize()` via a `change` listener
  (native inputs fire `change` immediately for spinner/arrow-key bumps, only
  on blur for typed text — this distinction is why both paths are wired).
  Validation is two-tier: `attemptGridResize()` first checks the value is a
  well-formed integer in range (1–20), then checks the new bounds via
  `piecesFitInBounds()` against every existing placed piece. On failure,
  `showGridSizeError(msg)` displays an inline error and the resize is
  **blocked** — existing pieces and grid bounds are left untouched. On
  success, existing pieces are preserved in place (bounds just grow/shrink
  around them). `dismissGridSizeError()` clears the error and reverts the
  input to `Math.max(gridRows(), gridCols())`. The Enter key is overloaded:
  if an error is currently showing, Enter **dismisses** it (does not
  re-attempt); otherwise it attempts a resize and only blurs the input on
  success — this was a self-caught bug (originally blurred unconditionally,
  which silently broke "press Enter again to dismiss" because focus was
  already gone for the second press).
- **Placement rules**: grid-locked (integer cells), but overlap, extending
  past the border, and landing on a blocked cell are all *allowed*. Any
  piece in that state is tracked in `pendingPlacementIds` (a `Set`, supports
  multiple at once) and rendered with a red glow, purely from membership in
  that set — independent of `selectedIds`, so it persists whether or not
  the piece is currently selected. Only **duplicate** auto-searches for an
  open spot (`findOpenAnchor`); rotate/flip/arrow-keys/drag never relocate a
  piece to "help" it fit — they apply literally and let the red state show
  if that broke it. **Critical ordering rule**: `updatePendingPlacement(pieceId)`
  must always be called **after** `maybeExpandGrid()`, never before — doing
  it in the wrong order was a real, previously-shipped bug (see Known
  issues below) and it's an easy mistake to reintroduce at a new call site.
  **No global lock** (removed 2026-10-15 at explicit user request): earlier
  versions blocked clicking/dragging/deselecting anything else while any
  piece was pending (`isLocked()`/`canInteractWith(id)`, with a blocking
  toast). That's gone — a pending piece just sits there red; every other
  piece (new tray drags, selecting, moving, right-click delete, clicking
  empty space to deselect) works completely normally regardless of what
  else is pending. Don't reintroduce a global interaction lock here; if a
  future change needs to restrict interaction with a specific piece, scope
  it to that piece only, not the whole board.
- **Infinite Grid**: checkbox that switches from a fixed size (manual
  input) to auto-expand/contract. `maybeExpandGrid(piece)` grows whichever
  side(s) a piece is touching/exceeding (`EXPAND_BUFFER = 2`);
  `maybeContractGrid()` shrinks empty outer rows/cols back down to an
  `INFINITE_MIN_DIM = 8` floor.
- **Selection model — multi-select**: `selectedIds` and
  `pendingPlacementIds` are both `Set`s (generalized from earlier
  single-id variables). Shift-click adds/removes a piece from the
  selection. `updateSelToolbar()` shows Rotate/Flip/Delete for any
  selection size, and adds Duplicate only when exactly one piece is
  selected; it positions itself over the bounding box of the whole
  selection.
- **Box (marquee) selection**: click-drag starting on empty board space
  draws a marquee rectangle (`#marquee-box`, driven by `onMarqueeMove`/
  `onMarqueeEnd`). A piece is selected if its on-screen center falls inside
  the dragged rectangle. Holding Shift at drag-start makes it additive
  (keeps the existing selection and adds to it); without Shift it replaces
  the selection. A plain click (no movement) on empty space still just
  deselects everything, as before.
- **Group transform**: `transformSelected(fn)` rotates/flips an entire
  multi-piece selection together as a rigid group — each piece's
  bounding-box corners are transformed within the group's shared frame
  using the same point-rule that `rotateCells`/`flipCells` use for single
  pieces (verified via a 360°-round-trip self-test). Single-piece selection
  still goes through the original, simpler single-piece path.
- **Group drag**: starting a mouse drag on any piece that's already part of
  a multi-selection (built via shift-click or marquee) moves the whole
  group together, by the same delta, exactly like arrow-key movement does —
  it does **not** collapse the selection down to just the piece you grabbed.
  `startDragFromPlaced` captures each selected piece's starting anchor in
  `drag.groupStart`; `onDragEnd` applies the dragged piece's final delta to
  all of them. Starting a drag on a piece that *isn't* part of a current
  multi-selection still behaves as a plain single-piece drag/select, as
  before. The floating rotate/flip/duplicate/delete toolbar is explicitly
  hidden for the whole duration of any drag (new piece or move) —
  `updateSelToolbar()` bails out early whenever the global `drag` variable
  is set, and both `startDragFromTile`/`startDragFromPlaced` call it
  immediately after setting `drag` so it disappears right away rather than
  waiting for the next `renderAll()` (which doesn't happen again until the
  drag ends).
- **Trash zone**: dragging a piece onto `#trash-zone` deletes it
  (`isOverTrashZone(clientX, clientY)`). This **replaced** an earlier
  "drag off the edge of the grid to delete" mechanic, which was removed
  because it conflicted with Infinite Grid's edge-expansion gesture (same
  drag motion meant two different, conflicting things). Note: dragging one
  piece of a multi-selection to the trash only deletes that one piece, not
  the whole group — intentional, since the UI only ever shows that one
  piece's ghost heading toward the trash.
- **Grid shape (blocked cells)**: `blockedCells` (a `Set` of `"r,c"`
  absolute-coordinate keys, persisted to `localStorage` as
  `poly_blockedCells`) lets specific cells be removed from the board
  entirely — the "variable layouts" part of the public puzzle-mode
  direction. Deliberately **not** called "holes" anywhere in code/UI: that
  word was already taken by `#holes-count` for a different, pre-existing
  concept (an uncovered-but-placeable cell — the same sense the pentomino-
  coloring reference doc uses it in). A blocked cell behaves like
  out-of-bounds: `isValidPlacement` rejects it, and it's excluded from the
  total/open tallies (`setupBoard`'s `total-count`, `updateHolesCount`'s
  `holes-count`) and from the checkerboard scheme's per-color totals
  (`updateCheckerCounts`) — but a piece can still be *dropped* on one, same
  as any other invalid placement (soft-invalid/pending, not a hard
  rejection — consistent with how overlap and off-grid already work).
  Toggled via the "Edit grid shape" sidebar checkbox
  (`editingGridShape`/`#edit-shape-toggle`), which repurposes a plain
  board-cell click (normally the start of a marquee drag) into
  `toggleBlockedCell(r,c)` instead. While that mode is on,
  `body.editing-grid-shape` is set, which does two things via CSS alone —
  no extra JS gating needed in the piece-interaction code: `.placed-piece
  .blk { pointer-events: none; }` so clicks reach the board cell
  underneath even where a piece is currently sitting (you can block/unblock
  a cell regardless of what's on it), and a pointer cursor on every cell.
  Starting a **new** piece drag from the tray while editing is explicitly
  blocked with a toast (`startDragFromTile` checks `editingGridShape`
  first) — editing the board's shape and placing pieces are kept as two
  separate modes, not mixed. Toggling a cell calls `pushUndo()` first and
  revalidates every placed piece afterward (`updatePendingPlacement`) since
  blocking/unblocking a cell can invalidate or un-invalidate whatever's
  sitting on it; `blockedCells` is included in the undo snapshot alongside
  grid bounds. CSS: `.board-cell.blocked` (dashed border, `--bg` fill) plus
  a `::after` pseudo-element showing a red X (`\2715`, `#e05252`) centered
  on the cell — originally a checkmark (`\2713`) per an explicit "red
  checkmarks instead of holes" request, changed to an X one message later
  when the user clarified that was actually what they meant (they'd drawn
  X's in their sketch the whole time). If asked to change this glyph
  again, it's this one `content` value in `.board-cell.blocked::after`.
- **Checkerboard / color scheme overlay**: `checkerboardEnabled` toggle
  colors the grid using one of three schemes in the `COLOR_SCHEMES`
  registry — `checkerboard` ((r+c) mod 2), `stripes2` (r mod 2), `stripes3`
  (r mod 3) — picked via the `#color-scheme-select` dropdown (only enabled
  when the checkerboard toggle is on). Each scheme supplies its own
  `colors`/`labels`/`indexFor`; `patternIndexFor(r,c)` just forwards to
  `currentScheme().indexFor(r,c)`, so rendering, the onion skin overlay and
  the count display all automatically follow whichever scheme is active.
  Persisted to `localStorage` as `poly_colorScheme`. These three were
  chosen out of a ~10-scheme catalog in a coloring-theory reference
  document (see "Checkerboard scheme scope" below) — the rest were
  explicitly descoped as not applicable to this app.
  `updateCheckerCounts()` (called from `updateHolesCount()`) shows two
  things: the whole board's **uncovered/remaining** cells by color (always
  shown whenever checkerboard mode is on), and, only while at least one
  piece is selected, a second "Selected: ..." line showing **covered**
  cells by color for just the selected pieces. These are deliberately
  different statistics (remaining vs. covered) — see that section before
  changing either one.
- **Onion skin overlay**: `onionSkinEnabled` toggle shows a semi-transparent
  checkerboard pattern over the board (`renderCheckerOverlay()`), restricted
  to only the cells actually covered by a placed piece (not the whole
  board — this was a deliberate refinement after an earlier version
  overlaid everywhere). Current opacity is `.checker-overlay-cell { opacity:
  0.5; }` after a couple of rounds of "make it more opaque" tuning (started
  at 0.3, went to 0.375, then to 0.5 at the user's explicit request to go
  "all the way to .5").
- **Puzzle tabs**: a tab bar (`#tab-bar`, built by `renderTabBar()`) lists
  "Sandbox" plus one button per entry in the `PUZZLES` registry (currently
  `test-puzzle-1` and `test-puzzle-2`). Clicking a puzzle tab
  (`switchToPuzzle(key)`) takes over the shared board/tray UI: grid bounds
  set to the puzzle's `rows`/`cols` (always 0-based), `blockedCells`
  replaced with the puzzle's `blocked` list, `placedPieces`/selection/
  pending/undo stack all reset fresh, Infinite Grid forced off
  (in-memory only), and the grid-size input / Infinite Grid / Edit-grid-
  shape controls disabled (a puzzle's shape is fixed while viewing it).
  `#sandbox-controls` (a wrapper div around every sandbox-only sidebar row
  and the Standard/Pentomino/Custom tray sections) is hidden and
  `#section-puzzle` shown instead, populated by `renderPuzzleTiles(key)` —
  just `renderFixedTiles('puzzle-tiles', PUZZLES[key].pieces,
  'puzzle_'+key)`, the same renderer Standard/Pentomino tiles use, so
  drag/rotate/flip-tile-preview all work identically. **Critically, none of
  this touches `localStorage`**: `switchToPuzzle` never calls
  `saveGridBounds()`/`saveBlockedCells()`, and `infiniteGrid`/
  `editingGridShape` are only mutated in memory, specifically so a puzzle
  session can never clobber the sandbox's persisted state. Leaving Sandbox
  calls `captureSandboxSnapshot()` first (deep-copies grid bounds,
  `blockedCells`, `placedPieces`, selection, `infiniteGrid` into
  `sandboxSnapshot`); `switchToSandbox()` restores from it exactly. The
  checkerboard/stripes overlay is deliberately **not** part of any of this
  snapshotting — it's treated as a global display preference that applies
  to whichever board is currently shown, not per-tab state.
  **Puzzle data format**: each `PUZZLES` entry is `{title, rows, cols,
  blocked: [[r,c],...], pieces: [{name,color,cells},...]}` — `cells` are
  relative coordinates exactly like `STANDARD_PIECES`/`PENTOMINO_PIECES`.
  `test-puzzle-1`'s 6 pieces were extracted directly from a user-provided
  sketch image (colors eyeballed/approximated, shapes verified cell-by-
  cell — 4 of the 6 matched an existing `PENTOMINO_PIECES` shape exactly,
  confirming the extraction was accurate; the other 2 were the same
  pentomino type in a different rotation, expected and fine since puzzles
  define their own exact cells rather than referencing the catalog). Its
  blocked cells went through several revisions, documented here in full
  since this took real back-and-forth to get right:
  1. Originally `[[2,3],[3,2]]` (green X's in the first sketch).
  2. Changed 2026-10-15 to `[[1,1],[4,2]]` (red X's in a follow-up sketch,
     green-X cells reopened). **This made the puzzle unsolvable** —
     confirmed by an exhaustive brute-force search (all 6 pieces, every
     rotation/reflection, every non-overlapping placement) that found zero
     arrangements satisfying the row/column-even-parity win condition, for
     *both* this and the original blocked-cell pair. The same piece set
     solves instantly with **zero** blocked cells (24 raw solutions, 3
     distinct up to rotating/flipping the whole board — see
     `scratchpad/pwtest/count_solutions.js`-style scripts from that
     session if this needs re-deriving), so the piece set itself was never
     the problem.
  3. **Current** (2026-10-15, same day): `[[1,1],[1,5],[5,0],[5,5]]`. Found
     by taking one of the 3 zero-blocked solutions (anchors: L (0,0), I
     (0,1), X (1,1), N (2,4), P (4,1), U (1,3) — all cells relative, listed
     in reading order of the board) and blocking 4 of its 6 naturally-
     uncovered cells. This is guaranteed not to break that solution (the
     pieces never needed those cells), and an exhaustive check of **all 15
     ways** to pick 4-of-6 from that solution's empty cells found every
     single one collapses the puzzle to **exactly 1 solution** — so this
     particular choice of 4 wasn't forced, any of the 15 would have worked
     equally well. Verified end-to-end in the app itself (injecting the
     solution's placements and confirming `#congrats-modal` fires), not
     just in the standalone solver. **Difficulty**: with these 4 blocked
     cells, 74 ways exist to place all 6 pieces without overlap; only 1
     satisfies the parity rule — about 1-in-74 odds for a "looks fine"
     placement to actually be right. (An earlier 2-blocked-cell version of
     this same fix, `[[1,1],[5,5]]`, was looser — 2,088 total placements,
     1-in-1,044 — before the user asked to tighten it to 4 blocked cells;
     that number is stale anywhere else it might still appear.) The app
     only evaluates the parity rule once every piece is placed and valid,
     so there's no partial/warmer-colder feedback along the way — discussed
     directly with the user, who chose to keep it this way for now rather
     than add live row/column counters (noted as the natural follow-up
     below). This is a genuinely hard puzzle, not a casual one — expected
     and accepted, not a bug.
  If this ever needs revisiting again: the pattern that worked was picking
  a known zero-blocked solution first, then blocking only cells that
  solution doesn't use — trying to pick blocked cells first and hoping a
  solution exists is what caused step 2's failure. **Possible future
  follow-up, discussed but not built**: live per-row/column covered-cell
  counters while placing pieces (not just the end-state pass/fail check),
  which would shift the puzzle from "mostly trial-and-error, a little
  logical deduction" toward more logical deduction — the user chose to
  keep the current all-or-nothing-at-the-end feedback for now.
- **Test Puzzle #2 (added 2026-10-16)**: a second `PUZZLES` entry
  (`test-puzzle-2`), extracted the same way as #1 — from a user-provided
  screenshot, verified cell-by-cell before shipping (reconstructed the
  drawn arrangement in a standalone script and confirmed: no overlaps, no
  out-of-bounds, 30/30 open cells covered, every row/column even — the
  user had drawn a *complete, pre-solved* layout this time, not just a
  piece reference, and it checked out). Introduced two new, generalized
  `PUZZLES` fields beyond what #1 uses:
  - **`hiddenBlocked: [[r,c],...]`** — a subset of `blocked` that's
    functionally blocked (placement/counts/parity all treat it exactly
    like any other blocked cell — `isBlocked()` is unchanged) but rendered
    with **zero visual difference from a normal open cell**: no dashed
    border, no X, nothing. `isVisiblyBlocked(r,c)` is the new check
    (`isBlocked(r,c) && not in hiddenBlocked`); `setupBoard()`'s per-cell
    className now branches on `isVisiblyBlocked`, not `isBlocked`, for
    both the `.blocked` class and whether to suppress the checkerboard
    pattern class — a hidden cell shows the checkerboard pattern like any
    other open cell would, on purpose, since full indistinguishability is
    the point. The open/total counts (`#holes-count`/`#total-count`)
    deliberately still use the *true* `isBlocked` count, not just the
    visible one — a player who does the arithmetic can infer hidden cells
    exist, just not where; that's an accepted/intended mystery mechanic,
    not an oversight. Test Puzzle #2 blocks 6 cells total, shows 4 (the
    "right side" ones, matching which half of the board they're in — `c`
    index 3,4,5) and hides 2 (the "left side" ones).
  - **`hintOutline: [[r,c],...]` + `hintText: "..."`** — an optional
    static dashed outline traced around an arbitrary region of absolute
    board cells, with a caption. `renderHintOverlay()` (called from
    `setupBoard()`, so it refreshes on cell-size/grid changes same as the
    checker overlay) reuses `buildOutlinePath`/`SVG_NS` — the exact same
    boundary-walk geometry already used for piece outlines — fed the hint
    region instead of a piece's cells, so it traces one smooth connected
    boundary (not per-cell borders) regardless of the region's shape. Lives
    in `#hint-overlay`, a new layer in `#board-outer` stacked above
    `#pieces-layer`/`#checker-overlay` (z-index 500) so it's never hidden
    by a placed piece. For #2, the outlined region is the union of the X
    and T pieces' cells in the solution (10 cells, one connected shape
    since the two pieces' cells happen to touch), captioned "The outlined
    cells can only be covered by two of the six pieces." — a logical
    anchor (narrows the search meaningfully) without fully revealing the
    solution for that region.
  - `test-puzzle-1` leaves both fields undefined; `renderHintOverlay()` and
    the `isVisiblyBlocked` hidden-cell check both no-op cleanly when a
    puzzle doesn't define them (checked via `PUZZLES[activeTab]` directly,
    not a separate per-tab flag), so neither feature needed any
    puzzle‑#1‑specific changes.
- **Puzzle progress (timer + win check)**: live-checked inside `renderAll()`
  whenever `activeTab !== 'sandbox'` (`checkPuzzleProgress()`), so it
  re-evaluates after every discrete mutation (place/move/rotate/delete/
  undo) without needing calls scattered at each site. Implements the win
  condition exactly: returns early (no highlight, no popup) unless
  `placedPieces.length === puzzle.pieces.length`, `pendingPlacementIds` is
  empty, and there's exactly one placed piece per puzzle piece name (guards
  against e.g. Duplicate creating a second copy of one type — that's
  correctly treated as "not done," not crashed on). Once genuinely
  complete, tallies covered cells per row/column: all even → **solved**
  (stops the timer via `stopPuzzleTimer()`, freezes `#puzzle-timer`'s text
  at the exact elapsed time, shows `#congrats-modal` with that same time
  string — computed once and reused for both, not read twice, to avoid a
  tick of drift between them); any odd → adds `.parity-odd` to every cell
  in the offending row(s)/column(s) (`box-shadow: inset`, reuses
  `--invalid-border` red rather than a new color). `puzzleSolved` latches
  true on solve so the popup doesn't re-fire on later interaction (e.g.
  clicking to select the solved pieces) — reset to `false` by
  `startPuzzleTimer()` on each fresh puzzle-tab entry.
  **Timer**: `startPuzzleTimer()`/`stopPuzzleTimer()`, `#puzzle-timer`
  (shown only while a puzzle tab is active, mirrors `#section-puzzle`'s
  visibility toggling in `switchToPuzzle`/`switchToSandbox`), updates every
  500ms via `setInterval`, `formatElapsed(ms)` → `"M:SS"`. Resets fresh on
  every puzzle-tab entry (consistent with the tab already resetting
  `placedPieces` etc. fresh each time — see "Puzzle tabs" above).
  **Tray consumption**: `renderPuzzleTiles()` grays out
  (`.tile.consumed { opacity:0.3; pointer-events:none; }`) any tile whose
  name already has an instance in `placedPieces`, and un-grays it the
  moment that piece is deleted (recomputed fresh every call, not tracked
  as separate state) — this is what makes "every piece placed" legible to
  the player as the tray visibly draining, not just an invisible rule.
- **Selected-piece glow**: `.placed-piece.selected .piece-svg` uses a
  single white `drop-shadow` (2px blur, 75% opacity) plus a dark
  drop-shadow for depth. This value has been tuned back and forth — see
  "Selection glow history" below before changing it again.
- **Undo**: single global stack (`pushUndo`/`undo`), snapshots
  `placedPieces` + selection + grid bounds + `blockedCells` as JSON. Called
  before every mutating action. Cleared (not persisted across) on every
  puzzle-tab switch — see "Puzzle tabs" below.
- **How to Play modal**: `#how-to-play-btn` (top-right of the topbar) opens
  `#how-to-play-modal`, reusing the existing `.modal-backdrop`/`.modal`
  pattern from the custom piece editor. Explains the actual win condition
  (see "Public puzzle mode direction" above) including the "count squares,
  not pieces" U-pentomino example. Auto-opens once on a visitor's first
  load (`openHowToPlay()` called at the end of INIT, gated on
  `localStorage.poly_hideHowToPlay !== 'true'`); a "Don't show this again"
  checkbox in the modal sets that flag on close. No backdrop-click-to-close
  or Escape-to-close — kept consistent with the editor modal's existing
  explicit-button-only pattern, not a new convention.
- **Keyboard**: arrows move, R rotate, T/F flip, D duplicate, Del/Backspace
  delete, Z undo, Escape deselects all. All operate on the current
  `selectedIds` (single or multi). Escape is deselect rather than D because
  D was already taken by Duplicate (flagged and confirmed with the user
  rather than silently overloading D). The global keydown guard is narrowed
  to only ignore keystrokes when `e.target.matches('input[type=text],
  input[type=number], input[type=color]')` — see Known issues for why this
  matters.
- **Tray controls**: a rotation dial + flip toggle that transform pieces
  *as dragged from the tray* only (`applyTrayTransform`) — never touches
  already-placed pieces. Every tray tile also has its own persistent
  rotate/flip buttons (`saveOverrides`/`applyOverrides` to localStorage).

## Checkerboard scheme scope (read before adding more colorings)

A document titled "Grid Colorings for Pentomino Puzzles" (shared 2026-10-01)
catalogs roughly 10 periodic colorings for pentomino-tiling math — checker,
row/column stripes in 2 and 3 colors, several `(x+y) mod k` diagonals,
four-color parity, 2×2-block checker, sparse dots — plus a validator/
solver/printed-piece-generator spec built around them, written for a
puzzle-*solving* app. This app has no solver, no exact-tiling concept, and
no "does this board admit a tiling" question — it's a free-form drag-and-
drop board. Asked explicitly which parts applied here, the user confirmed:
**only the top 3 recommended-for-building-first schemes** (checkerboard,
2-color stripes, 3-color stripes), as plain overlay/paint options, with
none of the validator/solver/printed-piece machinery. That's what
`COLOR_SCHEMES` implements. If asked to add more schemes from that document
later, the remaining ~7 (and their mirror variants) are still undone by
design, not by oversight — re-confirm scope before adding them, since nothing
in this app's architecture currently needs the multi-color-mix math the
document's later sections describe (reachable-sum validators, signature
vectors per piece, etc.) — none of that has a clear use here without a
solver to attach it to.

## Selection glow history (read before touching this again)

The CSS has been adjusted multiple times based on subjective "too
bright/too dim" feedback. Known values, in chronological order:

1. **Original (first shipped version)**:
   `drop-shadow(0 1px 2px rgba(0,0,0,0.4)) drop-shadow(0 0 3px #fff)
   drop-shadow(0 0 3px #fff);` — doubled, 3px blur, full-opacity white.
2. **Dimmed** (after an early "reduce brightness" request): single layer,
   `drop-shadow(0 1px 2px rgba(0,0,0,0.4)) drop-shadow(0 0 3px
   rgba(255,255,255,0.5));` — 3px, 50% opacity. Superseded.
3. **Over-brightened** (after a later "brighter" request): doubled, 4px
   blur, full opacity — `drop-shadow(0 0 4px rgba(255,255,255,1))` ×2. User
   feedback: "dramatically less obvious... go back to the original and then
   turn it up just a little." Reverted.
4. **3.5px doubled/full-opacity retry**: `drop-shadow(0 1px 2px
   rgba(0,0,0,0.4)) drop-shadow(0 0 3.5px #fff) drop-shadow(0 0 3.5px
   #fff);`. This was committed and pushed, but a local editor autosave
   reverted the working file back to the 4px version (#3) before the user
   actually saw it in a browser — they reported "still far too dramatic,
   looks unchanged," which was literally true. **Lesson**: after editing
   this CSS, re-grep the file immediately before telling the user to look,
   since this file is being actively edited in an IDE and can get reverted
   out from under a change.
5. **True original restored**: `drop-shadow(0 1px 2px rgba(0,0,0,0.4))
   drop-shadow(0 0 3px #fff) drop-shadow(0 0 3px #fff);` (exact value from
   #1). User still found this "very bright and noticeable" and asked for
   something "very subtle" — i.e. the doubled/full-opacity white glow was
   never actually subtle; the user's mental model of "the original" as
   dim didn't match its real CSS value.
6. **Subtle rewrite**: dropped the doubled-layer/full-opacity approach
   entirely in favor of a single white shadow layer with reduced opacity —
   `drop-shadow(0 1px 2px rgba(0,0,0,0.4)) drop-shadow(0 0 2px
   rgba(255,255,255,0.6));` (2px blur, 60% opacity). Confirmed subtle
   enough by the user.
7. **Nudged up twice** from that subtle baseline, blur and opacity tuned
   independently: 2px/0.6 → 3px/0.75 → **current: 2px/0.75** (blur brought
   back down while keeping the higher opacity). **Current (final, pushed)
   value**:
   `drop-shadow(0 1px 2px rgba(0,0,0,0.4)) drop-shadow(0 0 2px
   rgba(255,255,255,0.75));`
   If asked to adjust again, tune blur and opacity as independent, small
   (±0.25–0.5 opacity, ±1px blur) increments from this single-layer base —
   do not go back to the doubled-layer/full-opacity style from #1/#3/#4,
   since that was confirmed too strong across multiple rounds.

## Known issues / bugs already fixed this project (don't reintroduce these)

- **Pending-placement ordering bug**: every call site that mutates a
  piece's position must call `maybeExpandGrid()` **before**
  `updatePendingPlacement()`. Doing it in the other order was a real,
  shipped bug — a piece that needed grid expansion stayed permanently
  flagged invalid (red) even after the grid grew to fit it, because nothing
  ever re-checked it afterward. Matched directly to user bug report
  ("expansion works sometimes but it's glitchy... it stays red").
- **Persistent highlight bug**: moving a piece could leave stale
  `hl-valid`/`hl-invalid` classes on board cells after the drag ended. Root
  cause: `onDragEnd` called `clearHighlights()` and then called
  `updateDrag()` again afterward (to read the piece's final anchor), and
  `updateDrag()` re-adds highlight classes as a side effect — nothing
  cleared them a second time. Fixed with an explicit final
  `clearHighlights()` call immediately before `drag = null; renderAll();`.
- **Keyboard shortcuts silently stopped working** after interacting with
  any input or checkbox. Root cause: the keydown guard used a blanket
  `e.target.tagName === 'INPUT'` check, and checkboxes/number inputs retain
  DOM focus after being clicked, with nothing to blur them back out. Fixed
  two ways: (1) narrowed the guard to only suppress shortcuts for
  `type=text/number/color` inputs specifically, and (2) added a
  capture-phase `pointerdown` listener that blurs any focused form control
  when the user clicks something that isn't one.
- **Grid-resize Enter-key bug** (self-caught during this project, never
  shipped): the Enter handler for the grid size input used to blur the
  input unconditionally after attempting a resize, including on failure.
  This broke "press Enter again to dismiss the error" because focus was
  already gone before the second press. Fixed to only blur on success.

## Still open — not yet diagnosed

**User's notes for later (2026-11-11, "no need to fix now"):**
1. **Analyze said "no parity solutions" with 4 pieces on the board and 2
   in the tray, but dragging the 2 in solved it.** Diagnosed: not a solver
   bug. sandbox.html `piecesToAnalyze` analyzes only the pieces ON the
   board (by design since early on), so it solved I Z T Y alone. The solver
   with all six (I Z T Y N P, empty 6×6) finds 328 parity solutions, fast
   and slow agree. Fix to discuss: analyze every selected piece, or treat
   placed pieces as fixed (prefilled) and ask "how do the rest fit?"
2. **The red wrong-placement glow is hard to see on the red piece**
   (vermilion / the game palette's red). game.css `.placed-piece.invalid
   .piece-svg` is a red drop-shadow only. Idea: a thin white (dark mode:
   dark) ring first, then the red glow, so it shows on any color.
3. **New sandbox feature: dotted line strands** (lines along square edges
   that don't have to close into a loop). Same rule for players: no piece
   crosses a dotted line. Needs: puzzle data (list of edges), game.js
   drawing + the crossing check, solver.js (skip placements that cross an
   edge), sandbox drawing tool, puzzles.js/playtest pass-through.

**"The app is running less smoothly" (reported early on, not re-confirmed
since the rendering/selection work below).** Not profiled yet. Likely
contributors, roughly in order of suspicion, worth checking with the
browser's Performance tab under heavy piece count / large expanded grids:

1. `renderAll()` → `renderPlacedPieces()` does `piecesLayerEl.innerHTML =
   ''` and rebuilds **every** placed piece from scratch on every single
   state change, including running `buildOutlinePath()`'s grid
   rasterization for each one. Cheap per piece, but it's full rebuild +
   recompute every time, not incremental — with many pieces this adds up.
2. `updateSelToolbar()` runs on every `renderAll()` and calls
   `getBoundingClientRect()` right after an innerHTML rewrite — a forced
   synchronous layout on every render. Also runs on `resize`/`scroll`.
3. `setupBoard()` fully tears down and rebuilds every `.board-cell` div
   (`boardEl.innerHTML = ''` + a loop) whenever `maybeExpandGrid`/
   `maybeContractGrid` actually changes the bounds, or a manual resize
   happens. On a large grid (close to 20×20) this is hundreds of DOM nodes
   rebuilt, and it can fire on ordinary interactions (an arrow-key nudge
   near an edge) if expand/contract keeps triggering.
4. `maybeContractGrid()`'s `rowHasPiece`/`colHasPiece` checks are
   `placedPieces.some(...)` scans repeated in a `while` loop per edge —
   cost scales with piece count × grid size, and it's called after nearly
   every mutation.

None of this is confirmed as *the* cause — just where I'd look first.
Possible fixes if it proves out: memoize `buildOutlinePath`/`buildFillPath`
per unique cell-shape+size (they're pure functions of `cells`), diff
placed-piece DOM nodes instead of a full innerHTML rebuild, only call
`maybeExpandGrid`/`maybeContractGrid` when something actually changed
edge-adjacency (not on every move), and/or batch `setupBoard()` rebuilds.

## Deployment status

Repo: `rmackay0/polyominoes-app` on GitHub, deployed via Vercel with a
custom domain through Namecheap (Vercel auto-deploys on every push to
`main`). `gh auth setup-git` has been run so plain `git push` works
directly (no need to use `gh` for the push itself).

**Standing rule (persistent across sessions): commits are fine to make
without asking, but pushing to GitHub always requires the user to
explicitly ask first, every time** — even if a previous message in the same
session already asked for a push, a *new* push still needs a fresh ask.
Multiple pushes have happened over the life of this project; always check
`git log --oneline origin/main..HEAD` to see what's pending rather than
assuming the remote is stale or current.

## How to test changes (no test suite in the repo)

There's no formal test suite committed. Verification throughout this
project has been done with ad-hoc Playwright scripts in a scratch directory
(not part of the repo, not persisted between sessions) that: launch
headless Chromium, `page.goto('file://.../index.html')`, and drive
drag/keyboard interactions via `page.evaluate` + mouse simulation,
asserting on live page state (`placedPieces`, `pendingPlacementIds`,
`selectedIds`, `gridMinRow`, etc. are all plain global variables, directly
readable via `page.evaluate(() => ...)`). If `node_modules/playwright` is
missing or stale in the scratch dir, reinstall with `npm install
playwright@latest && npx playwright install chromium`.

Recommend setting up similar scripts (or a proper Playwright test file
checked into the repo) before making further changes to the
placement/grid/selection logic — it's easy to introduce ordering bugs like
the ones documented above without them, since a lot of the interesting
behavior only shows up across multi-step interactions (place → rotate →
check red state → move → check it clears → box-select → group-rotate →
undo), not from reading the code alone. A few things that looked like app
bugs during testing turned out to be test-script artifacts instead (CSS
`rgb()` vs `rgba(...,1)` string-matching mismatches, imprecise click
coordinates landing on grid gaps instead of cell centers, a native spinner
button's hit-box being a few pixels narrower than assumed) — always confirm
directly (`document.elementFromPoint`, `document.activeElement`, raw CSS
rule text) before concluding either way.

## Style/content conventions established so far

- Muted/retro color palette (see `:root` CSS vars and `PALETTE_COLORS`).
- Minimal UI text throughout (compact labels, icon-only buttons with
  `title` tooltips) — this was an explicit, repeated user preference.
- Rotate buttons are always teal (`--teal`/`.btn-rotate`), flip/reflect
  buttons always plum (`--plum`/`.btn-flip`), consistently everywhere they
  appear (tray, tile hover, selection toolbar, editor modal).
- Whole interface must fit a laptop screen with no page-level scrolling
  (`body { overflow: hidden }`); the sidebar scrolls internally as a
  fallback if content overflows.
- When a user asks to "turn up/down" an already-tuned value and later says
  it overshot, they tend to want you to recall and restore the exact prior
  value from history rather than just picking a number close to the
  current one — keeping this handoff's "history" sections up to date
  matters more than it might seem.
