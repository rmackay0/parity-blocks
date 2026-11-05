/* ═══════════════════════════════════════════════════════════════════
   PARITY BLOCKS: "THERE'S MORE BELOW" (phones)
   ═══════════════════════════════════════════════════════════════════
   Phones hide scroll bars, so it's easy to miss that a tutorial slide or
   the rules go on below the screen (user, 2026-11-05). On phones only, a
   small round ▾ sits at the bottom of a scrolling area while there's more
   to see, bobbing gently; tapping it scrolls down; it fades away at the
   bottom (and comes back if they scroll up again).

   attachScrollHint(el)   el = the element that scrolls (overflow auto).
   Used by tutorial.html (.tut-body) and rules.js (the rules popup).
   Styles: .scroll-hint in rules.css.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  // [BEHAVIOR] "a phone": a narrow screen, or a touch screen without a mouse
  const PHONE = window.matchMedia('(max-width: 760px), (hover: none) and (pointer: coarse)');
  const MORE_PX = 24;     // at least this much hidden below before it shows

  function attachScrollHint(el){
    if(!el || el._scrollHint) return;
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'scroll-hint';
    hint.setAttribute('aria-label', 'Scroll down for more');
    hint.tabIndex = -1;       // (the page scrolls with the keyboard anyway)
    hint.innerHTML = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 8 L10 13 L15 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    document.body.appendChild(hint);
    el._scrollHint = hint;
    // Tap: scroll most of a screen further
    hint.addEventListener('click', ()=>el.scrollBy({ top: Math.round(el.clientHeight * 0.7), behavior: 'smooth' }));

    // Show it while there's more below and the area is on screen; it sits
    // just above the area's bottom edge, centred
    let queued = false;
    function update(){
      queued = false;
      const r = el.getBoundingClientRect();
      const onScreen = el.getClientRects().length > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      const more = el.scrollHeight - el.clientHeight - el.scrollTop > MORE_PX;
      const show = PHONE.matches && onScreen && more;
      hint.classList.toggle('shown', show);
      if(show){
        hint.style.left = (r.left + r.width/2) + 'px';
        hint.style.top = (r.bottom - 50) + 'px';
      }
    }
    const later = ()=>{ if(!queued){ queued = true; requestAnimationFrame(update); } };
    el.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later);
    // (content comes and goes without any scrolling, e.g. a new slide, so check now and then too)
    setInterval(later, 400);
    later();
  }
  window.attachScrollHint = attachScrollHint;
})();
