// The playtest rules (playtest-ops.js) and the server (api/playtest.js),
// 2026-11-20. No browser, no real GitHub: the server talks to a stand-in.
//   node tests/playtest_ops_test.js
const ops = require('../playtest-ops.js');
const handler = require('../api/playtest.js');
let failures = 0;
const check = (ok, msg)=>{ console.log((ok ? '  ok   ' : '  FAIL ') + msg); if(!ok) failures++; };
const refused = (fn, status)=>{ try { fn(); return false; } catch(e){ return e.status === status; } };

const puzzle = { title: 'x', rows: 6, cols: 6, removed: [[0,0]], dottedLines: ['v,3,2'],
  pieces: [{ name:'L', color:'#C9433A', cells:[[0,0],[1,0],[2,0],[3,0],[3,1]] }, { name:'I', cells:[[0,0],[1,0],[2,0],[3,0],[4,0]] }] };

(async ()=>{
  console.log('Rules');
  // Old files (before folders) get an Inbox; their puzzles go in it
  let data = ops.normalize({ puzzles: [{ id:'old', title:'Old one', uploadedAt:'2026-11-01T00:00:00Z', puzzle }] });
  check(data.folders.length === 1 && data.folders[0].id === 'inbox', 'an old file gets an Inbox');
  check(data.puzzles[0].folder === 'inbox' && data.puzzles[0].trashed === false, 'its puzzles go in the Inbox');

  // Friend: upload always adds a new one, even with an existing id
  let out = ops.apply(data, { op:'upload', id:'old', title:'Friend’s', puzzle }, { owner:false });
  check(out.data.puzzles.length === 2 && out.result.id !== 'old', 'a friend’s upload never replaces one (new id ' + out.result.id + ')');
  check(out.data.puzzles.find(p=>p.id === 'old').title === 'Old one', 'the old one is untouched');
  // Owner: same id replaces
  out = ops.apply(data, { op:'upload', id:'old', title:'New name', puzzle }, { owner:true });
  check(out.data.puzzles.length === 1 && out.data.puzzles[0].title === 'New name', 'the owner’s upload again replaces it');
  check(data.puzzles[0].title === 'Old one', 'apply doesn’t change what it was given');

  // Folders
  out = ops.apply(data, { op:'newFolder', name:'  Hard ones  ' }, {});
  const fid = out.result.folder;
  data = out.data;
  check(data.folders.some(f=>f.id === fid && f.name === 'Hard ones'), 'anyone can make a folder (name tidied)');
  data = ops.apply(data, { op:'renameFolder', folder: fid, name:'Very hard' }, {}).data;
  check(data.folders.find(f=>f.id === fid).name === 'Very hard', 'anyone can rename a folder');
  data = ops.apply(data, { op:'upload', title:'Into folder', puzzle, folder: fid }, {}).data;
  check(data.puzzles[0].folder === fid, 'an upload can go into a chosen folder');
  data = ops.apply(data, { op:'move', id:'old', folder: fid }, {}).data;
  check(data.puzzles.find(p=>p.id === 'old').folder === fid, 'anyone can move a puzzle to another folder');
  data = ops.apply(data, { op:'move', id:'old', trashed: true }, {}).data;
  const t = data.puzzles.find(p=>p.id === 'old');
  check(t.trashed && t.folder === fid, 'the Trash keeps the puzzle (and remembers its folder)');
  data = ops.apply(data, { op:'move', id:'old', trashed: false }, {}).data;
  check(!data.puzzles.find(p=>p.id === 'old').trashed, 'and it can be put back');

  // Owner only
  check(refused(()=>ops.apply(data, { op:'renamePuzzle', id:'old', title:'z' }, {}), 403), 'friends can’t rename puzzles');
  check(refused(()=>ops.apply(data, { op:'deletePuzzle', id:'old' }, {}), 403), 'friends can’t delete puzzles');
  check(refused(()=>ops.apply(data, { op:'deleteFolder', folder: fid }, {}), 403), 'friends can’t delete folders');
  let o = ops.apply(data, { op:'renamePuzzle', id:'old', title:'Renamed' }, { owner:true }).data;
  check(o.puzzles.find(p=>p.id === 'old').title === 'Renamed', 'the owner can rename a puzzle');
  o = ops.apply(data, { op:'deletePuzzle', id:'old' }, { owner:true }).data;
  check(!o.puzzles.some(p=>p.id === 'old'), 'the owner can delete a puzzle for good');
  o = ops.apply(data, { op:'deleteFolder', folder: fid }, { owner:true }).data;
  check(!o.folders.some(f=>f.id === fid) && o.puzzles.every(p=>p.folder === 'inbox'), 'deleting a folder moves its puzzles to the Inbox');
  check(refused(()=>ops.apply(data, { op:'deleteFolder', folder:'inbox' }, { owner:true }), 400), 'the Inbox can’t be deleted');

  // Bad input
  check(refused(()=>ops.apply(data, { op:'upload', title:'x', puzzle: { rows: 99, cols: 6, pieces: [] } }, {}), 400), 'a too-big board is refused');
  check(refused(()=>ops.apply(data, { op:'upload', title:'x', puzzle: Object.assign({}, puzzle, { pieces: [{ name:'Q', cells:[] }] }) }, {}), 400), 'a made-up piece is refused');
  check(refused(()=>ops.apply(data, { op:'upload', title:'   ', puzzle }, {}), 400), 'an empty name is refused');
  check(refused(()=>ops.apply(data, { op:'move', id:'nope', trashed:true }, {}), 404), 'moving a missing puzzle says so');
  check(refused(()=>ops.apply(data, { op:'explode' }, {}), 400), 'an unknown change is refused');
  const clean = ops.apply(data, { op:'upload', title:'x', puzzle: Object.assign({ evil: '<script>' }, puzzle) }, {}).data.puzzles[0].puzzle;
  check(!('evil' in clean) && clean.pieces[1].color === undefined, 'only a clean copy of the puzzle is kept');

  console.log('Server');
  // A stand-in GitHub holding playtest.json
  let stored = JSON.stringify({ puzzles: [{ id:'old', title:'Old one', uploadedAt:'2026-11-01T00:00:00Z', puzzle }] });
  let sha = 1, commits = [], conflictOnce = false;
  global.fetch = async (url, init)=>{
    init = init || {};
    if(!/\/contents\/playtest\.json/.test(url)) return { ok:false, status:404, json: async()=>({}) };
    if(!init.method || init.method === 'GET')
      return { ok:true, status:200, json: async()=>({ sha:'s' + sha, content: Buffer.from(stored).toString('base64') }) };
    const body = JSON.parse(init.body);
    if(conflictOnce){ conflictOnce = false; sha++; return { ok:false, status:409, json: async()=>({}) }; }   // (someone else saved first)
    if(body.sha !== 's' + sha) return { ok:false, status:409, json: async()=>({}) };
    stored = Buffer.from(body.content, 'base64').toString('utf8'); sha++; commits.push(body.message);
    return { ok:true, status:200, json: async()=>({}) };
  };
  const call = async (method, body)=>{
    const res = { headers:{}, setHeader(k, v){ this.headers[k] = v; }, end(s){ this.body = JSON.parse(s); } };
    await handler({ method, body }, res);
    return res;
  };

  delete process.env.PLAYTEST_GITHUB_TOKEN;
  let r = await call('GET');
  check(r.statusCode === 503 && /aren’t switched on/.test(r.body.error), 'no server token: 503 with a sentence');
  process.env.PLAYTEST_GITHUB_TOKEN = 'server-token';
  r = await call('GET');
  check(r.statusCode === 200 && r.body.folders[0].id === 'inbox' && r.body.puzzles.length === 1, 'GET gives the file, with folders');
  check(r.headers['Cache-Control'] === 'no-store', 'never cached');
  r = await call('POST', { op:'upload', id:'old', title:'From a friend', puzzle });
  check(r.statusCode === 200 && JSON.parse(stored).puzzles.length === 2, 'POST upload adds a puzzle (as a friend: not a replace)');
  check(commits[commits.length - 1] === 'Playtest: upload a puzzle', 'commit message doesn’t name the puzzle');
  conflictOnce = true;
  r = await call('POST', JSON.stringify({ op:'newFolder', name:'Tries again' }));
  check(r.statusCode === 200 && JSON.parse(stored).folders.some(f=>f.name === 'Tries again'), 'a clash with another save is retried; a text body works too');
  r = await call('POST', { op:'deletePuzzle', id:'old' });
  check(r.statusCode === 403 && JSON.parse(stored).puzzles.some(p=>p.id === 'old'), 'the server never deletes (always a friend)');
  r = await call('POST', { op:'upload', title:'big', puzzle: Object.assign({}, puzzle, { hintText: 'x'.repeat(300000) }) });
  check(r.statusCode === 413, 'too big: 413');
  r = await call('DELETE');
  check(r.statusCode === 405, 'other methods: 405');

  console.log(failures ? `\n${failures} failure(s)` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
