/**
 * Custom Stories Block – Instagram-style stories
 * Dawn 15.x · Vanilla JS · Mobile-first
 */
(function () {
  'use strict';

  /* ── DOM refs ── */
  const section   = document.querySelector('.custom-stories');
  if (!section) return;

  const track     = section.querySelector('.cst-track');
  const prevBtn   = section.querySelector('.cst-nav--prev');
  const nextBtn   = section.querySelector('.cst-nav--next');
  const viewer    = section.querySelector('.cst-viewer');
  const items     = Array.from(section.querySelectorAll('.cst-story'));

  if (!track || !viewer || items.length === 0) return;

  /* ── State ── */
  let currentIdx    = 0;
  let progressTimer = null;
  let progressStart = 0;
  const DURATION    = 5000; // ms per slide

  /* ── Track navigation ── */
  function updateNav() {
    if (!prevBtn || !nextBtn) return;
    prevBtn.hidden = track.scrollLeft <= 10;
    nextBtn.hidden = track.scrollLeft + track.clientWidth >= track.scrollWidth - 10;
  }

  function scrollTrack(dir) {
    track.scrollBy({ left: dir * 200, behavior: 'smooth' });
  }

  if (prevBtn) prevBtn.addEventListener('click', () => scrollTrack(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => scrollTrack(1));
  track.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ── Gather story data from DOM ── */
  function getStories() {
    return items.map((el) => ({
      id:    el.dataset.storyId,
      type:  el.dataset.storyType   || 'image',
      img:   el.dataset.storyImg    || '',
      video: el.dataset.storyVideo  || '',
      title: el.dataset.storyTitle  || '',
      time:  el.dataset.storyTime   || '',
      text:  el.dataset.storyText   || '',
      cta:   el.dataset.storyCta    || '',
      url:   el.dataset.storyUrl    || '',
      thumb: el.querySelector('.cst-story__avatar img')?.src || ''
    }));
  }

  const stories = getStories();

  /* ── Open viewer ── */
  items.forEach((el, i) => {
    el.addEventListener('click', () => openViewer(i));
  });

  function openViewer(idx) {
    currentIdx = idx;
    viewer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    renderSlide();
    startProgress();
  }

  function closeViewer() {
    viewer.classList.remove('is-open');
    document.body.style.overflow = '';
    stopProgress();
    // Mark as seen
    items[currentIdx]?.classList.add('cst-story--seen');
  }

  /* ── Render slide ── */
  function renderSlide() {
    const s = stories[currentIdx];
    if (!s) return closeViewer();

    // Header
    const thumb = viewer.querySelector('.cst-viewer__thumb img');
    const name  = viewer.querySelector('.cst-viewer__name');
    const when  = viewer.querySelector('.cst-viewer__when');
    if (thumb) thumb.src = s.thumb;
    if (name)  name.textContent = s.title;
    if (when)  when.textContent = s.time;

    // Content
    const content = viewer.querySelector('.cst-viewer__content');
    if (s.type === 'video' && s.video) {
      content.innerHTML = `<video src="${s.video}" autoplay muted playsinline loop style="width:100%;height:100%;object-fit:cover"></video>`;
    } else if (s.type === 'text') {
      content.innerHTML = `<div class="cst-viewer__text-slide"><h3>${s.title}</h3><p>${s.text}</p></div>`;
    } else {
      const imgSrc = s.img || s.thumb || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" fill="%23eee"/>';
      content.innerHTML = `<img src="${imgSrc}" alt="${s.title}" style="width:100%;height:100%;object-fit:cover">`;
    }

    // CTA
    const ctaWrap = viewer.querySelector('.cst-viewer__cta');
    if (s.cta && s.url) {
      ctaWrap.innerHTML = `<a href="${s.url}" class="cst-viewer__cta-btn">${s.cta}</a>`;
      ctaWrap.style.display = '';
    } else {
      ctaWrap.style.display = 'none';
    }

    // Progress bars
    renderProgressBars();
  }

  /* ── Progress bars ── */
  function renderProgressBars() {
    const wrap = viewer.querySelector('.cst-viewer__progress');
    wrap.innerHTML = stories.map((_, i) => {
      let cls = 'cst-viewer__bar';
      if (i < currentIdx) cls += ' is-done';
      if (i === currentIdx) cls += ' is-active';
      return `<div class="${cls}"><div class="cst-viewer__bar-fill"></div></div>`;
    }).join('');
  }

  function startProgress() {
    stopProgress();
    progressStart = Date.now();
    const activeFill = viewer.querySelector('.cst-viewer__bar.is-active .cst-viewer__bar-fill');

    progressTimer = setInterval(() => {
      const elapsed = Date.now() - progressStart;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      if (activeFill) activeFill.style.width = pct + '%';
      if (pct >= 100) goNext();
    }, 50);
  }

  function stopProgress() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  /* ── Navigation ── */
  function goNext() {
    items[currentIdx]?.classList.add('cst-story--seen');
    if (currentIdx < stories.length - 1) {
      currentIdx++;
      renderSlide();
      startProgress();
    } else {
      closeViewer();
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      currentIdx--;
      renderSlide();
      startProgress();
    }
  }

  /* ── Viewer events ── */
  viewer.querySelector('.cst-viewer__close')?.addEventListener('click', closeViewer);
  viewer.querySelector('.cst-viewer__tap--prev')?.addEventListener('click', goPrev);
  viewer.querySelector('.cst-viewer__tap--next')?.addEventListener('click', goNext);

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (!viewer.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft') goPrev();
  });

  // Swipe support
  let touchStartX = 0;
  viewer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  viewer.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) > 50) {
      dx < 0 ? goNext() : goPrev();
    }
  }, { passive: true });

})();
