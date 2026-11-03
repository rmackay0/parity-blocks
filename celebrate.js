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
   THE WIN ANIMATION (the puzzle page's Solved popup; redone 2026-11-03)
   The user wanted the winning moment in the popup, not on the board. It
   plays along with the jingle, whose notes fall at 0.11, 0.51, 0.70,
   0.88, 1.08, 1.25 s and the big last note at 1.46 s:
     • a small picture of the board you just solved, pieces in place;
     • from the first note to the last small one, a green highlighter
       sweeps along each row in turn, top to bottom, and its (even) count
       appears beside it; then the same for each column, left to right;
     • on the big note the whole board turns green, hiding the pieces,
       and a white check mark draws itself across it. (User: a screenshot
       of the popup, e.g. to share a time, mustn't give away the solution.)
     • "Solved!" and your time come in, the time counting up.
   Without sound it runs a little quicker. With "reduce motion" set on the
   device, everything simply shows, finished (green board + check).
   [BEHAVIOR] WIN_NOTES / WIN_BIG are the jingle's notes (seconds);
   WIN_SWEEP how long one row's or column's highlighter takes.
═══════════════════════════════════════════════════════════════════ */
const WIN_NOTES = [0.11, 0.51, 0.70, 0.88, 1.08, 1.25];
const WIN_BIG = 1.46;
const WIN_SWEEP = 0.2;
const WIN_QUICK = 0.75;      // timings × this without sound

/* opts: { puzzle (rows, cols, blocked, hintOutline, removed), pieces
   [{cells, color, row, col}], time 'm:ss', sound } → the element, already
   animating (put it on the page straight away) */
function solvedCelebration(opts){
  const p = opts.puzzle, pieces = opts.pieces;
  const k = opts.sound ? 1 : WIN_QUICK;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = (el, frames, o)=>(!reduced && el && el.animate) ? el.animate(frames, Object.assign({ fill:'backwards' }, o)) : null;

  const el = document.createElement('div');
  el.className = 'win-show';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Solved! Your time: ' + opts.time);

  // The board picture, about 200px across, with a highlighter on every
  // row and column and the counts beside it (miniBoard 'count')
  const most = Math.max(p.rows, p.cols);
  const cell = Math.max(12, Math.floor((200 - 6 - (most - 1)*2) / most));
  const stage = document.createElement('div');
  stage.className = 'win-stage';
  const board = miniBoard({ rows:p.rows, cols:p.cols, cell, gaps:p.blocked || [], dotted:p.hintOutline || null,
                            removed:p.removed || [], pieces, show:'count' });
  board.classList.add('win-board');
  stage.appendChild(board);
  el.appendChild(stage);

  // The green cover: a copy of the board's frame (so it has the board's
  // shape, cut corners and all), on top of everything
  const inner = board.firstChild;
  const cover = inner.querySelector('.rb-frame').cloneNode();
  cover.removeAttribute('style');
  cover.setAttribute('class', 'win-cover');
  inner.appendChild(cover);
  // The check mark across its middle
  const { w, h } = board.boardSize;
  const f = Math.min(w, h) / 46;
  const pt = (x, y)=>(w/2 + x*f) + ' ' + (h/2 + y*f);
  const check = svgEl('path', { d:`M${pt(-11, 1)} L${pt(-3.5, 8.5)} L${pt(11.5, -7.5)}`, pathLength: 1,
                                class:'win-check-big', 'stroke-width': 4*f }, inner);

  const title = document.createElement('strong');
  title.className = 'win-title';
  title.textContent = 'Solved!';
  const time = document.createElement('p');
  time.className = 'win-time';
  time.innerHTML = 'Your time: <b></b>';
  time.querySelector('b').textContent = opts.time;
  el.appendChild(title);
  el.appendChild(time);
  if(opts.sound) playSolvedSound();
  const strokes = [...inner.querySelectorAll('.rb-hl')];
  if(reduced){ strokes.forEach(s=>s.remove()); return el; }

  // 1. The count: rows top to bottom, then columns left to right, spread
  // evenly from the first note to the last small one
  const marks = strokes.map(s=>{
    const isRow = s.hasAttribute('data-row');
    const key = isRow ? '[data-row="' + s.dataset.row + '"]' : '[data-col="' + s.dataset.col + '"]';
    return { stroke: s, isRow, count: inner.querySelector('.rb-count' + key) };
  });
  const first = WIN_NOTES[0], last = WIN_NOTES[WIN_NOTES.length - 1];
  const sweep = WIN_SWEEP * k * 1000;
  marks.forEach((mk, i)=>{
    const start = (first + i * (last - first) / Math.max(1, marks.length - 1)) * k * 1000;
    mk.stroke.style.transformBox = 'fill-box';
    mk.stroke.style.transformOrigin = mk.isRow ? 'left center' : 'center top';
    anim(mk.stroke, [ { transform: mk.isRow ? 'scaleX(0)' : 'scaleY(0)' }, { transform:'none' } ],
      { duration: sweep, delay: start, easing:'ease-out' });
    if(mk.count){
      mk.count.style.transformBox = 'fill-box';
      mk.count.style.transformOrigin = 'center';
      anim(mk.count, [ { opacity: 0, transform:'scale(0.4)' }, { opacity: 1, transform:'scale(1.3)', offset: 0.6 }, { opacity: 1, transform:'none' } ],
        { duration: 240, delay: start + sweep * 0.7, easing:'ease-out' });
    }
  });

  // 2. The big note: the board pops and turns green (the highlighter
  // fades: its ends stick out past the board), and the check draws itself
  const big = WIN_BIG * k * 1000;
  anim(board, [ { transform:'scale(1)' }, { transform:'scale(1.06)', offset: 0.35 }, { transform:'scale(1)' } ],
    { duration: 420, delay: big, easing:'ease-out', fill:'none' });
  board.style.setProperty('--glow-delay', big + 'ms');
  board.classList.add('glow');
  anim(cover, [ { opacity: 0 }, { opacity: 1 } ], { duration: 220, delay: big, easing:'ease-out' });
  strokes.forEach(s=>anim(s, [ { opacity: 0 } ], { duration: 220, delay: big, easing:'ease-out', fill:'forwards' }));
  anim(check, [ { strokeDashoffset: 1 }, { strokeDashoffset: 0 } ],
    { duration: 360, delay: big + 120, easing:'ease-out', fill:'both' });

  // 3. "Solved!" and the time; the time counts up
  anim(title, [ { opacity: 0, transform:'translateY(8px) scale(0.9)' }, { opacity: 1, transform:'none' } ],
    { duration: 380, delay: big + 60, easing:'cubic-bezier(.3,1.4,.5,1)' });
  anim(time, [ { opacity: 0, transform:'translateY(6px)' }, { opacity: 1, transform:'none' } ],
    { duration: 380, delay: big + 200, easing:'ease-out' });
  countUp(time.querySelector('b'), opts.time, big + 200, 650);
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
