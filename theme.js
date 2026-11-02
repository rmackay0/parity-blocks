/* ═══════════════════════════════════════════════════════════════════
   PARITY BLOCKS: LIGHT / DARK MODE
   ═══════════════════════════════════════════════════════════════════
   Light (white background) is the default. The "Dark mode" button, next
   to "Large text" in the rules popup and the tutorial, switches it.
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

  function apply(){
    const dark = isDark();
    document.documentElement.classList.toggle('dark', dark);
    // Every theme button on the page says what pressing it would do
    document.querySelectorAll('.theme-btn').forEach(btn=>{
      btn.textContent = dark ? 'Light mode' : 'Dark mode';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
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

  apply();
  document.addEventListener('DOMContentLoaded', apply);   // (label any buttons in the page's HTML)
  window.ParityTheme = { isDark, setDark, makeButton, apply };
})();
