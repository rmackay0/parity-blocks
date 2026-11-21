/* ═══════════════════════════════════════════════════════════════════════
   PLAYTEST CLOUD: reading and changing playtest.json from a page
   (sandbox.html, playtest.html; 2026-11-20). Needs playtest-ops.js first.
   ═══════════════════════════════════════════════════════════════════════
   Two ways in, the same rules (playtest-ops.js):
     OWNER    this browser has the GitHub token (the sandbox's ⚙ Publishing,
              localStorage 'pb_github'): reads and writes playtest.json on
              GitHub directly, with every owner power. No password, no
              server needed.
     FRIEND   no token: goes through /api/playtest (api/playtest.js), which
              holds its own token and only allows the friend changes.
   If the server isn't set up (or the page runs locally), friends still SEE
   the puzzles: load() falls back to the site's own playtest.json, and
   says so with readOnly: true.

     PlaytestCloud.isOwner()
     PlaytestCloud.load()       → { data, readOnly, why }
     PlaytestCloud.change(op)   → { data, result }   (throws an Error with a
                                                       sentence to show)
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const FILE = 'playtest.json', API = '/api/playtest';

function gh(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem('pb_github')); } catch(e){}
  return Object.assign({ token:'', repo:'rmackay0/parity-blocks', branch:'main' }, s || {});
}
const isOwner = ()=>!!gh().token;

function b64encode(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for(let i=0; i<bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64){
  return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), ch=>ch.charCodeAt(0)));
}
function ghError(res, action){
  if(res.status === 401) return new Error(`GitHub says the token is invalid or expired (${action}). Check the sandbox's ⚙ Publishing.`);
  if(res.status === 403 || res.status === 404) return new Error(`GitHub refused (${res.status}) while ${action}. Make sure the token has "Contents: Read and write".`);
  return new Error(`GitHub error ${res.status} while ${action}.`);
}

/* ── Owner: GitHub directly ── */
async function ownerRead(){
  const s = gh();
  const res = await fetch(`https://api.github.com/repos/${s.repo}/contents/${FILE}?ref=${encodeURIComponent(s.branch)}&t=${Date.now()}`,
    { headers: { Authorization: 'Bearer ' + s.token, Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if(res.status === 404) return { data: PlaytestOps.normalize({}), sha: null };
  if(!res.ok) throw ghError(res, 'reading ' + FILE);
  const file = await res.json();
  return { data: PlaytestOps.normalize(JSON.parse(b64decode(file.content))), sha: file.sha };
}
async function ownerChange(op){
  const s = gh();
  for(let attempt = 0; attempt < 3; attempt++){
    const { data, sha } = await ownerRead();
    const out = PlaytestOps.apply(data, op, { owner: true });
    const res = await fetch(`https://api.github.com/repos/${s.repo}/contents/${FILE}`, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + s.token, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ message: out.message, branch: s.branch,
        content: b64encode(JSON.stringify(out.data, null, 2) + '\n'), ...(sha ? { sha } : {}) }),
    });
    if(res.ok) return { data: out.data, result: out.result };
    if(res.status !== 409 && res.status !== 422) throw ghError(res, 'saving ' + FILE);
  }
  throw new Error('Someone else kept changing ' + FILE + '. Try again.');
}

/* ── Friends: the server ── */
async function serverJSON(res){
  let body = null;
  try { body = await res.json(); } catch(e){}
  if(!res.ok) throw new Error(body && body.error ? body.error
    : res.status === 404 ? 'Uploads from friends aren’t available here (no server).' : `The server said ${res.status}.`);
  return body;
}

async function load(){
  if(isOwner()) return { data: (await ownerRead()).data, readOnly: false };
  try {
    const data = await serverJSON(await fetch(API + '?t=' + Date.now(), { cache: 'no-store' }));
    return { data: PlaytestOps.normalize(data), readOnly: false };
  } catch(e){
    // The site's own copy (a minute or so behind; can't be changed from here)
    const res = await fetch(FILE + '?t=' + Date.now(), { cache: 'no-store' });
    if(!res.ok) throw new Error('Couldn’t load the puzzles. Try refreshing.');
    return { data: PlaytestOps.normalize(await res.json()), readOnly: true, why: e.message };
  }
}

async function change(op){
  if(isOwner()) return ownerChange(op);
  const body = await serverJSON(await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op) }));
  return { data: PlaytestOps.normalize(body.data), result: body.result || {} };
}

window.PlaytestCloud = { isOwner, load, change };
})();
