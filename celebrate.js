/* ═══════════════════════════════════════════════════════════════════
   PARITY BLOCKS: THE SOLVED BADGE
   ═══════════════════════════════════════════════════════════════════
   Every success message (the puzzle page's Solved popup and badge, and
   the tutorial's) is one of these: a green circle with a checkmark,
   then a title and a line of text, all in one box.

   With animate + sound (the puzzle page), it plays the jingle
   (assets/solved.mp3) and moves along with it:
     0.11 s  first note: the green circle pops in
     0.15–1.08 s  the checkmark draws itself (ends on the note at 1.08 s)
     1.16 s  the checkmark shrinks, as if pressed...
     1.46 s  the big last note: it pops back out, and the text appears
   With animate alone (the tutorial: no sound), the same animation runs
   a little quicker. (The timings live in game.css, "Solved badge".)

   Loaded by play.html and tutorial.html (styles in game.css). A page
   that wants the jingle calls enableSolvedSound() once at the start.
   ═══════════════════════════════════════════════════════════════════ */
const SOLVED_SOUND = 'assets/solved.mp3';
let solvedAudio = null;

// Events that count as a real tap or click for the browser. (A finger
// going DOWN doesn't count on phones, only lifting it does: listening for
// pointerdown is why the jingle used to stay silent on phones.)
const UNLOCK_EVENTS = ['touchend', 'pointerup', 'click', 'keydown'];
let soundUnlocked = false, unlocking = false, realPlay = false;

function enableSolvedSound(){
  try { solvedAudio = new Audio(SOLVED_SOUND); solvedAudio.preload = 'auto'; } catch(e){ return; }
  UNLOCK_EVENTS.forEach(t=>document.addEventListener(t, unlockSolvedSound, true));
}
// Phones only let a page play sound it has already started during a tap.
// So on the first tap or click, play the jingle silently for a moment;
// after that it can play by itself. If the browser refuses, try again on
// the next tap.
function unlockSolvedSound(){
  if(!solvedAudio || soundUnlocked || unlocking) return;
  unlocking = true;
  solvedAudio.muted = true;
  const done = ok=>{
    unlocking = false;
    // (If that same tap solved the puzzle, the real jingle is playing now: leave it)
    if(!realPlay){ solvedAudio.pause(); solvedAudio.currentTime = 0; solvedAudio.muted = false; }
    if(ok){
      soundUnlocked = true;
      UNLOCK_EVENTS.forEach(t=>document.removeEventListener(t, unlockSolvedSound, true));
    }
  };
  try {
    const p = solvedAudio.play();
    if(p && p.then) p.then(()=>done(true), ()=>done(false)); else done(true);
  } catch(e){ done(false); }
}

function playSolvedSound(){
  if(!solvedAudio) return;
  realPlay = true;
  try {
    solvedAudio.muted = false;
    solvedAudio.currentTime = 0;
    const p = solvedAudio.play();
    if(p && p.catch) p.catch(()=>{});     // (blocked by the browser: just no sound)
  } catch(e){}
}

