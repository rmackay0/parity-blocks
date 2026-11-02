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
   THE WIN ANIMATION (the puzzle page's Solved popup, 2026-11-02)
   The user wanted the winning moment in the popup, not on the board. It
   plays along with the jingle, whose notes fall at 0.11, 0.51, 0.70,
   0.88, 1.08, 1.25 s and the big last note at 1.46 s:
     • a small picture of the board you just solved, empty at first;
     • your pieces drop onto it one by one, one per note (a puzzle
       usually has six pieces: one for each note before the big one);
     • on the big note the board pops and glows green, a check seal stamps
       onto its corner, and little blocks in your pieces' colors burst
       out of it;
     • "Solved!" and your time come in, the time counting up.
   Without sound it runs a little quicker. With "reduce motion" set on the
   device, everything simply shows, finished.
   [BEHAVIOR] WIN_NOTES / WIN_BIG are the jingle's notes (seconds);
   WIN_CONFETTI how many little blocks burst out.
═══════════════════════════════════════════════════════════════════ */
const WIN_NOTES = [0.11, 0.51, 0.70, 0.88, 1.08, 1.25];
const WIN_BIG = 1.46;
const WIN_CONFETTI = 28;
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

  // The board picture, about 200px across
  const most = Math.max(p.rows, p.cols);
  const cell = Math.max(12, Math.floor((200 - 6 - (most - 1)*2) / most));
  const stage = document.createElement('div');
  stage.className = 'win-stage';
  const board = miniBoard({ rows:p.rows, cols:p.cols, cell, gaps:p.blocked || [], dotted:p.hintOutline || null,
                            removed:p.removed || [], pieces });
  board.classList.add('win-board');
  stage.appendChild(board);
  // The check seal on the board's top-right corner
  stage.insertAdjacentHTML('beforeend', `
    <svg class="win-seal" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="24"/><path d="M15 27 L22.5 34.5 L37.5 18.5"/>
    </svg>`);
  const confetti = document.createElement('div');
  confetti.className = 'win-confetti';
  stage.appendChild(confetti);
  el.appendChild(stage);

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
  if(reduced) return el;

  // 1. The pieces drop in, one per note
  const groups = [...board.querySelectorAll('.mb-piece')];
  const n = groups.length;
  const at = i => n <= WIN_NOTES.length
    ? WIN_NOTES[n === 1 ? WIN_NOTES.length - 1 : Math.round(i * (WIN_NOTES.length - 1) / (n - 1))]
    : WIN_NOTES[0] + i * (WIN_NOTES[WIN_NOTES.length - 1] - WIN_NOTES[0]) / (n - 1);
  groups.forEach((g, i)=>{
    g.style.transformBox = 'fill-box';
    g.style.transformOrigin = 'center';
    anim(g, [
      { transform:`translateY(${-cell*1.6}px) scale(1.1)`, opacity: 0 },
      { transform:'translateY(0) scale(0.94, 1.04)', opacity: 1, offset: 0.6 },
      { transform:'scale(1.03, 0.97)', offset: 0.8 },
      { transform:'none', opacity: 1 },
    ], { duration: 260 * Math.max(k, 0.85), delay: at(i) * k * 1000, easing:'cubic-bezier(.3,.7,.4,1)' });
  });

  // 2. The big note: the board pops and glows, the seal stamps on, blocks burst out
  const big = WIN_BIG * k * 1000;
  anim(board, [ { transform:'scale(1)' }, { transform:'scale(1.07)', offset: 0.35 }, { transform:'scale(1)' } ],
    { duration: 420, delay: big, easing:'ease-out', fill:'none' });
  board.style.setProperty('--glow-delay', big + 'ms');
  board.classList.add('glow');
  anim(stage.querySelector('.win-seal'), [
    { transform:'scale(0) rotate(-30deg)', opacity: 0 },
    { transform:'scale(1.25) rotate(6deg)', opacity: 1, offset: 0.6 },
    { transform:'none', opacity: 1 },
  ], { duration: 380, delay: big, easing:'cubic-bezier(.3,1.4,.5,1)' });
  anim(stage.querySelector('.win-seal path'), [ { strokeDashoffset: 34 }, { strokeDashoffset: 0 } ],
    { duration: 300, delay: big + 150, easing:'ease-out', fill:'both' });
  burst(confetti, pieces.map(q=>q.color), big);

  // 3. "Solved!" and the time; the time counts up
  anim(title, [ { opacity: 0, transform:'translateY(8px) scale(0.9)' }, { opacity: 1, transform:'none' } ],
    { duration: 380, delay: big + 60, easing:'cubic-bezier(.3,1.4,.5,1)' });
  anim(time, [ { opacity: 0, transform:'translateY(6px)' }, { opacity: 1, transform:'none' } ],
    { duration: 380, delay: big + 200, easing:'ease-out' });
  countUp(time.querySelector('b'), opts.time, big + 200, 650);
  return el;
}

// Little blocks bursting out of the board's middle, then falling
function burst(layer, colors, delay){
  for(let i = 0; i < WIN_CONFETTI; i++){
    const b = document.createElement('i');
    const size = 6 + Math.random() * 6;
    b.style.width = b.style.height = size + 'px';
    b.style.background = colors[i % colors.length];
    layer.appendChild(b);
    const angle = -Math.PI/2 + (Math.random() - 0.5) * Math.PI * 1.3;     // mostly upward
    const dist = 80 + Math.random() * 90;
    const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
    const spin = (Math.random() - 0.5) * 540;
    b.animate([
      { transform:'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1 },
      { transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${spin/2}deg)`, opacity: 1, offset: 0.45 },
      { transform:`translate(calc(-50% + ${dx*1.25}px), calc(-50% + ${dy + 150}px)) scale(0.8) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 500, delay: delay + Math.random() * 60, easing:'cubic-bezier(.15,.7,.4,1)', fill:'both' });
  }
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
