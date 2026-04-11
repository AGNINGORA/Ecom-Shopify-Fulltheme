/**
 * custom-wishlist.js
 * Wishlist basée sur localStorage — Dawn 15.x · Vanilla JS
 *
 * Architecture :
 *  WishlistStore  — lecture/écriture localStorage
 *  WishlistButton — bouton cœur (carte produit + page produit)
 *  WishlistHeader — compteur dans le header
 *  WishlistPage   — page liste de souhaits (fetch AJAX)
 */

(function () {
  'use strict';

  const WL_KEY = 'cwl_items'; // localStorage key → tableau de handles

  // ══════════════════════════════════════════════════════════════
  //  STORE — lecture / écriture localStorage
  // ══════════════════════════════════════════════════════════════

  const WishlistStore = {
    _read() {
      try {
        return JSON.parse(localStorage.getItem(WL_KEY)) || [];
      } catch {
        return [];
      }
    },
    _write(items) {
      localStorage.setItem(WL_KEY, JSON.stringify(items));
    },
    get()          { return this._read(); },
    count()        { return this._read().length; },
    has(handle)    { return this._read().includes(handle); },
    add(handle)    {
      const items = this._read();
      if (!items.includes(handle)) { items.push(handle); this._write(items); }
    },
    remove(handle) {
      this._write(this._read().filter((h) => h !== handle));
    },
    toggle(handle) {
      this.has(handle) ? this.remove(handle) : this.add(handle);
      return this.has(handle); // true = ajouté
    },
  };

  // ══════════════════════════════════════════════════════════════
  //  EVENTS — bus interne pour synchroniser les composants
  // ══════════════════════════════════════════════════════════════

  function emitChange(handle, isActive) {
    document.dispatchEvent(
      new CustomEvent('cwl:change', { detail: { handle, isActive } })
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  BOUTON CŒUR
  // ══════════════════════════════════════════════════════════════

  class WishlistButton {
    constructor(el) {
      this.el     = el;
      this.handle = el.getAttribute('data-cwl-handle');
      if (!this.handle) return;

      this._syncState();
      this._bindClick();
      this._listenChange();
    }

    _syncState() {
      const active = WishlistStore.has(this.handle);
      this.el.classList.toggle('is-active', active);
      this.el.setAttribute('aria-pressed', String(active));

      // Label textuel (variante page produit)
      if (this.el.hasAttribute('data-cwl-label')) {
        this.el.setAttribute(
          'data-cwl-label',
          active ? 'Retirer des souhaits' : 'Ajouter aux souhaits'
        );
      }
    }

    _bindClick() {
      this.el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isNowActive = WishlistStore.toggle(this.handle);

        // Animation pop
        this.el.classList.remove('is-animating');
        void this.el.offsetWidth; // reflow pour relancer l'animation
        this.el.classList.add('is-animating');
        this.el.addEventListener(
          'animationend',
          () => this.el.classList.remove('is-animating'),
          { once: true }
        );

        emitChange(this.handle, isNowActive);
      });
    }

    _listenChange() {
      document.addEventListener('cwl:change', (e) => {
        if (e.detail.handle === this.handle) this._syncState();
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  COMPTEUR HEADER
  // ══════════════════════════════════════════════════════════════

  class WishlistHeader {
    constructor() {
      this.countEl = document.querySelector('[data-cwl-count]');
      if (!this.countEl) return;

      this._update();
      document.addEventListener('cwl:change', () => this._update());
    }

    _update() {
      const n = WishlistStore.count();
      this.countEl.textContent   = n > 0 ? n : '';
      this.countEl.classList.toggle('is-visible', n > 0);
      this.countEl.setAttribute('aria-label', `${n} article${n > 1 ? 's' : ''} en liste de souhaits`);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  PAGE WISHLIST
  // ══════════════════════════════════════════════════════════════

  class WishlistPage {
    constructor(el) {
      this.el        = el;
      this.gridEl    = el.querySelector('[data-cwl-grid]');
      this.emptyEl   = el.querySelector('[data-cwl-empty]');
      this.loadingEl = el.querySelector('[data-cwl-loading]');
      this.countEl   = el.querySelector('[data-cwl-page-count]');

      this._load();
    }

    async _load() {
      const handles = WishlistStore.get();

      this._showLoading(true);

      if (handles.length === 0) {
        this._showEmpty();
        return;
      }

      // Fetch tous les produits en parallèle via l'API AJAX Shopify
      const results = await Promise.allSettled(
        handles.map((h) =>
          fetch(`/products/${h}.js`, { headers: { 'Content-Type': 'application/json' } })
            .then((r) => (r.ok ? r.json() : null))
        )
      );

      const products = results
        .filter((r) => r.status === 'fulfilled' && r.value)
        .map((r) => r.value);

      this._showLoading(false);

      if (products.length === 0) {
        this._showEmpty();
        return;
      }

      this._renderGrid(products);
      if (this.countEl) {
        this.countEl.textContent = `${products.length} article${products.length > 1 ? 's' : ''}`;
      }
    }

    _renderGrid(products) {
      if (!this.gridEl) return;
      this.gridEl.innerHTML = '';
      this.gridEl.hidden    = false;
      if (this.emptyEl) this.emptyEl.hidden = true;

      products.forEach((product) => {
        const card = this._buildCard(product);
        this.gridEl.appendChild(card);
      });
    }

    _buildCard(product) {
      const variant  = product.variants[0];
      const imageUrl = product.featured_image
        ? product.featured_image + '&width=600'
        : null;

      const hasSale = variant.compare_at_price && variant.compare_at_price > variant.price;

      const card = document.createElement('div');
      card.className = 'cwlp__card';
      card.setAttribute('data-cwl-card', product.handle);

      card.innerHTML = `
        <div class="cwlp__card-img-wrap">
          ${imageUrl
            ? `<img class="cwlp__card-img" src="${imageUrl}" alt="${this._esc(product.title)}" loading="lazy" width="300" height="300">`
            : `<div class="cwlp__card-img" style="background:#f0ece6"></div>`
          }
          <button
            class="cwlp__card-remove"
            data-cwl-remove="${this._esc(product.handle)}"
            aria-label="Retirer ${this._esc(product.title)} de la liste"
            type="button"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M5 5l10 10M15 5L5 15"/>
            </svg>
          </button>
        </div>
        <div class="cwlp__card-body">
          <a class="cwlp__card-title" href="/products/${product.handle}">${this._esc(product.title)}</a>
          <p class="cwlp__card-price">
            ${this._money(variant.price)}
            ${hasSale ? `<span class="cwlp__card-price-compare">${this._money(variant.compare_at_price)}</span>` : ''}
          </p>
          <button
            class="cwlp__card-atc"
            type="button"
            data-cwl-atc="${variant.id}"
            ${!variant.available ? 'disabled' : ''}
          >
            ${variant.available ? 'Ajouter au panier' : 'Épuisé'}
          </button>
        </div>
      `;

      // Bouton supprimer
      card.querySelector('[data-cwl-remove]').addEventListener('click', () => {
        this._removeCard(product.handle, card);
      });

      // Bouton ATC
      const atcBtn = card.querySelector('[data-cwl-atc]');
      if (atcBtn && variant.available) {
        atcBtn.addEventListener('click', () => this._addToCart(variant.id, atcBtn));
      }

      return card;
    }

    _removeCard(handle, cardEl) {
      WishlistStore.remove(handle);
      emitChange(handle, false);

      cardEl.classList.add('is-removing');
      cardEl.addEventListener('animationend', () => {
        cardEl.remove();

        // Si grille vide après suppression
        if (this.gridEl && this.gridEl.children.length === 0) {
          this._showEmpty();
        } else if (this.countEl) {
          const n = this.gridEl.children.length;
          this.countEl.textContent = `${n} article${n > 1 ? 's' : ''}`;
        }
      }, { once: true });
    }

    async _addToCart(variantId, btn) {
      const originalText = btn.textContent;
      btn.disabled  = true;
      btn.textContent = '…';

      try {
        const response = await fetch('/cart/add.js', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ id: variantId, quantity: 1 }),
        });

        if (!response.ok) throw new Error();

        btn.textContent = 'Ajouté ✓';
        document.dispatchEvent(new CustomEvent('cart:refresh'));
        document.dispatchEvent(new CustomEvent('cart:update'));

        setTimeout(() => {
          btn.disabled    = false;
          btn.textContent = originalText;
        }, 2000);
      } catch {
        btn.disabled    = false;
        btn.textContent = originalText;
      }
    }

    _showLoading(state) {
      if (this.loadingEl) this.loadingEl.hidden = !state;
      if (this.gridEl)    this.gridEl.hidden    = state;
      if (this.emptyEl)   this.emptyEl.hidden   = state;
    }

    _showEmpty() {
      if (this.loadingEl) this.loadingEl.hidden = true;
      if (this.gridEl)    this.gridEl.hidden    = true;
      if (this.emptyEl)   this.emptyEl.hidden   = false;
    }

    _money(cents) {
      return new Intl.NumberFormat(document.documentElement.lang || 'fr-FR', {
        style:    'currency',
        currency: window.Shopify?.currency?.active || 'EUR',
        minimumFractionDigits: 2,
      }).format(cents / 100);
    }

    _esc(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════

  function init() {
    // Boutons cœur
    document.querySelectorAll('[data-cwl-btn]').forEach((el) => {
      if (!el._cwlInit) el._cwlInit = new WishlistButton(el);
    });

    // Compteur header
    if (!window._cwlHeader) window._cwlHeader = new WishlistHeader();

    // Page wishlist
    const pageEl = document.querySelector('[data-cwl-page]');
    if (pageEl && !pageEl._cwlInit) pageEl._cwlInit = new WishlistPage(pageEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Rechargement éditeur de thème
  document.addEventListener('shopify:section:load', () => init());
})();