/* ═══════════════════════════════════════════════════════════════════
   THE WIN ANIMATION (the puzzle page's Solved popup; redone 2026-11-05)
   Plays along with the jingle (notes at 0.11, 0.51, 0.70, 0.88, 1.08,
   1.25 s, the big last note at 1.46 s). User's spec, 2026-11-05:
     • a small picture of the board you just solved, pieces in place,
       centred in the popup (the counts hang off to the right and below);
     • green bands, exactly the size of the grid (nothing past its edge),
       count it in turns: top row, left column, second row, second column
       and so on; each line's (even) count pops in beside it;
     • once every line is drawn, the whole board is green, no gaps
       (hiding the pieces: a screenshot of the popup to share a time
       mustn't give away the solution);
     • a very subtle squash-and-bounce, then on the big note, with a pop,
       the numbers vanish and a white check mark is there;
     • the level ("Medium", in its color) above "Solved!", then your time,
       counting up.
   Without sound it runs a little quicker. With "reduce motion" set on the
   device, it simply shows finished (green board + check, no numbers).
   [BEHAVIOR] the timings (seconds) are below.
═══════════════════════════════════════════════════════════════════ */
const WIN_LINES_FROM = 0.11;   // the first line starts (first note)
const WIN_LINES_TO   = 1.0;    // the last line starts
const WIN_SWEEP      = 0.18;   // how long one line's band takes to draw
const WIN_GREEN      = 1.2;    // the whole board turns green (0.14 s fade)
const WIN_SQUASH     = 1.3;    // the squash-and-bounce (until the big note)
const WIN_BIG        = 1.46;   // the big note: numbers pop away, check mark pops in
const WIN_QUICK      = 0.75;   // timings × this without sound
const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/* opts: { puzzle (rows, cols, blocked, hintOutline, removed), pieces
   [{cells, color, row, col}], time 'm:ss', sound, level ('easy' |
   'medium' | 'hard', optional) } → the element, already animating (put it
   on the page straight away) */
