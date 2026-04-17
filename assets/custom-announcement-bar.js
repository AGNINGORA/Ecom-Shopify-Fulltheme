/**
 * custom-announcement-bar.js
 * Barre d'annonce premium — auto-rotate, countdown, dismiss
 */
(function () {
  'use strict';

  class AnnouncementBar {
    constructor(el) {
      this.root     = el;
      this.slides   = Array.from(el.querySelectorAll('[data-cab-slide]'));
      this.prevBtn  = el.querySelector('[data-cab-prev]');
      this.nextBtn  = el.querySelector('[data-cab-next]');
      this.dismiss  = el.querySelector('[data-cab-dismiss]');
      this.progress = el.querySelector('[data-cab-progress]');

      this.current   = 0;
      this.total     = this.slides.length;
      this.autoplay  = el.dataset.cabAutoplay === 'true';
      this.speed     = (parseInt(el.dataset.cabSpeed, 10) || 5) * 1000;
      this.timer     = null;
      this.paused    = false;

      if (this.total === 0) return;

      // Init countdowns
      this.slides.forEach((slide) => {
        const cdEl = slide.querySelector('[data-cab-countdown]');
        if (cdEl) this._initCountdown(cdEl);
      });

      // Show first slide
      this._showSlide(0);

      if (this.total > 1) {
        this._bindNav();
        if (this.autoplay) this._startAutoplay();
      }

      // Dismiss
      if (this.dismiss) {
        this.dismiss.addEventListener('click', () => {
          this.root.classList.add('is-dismissed');
          this._stopAutoplay();
          try { sessionStorage.setItem('cab-dismissed', '1'); } catch (_) {}
        });

        try {
          if (sessionStorage.getItem('cab-dismissed') === '1') {
            this.root.classList.add('is-dismissed');
            return;
          }
        } catch (_) {}
      }

      // Pause on hover/focus
      el.addEventListener('mouseenter', () => { this.paused = true; this._stopAutoplay(); });
      el.addEventListener('mouseleave', () => { this.paused = false; if (this.autoplay) this._startAutoplay(); });
      el.addEventListener('focusin', () => { this.paused = true; this._stopAutoplay(); });
      el.addEventListener('focusout', () => { this.paused = false; if (this.autoplay) this._startAutoplay(); });
    }

    _showSlide(index) {
      this.slides.forEach((s, i) => {
        s.classList.toggle('is-active', i === index);
      });
      this.current = index;
      this._resetProgress();
    }

    _next() {
      this._showSlide((this.current + 1) % this.total);
    }

    _prev() {
      this._showSlide((this.current - 1 + this.total) % this.total);
    }

    _bindNav() {
      this.prevBtn?.addEventListener('click', () => {
        this._prev();
        this._restartAutoplay();
      });
      this.nextBtn?.addEventListener('click', () => {
        this._next();
        this._restartAutoplay();
      });
    }

    _startAutoplay() {
      this._stopAutoplay();
      this._resetProgress();
      this.timer = setInterval(() => {
        if (!this.paused) this._next();
      }, this.speed);
    }

    _stopAutoplay() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      if (this.progress) {
        this.progress.classList.remove('is-animating');
        this.progress.style.width = '0%';
      }
    }

    _restartAutoplay() {
      if (this.autoplay) this._startAutoplay();
    }

    _resetProgress() {
      if (!this.progress || !this.autoplay) return;
      this.progress.classList.remove('is-animating');
      this.progress.style.width = '0%';
      // Force reflow
      void this.progress.offsetWidth;
      this.progress.style.transitionDuration = this.speed + 'ms';
      this.progress.classList.add('is-animating');
      this.progress.style.width = '100%';
    }

    // ── Countdown ──────────────────────────────────────────────
    _initCountdown(el) {
      const endDate = el.dataset.cabCountdown;
      if (!endDate) return;

      const target = new Date(endDate).getTime();
      const hEl = el.querySelector('[data-cab-h]');
      const mEl = el.querySelector('[data-cab-m]');
      const sEl = el.querySelector('[data-cab-s]');
      const dEl = el.querySelector('[data-cab-d]');

      const update = () => {
        const now  = Date.now();
        const diff = Math.max(0, target - now);

        if (diff === 0) {
          el.textContent = 'Expiré';
          return;
        }

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        if (dEl) dEl.textContent = String(d).padStart(2, '0');
        if (hEl) hEl.textContent = String(h).padStart(2, '0');
        if (mEl) mEl.textContent = String(m).padStart(2, '0');
        if (sEl) sEl.textContent = String(s).padStart(2, '0');
      };

      update();
      setInterval(update, 1000);
    }
  }

  function init() {
    document.querySelectorAll('[data-cab]').forEach((el) => {
      if (!el._cabInit) el._cabInit = new AnnouncementBar(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('[data-cab]');
    if (el) el._cabInit = new AnnouncementBar(el);
  });
})();
