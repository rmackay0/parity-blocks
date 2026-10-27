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
  goal1: 'Fit all of the pieces onto the grid.',
  goal2: 'Make sure that every row and every column has an even number of blocks in it.',
  checkRows: 'Check rows',
  checkCols: 'Check columns',
  allEven: 'All even: solved!',
  rulesHeading: 'Rules',
  reflect: TOUCH ? 'Pieces can be reflected: tap one twice.' : 'Pieces can be reflected: double-click one.',
  rotate: TOUCH ? 'Pieces can be rotated: tap one.' : 'Pieces can be rotated: click one.',
  gap: 'You can’t place a piece on a dotted square.',
  dotted: 'You can’t place a piece across a dotted perimeter.',
  ok: 'Got it',
  tutorial: 'Play the tutorial',
};

// [BEHAVIOR] Remembers that this visitor has seen the rules, so the popup
// only opens by itself once. Clear this key (or rename it) to show it to
// everyone again, e.g. after changing the rules.
const SEEN_KEY = 'pb_rulesSeen';

/* ── Example boards (6x6). Each piece: color, cells, top-left row/col ── */
const EX_P = { color:'#b8923f', cells:[[0,0],[0,1],[1,0],[1,1],[2,0]] };
const EX_U = { color:'#a85c4a', cells:[[0,0],[0,2],[1,0],[1,1],[1,2]] };
const EX_T = { color:'#5a7d8c', cells:[[0,0],[0,1],[0,2],[1,1],[2,1]] };
const EX_V = { color:'#8a9c5a', cells:[[0,0],[0,1],[0,2],[1,0],[2,0]] };
const EXAMPLE = {
  // Every row and column has an even number of filled blocks
  solved: [ {...EX_P, row:0, col:4}, {...EX_U, row:4, col:0}, {...EX_T, row:3, col:2}, {...EX_V, row:2, col:1} ],
  // Same pieces, V moved up-left one square: rows 2 & 5 and columns 1 & 4 go odd
  wrong:  [ {...EX_P, row:0, col:4}, {...EX_U, row:4, col:0}, {...EX_T, row:3, col:2}, {...EX_V, row:1, col:0} ],
};
const F_PIECE = { color:'#7d6aa8', cells:[[0,1],[0,2],[1,0],[1,1],[2,1]] };

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
    p.appendChild(document.createTextNode(text));
    div.appendChild(p);
  });
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

  // Top-left: switch between large and standard text (shared with the tutorial)
  const sizeBtn = document.createElement('button');
  sizeBtn.type = 'button';
  sizeBtn.className = 'text-size-btn';
  sizeBtn.addEventListener('click', ()=>setLargeText(!isLargeText()));
  popup.appendChild(sizeBtn);

  const h2 = document.createElement('h2');
  h2.id = 'rules-title';
  h2.textContent = T.title;
  popup.appendChild(h2);

  // Goals
  const goals = document.createElement('h3');
  goals.textContent = T.goalsHeading;
  popup.appendChild(goals);
  item(popup, [[T.goal1, null, '1.']], [
    figure(miniBoard({ rows:6, cols:6, cell:24, pieces:EXAMPLE.solved })),
  ]);
  item(popup, [[T.goal2, null, '2.']], [
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.wrong,  show:'rows'   }), T.checkRows),
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.wrong,  show:'cols'   }), T.checkCols),
    figure(miniBoard({ rows:6, cols:6, cell:17, pieces:EXAMPLE.solved, show:'solved' }), T.allEven),
  ], 'three');

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
  item(popup, [[T.gap]], [
    figure(miniBoard({ rows:1, cols:1, cell:44, gaps:[[0,0]] })),
  ]);
  // Half inside the dotted square, half outside
  const crossing = { color:'#5f9e8f', cells:[[0,0],[0,1],[0,2],[1,1]], row:2, col:1 };
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

  // Clicking the dimmed area outside the popup closes it
  backdrop.addEventListener('click', e=>{ if(e.target === backdrop) closeRules(); });
  document.body.appendChild(backdrop);
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
