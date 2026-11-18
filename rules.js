/* ═══════════════════════════════════════════════════════════════════
   RULES POPUP
   Shared by index.html and play.html. Needs shapes.js loaded first, and
   rules.css for its look.

   Opens:
     • automatically on the puzzle page, the first time a player reaches
       it (i.e. after picking a difficulty), if they've never seen the
       rules before. Only pages that load this script with
       data-auto-open do this; the splash screen doesn't. And
     • whenever anything with a data-open-rules attribute is clicked
       (the "Rules" buttons).

   [CONTENT] The wording is in RULES_TEXT just below. The example boards
   in the pictures are in EXAMPLE further down. They're a made-up board,
   deliberately NOT one of the real puzzles, so the pictures never give a
   solution away.
═══════════════════════════════════════════════════════════════════ */
(function(){

// "Tap" on touchscreens, "click" with a mouse (same check as the tutorial)
const TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

const RULES_TEXT = {
  title: 'How to Play',
  goalsHeading: 'Goals',
  // (2026-11-15: the same design as the tutorial's first slide, no
  // animation: each goal's name as a heading, one line under it. The
  // official terms are colored by markTerms, shapes.js)
  goal1Title: 'Tiling',
  // ("all of": user, 2026-11-17, after a tester's note; 2026-11-18, user: the
  // overlap and dotted-line rules are part of this goal now, and its picture
  // has a dotted line round U and Y; the separate dotted-line rule is gone)
  goal1: 'Fit all of the pieces onto the grid. Pieces cannot be placed on another piece or a dotted line.',
  goal2Title: 'Parity',            // (was "Solving for Parity" until 2026-11-16, user)
  goal2: 'Every row and every column must contain an even number of blocks.',
  // (2026-11-18: the line that leads into the block / piece pictures)
  parityLead: 'Parity counts blocks:',
  // (2026-11-18: the captions say which lines are odd: PARITY_EXAMPLE's
  // wrong board (shapes.js) has 5 in rows 3 and 4, 5 in column 5 and 3 in column 6)
  checkRows: 'Rows 3 and 4 are odd',
  checkCols: 'Columns 5 and 6 are odd',
  allEven: 'All even: parity!',
  // (2026-11-18, user: "Controls": place, rotate, reflect, then the highlighter)
  rulesHeading: 'Controls',
  place: 'To place a piece: drag it onto the grid.',
  rotate: TOUCH ? 'To rotate a piece: tap it.' : 'To rotate a piece: click it.',
  reflect: TOUCH ? 'To reflect a piece: tap it twice.' : 'To reflect a piece: double-click it.',
  highlight: TOUCH ? 'To mark a square: turn on the highlighter (✎), then tap the square.'
                   : 'To mark a square: turn on the highlighter (✎), then click the square.',
  ok: 'Got it',
  tutorial: 'Play the tutorial',
  // (2026-11-18, user: the rules open first now; this points to the tutorial)
  tutorialTip: 'For helpful tips on solving Medium and Hard puzzles, play the tutorial.',
};

// [BEHAVIOR] Remembers that this visitor has seen the rules, so the popup
// only opens by itself once. Clear this key (or rename it) to show it to
// everyone again, e.g. after changing the rules.
const SEEN_KEY = 'pb_rulesSeen';

/* ── Example boards (6x6). Each piece: color, cells, top-left row/col ── */
// (2026-11-14: the example now lives in shapes.js, PARITY_EXAMPLE, since
// the tutorial's first slide shows the same pictures)
const EXAMPLE = PARITY_EXAMPLE;
const F_PIECE = { color:PIECE_COLOR.F, cells:[[0,1],[0,2],[1,0],[1,1],[2,1]] };

/* Drawing helpers (svgEl, drawPiece, drawNoMark, miniBoard) are in shapes.js */

function pieceOnly(cells, color, cell){
  const gap = 3, b = bounds(cells);
  const w = b.cols*cell + (b.cols-1)*gap, h = b.rows*cell + (b.rows-1)*gap;
  const svg = svgEl('svg', { width:w+4, height:h+4, viewBox:`-2 -2 ${w+4} ${h+4}`, 'aria-hidden':'true' });
  drawPiece(svg, cells, color, 0, 0, cell, gap);
  return svg;
}

function arrowSvg(curved){
  const svg = svgEl('svg', { width:60, height:44, viewBox:'0 0 60 44', 'aria-hidden':'true' });
  if(curved){
    // clockwise, from lower left over the top to the far right, where it
    // heads straight down into a V tip: the straight arrow's tip turned down
    // (2026-11-18, the user's pick "F": the old tip looked bent)
    svgEl('path', { d:'M19.28 31 A14 14 0 1 1 44 22 L44 26', class:'rb-arrow' }, svg);
    svgEl('path', { d:'M51 19 L44 26 L37 19', class:'rb-arrow' }, svg);
  } else {
    svgEl('path', { d:'M8 22 H50 M41 13 L50 22 L41 31', class:'rb-arrow' }, svg);
  }
  return svg;
}

function figure(content, caption){
  const fig = document.createElement('figure');
  fig.className = 'rules-figure';
  fig.appendChild(content);
  if(caption){
    const fc = document.createElement('figcaption');
    fc.textContent = caption;
    fig.appendChild(fc);
  }
  return fig;
}

function item(parent, texts, visuals, rowClass){
  const div = document.createElement('div');
  div.className = 'rules-item';
  texts.forEach(([text, cls, num])=>{
    const p = document.createElement('p');
    if(cls) p.className = cls;
    if(num){ const s = document.createElement('span'); s.className = 'rules-num'; s.textContent = num; p.appendChild(s); }
    p.insertAdjacentHTML('beforeend', text);   // (RULES_TEXT is ours, and may hold <u>)
    div.appendChild(p);
  });
  const row = document.createElement('div');
  row.className = 'rules-visuals' + (rowClass ? ' ' + rowClass : '');
  visuals.forEach(v=>row.appendChild(v));
  div.appendChild(row);
  parent.appendChild(div);
}

// A goal: a numbered heading (its name), one line, then its pictures in a row
function goalItem(parent, n, title, text, visuals, rowClass){
  const div = document.createElement('div');
  div.className = 'rules-item rules-goal';
  div.innerHTML = `<h4 class="rules-goal-title"><span class="rules-gnum">${n}</span>${title}</h4><p>${text}</p>`;
  const row = document.createElement('div');
  row.className = 'rules-visuals' + (rowClass ? ' ' + rowClass : '');
  visuals.forEach(v=>row.appendChild(v));
  div.appendChild(row);
  parent.appendChild(div);
  return div;
}

/* ═══════════════════════════════════════════════════════════════════
   POPUP
═══════════════════════════════════════════════════════════════════ */
let backdrop = null, lastFocus = null;

function build(){
  const T = RULES_TEXT;
  backdrop = document.createElement('div');
  backdrop.className = 'rules-backdrop';
  backdrop.hidden = true;
  const popup = document.createElement('div');
  popup.className = 'rules-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-labelledby', 'rules-title');
  popup.tabIndex = -1;   // focused on open, so keyboard scrolling works
  backdrop.appendChild(popup);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'rules-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = '&times;';
  close.addEventListener('click', closeRules);
  popup.appendChild(close);

  // Top-left: the moon / sun (dark mode, theme.js) at the far left, then
  // large / standard text; both shared with the tutorial (user, 2026-11-05)
  const viewBtns = document.createElement('div');
  viewBtns.className = 'view-btns';
  if(window.ParityTheme) viewBtns.appendChild(ParityTheme.makeButton());
  const sizeBtn = document.createElement('button');
  sizeBtn.type = 'button';
  sizeBtn.className = 'text-size-btn';
  sizeBtn.addEventListener('click', ()=>setLargeText(!isLargeText()));
  viewBtns.appendChild(sizeBtn);
  popup.appendChild(viewBtns);

  const h2 = document.createElement('h2');
  h2.id = 'rules-title';
  h2.textContent = T.title;
  popup.appendChild(h2);

  // Goals
  const goals = document.createElement('h3');
  goals.textContent = T.goalsHeading;
  popup.appendChild(goals);
  const phone = window.matchMedia('(max-width: 600px)').matches;
  // 1 Tiling: the puzzle's pieces → the grid with ALL of them fitted on
  // (2026-11-17: was all 12 pentominoes, which suggested a choice)
  const arrow = document.createElement('span');
  arrow.className = 'rules-goal-arrow';
  arrow.textContent = '→';
  // (2026-11-18, user) a dotted line round U and Y on the tiled grid: the
  // pieces fit inside dotted lines, never across them
  const tiled = termBoardPieces();
  const dottedUY = tiled.filter(p=>p.name === 'U' || p.name === 'Y')
    .flatMap(p=>p.cells.map(([r, c])=>[p.row + r, p.col + c]));
  goalItem(popup, 1, T.goal1Title, T.goal1, [
    tilingPieces(phone ? 7 : 11), arrow,
    miniBoard({ rows:6, cols:6, cell: phone ? 11 : 16, pieces: tiled, dotted: dottedUY }),
  ], 'tiling');
  // 2 Parity: what a block and a piece are first (the tutorial's pictures,
  // without the empty squares), then the goal's line, then the counts
  // beside the rows, the columns, and all even (2026-11-18, user: this order)
  const goal2 = goalItem(popup, 2, T.goal2Title, T.goal2, [
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.wrong,  show:'rows', noStrokes: true }), T.checkRows),
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.wrong,  show:'cols', noStrokes: true }), T.checkCols),
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.solved, show:'solved' }), T.allEven),
  ], 'three');
  const terms = termPictures(phone ? 15 : 20, false, false);
  terms.classList.add('rules-terms');
  const lead = document.createElement('p');
  lead.className = 'rules-parity-lead';
  lead.textContent = T.parityLead;
  goal2.querySelector('.rules-goal-title').after(lead, terms);

  const rules = document.createElement('h3');
  rules.textContent = T.rulesHeading;
  popup.appendChild(rules);
  // (2026-11-18, user: place, rotate, reflect, then the highlighter (it was
  // a tip); the dotted-line picture that ended the rules is gone: goal 1
  // says it now)
  item(popup, [[T.place]], []);
  item(popup, [[T.rotate]], [
    figure(pieceOnly(F_PIECE.cells, F_PIECE.color, 22)),
    figure(arrowSvg(true)),
    figure(pieceOnly(rotateCells(F_PIECE.cells), F_PIECE.color, 22)),
  ]);
  item(popup, [[T.reflect]], [
    figure(pieceOnly(F_PIECE.cells, F_PIECE.color, 22)),
    figure(arrowSvg(false)),
    figure(pieceOnly(reflectCells(F_PIECE.cells), F_PIECE.color, 22)),
  ]);
  item(popup, [[T.highlight]], []);

  // On the puzzle page, offer the interactive tutorial (play.html defines window.openTutorial)
  if(typeof window.openTutorial === 'function'){
    const tip = document.createElement('p');
    tip.className = 'rules-tutorial-tip';
    tip.textContent = T.tutorialTip;
    popup.appendChild(tip);
    const tut = document.createElement('button');
    tut.type = 'button';
    tut.className = 'rules-ok rules-tutorial';
    tut.textContent = T.tutorial;
    tut.addEventListener('click', ()=>{ closeRules(); window.openTutorial(); });
    popup.appendChild(tut);
  }

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'rules-ok';
  ok.textContent = T.ok;
  ok.addEventListener('click', closeRules);
  popup.appendChild(ok);

  markTerms(popup);   // (the official terms in their own color)

  // Clicking the dimmed area outside the popup closes it
  backdrop.addEventListener('click', e=>{ if(e.target === backdrop) closeRules(); });
  document.body.appendChild(backdrop);
  // Phones: a ▾ while the rules go on below the screen (scroll-hint.js)
  if(window.attachScrollHint) attachScrollHint(popup);
}

