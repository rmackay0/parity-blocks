/* ═══════════════════════════════════════════════════════════════════
   PARITY BLOCKS: LIGHT / DARK MODE
   ═══════════════════════════════════════════════════════════════════
   Light (white background) is the default. It switches with the round
   moon / sun button at the top left of the start screen and the puzzle
   page (any button with data-theme-toggle), or the "Dark mode" button
   next to "Large text" in the rules popup and the tutorial.
   The choice is remembered in this browser (localStorage 'pb_theme') and
   shared by every page.

   Dark mode = the class "dark" on <html>. Each stylesheet keeps its
   light colors in :root and its dark ones in an html.dark { … } block
   right below, tagged [COLORS].

   Load this in each page's <head>, BEFORE the stylesheets' content shows
   (a plain <script src="theme.js"></script>), so a page never flashes
   white before turning dark.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  const KEY = 'pb_theme';
  function isDark(){ try { return localStorage.getItem(KEY) === 'dark'; } catch(e){ return false; } }

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
    try { localStorage.setItem(KEY, on ? 'dark' : 'light'); } catch(e){}
    apply();
  }

  // A "Dark mode" / "Light mode" button (styled like the Large text button)
  function makeButton(){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'text-size-btn theme-btn';
    btn.addEventListener('click', ()=>setDark(!isDark()));
    return btn;
  }

  // Switched in another tab, or in the tutorial shown over the puzzle page
  // (a separate page in a frame): follow it here too
  window.addEventListener('storage', e=>{ if(e.key === KEY) apply(); });

  // Any [data-theme-toggle] button switches the mode (set up once the page is read)
  document.addEventListener('click', e=>{
    const btn = e.target.closest && e.target.closest('[data-theme-toggle]');
    if(btn) setDark(!isDark());
  });

  apply();
  document.addEventListener('DOMContentLoaded', apply);   // (label any buttons in the page's HTML)
  window.ParityTheme = { isDark, setDark, makeButton, apply };
})();
