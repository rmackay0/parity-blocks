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
