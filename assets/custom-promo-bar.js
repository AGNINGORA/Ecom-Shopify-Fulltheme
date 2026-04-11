/* =============================================================
   custom-promo-bar.js
   Barre d'annonces rotative
   Dawn 15.x · Vanilla JS
   ============================================================= */

(function () {
  'use strict';

  const STORAGE_KEY = 'cpb_dismissed';

  class PromoBar {
    constructor(el) {
      this.el      = el;
      this.slides  = Array.from(el.querySelectorAll('[data-cpb-slide]'));
      this.dots    = Array.from(el.querySelectorAll('[data-cpb-dot]'));
      this.prevBtn = el.querySelector('[data-cpb-prev]');
      this.nextBtn = el.querySelector('[data-cpb-next]');
      this.closeBtn = el.querySelector('[data-cpb-close]');

      this.total   = this.slides.length;
      this.current = 0;
      this.timer   = null;
      this.speed   = parseInt(el.style.getPropertyValue('--cpb-speed'), 10) || 4000;

      if (this.total === 0) return;

      // Vérifier si l'utilisateur a déjà fermé la barre
      if (sessionStorage.getItem(STORAGE_KEY) === '1') {
        this.el.setAttribute('hidden', '');
        return;
      }

      this._bindEvents();
      if (this.total > 1) this._startTimer();
    }

    // ── Navigation ─────────────────────────────────────────────
    goTo(index) {
      const prev = this.current;
      this.current = ((index % this.total) + this.total) % this.total;
      if (prev === this.current) return;

      this.slides[prev].classList.remove('is-active');
      this.slides[prev].setAttribute('aria-hidden', 'true');
      this.slides[this.current].classList.add('is-active');
      this.slides[this.current].removeAttribute('aria-hidden');

      this.dots.forEach((dot, i) => {
        const on = i === this.current;
        dot.classList.toggle('is-active', on);
        dot.setAttribute('aria-selected', String(on));
      });

      // Redémarrer le timer
      this._resetTimer();
    }

    next() { this.goTo(this.current + 1); }
    prev() { this.goTo(this.current - 1); }

    // ── Timer auto-rotation ─────────────────────────────────────
    _startTimer() {
      this.timer = setInterval(() => this.next(), this.speed);
    }

    _resetTimer() {
      clearInterval(this.timer);
      if (this.total > 1) this._startTimer();
    }

    // ── Pause au survol ─────────────────────────────────────────
    _bindEvents() {
      this.prevBtn?.addEventListener('click', () => this.prev());
      this.nextBtn?.addEventListener('click', () => this.next());

      this.dots.forEach((dot) =>
        dot.addEventListener('click', () => this.goTo(+dot.dataset.cpbDot))
      );

      this.closeBtn?.addEventListener('click', () => {
        sessionStorage.setItem(STORAGE_KEY, '1');
        this.el.setAttribute('hidden', '');
        clearInterval(this.timer);
      });

      // Pause au survol (desktop)
      this.el.addEventListener('mouseenter', () => clearInterval(this.timer));
      this.el.addEventListener('mouseleave', () => {
        if (this.total > 1) this._startTimer();
      });

      // Swipe mobile
      let startX = 0;
      this.el.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
      }, { passive: true });
      this.el.addEventListener('touchend', (e) => {
        const delta = e.changedTouches[0].clientX - startX;
        if (Math.abs(delta) > 40) this.goTo(this.current + (delta < 0 ? 1 : -1));
      }, { passive: true });
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-cpb]').forEach((el) => {
      if (!el._cpbInit) el._cpbInit = new PromoBar(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('[data-cpb]');
    if (el) { el._cpbInit = new PromoBar(el); }
  });

})();
