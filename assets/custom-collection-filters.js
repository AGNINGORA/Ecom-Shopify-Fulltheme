/* =============================================================
   custom-collection-filters.js
   Filtres AJAX collection — history.pushState + fetch sections API
   Dawn 15.x · Vanilla JS
   ============================================================= */

(function () {
  'use strict';

  class CollectionFilters {
    constructor(el) {
      this.el          = el;
      this.grid        = el.querySelector('[data-ccf-grid]');
      this.toolbar     = el.querySelector('[data-ccf-toolbar]');
      this.countEl     = el.querySelector('[data-ccf-count-num]');
      this.activeFilters = el.querySelector('[data-ccf-active-filters]');
      this.spinner     = document.querySelector('[data-ccf-spinner]');
      this.drawer      = document.getElementById('ccf-filters-drawer');
      this.overlay     = document.querySelector('[data-ccf-overlay]');
      this.drawerCount = document.querySelector('[data-ccf-drawer-count]');

      this._loading = false;
      this._abortCtrl = null;

      this._bindEvents();
    }

    // ── Événements ───────────────────────────────────────────
    _bindEvents() {
      // Tri
      this.toolbar?.querySelector('[data-ccf-sort]')
        ?.addEventListener('change', (e) => {
          const url = new URL(window.location.href);
          url.searchParams.set('sort_by', e.target.value);
          url.searchParams.delete('page');
          this._navigate(url.toString());
        });

      // Filtres par checkbox
      document.addEventListener('change', (e) => {
        const cb = e.target.closest('[data-ccf-filter-checkbox]');
        if (!cb) return;
        const url = cb.checked ? cb.dataset.urlActive : cb.dataset.urlRemove;
        if (url) this._navigate(url);
      });

      // Prix range — double slider
      document.querySelectorAll('[data-ccf-price-range]').forEach(wrap => {
        const minR = wrap.querySelector('[data-ccf-range-min]');
        const maxR = wrap.querySelector('[data-ccf-range-max]');
        const minI = wrap.querySelector('[data-ccf-price-min-input]');
        const maxI = wrap.querySelector('[data-ccf-price-max-input]');
        const fill = wrap.querySelector('[data-ccf-price-fill]');

        if (!minR || !maxR) return;

        const updateFill = () => {
          const max    = parseFloat(maxR.max) || 1;
          const minPct = (parseFloat(minR.value) / max) * 100;
          const maxPct = (parseFloat(maxR.value) / max) * 100;
          if (fill) {
            fill.style.left  = minPct + '%';
            fill.style.width = (maxPct - minPct) + '%';
          }
        };

        minR.addEventListener('input', () => {
          const v = parseFloat(minR.value);
          const m = parseFloat(maxR.value);
          if (v > m) minR.value = m;
          if (minI) minI.value = minR.value;
          updateFill();
        });

        maxR.addEventListener('input', () => {
          const v = parseFloat(maxR.value);
          const m = parseFloat(minR.value);
          if (v < m) maxR.value = m;
          if (maxI) maxI.value = maxR.value;
          updateFill();
        });

        // Soumettre au mouseup / touchend
        [minR, maxR].forEach(r => {
          r.addEventListener('change', () => this._applyPriceFilter(wrap));
        });

        // Inputs texte
        let priceDebounce;
        [minI, maxI].forEach(inp => {
          inp?.addEventListener('input', () => {
            clearTimeout(priceDebounce);
            if (minI) minR.value = minI.value || minR.min;
            if (maxI) maxR.value = maxI.value || maxR.max;
            updateFill();
            priceDebounce = setTimeout(() => this._applyPriceFilter(wrap), 600);
          });
        });

        updateFill();
      });

      // Liens filtres (actifs, pagination, clear)
      document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-ccf-filter-link]');
        if (!link || !link.href) return;
        e.preventDefault();
        this._navigate(link.href);
      });

      // Drawer filtres mobile
      document.querySelector('[data-ccf-open-filters]')
        ?.addEventListener('click', () => this._openDrawer());

      document.querySelectorAll('[data-ccf-close-filters]').forEach(btn =>
        btn.addEventListener('click', () => this._closeDrawer())
      );

      this.overlay?.addEventListener('click', () => this._closeDrawer());

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.drawer && !this.drawer.hidden) {
          this._closeDrawer();
        }
      });

      // Load more
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ccf-load-btn]');
        if (!btn) return;
        const page = parseInt(btn.dataset.page, 10) || 2;
        const url  = new URL(window.location.href);
        url.searchParams.set('page', page);
        this._loadMore(url.toString(), btn);
      });

      // Popstate (back/forward)
      window.addEventListener('popstate', () => {
        this._fetchAndRender(window.location.href, false);
      });
    }

    // ── Filtre prix ──────────────────────────────────────────
    _applyPriceFilter(wrap) {
      const minI = wrap.querySelector('[data-ccf-price-min-input]');
      const maxI = wrap.querySelector('[data-ccf-price-max-input]');
      const url  = new URL(window.location.href);

      if (minI?.name) url.searchParams.set(minI.name, minI.value || '');
      if (maxI?.name) url.searchParams.set(maxI.name, maxI.value || '');
      url.searchParams.delete('page');

      this._navigate(url.toString());
    }

    // ── Navigation AJAX principale ───────────────────────────
    _navigate(url) {
      history.pushState(null, '', url);
      this._fetchAndRender(url, true);
      this._closeDrawer();
    }

    async _fetchAndRender(url, scrollTop = true) {
      if (this._loading) {
        this._abortCtrl?.abort();
      }

      this._loading    = true;
      this._abortCtrl  = new AbortController();

      this.grid?.classList.add('is-loading');
      if (this.spinner) this.spinner.removeAttribute('hidden');

      try {
        const res = await fetch(url, {
          signal:  this._abortCtrl.signal,
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        if (!res.ok) throw new Error('Fetch error');
        const html = await res.text();
        const doc  = new DOMParser().parseFromString(html, 'text/html');

        // Mettre à jour la grille
        const newGrid = doc.querySelector('[data-ccf-grid]');
        if (newGrid && this.grid) {
          this.grid.innerHTML   = newGrid.innerHTML;
          this.grid.style.cssText = newGrid.style.cssText;
        }

        // Mettre à jour le compteur
        const newCount = doc.querySelector('[data-ccf-count-num]');
        if (newCount && this.countEl) {
          this.countEl.textContent = newCount.textContent;
        }

        // Mettre à jour les filtres actifs
        const newActive = doc.querySelector('[data-ccf-active-filters]');
        if (this.activeFilters) {
          if (newActive) {
            this.activeFilters.innerHTML = newActive.innerHTML;
            this.activeFilters.removeAttribute('hidden');
          } else {
            this.activeFilters.innerHTML = '';
          }
        }

        // Mettre à jour le badge "Filtres (N)"
        const newBadge = doc.querySelector('[data-ccf-active-count]');
        const badge    = this.el.querySelector('[data-ccf-active-count]');
        const filterBtn = this.el.querySelector('[data-ccf-open-filters]');
        if (badge && newBadge) {
          badge.textContent = newBadge.textContent;
          badge.removeAttribute('hidden');
        } else if (badge) {
          badge.setAttribute('hidden', '');
        }

        // Mettre à jour la pagination / load more
        const newPagination = doc.querySelector('[data-ccf-pagination], [data-ccf-load-more]');
        const oldPagination = this.el.querySelector('[data-ccf-pagination], [data-ccf-load-more]');
        if (oldPagination) {
          if (newPagination) {
            oldPagination.outerHTML = newPagination.outerHTML;
          } else {
            oldPagination.remove();
          }
        }

        // Mettre à jour les filtres dans la sidebar / drawer
        const newFilterPanels = doc.querySelectorAll('[data-ccf-filter-group]');
        const oldFilterPanels = document.querySelectorAll('[data-ccf-filter-group]');
        oldFilterPanels.forEach((old, i) => {
          if (newFilterPanels[i]) old.outerHTML = newFilterPanels[i].outerHTML;
        });

        // Mettre à jour le compteur drawer
        if (this.drawerCount) {
          const cnt = newCount?.textContent?.trim() || '';
          this.drawerCount.textContent = cnt ? `(${cnt})` : '';
        }

        // Scroll haut
        if (scrollTop) {
          this.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Rebind quick-add après refresh DOM
        this._bindQuickAdd();

      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[CollectionFilters] Fetch error:', err);
        }
      } finally {
        this._loading = false;
        this.grid?.classList.remove('is-loading');
        if (this.spinner) this.spinner.setAttribute('hidden', '');
      }
    }

    // ── Load more (append) ───────────────────────────────────
    async _loadMore(url, btn) {
      if (this._loading) return;
      this._loading = true;

      const origText  = btn.innerHTML;
      btn.disabled    = true;
      btn.textContent = 'Chargement…';

      try {
        const res  = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const html = await res.text();
        const doc  = new DOMParser().parseFromString(html, 'text/html');

        const newItems = doc.querySelectorAll('[data-ccf-grid] .ccf__card');
        newItems.forEach(item => this.grid?.appendChild(item.cloneNode(true)));

        // Mettre à jour la page et vérifier s'il reste des produits
        const nextPage   = parseInt(btn.dataset.page, 10) + 1;
        const total      = parseInt(btn.dataset.total, 10) || 0;
        const perPage    = parseInt(btn.dataset.per, 10) || 24;
        const loaded     = (nextPage - 1) * perPage;

        if (loaded >= total) {
          btn.closest('[data-ccf-load-more]')?.remove();
        } else {
          btn.dataset.page = nextPage;
          btn.innerHTML    = origText;
          const remaining  = total - loaded;
          const remEl      = btn.querySelector('.ccf__load-remaining');
          if (remEl) remEl.textContent = `(encore ${remaining})`;
          btn.disabled = false;
        }

        history.pushState(null, '', url);
        this._bindQuickAdd();

      } catch (_) {
        btn.innerHTML = origText;
        btn.disabled  = false;
      } finally {
        this._loading = false;
      }
    }

    // ── Drawer ───────────────────────────────────────────────
    _openDrawer() {
      if (!this.drawer) return;
      this.drawer.removeAttribute('hidden');
      this.overlay?.classList.add('is-open');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.drawer.classList.add('is-open');
        });
      });
      this.drawer.focus();
      document.body.style.overflow = 'hidden';
    }

    _closeDrawer() {
      if (!this.drawer || this.drawer.hidden) return;
      this.drawer.classList.remove('is-open');
      this.overlay?.classList.remove('is-open');
      setTimeout(() => {
        this.drawer.setAttribute('hidden', '');
        document.body.style.overflow = '';
      }, 300);
    }

    // ── ATC rapide sur les cards ─────────────────────────────
    _bindQuickAdd() {
      this.el.querySelectorAll('[data-ccf-quick-add]').forEach(btn => {
        if (btn._ccfBound) return;
        btn._ccfBound = true;
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const variantId = btn.dataset.ccfQuickAdd;
          if (!variantId) return;

          btn.disabled = true;
          const orig   = btn.innerHTML;
          btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2.2"
              stroke-dasharray="22" stroke-dashoffset="8" stroke-linecap="round"
              style="animation: ccf-spin 0.7s linear infinite"/>
          </svg>`;

          try {
            const res  = await fetch('/cart/add.js', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
              body:    JSON.stringify({ id: variantId, quantity: 1 }),
            });
            if (res.ok) {
              btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                <path d="M4 10L8.5 14.5L16 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
              </svg>`;
              btn.style.background = '#22c55e';

              const cart = await fetch('/cart.js').then(r => r.json());
              document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));

              setTimeout(() => {
                btn.innerHTML       = orig;
                btn.style.background = '';
                btn.disabled        = false;
              }, 2000);
            } else {
              throw new Error();
            }
          } catch (_) {
            btn.innerHTML = orig;
            btn.disabled  = false;
          }
        });
      });
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-ccf]').forEach(el => {
      if (!el._ccfInit) el._ccfInit = new CollectionFilters(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('[data-ccf]');
    if (el) { el._ccfInit = null; el._ccfInit = new CollectionFilters(el); }
  });

})();
