/* ═══════════════════════════════════════════════════════════════════
   PARITY BLOCKS: LIGHT / DARK MODE
   ═══════════════════════════════════════════════════════════════════
   The default is the device's own light / dark setting (2026-11-13; was
   always light). It switches with the round moon / sun button,
   the same on every page (any button with data-theme-toggle): top left of
   the start screen, the puzzle page, the sandbox, and (far left, Large
   text to its right) the rules popup and the tutorial.
   The choice is remembered in this browser (localStorage 'pb_theme') and
   shared by every page; pages already open follow it straight away.

   Dark mode = the class "dark" on <html>. Each stylesheet keeps its
   light colors in :root and its dark ones in an html.dark { … } block
   right below, tagged [COLORS].

   Load this in each page's <head>, BEFORE the stylesheets' content shows
   (a plain <script src="theme.js"></script>), so a page never flashes
   white before turning dark.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  const KEY = 'pb_theme';
  // (2026-11-13, user: their phone was in dark mode but the tutorial was
  // light.) Until the moon / sun button is pressed, every page follows the
  // device's own light / dark setting; once pressed, that choice wins on
  // every page.
  const SYSTEM = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  // (2026-11-13, user: in Firefox the start screen was dark but the tutorial
  // opened light. Firefox can keep each page's saved settings apart (e.g.
  // files opened from the computer), so the choice also rides along in the
  // address of every page link: "?theme=dark". A page opened that way
  // saves it and uses it.)
  let chosen = null;
  try { const t = new URLSearchParams(location.search).get('theme'); if(t === 'dark' || t === 'light') chosen = t; } catch(e){}
  if(chosen){ try { localStorage.setItem(KEY, chosen); } catch(e){} }
  function savedChoice(){
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch(e){}
    return (saved === 'dark' || saved === 'light') ? saved : chosen;
  }
  function isDark(){
    const saved = savedChoice();
    if(saved) return saved === 'dark';
    return !!(SYSTEM && SYSTEM.matches);
  }
  // A link to another of our pages, with the chosen mode added (nothing
  // added if the button was never pressed: then every page follows the device)
  function withTheme(url){
    const saved = savedChoice();
    if(!saved) return url;
    try {
      const u = new URL(url, location.href);
      if(!/\.html$/.test(u.pathname) && !u.pathname.endsWith('/')) return url;
      u.searchParams.set('theme', saved);
      return u.href;
    } catch(e){ return url; }
  }
  // Every plain link to one of our pages picks up the mode as it's clicked
  document.addEventListener('click', e=>{
    const a = e.target.closest && e.target.closest('a[href]');
    if(!a || a.target || /^(https?:|mailto:|#)/.test(a.getAttribute('href'))) return;
    a.href = withTheme(a.getAttribute('href'));
  }, true);

  // The round icon buttons at the top left of the start screen and the
  // puzzle page ([data-theme-toggle]): a moon in light mode, a sun in dark
  const MOON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>';
  const SUN = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/>'
    + '<path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function apply(){
    const dark = isDark();
    document.documentElement.classList.toggle('dark', dark);
    // Every theme button on the page says what pressing it would do
    document.querySelectorAll('.theme-btn').forEach(btn=>{
      btn.textContent = dark ? 'Light mode' : 'Dark mode';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    });
    document.querySelectorAll('[data-theme-toggle]').forEach(btn=>{
      btn.innerHTML = dark ? SUN : MOON;
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.title = dark ? 'Light mode' : 'Dark mode';
    });
  }

  function setDark(on){
    chosen = on ? 'dark' : 'light';
    try { localStorage.setItem(KEY, chosen); } catch(e){}
    apply();
    // Tell the page around this one (the puzzle page round the tutorial)
    // and any page inside it (the tutorial in the puzzle page) straight
    // away too, so everything on screen switches together (user, 2026-11-05)
    const note = { type: 'pb-theme' };
    try { if(window.parent !== window) window.parent.postMessage(note, '*'); } catch(e){}
    for(let i = 0; i < window.frames.length; i++){ try { window.frames[i].postMessage(note, '*'); } catch(e){} }
  }

  // The round moon / sun button, the same everywhere (the rules popup uses
  // this; the tutorial and the pages have it in their HTML). The click is
  // handled below, like every [data-theme-toggle] button.
  function makeButton(){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('data-theme-toggle', '');
    apply();
    return btn;
  }

  // Follow a switch made anywhere else: another tab or page (storage), the
  // page around or inside this one (message), and a page the browser kept
  // and shows again, e.g. after its Back button (pageshow / visibilitychange)
  window.addEventListener('storage', e=>{ if(e.key === KEY) apply(); });
  window.addEventListener('message', e=>{ if(e.data && e.data.type === 'pb-theme') apply(); });
  window.addEventListener('pageshow', apply);
  // (the device switching light / dark, e.g. at sunset: followed until the button is pressed)
  if(SYSTEM){ if(SYSTEM.addEventListener) SYSTEM.addEventListener('change', apply); else if(SYSTEM.addListener) SYSTEM.addListener(apply); }
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) apply(); });

  // Any [data-theme-toggle] button switches the mode (set up once the page is read)
  document.addEventListener('click', e=>{
    const btn = e.target.closest && e.target.closest('[data-theme-toggle]');
    if(btn) setDark(!isDark());
  });

  apply();
  document.addEventListener('DOMContentLoaded', apply);   // (label any buttons in the page's HTML)
  window.ParityTheme = { isDark, setDark, makeButton, apply, withTheme };
})();
