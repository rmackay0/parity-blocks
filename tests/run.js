// Runs the tests (2026-11-16). From the project folder:
//
//   node tests/run.js              QUICK (~25 s): the solver checks + smoke_test
//                                  (every page and tutorial slide, laptop + phone,
//                                  each level solved, no JavaScript errors)
//   node tests/run.js changed      QUICK + the tests that cover the files changed
//                                  since the last push (committed or not)
//   node tests/run.js full         EVERY test (~10 min): before a push
//   node tests/run.js tutorial_test ff_test          just these
//
// Options: --since <git ref> (for "changed"; default origin/main),
//          --jobs <n> (tests at once; default 3), --list (show the map below).
// Each test's whole output goes to tests/logs/<name>.log; only the failing
// lines are shown here. A test passes when it exits with code 0.
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOGS = path.join(__dirname, 'logs');

// Every test, and the files it covers ("changed" picks tests by these).
// A test also runs when its own file changes. Not here (tools that only take
// screenshots or make data): look_screens, dotted_squares_screens, make_icons,
// make_puzzles, puzzle_stats, puzzle4_tilings.
const TESTS = {
  // Fast checks (QUICK runs these)
  'solver.test':           { file: 'tests/solver.test.js',       covers: ['solver.js'], quick: true },
  'smoke_test':            { covers: ['*'], quick: true },
  // Solver
  'parity_fast_check':     { file: 'tests/parity_fast_check.js', covers: ['solver.js'] },
  // The puzzle page
  'play_test':             { covers: ['play.html', 'index.html', 'game.js', 'published.js'] },
  'click_test':            { covers: ['game.js', 'play.html'] },
  'overlap_test':          { covers: ['game.js'] },
  'tame_errors_test':      { covers: ['game.js'] },
  'game_features_test':    { covers: ['game.js', 'sandbox.html'] },
  'ghost_test':            { covers: ['game.js'] },
  'feel_test':             { covers: ['game.js', 'game.css'] },
  'trails_test':           { covers: ['game.js', 'game.css', 'shapes.js'] },
  'highlighter_test':      { covers: ['game.js', 'game.css', 'play.html', 'shapes.js'] },
  'board_still_test':      { covers: ['game.js', 'game.css', 'play.html', 'tutorial.html'] },
  'solved_state_test':     { covers: ['celebrate.js', 'play.html', 'game.js', 'shapes.js', 'published.js'] },
  'win_test':              { covers: ['celebrate.js', 'play.html', 'published.js'] },
  'next_level_test':       { covers: ['play.html', 'celebrate.js', 'game.css', 'published.js'] },
  'share_test':            { covers: ['play.html', 'published.js'] },
  'progress_test':         { covers: ['progress.js', 'play.html', 'index.html'] },
  'claude_puzzles_test':   { covers: ['puzzles.js', 'sandbox.html', 'play.html'] },
  'piece_colors_test':     { covers: ['shapes.js', 'game.js', 'sandbox.html', 'tutorial.html', 'solver.js', 'play.html'] },
  // Tutorial
  'tutorial_test':         { covers: ['tutorial.html', 'shapes.js', 'game.js', 'celebrate.js'] },
  'ff_test':               { covers: ['tutorial.html'] },
  'slide1_test':           { covers: ['tutorial.html', 'shapes.js'] },
  'glow_clip_test':        { covers: ['tutorial.html', 'scroll-hint.js', 'game.css'] },
  'phone_layout_check':    { covers: ['tutorial.html', 'game.js', 'game.css', 'shapes.js', 'rules.css'] },
  'scroll_hint_test':      { covers: ['scroll-hint.js', 'tutorial.html', 'rules.js', 'rules.css'] },
  'large_text_test':       { covers: ['tutorial.html', 'rules.js', 'rules.css', 'shapes.js', 'game.css', 'play.html'] },
  // Rules, light / dark
  'rules_text_test':       { covers: ['rules.js', 'rules.css', 'shapes.js', 'tutorial.html'] },
  'theme_toggle_test':     { covers: ['theme.js', 'index.html', 'play.html', 'rules.css', 'game.css'] },
  'theme_sync_test':       { covers: ['theme.js', 'tutorial.html', 'rules.js'] },
  // Sandbox
  'sandbox_analyze_test':  { covers: ['sandbox.html', 'solver.js'] },
  'sandbox_counts_test':   { covers: ['sandbox.html', 'game.js'] },
  'sandbox_dotted_test':   { covers: ['sandbox.html', 'shapes.js'] },
  'cloud_test':            { covers: ['sandbox.html', 'playtest.html', 'playtest.json', 'play.html'], server: true },
};
for (const [name, t] of Object.entries(TESTS)) t.file = t.file || `tests/browser/${name}.js`;

