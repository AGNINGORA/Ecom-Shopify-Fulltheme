/**
 * custom-reviews.js
 * Avis clients – filtre, tri, pagination "voir plus"
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class Reviews {
    constructor(root) {
      this.root        = root;
      this.list        = root.querySelector('[data-crv-list]');
      this.perPage     = parseInt(this.list?.dataset.perPage, 10) || 5;
      this.layout      = this.list?.dataset.crvLayout || 'grid';
      this.sortSelect  = root.querySelector('[data-crv-sort]');
      this.filterBtns  = Array.from(root.querySelectorAll('[data-filter-star]'));
      this.filterLabel = root.querySelector('[data-crv-filter-label]');
      this.filterText  = root.querySelector('[data-crv-filter-text]');
      this.clearBtn    = root.querySelector('[data-crv-clear-filter]');
      this.loadMoreBtn = root.querySelector('[data-crv-load-more]');
      this.remainingEl = root.querySelector('[data-crv-remaining]');
      this.prevBtn     = root.querySelector('[data-crv-prev]');
      this.nextBtn     = root.querySelector('[data-crv-next]');

      // Récupère tous les avis depuis le DOM et stocke leurs données
      this.allReviews  = Array.from(root.querySelectorAll('[data-crv-review]')).map((el) => ({
        el,
        rating:  parseInt(el.dataset.rating, 10),
        date:    el.dataset.date || '',
        index:   parseInt(el.dataset.index, 10),
      }));

      // État
      this.activeFilter  = null; // null = tous
      this.currentSort   = 'date-desc';
      this.shown         = this.perPage;
      this._autoPlayId   = null;

      this._bindEvents();
      this._render();

      // Carrousel : init après render
      if (this.layout === 'carousel') {
        this._bindCarousel();
        this._startAutoPlay();
      }
    }

    // ── Liaisons événements ──────────────────────────────────────
    _bindEvents() {
      // Filtres par note (barres)
      this.filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const star = parseInt(btn.dataset.filterStar, 10);
          if (this.activeFilter === star) {
            this._clearFilter();
          } else {
            this._setFilter(star);
          }
        });
      });

      // Effacer le filtre
      this.clearBtn?.addEventListener('click', () => this._clearFilter());

      // Tri
      this.sortSelect?.addEventListener('change', () => {
        this.currentSort = this.sortSelect.value;
        this.shown = this.perPage;
        this._render();
      });

      // Voir plus
      this.loadMoreBtn?.addEventListener('click', () => {
        this.shown += this.perPage;
        this._render();
      });
    }

    // ── Appliquer un filtre ──────────────────────────────────────
    _setFilter(star) {
      this.activeFilter = star;
      this.shown        = this.perPage;

      // UI barres
      this.filterBtns.forEach((b) => {
        b.classList.toggle('is-active', parseInt(b.dataset.filterStar, 10) === star);
      });

      // Label filtre actif
      if (this.filterLabel) this.filterLabel.hidden = false;
      if (this.filterText)  this.filterText.textContent = `${star} étoile${star > 1 ? 's' : ''}`;

      this._render();
    }

    // ── Effacer le filtre ────────────────────────────────────────
    _clearFilter() {
      this.activeFilter = null;
      this.shown        = this.perPage;

      this.filterBtns.forEach((b) => b.classList.remove('is-active'));
      if (this.filterLabel) this.filterLabel.hidden = true;

      this._render();
    }

    // ── Tri ──────────────────────────────────────────────────────
    _sort(reviews) {
      const sorted = [...reviews];

      switch (this.currentSort) {
        case 'date-asc':
          // On utilise l'index original comme proxy de date ASC
          sorted.sort((a, b) => a.index - b.index);
          break;
        case 'date-desc':
          sorted.sort((a, b) => b.index - a.index);
          break;
        case 'rating-desc':
          sorted.sort((a, b) => b.rating - a.rating || b.index - a.index);
          break;
        case 'rating-asc':
          sorted.sort((a, b) => a.rating - b.rating || a.index - b.index);
          break;
        default:
          sorted.sort((a, b) => b.index - a.index);
      }

      return sorted;
    }

    // ── Rendu principal ──────────────────────────────────────────
    _render() {
      // Filtrer
      let filtered = this.activeFilter !== null
        ? this.allReviews.filter((r) => r.rating === this.activeFilter)
        : [...this.allReviews];

      // Trier
      filtered = this._sort(filtered);

      const total   = filtered.length;
      const visible = filtered.slice(0, this.shown);
      const hidden  = filtered.slice(this.shown);

      // Réorganiser les éléments dans le DOM selon le tri
      if (this.list) {
        visible.forEach(({ el }, i) => {
          el.hidden = false;
          // Réinsérer dans le bon ordre
          this.list.appendChild(el);
        });
      }

      // Masquer les avis hors de la sélection
      hidden.forEach(({ el }) => { el.hidden = true; });

      // Masquer les avis qui ne correspondent pas au filtre
      this.allReviews.forEach(({ el, rating }) => {
        if (this.activeFilter !== null && rating !== this.activeFilter) {
          el.hidden = true;
        }
      });

      // Bouton "Voir plus"
      const remaining = total - this.shown;
      if (this.loadMoreBtn) {
        this.loadMoreBtn.hidden = remaining <= 0;
        if (this.remainingEl) {
          this.remainingEl.textContent = `(${Math.max(0, remaining)} restant${remaining > 1 ? 's' : ''})`;
        }
      }
    }
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.custom-reviews[data-section-id]').forEach((el) => {
      if (!el._rvInit) el._rvInit = new Reviews(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('.custom-reviews');
    if (el) el._rvInit = new Reviews(el);
  });
})();
