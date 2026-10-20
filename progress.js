/* ═══════════════════════════════════════════════════════════════════════
   PARITY BLOCKS: A PLAYER'S PROGRESS
   Kept only in this browser (localStorage). Nothing is sent anywhere.
   Used by play.html (saves the board, records solves) and index.html
   (the Archive calendar).

   'pb_progress'   unfinished boards, one per puzzle:
                   { "<puzzle key>": { placed:[{name,cells,row,col}],
                                       tray:{name:cells}, elapsedMs, savedAt } }
                   The key for Easy/Medium/Hard includes when that puzzle
                   was published, so a newly published puzzle starts fresh.
   'pb_completed'  every solve of an Easy / Medium / Hard puzzle:
                   [{ date:'YYYY-MM-DD' (the player's own day), level,
                      title, timeMs, at }]
═══════════════════════════════════════════════════════════════════════ */
const PROGRESS_KEY = 'pb_progress';
const COMPLETED_KEY = 'pb_completed';

function readJSON(key, fallback){
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch(e){ return fallback; }
}
function writeJSON(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){} }

// The day as the player sees it, e.g. '2026-10-20' (not UTC)
function localDay(d){
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ── Unfinished boards ── */
function loadSavedBoard(key){ return readJSON(PROGRESS_KEY, {})[key] || null; }
function saveBoardState(key, state){
  const all = readJSON(PROGRESS_KEY, {});
  // An older Easy/Medium/Hard puzzle's board can go: only the current one matters
  const level = key.split(':')[0] === 'level' ? key.split(':')[1] : null;
  if(level) Object.keys(all).forEach(k=>{ if(k !== key && k.startsWith('level:' + level + ':')) delete all[k]; });
  all[key] = state;
  writeJSON(PROGRESS_KEY, all);
}
function clearSavedBoard(key){
  const all = readJSON(PROGRESS_KEY, {});
  if(key in all){ delete all[key]; writeJSON(PROGRESS_KEY, all); }
}

/* ── Solves ── */
function recordSolve(level, title, timeMs){
  const list = readJSON(COMPLETED_KEY, []);
  list.push({ date: localDay(), level, title, timeMs, at: new Date().toISOString() });
  writeJSON(COMPLETED_KEY, list);
}
function loadSolves(){ return readJSON(COMPLETED_KEY, []); }
