/* ═══════════════════════════════════════════════════════════════════════
   /api/playtest: the server side of the playtest page (2026-11-20)
   ═══════════════════════════════════════════════════════════════════════
   A Vercel function (Vercel runs every file in api/ on its servers; the
   file itself is never sent to browsers). It lets FRIENDS (no GitHub
   token) upload puzzles and sort folders, using a token that only the
   server knows. The owner's own browser doesn't come here for changes: it
   writes to GitHub with the owner's token, as before.

     GET  /api/playtest       → playtest.json, fresh from GitHub (the site's
                                own copy lags about a minute behind)
     POST /api/playtest       → one change, { op, … } (see playtest-ops.js;
                                always as a friend, never as the owner)

   Setup, once (Vercel → the project → Settings → Environment Variables):
     PLAYTEST_GITHUB_TOKEN   a fine-grained GitHub token for parity-blocks,
                             "Contents: Read and write"
     PLAYTEST_REPO           (optional) default rmackay0/parity-blocks
     PLAYTEST_BRANCH         (optional) default main
   Without the token, GET and POST answer 503 and the pages say so.
   ═══════════════════════════════════════════════════════════════════════ */
const ops = require('../playtest-ops.js');

const FILE = 'playtest.json';
const MAX_BODY = 200000;          // characters; a 16 × 16 puzzle is about 3,000

function settings(){
  return {
    token: process.env.PLAYTEST_GITHUB_TOKEN || '',
    repo: process.env.PLAYTEST_REPO || 'rmackay0/parity-blocks',
    branch: process.env.PLAYTEST_BRANCH || 'main',
  };
}
function headers(s){
  return { Authorization: 'Bearer ' + s.token, Accept: 'application/vnd.github+json', 'User-Agent': 'parity-blocks-playtest' };
}
function githubError(status){
  const e = new Error(status === 401 ? 'The server’s GitHub token is invalid or expired.'
    : `GitHub refused the server (${status}).`);
  e.status = 502;
  return e;
}

// playtest.json from GitHub: { data, sha } (sha = null if it isn't there yet)
async function readFile(s){
  const res = await fetch(`https://api.github.com/repos/${s.repo}/contents/${FILE}?ref=${encodeURIComponent(s.branch)}&t=${Date.now()}`, { headers: headers(s) });
  if(res.status === 404) return { data: ops.normalize({}), sha: null };
  if(!res.ok) throw githubError(res.status);
  const file = await res.json();
  return { data: ops.normalize(JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))), sha: file.sha };
}

// Read, change, save; again if someone else saved in between (409 / 422)
async function change(s, op){
  for(let attempt = 0; attempt < 3; attempt++){
    const { data, sha } = await readFile(s);
    const out = ops.apply(data, op, { owner: false });
    const res = await fetch(`https://api.github.com/repos/${s.repo}/contents/${FILE}`, {
      method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, headers(s)),
      body: JSON.stringify({ message: out.message, branch: s.branch,
        content: Buffer.from(JSON.stringify(out.data, null, 2) + '\n', 'utf8').toString('base64'),
        ...(sha ? { sha } : {}) }),
    });
    if(res.ok) return out;
    if(res.status !== 409 && res.status !== 422) throw githubError(res.status);
  }
  const e = new Error('Someone else kept changing the playtest page at the same moment. Try again.');
  e.status = 409;
  throw e;
}

function send(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res){
  const s = settings();
  if(!s.token) return send(res, 503, { error: 'Uploads from friends aren’t switched on yet (the server has no GitHub token).' });
  try {
    if(req.method === 'GET') return send(res, 200, (await readFile(s)).data);
    if(req.method !== 'POST') return send(res, 405, { error: 'Use GET or POST.' });
    let body = req.body;
    if(typeof body === 'string'){
      if(body.length > MAX_BODY) return send(res, 413, { error: 'That’s too big to upload.' });
      try { body = JSON.parse(body); } catch(e){ return send(res, 400, { error: 'That isn’t JSON.' }); }
    }
    if(!body || typeof body !== 'object') return send(res, 400, { error: 'Nothing was sent.' });
    if(JSON.stringify(body).length > MAX_BODY) return send(res, 413, { error: 'That’s too big to upload.' });
    const out = await change(s, body);
    return send(res, 200, { ok: true, result: out.result, data: out.data });
  } catch(e){
    return send(res, e.status || 500, { error: e.status ? e.message : 'Something went wrong on the server.' });
  }
};
