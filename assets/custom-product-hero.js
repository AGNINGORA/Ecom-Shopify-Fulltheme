(function () {
  'use strict';

  class ProductGallery {
    constructor(sectionEl) {
      this.root    = sectionEl;
      this.track   = sectionEl.querySelector('[id^="gallery-track-"]');
      this.slides  = Array.from(sectionEl.querySelectorAll('.gallery__slide'));
      this.dots    = Array.from(sectionEl.querySelectorAll('[data-dot]'));
      this.thumbs  = Array.from(sectionEl.querySelectorAll('[data-thumb]'));
      this.prevBtn = sectionEl.querySelector('[data-gallery-prev]');
      this.nextBtn = sectionEl.querySelector('[data-gallery-next]');
      this.zooms   = Array.from(sectionEl.querySelectorAll('[data-zoom]'));
      this.current = 0;
      this.total   = this.slides.length;
      this._dragStartX = 0;
      this._dragging   = false;

      this._bindVariantChange();

      if (this.total <= 1) return;

      this._bindArrows();
      this._bindDots();
      this._bindThumbs();
      this._bindSwipe();
      this._bindZoom();
    }

    // ── Navigation ────────────────────────────────────────────────────────
    goTo(index) {
      const prev = this.current;
      this.current = ((index % this.total) + this.total) % this.total;

      this.slides[prev].classList.remove('is-active');
      this.slides[this.current].classList.add('is-active');

      // Pause la vidéo du slide quitté
      const video = this.slides[prev].querySelector('video');
      if (video) video.pause();

      this._syncIndicators();
    }

    _syncIndicators() {
      const active = this.current;
      [...this.dots, ...this.thumbs].forEach((el) => {
        const i   = parseInt(el.dataset.dot ?? el.dataset.thumb, 10);
        const on  = i === active;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-selected', String(on));
      });
    }

    // ── Flèches ───────────────────────────────────────────────────────────
    _bindArrows() {
      this.prevBtn?.addEventListener('click', () => this.goTo(this.current - 1));
      this.nextBtn?.addEventListener('click', () => this.goTo(this.current + 1));
    }

    // ── Dots ──────────────────────────────────────────────────────────────
    _bindDots() {
      this.dots.forEach((dot) =>
        dot.addEventListener('click', () => this.goTo(+dot.dataset.dot))
      );
    }

    // ── Miniatures ────────────────────────────────────────────────────────
    _bindThumbs() {
      this.thumbs.forEach((thumb) =>
        thumb.addEventListener('click', () => this.goTo(+thumb.dataset.thumb))
      );
    }

    // ── Swipe (touch + drag souris) ───────────────────────────────────────
    _bindSwipe() {
      const t = this.track;

      // Touch
      t.addEventListener('touchstart', (e) => {
        this._dragStartX = e.touches[0].clientX;
        this._dragging   = true;
      }, { passive: true });

      t.addEventListener('touchend', (e) => {
        if (!this._dragging) return;
        const delta = e.changedTouches[0].clientX - this._dragStartX;
        if (Math.abs(delta) > 40) this.goTo(this.current + (delta < 0 ? 1 : -1));
        this._dragging = false;
      }, { passive: true });

      // Souris
      t.addEventListener('mousedown', (e) => {
        this._dragStartX = e.clientX;
        this._dragging   = true;
      });

      t.addEventListener('mouseup', (e) => {
        if (!this._dragging) return;
        const delta = e.clientX - this._dragStartX;
        if (Math.abs(delta) > 40) this.goTo(this.current + (delta < 0 ? 1 : -1));
        this._dragging = false;
      });

      t.addEventListener('mouseleave', () => { this._dragging = false; });
    }

    // ── Changement de variante → navigation vers l'image associée ─────────
    _bindVariantChange() {
      document.addEventListener('variant:change', (e) => {
        const variant = e.detail?.variant;
        if (!variant || !variant.featured_media) return;

        const mediaId = variant.featured_media.id;
        const targetSlide = this.slides.findIndex(
          (s) => s.dataset.mediaId === String(mediaId)
        );

        if (targetSlide >= 0 && targetSlide !== this.current) {
          this.goTo(targetSlide);
        }
      });
    }

    // ── Zoom au survol (desktop uniquement) ───────────────────────────────
    _bindZoom() {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

      this.zooms.forEach((wrap) => {
        const img = wrap.querySelector('img');
        if (!img) return;

        wrap.addEventListener('mousemove', (e) => {
          const r    = wrap.getBoundingClientRect();
          const xPct = ((e.clientX - r.left) / r.width)  * 100;
          const yPct = ((e.clientY - r.top)  / r.height) * 100;
          img.style.transformOrigin = `${xPct}% ${yPct}%`;
          img.classList.add('is-zoomed');
        });

        wrap.addEventListener('mouseleave', () => {
          img.classList.remove('is-zoomed');
          img.style.transformOrigin = 'center center';
        });
      });
    }
  }

  // ── Initialisation ────────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.custom-product-hero[data-section-id]').forEach((el) => {
      if (!el._galleryInit) {
        el._galleryInit = new ProductGallery(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Rechargement dans l'éditeur de thème Shopify
  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('.custom-product-hero');
    if (el) { el._galleryInit = new ProductGallery(el); }
  });

})();

// ── Date de livraison estimée (jours ouvrés → date réelle) ──────────
(function () {
  'use strict';

  function addBusinessDays(date, days) {
    let d = new Date(date);
    let added = 0;
    while (added < days) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      if (day !== 0 && day !== 6) added++; // ignore Sam=6, Dim=0
    }
    return d;
  }

  function initDeliveryDates() {
    document.querySelectorAll('.cph__delivery[data-delivery-min]').forEach((el) => {
      const min = parseInt(el.dataset.deliveryMin, 10);
      if (!min || isNaN(min)) return;
      const span = el.querySelector('[data-cph-delivery-date]');
      if (!span) return;
      const estimated = addBusinessDays(new Date(), min);
      const locale = document.documentElement.lang || 'fr-FR';
      span.textContent = estimated.toLocaleDateString(locale, {
        weekday: 'long',
        day:     'numeric',
        month:   'long',
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeliveryDates);
  } else {
    initDeliveryDates();
  }
  document.addEventListener('shopify:section:load', initDeliveryDates);
})();