/* ── Large text ── (same setting as the tutorial's button: 'pb_largeText') */
const LARGE_TEXT_KEY = 'pb_largeText';
function isLargeText(){ try { return localStorage.getItem(LARGE_TEXT_KEY) === '1'; } catch(e){ return false; } }
function setLargeText(on){
  try { localStorage.setItem(LARGE_TEXT_KEY, on ? '1' : '0'); } catch(e){}
  showLargeText();
}
function showLargeText(){
  const on = isLargeText();
  document.documentElement.classList.toggle('large-text', on);
  const btn = backdrop && backdrop.querySelector('.text-size-btn');
  if(btn){
    btn.textContent = on ? 'Standard text' : 'Large text';
    btn.classList.toggle('is-large-label', !on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function openRules(){
  if(!backdrop) build();
  showLargeText();          // pick up a change made in the tutorial
  if(window.ParityTheme) ParityTheme.apply();   // (labels the Dark mode button)
  lastFocus = document.activeElement;
  backdrop.hidden = false;
  const popup = backdrop.querySelector('.rules-popup');
  popup.scrollTop = 0;
  popup.focus({ preventScroll:true });
}

function closeRules(){
  if(!backdrop || backdrop.hidden) return;
  backdrop.hidden = true;
  try { localStorage.setItem(SEEN_KEY, '1'); } catch(e){}
  if(lastFocus && lastFocus.focus) lastFocus.focus();
}

document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && backdrop && !backdrop.hidden){ e.stopImmediatePropagation(); closeRules(); }
}, true);

document.addEventListener('click', e=>{
  const btn = e.target.closest && e.target.closest('[data-open-rules]');
  if(btn){ e.preventDefault(); openRules(); }
});

// First time ever: show the rules once, but only on a page that asks for it
// (<script src="rules.js" data-auto-open>, i.e. the puzzle page)
const autoOpen = document.currentScript && document.currentScript.hasAttribute('data-auto-open');
let seen = false;
try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch(e){}
if(autoOpen && !seen) openRules();

window.ParityRules = { open: openRules, close: closeRules };

})();