function solvedCelebration(opts){
  const p = opts.puzzle, pieces = opts.pieces;
  const k = opts.sound ? 1 : WIN_QUICK, ms = t=>t * k * 1000;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = (el, frames, o)=>(!reduced && el && el.animate) ? el.animate(frames, Object.assign({ fill:'backwards' }, o)) : null;

  const el = document.createElement('div');
  el.className = 'win-show';
  el.setAttribute('role', 'status');
  const levelName = LEVEL_NAMES[opts.level] || '';
  el.setAttribute('aria-label', (levelName ? levelName + ' ' : '') + 'Solved! Your time: ' + opts.time);

  // The board picture, about 200px across, with the counts to its right
  // and below (miniBoard 'solved': counts only, all green)
  const most = Math.max(p.rows, p.cols);
  const cell = Math.max(12, Math.floor((200 - 6 - (most - 1)*2) / most));
  const stage = document.createElement('div');
  stage.className = 'win-stage';
  const board = miniBoard({ rows:p.rows, cols:p.cols, cell, gaps:p.blocked || [], dotted:p.hintOutline || null,
                            removed:p.removed || [], pieces, show:'solved' });
  board.classList.add('win-board');
  stage.appendChild(board);
  el.appendChild(stage);
  // Centre the BOARD, not the picture: the counts only take room on the
  // right and below, so the same room is added on the left and above
  const { w, h } = board.boardSize;
  const MARGIN = 8;                                           // (miniBoard's margin round the board)
  const extraW = +board.getAttribute('width') - w - 2*MARGIN, extraH = +board.getAttribute('height') - h - 2*MARGIN;
  stage.style.marginLeft = extraW + 'px';
  stage.style.marginTop = (6 + extraH) + 'px';

  // The squares' area (gaps between them included), so the bands and the
  // green never go past the grid; on a board with cut squares, only the
  // squares that exist
  const inner = board.firstChild;
  const pad = 6, gap = 3, step = cell + gap;                  // (miniBoard's frame and gap)
  const gridW = p.cols*cell + (p.cols - 1)*gap, gridH = p.rows*cell + (p.rows - 1)*gap;
  const removed = new Set((p.removed || []).map(([r,c])=>r + ',' + c));
  const present = [];
  for(let r=0; r<p.rows; r++) for(let c=0; c<p.cols; c++) if(!removed.has(r + ',' + c)) present.push([r,c]);
  const clipId = 'win-clip-' + Math.random().toString(36).slice(2, 8);
  const clip = svgEl('clipPath', { id: clipId }, svgEl('defs', {}, inner));
  svgEl('path', { d: buildFillPath(present, cell, gap), transform:`translate(${pad},${pad})` }, clip);
  const bands = svgEl('g', { 'clip-path': `url(#${clipId})` }, inner);

  // The lines, in turns: row 1, column 1, row 2, column 2, ... (whichever
  // runs out first, the rest of the other follow)
  const order = [];
  for(let i = 0; i < Math.max(p.rows, p.cols); i++){
    if(i < p.rows) order.push({ isRow: true, i });
    if(i < p.cols) order.push({ isRow: false, i });
  }
  const lines = order.map(({ isRow, i })=>({
    isRow,
    band: svgEl('rect', isRow ? { x: pad, y: pad + i*step, width: gridW, height: cell, class:'win-band' }
                              : { x: pad + i*step, y: pad, width: cell, height: gridH, class:'win-band' }, bands),
    count: inner.querySelector('.rb-count[data-' + (isRow ? 'row' : 'col') + '="' + i + '"]'),
  }));

  // The whole board green (the squares' area plus the frame, in the
  // board's own shape), then the check mark on it
  const cover = inner.querySelector('.rb-frame').cloneNode();
  cover.removeAttribute('style');
  cover.setAttribute('class', 'win-cover');
  inner.appendChild(cover);
  const f = Math.min(w, h) / 46;
  const pt = (x, y)=>(w/2 + x*f) + ' ' + (h/2 + y*f);
  const check = svgEl('path', { d:`M${pt(-11, 1)} L${pt(-3.5, 8.5)} L${pt(11.5, -7.5)}`, pathLength: 1,
                                class:'win-check-big', 'stroke-width': 4*f }, inner);
  check.style.transformBox = 'fill-box';
  check.style.transformOrigin = 'center';

  // "Medium" (in Medium's color) above "Solved!"
  const level = document.createElement('span');
  level.className = 'win-level' + (opts.level ? ' ' + opts.level : '');
  level.textContent = levelName;
  const title = document.createElement('strong');
  title.className = 'win-title';
  title.textContent = 'Solved!';
  const time = document.createElement('p');
  time.className = 'win-time';
  time.innerHTML = 'Your time: <b></b>';
  time.querySelector('b').textContent = opts.time;
  if(levelName) el.appendChild(level);
  el.appendChild(title);
  el.appendChild(time);
  if(opts.sound) playSolvedSound();
  const counts = [...inner.querySelectorAll('.rb-count')];
  // Finished state (what stays): green board, check mark, no numbers
  const finish = ()=>{ counts.forEach(c=>{ c.style.opacity = '0'; }); bands.style.opacity = '0'; };
  if(reduced){ finish(); return el; }

  // 1. The lines, spread evenly; each count pops in as its band arrives
  const sweep = ms(WIN_SWEEP);
  lines.forEach((ln, n)=>{
    const start = ms(WIN_LINES_FROM + n * (WIN_LINES_TO - WIN_LINES_FROM) / Math.max(1, lines.length - 1));
    ln.band.style.transformBox = 'fill-box';
    ln.band.style.transformOrigin = ln.isRow ? 'left center' : 'center top';
    anim(ln.band, [ { transform: ln.isRow ? 'scaleX(0)' : 'scaleY(0)' }, { transform:'none' } ],
      { duration: sweep, delay: start, easing:'ease-out' });
    if(ln.count){
      ln.count.style.transformBox = 'fill-box';
      ln.count.style.transformOrigin = 'center';
      anim(ln.count, [ { opacity: 0, transform:'scale(0.4)' }, { opacity: 1, transform:'scale(1.3)', offset: 0.6 }, { opacity: 1, transform:'none' } ],
        { duration: 240, delay: start + sweep * 0.7, easing:'ease-out' });
    }
  });

  // 2. Every line drawn: the whole board turns green, no gaps
  anim(cover, [ { opacity: 0 }, { opacity: 1 } ], { duration: 140, delay: ms(WIN_GREEN), easing:'ease-out' });

  // 3. A very subtle squash and bounce, ending on the big note
  const squash = ms(WIN_SQUASH), big = ms(WIN_BIG);
  const boardOnly = svgEl('g', {}, inner);                    // (the board + green + check squash; the numbers don't)
  [...inner.childNodes].filter(n=>n !== boardOnly && !(n.classList && n.classList.contains('rb-count')) && n.tagName !== 'defs')
    .forEach(n=>boardOnly.appendChild(n));
  boardOnly.style.transformBox = 'fill-box';
  boardOnly.style.transformOrigin = 'center bottom';
  anim(boardOnly, [ { transform:'none' }, { transform:'scale(1.035, 0.965)', offset: 0.45 },
                    { transform:'scale(0.985, 1.02)', offset: 0.8 }, { transform:'none' } ],
    { duration: big - squash + 90, delay: squash, easing:'ease-in-out', fill:'none' });

  // 4. The big note: pop! the numbers vanish and the check mark is there
  counts.forEach(c=>anim(c, [ { opacity: 1, transform:'none' }, { opacity: 0, transform:'scale(0.2)' } ],
    { duration: 120, delay: big, easing:'ease-in', fill:'forwards' }));
  anim(check, [ { strokeDashoffset: 0, opacity: 0, transform:'scale(0.3)' }, { opacity: 1, transform:'scale(1.18)', offset: 0.6 },
                { strokeDashoffset: 0, opacity: 1, transform:'none' } ],
    { duration: 220, delay: big, easing:'cubic-bezier(.3,1.5,.5,1)', fill:'both' });
  check.style.strokeDashoffset = '0';
  setTimeout(finish, big + 140);
  board.style.setProperty('--glow-delay', big + 'ms');
  board.classList.add('glow');

  // 5. The level, "Solved!" and the time; the time counts up
  anim(level, [ { opacity: 0, transform:'translateY(8px) scale(0.9)' }, { opacity: 1, transform:'none' } ],
    { duration: 380, delay: big + 40, easing:'cubic-bezier(.3,1.4,.5,1)' });
  anim(title, [ { opacity: 0, transform:'translateY(8px) scale(0.9)' }, { opacity: 1, transform:'none' } ],
    { duration: 380, delay: big + 90, easing:'cubic-bezier(.3,1.4,.5,1)' });
  anim(time, [ { opacity: 0, transform:'translateY(6px)' }, { opacity: 1, transform:'none' } ],
    { duration: 380, delay: big + 220, easing:'ease-out' });
  countUp(time.querySelector('b'), opts.time, big + 220, 650);
  return el;
}

