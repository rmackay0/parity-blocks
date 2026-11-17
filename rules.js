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
  goal1: 'Fit the pieces onto the grid.',
  goal2Title: 'Solving for Parity',
  goal2: 'Every row and every column must contain an even number of blocks.',
  checkRows: 'Check rows',
  checkCols: 'Check columns',
  allEven: 'All even: solved!',
  rulesHeading: 'Rules',
  reflect: TOUCH ? 'Pieces can be reflected: tap one twice.' : 'Pieces can be reflected: double-click one.',
  rotate: TOUCH ? 'Pieces can be rotated: tap one.' : 'Pieces can be rotated: click one.',
  // (One dotted rule only since 2026-11-03: the "dotted square" rule is gone.
  // A puzzle's dotted squares are still kept clear by this one, since no
  // piece fits inside a line round one or two squares.)
  dotted: 'You can’t place a piece across a dotted line.',
  ok: 'Got it',
  tutorial: 'Play the tutorial',
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
    // clockwise arc with an arrowhead at its end
    svgEl('path', { d:'M12 30 A18 18 0 1 1 46 28', class:'rb-arrow' }, svg);
    svgEl('path', { d:'M38 24 L46 28 L49 19', class:'rb-arrow' }, svg);
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
  // 1 Tiling: the 12 pieces → a grid they've been fitted onto
  const arrow = document.createElement('span');
  arrow.className = 'rules-goal-arrow';
  arrow.textContent = '→';
  goalItem(popup, 1, T.goal1Title, T.goal1, [
    twelvePieces(phone ? 6 : 9), arrow,
    miniBoard({ rows:6, cols:6, cell: phone ? 11 : 16, pieces: termBoardPieces() }),
  ], 'tiling');
  // 2 Solving for Parity: the counts beside the rows, then the columns, then
  // all even (numbers only, no lines across the pieces: user 2026-11-15)
  goalItem(popup, 2, T.goal2Title, T.goal2, [
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.wrong,  show:'rows', noStrokes: true }), T.checkRows),
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.wrong,  show:'cols', noStrokes: true }), T.checkCols),
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.solved, show:'solved' }), T.allEven),
  ], 'three');
  // What a block and a piece are (the tutorial's pictures, without the
  // empty squares: user 2026-11-15)
  const terms = termPictures(phone ? 15 : 20, false, false);
  terms.classList.add('rules-terms');
  popup.appendChild(terms);

  // Rules
  const rules = document.createElement('h3');
  rules.textContent = T.rulesHeading;
  popup.appendChild(rules);
  item(popup, [[T.reflect]], [
    figure(pieceOnly(F_PIECE.cells, F_PIECE.color, 22)),
    figure(arrowSvg(false)),
    figure(pieceOnly(reflectCells(F_PIECE.cells), F_PIECE.color, 22)),
  ]);
  item(popup, [[T.rotate]], [
    figure(pieceOnly(F_PIECE.cells, F_PIECE.color, 22)),
    figure(arrowSvg(true)),
    figure(pieceOnly(rotateCells(F_PIECE.cells), F_PIECE.color, 22)),
  ]);
  // Half inside the dotted line, half outside
  // (the T pentomino, five blocks: it was a four-block T until 2026-11-16, user)
  const crossing = { color:PIECE_COLOR.T, cells:[[0,0],[0,1],[0,2],[1,1],[2,1]], row:2, col:1 };
  item(popup, [[T.dotted]], [
    figure(miniBoard({ rows:5, cols:5, cell:26, pieces:[crossing],
      dotted:[[1,1],[1,2],[2,1],[2,2]], noMarkOn: crossing })),
  ]);

  // On the puzzle page, offer the interactive tutorial (play.html defines window.openTutorial)
  if(typeof window.openTutorial === 'function'){
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