// ── What to run ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (flag, dflt) => { const i = args.indexOf(flag); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const since = opt('--since', 'origin/main');
const jobs = parseInt(opt('--jobs', '3'), 10);
if (args.includes('--list')) {
  for (const [name, t] of Object.entries(TESTS)) console.log(`${name.padEnd(22)} ${t.quick ? 'QUICK ' : '      '}${t.covers.join(', ')}`);
  process.exit(0);
}
const mode = args[0] || 'quick';
const quick = Object.keys(TESTS).filter(n => TESTS[n].quick);
let pick;
if (mode === 'quick') pick = quick;
else if (mode === 'full') pick = Object.keys(TESTS);
else if (mode === 'changed') pick = changedTests();
else {
  pick = args.map(a => a.replace(/\.js$/, ''));
  const unknown = pick.filter(n => !TESTS[n]);
  if (unknown.length) { console.log(`Unknown test: ${unknown.join(', ')}  (node tests/run.js --list)`); process.exit(2); }
}

// The files changed since `since` (committed or not, plus new files), and the tests that cover them
function changedTests(){
  const git = cmd => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const files = [...new Set([...git(`git diff --name-only ${since}`), ...git('git ls-files --others --exclude-standard')])];
  console.log(`Changed since ${since}: ${files.length ? files.join(', ') : '(nothing)'}`);
  if (files.some(f => f === 'tests/browser/lib.js')) { console.log('lib.js changed → every test'); return Object.keys(TESTS); }
  const set = new Set(quick);
  for (const [name, t] of Object.entries(TESTS))
    if (files.includes(t.file) || t.covers.some(c => c !== '*' && files.includes(c))) set.add(name);
  const uncovered = files.filter(f => /\.(js|html|css|json)$/.test(f) && !f.startsWith('tests/')
    && !Object.values(TESTS).some(t => t.covers.includes(f)));
  if (uncovered.length) console.log(`No specific tests for: ${uncovered.join(', ')} (smoke_test still opens every page)`);
  return [...set];
}

// ── Running them ─────────────────────────────────────────────────────────
function runOne(name){
  const t = TESTS[name], start = Date.now();
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(ROOT, t.file)], { cwd: path.dirname(path.join(ROOT, t.file)) });
    let out = '';
    child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
    child.on('close', code => {
      fs.writeFileSync(path.join(LOGS, name + '.log'), out);
      resolve({ name, ok: code === 0, secs: Math.round((Date.now() - start) / 1000), out });
    });
  });
}

(async () => {
  fs.mkdirSync(LOGS, { recursive: true });
  // cloud_test needs the site served over http (port 8765)
  let server = null;
  if (pick.some(n => TESTS[n].server)) {
    server = spawn('python3', ['-m', 'http.server', '8765'], { cwd: ROOT, stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`Running ${pick.length} test${pick.length > 1 ? 's' : ''} (${mode}), ${jobs} at a time…\n`);
  const t0 = Date.now(), queue = [...pick], results = [];
  async function worker(){
    while (queue.length) {
      const r = await runOne(queue.shift());
      results.push(r);
      console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(22)} ${String(r.secs).padStart(4)} s`);
      if (!r.ok) {
        // The failing lines (or the end of the output if none are marked)
        const lines = r.out.split('\n');
        let bad = lines.filter(l => /^FAIL|✗|Error|ERRORS|errors?:/i.test(l) && !/no page errors/i.test(l));
        if (!bad.length) bad = lines.filter(Boolean).slice(-6);
        bad.slice(0, 12).forEach(l => console.log('    ' + l.slice(0, 200)));
        console.log(`    (whole output: tests/logs/${r.name}.log)`);
      }
    }
  }
  await Promise.all([...Array(Math.max(1, jobs))].map(worker));
  if (server) server.kill();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length ? '✗ ' + failed.length + ' FAILED: ' + failed.map(r => r.name).join(', ') : '✓ all ' + results.length + ' passed'}`
    + `  (${Math.round((Date.now() - t0) / 1000)} s)`);
  process.exitCode = failed.length ? 1 : 0;
})();
