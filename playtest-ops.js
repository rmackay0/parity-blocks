/* ═══════════════════════════════════════════════════════════════════════
   PLAYTEST OPS: the rules for changing playtest.json (2026-11-20)
   ═══════════════════════════════════════════════════════════════════════
   One file, used in two places so the rules can't drift apart:
     • in the browser (sandbox.html, playtest.html) when the OWNER changes
       things with their own GitHub token (window.PlaytestOps)
     • on the server (api/playtest.js, a Vercel function) when FRIENDS do
       (require('../playtest-ops.js'))

   playtest.json:
     { about,
       folders: [{ id, name }],                     'inbox' always exists
       puzzles: [{ id, title, uploadedAt, puzzle, folder, trashed }] }

   One Trash for every folder (user, 2026-11-20: each folder's Trash just
   leads to the main one): a puzzle with trashed: true. It keeps its
   folder, so putting it back returns it there. Nothing in the Trash is
   deleted; it can be moved back any time.

   Who can do what (user, 2026-11-20):
     anyone   upload (always as a NEW puzzle, so nothing gets overwritten),
              make a folder, rename a folder, move a puzzle to another
              folder, into the Trash or back out
     owner    all of that, plus: upload again over the same puzzle
              (replace), rename a puzzle, delete a puzzle for good, delete
              a folder (its puzzles go to the Inbox)

   apply(data, op, { owner }) → { data, message, result }
     op = { op: 'upload', id?, title, puzzle, folder? }
        | { op: 'newFolder', name }            result: { folder: id }
        | { op: 'renameFolder', folder, name }
        | { op: 'move', id, folder?, trashed? }
        | { op: 'renamePuzzle', id, title }    owner only
        | { op: 'deletePuzzle', id }           owner only
        | { op: 'deleteFolder', folder }       owner only
   A refused change throws an Error with .status (400, 403 or 404) and a
   sentence the page can show as it is.
   ═══════════════════════════════════════════════════════════════════════ */
