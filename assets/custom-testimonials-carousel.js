/**
 * custom-testimonials-carousel.js
 * Carrousel témoignages — scroll-snap, autoplay, flèches, dots, touch
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class TestimonialsCarousel {
    constructor(carousel) {
      this.carousel  = carousel;
      this.track     = carousel.querySelector('[data-ctc-track]');
      this.slides    = Array.from(carousel.querySelectorAll('[data-ctc-slide]'));
      this.prevBtn   = carousel.querySelector('[data-ctc-prev]');
      this.nextBtn   = carousel.querySelector('[data-ctc-next]');
      this.dotsWrap  = carousel.querySelector('[data-ctc-dots]');
      this.dots      = this.dotsWrap ? Array.from(this.dotsWrap.querySelectorAll('[data-ctc-dot]')) : [];

      if (!this.track || this.slides.length === 0) return;

      // Config
      this.autoplay    = carousel.dataset.autoplay !== 'false';
      this.speed       = parseInt(carousel.dataset.speed, 10) || 5000;
      this.slideCount  = this.slides.length;
      this.currentIndex = 0;
      this._timer      = null;
      this._scrollEndTimer = null;

      this._bindEvents();
      this._updateArrows();

      if (this.autoplay && this.slideCount > 1) {
        this._startAutoplay();
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  NAVIGATION
    // ══════════════════════════════════════════════════════════════

    goTo(index) {
      // Wrap around
      const total  = this.slideCount;
      this.currentIndex = ((index % total) + total) % total;

      const targetSlide = this.slides[this.currentIndex];
      if (!targetSlide) return;

      // Scroll le track pour aligner le slide cible
      const trackRect  = this.track.getBoundingClientRect();
      const slideRect  = targetSlide.getBoundingClientRect();
      const offset     = slideRect.left - trackRect.left + this.track.scrollLeft;

      this.track.scrollTo({ left: offset, behavior: 'smooth' });
      this._setActive(this.currentIndex);
    }

    prev() { this.goTo(this.currentIndex - 1); }
    next() { this.goTo(this.currentIndex + 1); }

    // ── Mettre à jour dots et ARIA ────────────────────────────────
    _setActive(index) {
      this.currentIndex = index;

      this.dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });

      this._updateArrows();
    }

    _updateArrows() {
      // Pas de désactivation (boucle infinie) — optionnel selon préférence
      // Décommenter pour désactiver aux extrémités (sans boucle) :
      // if (this.prevBtn) this.prevBtn.disabled = this.currentIndex === 0;
      // if (this.nextBtn) this.nextBtn.disabled = this.currentIndex === this.slideCount - 1;
    }

    // ══════════════════════════════════════════════════════════════
    //  AUTOPLAY
    // ══════════════════════════════════════════════════════════════

    _startAutoplay() {
      this._stopAutoplay();
      this._timer = setInterval(() => this.next(), this.speed);
    }

    _stopAutoplay() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  ÉVÉNEMENTS
    // ══════════════════════════════════════════════════════════════

    _bindEvents() {
      // Flèches
      this.prevBtn?.addEventListener('click', () => {
        this._stopAutoplay();
        this.prev();
        if (this.autoplay) this._startAutoplay();
      });

      this.nextBtn?.addEventListener('click', () => {
        this._stopAutoplay();
        this.next();
        if (this.autoplay) this._startAutoplay();
      });

      // Dots
      this.dots.forEach((dot) => {
        dot.addEventListener('click', () => {
          const idx = parseInt(dot.dataset.ctcDot, 10);
          this._stopAutoplay();
          this.goTo(idx);
          if (this.autoplay) this._startAutoplay();
        });
      });

      // Pause au survol / focus
      this.carousel.addEventListener('mouseenter', () => this._stopAutoplay());
      this.carousel.addEventListener('mouseleave', () => {
        if (this.autoplay) this._startAutoplay();
      });
      this.carousel.addEventListener('focusin', () => this._stopAutoplay());
      this.carousel.addEventListener('focusout', () => {
        if (this.autoplay) this._startAutoplay();
      });

      // Détection du slide actif après scroll natif (swipe touch)
      this.track.addEventListener('scroll', () => {
        clearTimeout(this._scrollEndTimer);
        this._scrollEndTimer = setTimeout(() => {
          this._detectCurrentSlide();
        }, 80);
      }, { passive: true });

      // Clavier sur le carousel
      this.carousel.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); this.prev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
      });
    }

    // ── Détecter le slide visible après scroll libre ──────────────
    _detectCurrentSlide() {
      const trackLeft   = this.track.scrollLeft;
      const trackWidth  = this.track.offsetWidth;
      const center      = trackLeft + trackWidth / 2;

      let closest     = 0;
      let closestDist = Infinity;

      this.slides.forEach((slide, i) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const dist        = Math.abs(slideCenter - center);
        if (dist < closestDist) {
          closestDist = dist;
          closest     = i;
        }
      });

      if (closest !== this.currentIndex) {
        this._setActive(closest);
      }
    }
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-ctc-carousel]').forEach((carousel) => {
      if (!carousel._ctcInit) {
        carousel._ctcInit = new TestimonialsCarousel(carousel);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    e.target.querySelectorAll('[data-ctc-carousel]').forEach((carousel) => {
      carousel._ctcInit = new TestimonialsCarousel(carousel);
    });
  });
})();
