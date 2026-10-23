/* ═══════════════════════════════════════════════════════════════════
   PARITY BLOCKS: THE SOLVED BADGE
   ═══════════════════════════════════════════════════════════════════
   Every success message (the puzzle page's Solved popup and badge, and
   the tutorial's) is one of these: a green circle with a checkmark,
   then a title and a line of text, all in one box.

   With animate + sound (the puzzle page), it plays the jingle
   (assets/solved.mp3) and moves along with it:
     0.16 s  first note: the green circle pops in
     0.2–0.95 s  the first three notes: the checkmark draws itself
     1.3 s   the checkmark shrinks, as if pressed...
     1.62 s  the big last note: it pops back out, and the text appears
   With animate alone (the tutorial: no sound), the same animation runs
   a little quicker. (The timings live in game.css, "Solved badge".)

   Loaded by play.html and tutorial.html (styles in game.css). A page
   that wants the jingle calls enableSolvedSound() once at the start.
   ═══════════════════════════════════════════════════════════════════ */
const SOLVED_SOUND = 'assets/solved.mp3';
let solvedAudio = null;

function enableSolvedSound(){
  try { solvedAudio = new Audio(SOLVED_SOUND); solvedAudio.preload = 'auto'; } catch(e){ return; }
  document.addEventListener('pointerdown', unlockSolvedSound, true);
}
// iPhones only let a page play sound it has already started during a tap.
// So on the first tap or click, play the jingle silently for a moment;
// after that it can play by itself.
function unlockSolvedSound(){
  document.removeEventListener('pointerdown', unlockSolvedSound, true);
  if(!solvedAudio) return;
  solvedAudio.muted = true;
  const p = solvedAudio.play();
  const reset = ()=>{ solvedAudio.pause(); solvedAudio.currentTime = 0; solvedAudio.muted = false; };
  if(p && p.then) p.then(reset, ()=>{ solvedAudio.muted = false; }); else reset();
}

function playSolvedSound(){
  if(!solvedAudio) return;
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