(function(root){
'use strict';

const INBOX = 'inbox';
const ABOUT = 'Puzzles uploaded from the sandbox for playtesting (playtest.html).';
const LIMITS = { title: 80, folderName: 40, folders: 200, puzzles: 5000, size: 16, hintText: 300 };
const PIECE_NAMES = 'FILNPTUVWXYZ';

function refuse(status, message){ const e = new Error(message); e.status = status; return e; }
function newId(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Fill in what older files don't have (no folders before 2026-11-20)
function normalize(data){
  data = data && typeof data === 'object' ? data : {};
  data.about = data.about || ABOUT;
  data.folders = Array.isArray(data.folders) ? data.folders.filter(f=>f && f.id) : [];
  if(!data.folders.some(f=>f.id === INBOX)) data.folders.unshift({ id: INBOX, name: 'Inbox' });
  data.puzzles = Array.isArray(data.puzzles) ? data.puzzles.filter(p=>p && p.id && p.puzzle) : [];
  const ids = new Set(data.folders.map(f=>f.id));
  data.puzzles.forEach(p=>{ if(!ids.has(p.folder)) p.folder = INBOX; p.trashed = !!p.trashed; });
  return data;
}

/* ── Checking what comes in (anyone can send anything to the server, and
   the file is public, so only a clean copy of a real puzzle goes in) ── */
function cleanText(s, max, what){
  if(typeof s !== 'string') throw refuse(400, `The ${what} is missing.`);
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if(!s) throw refuse(400, `The ${what} is empty.`);
  return s.slice(0, max);
}
function cleanPuzzle(p){
  const bad = why=>refuse(400, 'That isn’t a puzzle the game can open (' + why + ').');
  if(!p || typeof p !== 'object') throw bad('no puzzle');
  const int = (v, lo, hi)=>Number.isInteger(v) && v >= lo && v <= hi;
  if(!int(p.rows, 1, LIMITS.size) || !int(p.cols, 1, LIMITS.size)) throw bad('size');
  const squares = (list, what)=>{
    if(list === undefined) return [];
    if(!Array.isArray(list) || list.length > p.rows*p.cols) throw bad(what);
    return list.map(rc=>{
      if(!Array.isArray(rc) || !int(rc[0], 0, p.rows - 1) || !int(rc[1], 0, p.cols - 1)) throw bad(what);
      return [rc[0], rc[1]];
    });
  };
  const lines = p.dottedLines === undefined ? [] : p.dottedLines;
  if(!Array.isArray(lines) || lines.length > 2*LIMITS.size*LIMITS.size || !lines.every(k=>typeof k === 'string' && /^[hv],\d{1,2},\d{1,2}$/.test(k))) throw bad('dotted lines');
  if(!Array.isArray(p.pieces) || !p.pieces.length || p.pieces.length > 12) throw bad('pieces');
  const seen = new Set();
  const pieces = p.pieces.map(d=>{
    if(!d || typeof d.name !== 'string' || d.name.length !== 1 || !PIECE_NAMES.includes(d.name) || seen.has(d.name)) throw bad('pieces');
    seen.add(d.name);
    if(!Array.isArray(d.cells) || d.cells.length !== 5 || !d.cells.every(c=>Array.isArray(c) && int(c[0], 0, 4) && int(c[1], 0, 4))) throw bad('piece ' + d.name);
    const out = { name: d.name, cells: d.cells.map(c=>[c[0], c[1]]) };
    if(typeof d.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(d.color)) out.color = d.color;
    return out;
  });
  return {
    title: typeof p.title === 'string' ? p.title.slice(0, LIMITS.title) : '',
    rows: p.rows, cols: p.cols,
    removed: squares(p.removed, 'cut squares'),
    blocked: squares(p.blocked, 'dotted squares'),
    hintOutline: squares(p.hintOutline, 'dotted loop'),
    dottedLines: lines.slice(),
    hintText: typeof p.hintText === 'string' ? p.hintText.slice(0, LIMITS.hintText) : '',
    pieces,
  };
}

function findPuzzle(data, id){
  const p = data.puzzles.find(e=>e.id === id);
  if(!p) throw refuse(404, 'That puzzle isn’t there any more. Refresh the page.');
  return p;
}
function findFolder(data, id){
  const f = data.folders.find(e=>e.id === id);
  if(!f) throw refuse(404, 'That folder isn’t there any more. Refresh the page.');
  return f;
}
function ownerOnly(owner, what){
  if(!owner) throw refuse(403, `Only the owner can ${what}.`);
}

function apply(data, op, opts){
  const owner = !!(opts && opts.owner);
  data = normalize(JSON.parse(JSON.stringify(data || {})));
  op = op || {};
  let message, result = {};
  switch(op.op){
    case 'upload': {
      const title = cleanText(op.title, LIMITS.title, 'puzzle’s name');
      const puzzle = cleanPuzzle(op.puzzle);
      puzzle.title = title;
      const folder = op.folder && data.folders.some(f=>f.id === op.folder) ? op.folder : null;
      const old = owner && typeof op.id === 'string' ? data.puzzles.find(e=>e.id === op.id) : null;
      // Friends always add a new puzzle; the owner's re-upload replaces (and
      // keeps its folder unless another is chosen)
      const id = owner && typeof op.id === 'string' && /^[\w:.-]{1,60}$/.test(op.id) ? op.id : newId('p');
      if(!old && data.puzzles.length >= LIMITS.puzzles) throw refuse(400, 'The playtest page is full.');
      const item = { id, title, uploadedAt: new Date().toISOString(), puzzle,
                     folder: folder || (old ? old.folder : INBOX), trashed: false };
      data.puzzles = [item].concat(data.puzzles.filter(e=>e.id !== id));
      message = 'Playtest: upload a puzzle';
      result = { id, folder: item.folder };
      break;
    }
    case 'newFolder': {
      if(data.folders.length >= LIMITS.folders) throw refuse(400, 'There are too many folders.');
      const f = { id: newId('f'), name: cleanText(op.name, LIMITS.folderName, 'folder name') };
      data.folders.push(f);
      message = 'Playtest: new folder';
      result = { folder: f.id };
      break;
    }
    case 'renameFolder': {
      findFolder(data, op.folder).name = cleanText(op.name, LIMITS.folderName, 'folder name');
      message = 'Playtest: rename a folder';
      break;
    }
    case 'move': {
      const p = findPuzzle(data, op.id);
      if(op.folder !== undefined) p.folder = findFolder(data, op.folder).id;
      if(op.trashed !== undefined) p.trashed = !!op.trashed;
      message = op.trashed === true ? 'Playtest: move a puzzle to the Trash' : 'Playtest: move a puzzle';
      break;
    }
    case 'renamePuzzle': {
      ownerOnly(owner, 'rename puzzles');
      const p = findPuzzle(data, op.id);
      p.title = p.puzzle.title = cleanText(op.title, LIMITS.title, 'puzzle’s name');
      message = 'Playtest: rename a puzzle';
      break;
    }
    case 'deletePuzzle': {
      ownerOnly(owner, 'delete puzzles');
      findPuzzle(data, op.id);
      data.puzzles = data.puzzles.filter(e=>e.id !== op.id);
      message = 'Playtest: delete a puzzle';
      break;
    }
    case 'deleteFolder': {
      ownerOnly(owner, 'delete folders');
      if(op.folder === INBOX) throw refuse(400, 'The Inbox can’t be deleted (it can be renamed).');
      findFolder(data, op.folder);
      data.folders = data.folders.filter(f=>f.id !== op.folder);
      data.puzzles.forEach(p=>{ if(p.folder === op.folder) p.folder = INBOX; });
      message = 'Playtest: delete a folder';
      break;
    }
    default:
      throw refuse(400, 'Unknown change: ' + String(op.op).slice(0, 30));
  }
  return { data, message, result };
}

const api = { INBOX, LIMITS, normalize, cleanPuzzle, apply };
if(typeof module !== 'undefined' && module.exports) module.exports = api;
else root.PlaytestOps = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
