/**
 * custom-before-after.js
 * Mode Single  : Slider Avant/Après (drag + touch) + Compteurs animés
 * Mode Galerie : Mini-sliders identiques + expand "Voir plus"
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  //  SLIDER BEFORE / AFTER
  //  Fonctionne pour les sliders grand format (mode Single)
  //  ET pour les mini-sliders dans les cartes (mode Galerie)
  // ══════════════════════════════════════════════════════════════

  class BeforeAfterSlider {
    constructor(el) {
      this.el       = el;
      this.before   = el.querySelector('[data-cba-before]');
      this.divider  = el.querySelector('[data-cba-divider]');
      this.position = 50;

      this._fixImageWidth();
      this._setPosition(50);
      this._bindEvents();
    }

    // L'image avant doit rester à la largeur du slider,
    // même quand son conteneur est rogné par clip
    _fixImageWidth() {
      const img = this.before?.querySelector('.cba__img');
      if (!img) return;

      const updateWidth = () => {
        img.style.width  = this.el.offsetWidth  + 'px';
        img.style.height = this.el.offsetHeight + 'px';
      };
      updateWidth();
      new ResizeObserver(updateWidth).observe(this.el);
    }

    _setPosition(pct) {
      this.position = Math.max(2, Math.min(98, pct));
      if (this.before)  this.before.style.width  = this.position + '%';
      if (this.divider) this.divider.style.left   = this.position + '%';
    }

    _pctFromEvent(clientX) {
      const rect = this.el.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * 100;
    }

    _bindEvents() {
      // ── Souris ────────────────────────────────────────────────
      this.el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.el.dataset.dragging = '1';
        this._setPosition(this._pctFromEvent(e.clientX));

        const onMove = (e) => this._setPosition(this._pctFromEvent(e.clientX));
        const onUp   = () => {
          delete this.el.dataset.dragging;
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup',   onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup',   onUp);
      });

      // ── Touch ──────────────────────────────────────────────────
      this.el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.el.dataset.dragging = '1';
        this._setPosition(this._pctFromEvent(e.touches[0].clientX));
      }, { passive: false });

      this.el.addEventListener('touchmove', (e) => {
        e.preventDefault();
        this._setPosition(this._pctFromEvent(e.touches[0].clientX));
      }, { passive: false });

      this.el.addEventListener('touchend', () => {
        delete this.el.dataset.dragging;
      });

      // ── Clavier ────────────────────────────────────────────────
      this.el.setAttribute('tabindex', '0');
      this.el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); this._setPosition(this.position - 2); }
        if (e.key === 'ArrowRight') { e.preventDefault(); this._setPosition(this.position + 2); }
        if (e.key === 'Home')       { e.preventDefault(); this._setPosition(2); }
        if (e.key === 'End')        { e.preventDefault(); this._setPosition(98); }
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  EXPAND "VOIR PLUS" — témoignage tronqué 3 lignes
  // ══════════════════════════════════════════════════════════════

  class TestimonialExpand {
    constructor(card) {
      this.textEl = card.querySelector('[data-cba-testi-text]');
      this.btn    = card.querySelector('[data-cba-testi-more]');
      if (!this.textEl || !this.btn) return;

      // Vérifie après rendu si le texte dépasse 3 lignes
      // requestAnimationFrame garantit que le layout est calculé
      requestAnimationFrame(() => {
        if (this.textEl.scrollHeight <= this.textEl.clientHeight + 2) {
          this.btn.hidden = true; // texte court : pas besoin du bouton
          return;
        }
        this.btn.addEventListener('click', () => this._toggle());
      });
    }

    _toggle() {
      const expanded = this.btn.getAttribute('aria-expanded') === 'true';
      this.textEl.classList.toggle('is-expanded', !expanded);
      this.btn.setAttribute('aria-expanded', String(!expanded));
      this.btn.textContent = !expanded ? 'Voir moins' : 'Voir plus';
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  COMPTEURS ANIMÉS (mode Single)
  // ══════════════════════════════════════════════════════════════

  class StatCounter {
    constructor(statEl) {
      this.el        = statEl;
      this.countEl   = statEl.querySelector('[data-cba-count]');
      const raw      = statEl.dataset.value || '0';
      this.isDecimal = raw.includes('.');
      this.target    = parseFloat(raw);
      this.decimals  = this.isDecimal ? (raw.split('.')[1] || '').length : 0;
      this.animated  = false;
    }

    animate() {
      if (this.animated) return;
      this.animated = true;

      const duration = 1800;
      const start    = performance.now();
      const target   = this.target;
      const countEl  = this.countEl;
      const decimals = this.decimals;
      const ease     = (t) => 1 - Math.pow(1 - t, 4);

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const value    = target * ease(progress);

        if (countEl) {
          countEl.textContent = decimals > 0
            ? value.toFixed(decimals)
            : Math.floor(value).toString();
        }

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else if (countEl) {
          countEl.textContent = decimals > 0 ? target.toFixed(decimals) : target.toString();
        }
      };

      requestAnimationFrame(tick);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT SECTION — gère les deux modes
  // ══════════════════════════════════════════════════════════════

  class BeforeAfterSection {
    constructor(root) {
      this.root = root;

      // ── Sliders (mode Single ET galerie) ──────────────────────
      // BeforeAfterSlider fonctionne pour [data-cba-slider] peu
      // importe sa taille — le CSS adapte l'aspect-ratio.
      root.querySelectorAll('[data-cba-slider]').forEach((el) => {
        new BeforeAfterSlider(el);
      });

      // ── Expand "Voir plus" (mode Galerie) ─────────────────────
      root.querySelectorAll('[data-cba-testi-card]').forEach((card) => {
        new TestimonialExpand(card);
      });

      // ── Compteurs animés (mode Single) ────────────────────────
      const statEls = Array.from(root.querySelectorAll('[data-cba-stat]'));
      if (statEls.length === 0) return;

      const counters = statEls.map((el) => new StatCounter(el));

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              counters.forEach((c) => c.animate());
              observer.disconnect();
            }
          });
        },
        { threshold: 0.25 },
      );

      const statsWrap = root.querySelector('[data-cba-stats]');
      if (statsWrap) observer.observe(statsWrap);
    }
  }

  // ── Init globale ──────────────────────────────────────────────

  function init() {
    document.querySelectorAll('.custom-before-after[data-section-id]').forEach((el) => {
      if (!el._cbaInit) el._cbaInit = new BeforeAfterSection(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('.custom-before-after');
    if (el) el._cbaInit = new BeforeAfterSection(el);
  });
})();