// Count "0:00" up to the final time
function countUp(el, finalText, delay, duration){
  const [m, s] = finalText.split(':').map(Number);
  const total = (m || 0) * 60 + (s || 0);
  if(!total) return;
  const fmt = t => Math.floor(t/60) + ':' + String(t%60).padStart(2, '0');
  el.textContent = fmt(0);
  const start = performance.now() + delay;
  const tick = now=>{
    const f = Math.min(1, Math.max(0, (now - start) / duration));
    el.textContent = fmt(Math.round(total * (1 - Math.pow(1 - f, 3))));   // (slows as it nears the end)
    if(f < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* Make a badge. opts:
     animate  draw the checkmark (a little quicker without sound)
     sound    play the jingle, with the animation timed to it
     stack    icon on top, centred (the Solved popup); otherwise side by side
     plain    no box around it (when it already sits inside one) */
function solvedBadge(title, text, opts){
  opts = opts || {};
  const el = document.createElement('div');
  el.className = 'win-badge' + (opts.animate ? ' animate' : '') + (opts.animate && !opts.sound ? ' quick' : '')
    + (opts.stack ? ' stack' : '') + (opts.plain ? ' plain' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <svg class="win-icon" viewBox="0 0 52 52" aria-hidden="true">
      <circle class="win-circle" cx="26" cy="26" r="24"/>
      <path class="win-check" d="M15 27 L22.5 34.5 L37.5 18.5"/>
    </svg>
    <div class="win-text"><strong></strong><span></span></div>`;
  el.querySelector('strong').textContent = title;
  el.querySelector('span').innerHTML = text || '';
  if(!text) el.querySelector('span').remove();
  if(opts.animate && opts.sound) playSolvedSound();
  return el;
}
