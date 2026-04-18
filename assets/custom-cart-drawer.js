/**
 * custom-cart-drawer.js
 * Drawer panier complet — Vanilla JS · Dawn 15.x
 *
 * Fonctionnalités :
 *  - Slide-in depuis la droite
 *  - Fetch /cart.js, /cart/change.js
 *  - Barre livraison gratuite animée
 *  - Upsell avec marquage "déjà dans le panier"
 *  - Synchronisation avec compteurs Dawn ([data-cart-count])
 *  - Interception du panier Dawn via event capture
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  //  UTILITAIRES
  // ══════════════════════════════════════════════════════════════

  /** Formate des centimes en monnaie locale */
  function money(cents) {
    const currency = window.Shopify?.currency?.active || 'EUR';
    const locale   = document.documentElement.lang || 'fr-FR';
    try {
      return new Intl.NumberFormat(locale, {
        style:                 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch (_) {
      return (cents / 100).toFixed(2) + ' ' + currency;
    }
  }

  /** Échappe le HTML pour injection sûre */
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /** Génère l'HTML d'un article (miroir du snippet custom-cart-drawer-item.liquid) */
  function renderItemHTML(item) {
    const imgHTML = item.image
      ? `<img class="ccd-item__img" src="${esc(item.image)}" alt="${esc(item.product_title)}" width="80" height="80" loading="lazy" draggable="false">`
      : `<div class="ccd-item__img-placeholder">
           <svg viewBox="0 0 40 40" fill="none"><rect width="40" height="40" fill="#f0f0f0"/><path d="M10 28L18 18L24 24L28 20L34 28H10Z" fill="#d0d0d0"/><circle cx="15" cy="16" r="3" fill="#d0d0d0"/></svg>
         </div>`;

    const variantHTML = item.variant_title && item.variant_title !== 'Default Title'
      ? `<p class="ccd-item__variant">${esc(item.variant_title)}</p>`
      : '';

    const originalPrice = item.original_line_price !== item.final_line_price
      ? `<span class="ccd-item__price ccd-item__price--original">${money(item.original_line_price)}</span>`
      : '';

    const saleClass = item.original_line_price !== item.final_line_price ? ' ccd-item__price--sale' : '';

    const decIcon = item.quantity <= 1
      ? `<path d="M2 7H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`
      : `<path d="M2 7H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;

    return `
      <div class="ccd-item" data-ccd-item data-key="${esc(item.key)}">
        <a class="ccd-item__img-wrap" href="${esc(item.url)}" tabindex="-1" aria-hidden="true">
          ${imgHTML}
        </a>
        <div class="ccd-item__info">
          <div class="ccd-item__top">
            <a class="ccd-item__name" href="${esc(item.url)}">${esc(item.product_title)}</a>
            <button class="ccd-item__remove" data-ccd-remove="${esc(item.key)}" type="button" aria-label="Supprimer ${esc(item.product_title)}">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          ${variantHTML}
          <div class="ccd-item__bottom">
            <div class="ccd-item__qty" data-ccd-qty-wrap>
              <button class="ccd-item__qty-btn" data-ccd-dec="${esc(item.key)}" type="button" aria-label="Diminuer la quantité" ${item.quantity <= 1 ? 'data-remove' : ''}>
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 7H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </button>
              <span class="ccd-item__qty-num" aria-live="polite">${item.quantity}</span>
              <button class="ccd-item__qty-btn" data-ccd-inc="${esc(item.key)}" type="button" aria-label="Augmenter la quantité">
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </button>
            </div>
            <div class="ccd-item__prices">
              ${originalPrice}
              <span class="ccd-item__price${saleClass}">${money(item.final_line_price)}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ══════════════════════════════════════════════════════════════
  //  CLASSE PRINCIPALE
  // ══════════════════════════════════════════════════════════════

  class CartDrawer {
    constructor() {
      this.drawer       = document.getElementById('custom-cart-drawer');
      this.overlay      = document.querySelector('[data-ccd-overlay]');
      if (!this.drawer) return;

      // Refs DOM
      this.closeBtn     = this.drawer.querySelector('[data-ccd-close]');
      this.itemsWrap    = this.drawer.querySelector('[data-ccd-items]');
      this.emptyWrap    = this.drawer.querySelector('[data-ccd-empty]');
      this.footer       = this.drawer.querySelector('[data-ccd-footer]');
      this.countEl      = this.drawer.querySelector('[data-ccd-count]');
      this.totalEl      = this.drawer.querySelector('[data-ccd-total]');
      this.shippingWrap = this.drawer.querySelector('[data-ccd-shipping]');
      this.shippingMsg  = this.drawer.querySelector('[data-ccd-shipping-msg]');
      this.shippingBar  = this.drawer.querySelector('[data-ccd-shipping-bar]');
      this.upsellWrap   = this.drawer.querySelector('[data-ccd-upsell]');
      this.upsellList   = this.drawer.querySelector('[data-ccd-upsell-list]');
      this.savingsWrap  = this.drawer.querySelector('[data-ccd-savings]');
      this.savingsText  = this.drawer.querySelector('[data-ccd-savings-text]');

      // Config depuis data-attributes
      this.threshold  = parseInt(this.drawer.dataset.threshold, 10) || 0;
      this.showShipping = this.drawer.dataset.showShipping !== 'false';
      this.freeMsg    = this.drawer.dataset.freeMsg || 'Félicitations ! Livraison gratuite !';
      this.upsellLimit = parseInt(this.upsellWrap?.dataset.upsellLimit, 10) || 3;

      this._isOpen    = false;
      this._loading   = false;
      this._recoCache = {};

      this._bindEvents();
      this._hookDawnEvents();

      // Sync l'état upsell sur le chargement initial
      this._fetchCart().then((cart) => {
        if (cart) {
          this._updateUpsell(cart);
          this._updateSavings(cart);
        }
      });
    }

    // ══════════════════════════════════════════════════════════════
    //  OUVERTURE / FERMETURE
    // ══════════════════════════════════════════════════════════════

    open() {
      if (this._isOpen) return;
      this._isOpen = true;
      this.drawer.classList.add('is-open');
      this.overlay?.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      this.drawer.focus();
      // Trap focus
      this._trapFocus();
    }

    close() {
      if (!this._isOpen) return;
      this._isOpen = false;
      this.drawer.classList.remove('is-open');
      this.overlay?.classList.remove('is-open');
      document.body.style.overflow = '';
      this._releaseFocus();
    }

    toggle() {
      this._isOpen ? this.close() : this.open();
    }

    // ══════════════════════════════════════════════════════════════
    //  FETCH CART & RENDU
    // ══════════════════════════════════════════════════════════════

    async _fetchCart() {
      try {
        const res = await fetch('/cart.js', {
          headers: { 'Content-Type': 'application/json' },
        });
        return res.ok ? res.json() : null;
      } catch (_) {
        return null;
      }
    }

    async fetchAndRender() {
      const cart = await this._fetchCart();
      if (cart) this._renderCart(cart);
      return cart;
    }

    _renderCart(cart) {
      const count = cart.item_count || 0;
      const total = cart.total_price || 0;

      // Compteur d'articles
      if (this.countEl) this.countEl.textContent = `(${count})`;

      // Compteurs Dawn globaux
      document.querySelectorAll('[data-cart-count]').forEach((el) => {
        el.textContent = count;
        el.setAttribute('aria-label', `${count} article${count !== 1 ? 's' : ''} dans le panier`);
      });

      // Sous-total
      if (this.totalEl) this.totalEl.textContent = money(total);

      // Barre livraison
      this._updateShipping(total);

      // Articles
      if (this.itemsWrap) {
        if (count === 0) {
          this.itemsWrap.innerHTML = '';
        } else {
          this.itemsWrap.innerHTML = cart.items.map(renderItemHTML).join('');
        }
      }

      // État vide / footer
      const isEmpty = count === 0;
      if (this.emptyWrap) this.emptyWrap.hidden = !isEmpty;
      if (this.footer)    this.footer.hidden    = isEmpty;

      // Upsell + Économies
      this._updateUpsell(cart);
      this._updateSavings(cart);
    }

    // ── Barre livraison gratuite ──────────────────────────────────
    _updateShipping(totalCents) {
      if (!this.shippingWrap || !this.threshold) return;

      const remaining = this.threshold - totalCents;
      const pct       = Math.min(100, Math.round((totalCents / this.threshold) * 100));

      if (this.shippingBar) {
        this.shippingBar.style.width = pct + '%';
        this.shippingBar.parentElement?.setAttribute('aria-valuenow', pct);
      }

      if (this.shippingMsg) {
        if (remaining <= 0) {
          this.shippingMsg.textContent = this.freeMsg;
        } else {
          this.shippingMsg.textContent = `Plus que ${money(remaining)} pour la livraison gratuite !`;
        }
      }
    }

    // ── Recommandations dynamiques (API Shopify) ────────────────
    async _updateUpsell(cart) {
      if (!this.upsellWrap || !this.upsellList) return;

      const isEmpty = (cart.item_count || 0) === 0;
      this.upsellWrap.hidden = isEmpty;
      if (isEmpty) return;

      const cartProductIds = new Set(cart.items.map((i) => String(i.product_id)));
      const lastProductId  = cart.items[cart.items.length - 1]?.product_id;
      if (!lastProductId) return;

      try {
        const products = await this._fetchRecommendations(lastProductId);
        const filtered = products
          .filter((p) => !cartProductIds.has(String(p.id)) && p.available)
          .slice(0, this.upsellLimit);

        if (filtered.length === 0) {
          this.upsellWrap.hidden = true;
          return;
        }

        this.upsellList.innerHTML = filtered.map((p) => {
          const vid   = p.variants[0]?.id || '';
          const img   = p.featured_image ? `<img class="ccd__upsell-img" src="${esc(p.featured_image)}" alt="${esc(p.title)}" width="60" height="60" loading="lazy">` : '';
          const price = money(p.price);
          const cmp   = p.compare_at_price && p.compare_at_price > p.price
            ? `<span class="ccd__upsell-compare">${money(p.compare_at_price)}</span>`
            : '';
          return `
            <div class="ccd__upsell-item" data-ccd-upsell-product data-product-id="${p.id}">
              ${img}
              <div class="ccd__upsell-info">
                <p class="ccd__upsell-name">${esc(p.title)}</p>
                <p class="ccd__upsell-price">${cmp}${price}</p>
              </div>
              <button class="ccd__upsell-add" data-ccd-upsell-add="${vid}" type="button" aria-label="Ajouter ${esc(p.title)}">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
            </div>`;
        }).join('');
      } catch (_) {
        this.upsellWrap.hidden = true;
      }
    }

    async _fetchRecommendations(productId) {
      if (this._recoCache[productId]) return this._recoCache[productId];
      try {
        const res = await fetch(`/recommendations/products.json?product_id=${productId}&limit=8&intent=related`);
        if (!res.ok) return [];
        const data = await res.json();
        const products = data.products || [];
        this._recoCache[productId] = products;
        return products;
      } catch (_) {
        return [];
      }
    }

    // ── Économies ────────────────────────────────────────────────
    _updateSavings(cart) {
      if (!this.savingsWrap || !this.savingsText) return;

      let totalSavings = 0;
      (cart.items || []).forEach((item) => {
        if (item.original_line_price > item.final_line_price) {
          totalSavings += item.original_line_price - item.final_line_price;
        }
      });

      if (totalSavings > 0) {
        this.savingsWrap.hidden = false;
        this.savingsText.textContent = `Vous économisez ${money(totalSavings)}`;
      } else {
        this.savingsWrap.hidden = true;
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  ACTIONS PANIER
    // ══════════════════════════════════════════════════════════════

    async _changeQty(key, newQty) {
      if (this._loading) return;
      this._loading = true;

      // Feedback visuel sur l'item
      const itemEl = this.itemsWrap?.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (itemEl) itemEl.classList.add('is-loading');

      try {
        const res = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity: newQty }),
        });

        if (res.ok) {
          const cart = await fetch('/cart.js').then((r) => r.json());
          this._renderCart(cart);
          this._dispatchUpdate(cart);
        }
      } catch (_) {
        if (itemEl) itemEl.classList.remove('is-loading');
      } finally {
        this._loading = false;
      }
    }

    async _addToCart(variantId) {
      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: variantId, quantity: 1 }),
        });

        if (res.ok) {
          const cart = await fetch('/cart.js').then((r) => r.json());
          this._renderCart(cart);
          this._dispatchUpdate(cart);
        }
      } catch (_) { /* noop */ }
    }

    // Dispatch pour synchronisation avec Dawn et autres composants
    // On n'envoie PAS cart:refresh ici pour éviter un double fetch :
    // _renderCart a déjà mis à jour le drawer avec les données fraîches.
    // On envoie cart:update (compteurs Dawn) et cart:updated (autres composants customs).
    _dispatchUpdate(cart) {
      document.dispatchEvent(new CustomEvent('cart:update', {
        detail: { count: cart.item_count },
      }));
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
    }

    // ══════════════════════════════════════════════════════════════
    //  ÉVÉNEMENTS
    // ══════════════════════════════════════════════════════════════

    _bindEvents() {
      // Fermer via bouton ou overlay
      this.closeBtn?.addEventListener('click', () => this.close());
      this.overlay?.addEventListener('click', () => this.close());

      // Fermer via Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._isOpen) this.close();
      });

      // Délégation des clics dans le drawer
      this.drawer.addEventListener('click', (e) => {
        // Supprimer article
        const removeBtn = e.target.closest('[data-ccd-remove]');
        if (removeBtn) {
          this._changeQty(removeBtn.dataset.ccdRemove, 0);
          return;
        }

        // Décrémenter (ou supprimer si qty=1)
        const decBtn = e.target.closest('[data-ccd-dec]');
        if (decBtn) {
          const key     = decBtn.dataset.ccdDec;
          const qtyEl   = decBtn.closest('[data-ccd-qty-wrap]')?.querySelector('.ccd-item__qty-num');
          const current = parseInt(qtyEl?.textContent, 10) || 1;
          this._changeQty(key, Math.max(0, current - 1));
          return;
        }

        // Incrémenter
        const incBtn = e.target.closest('[data-ccd-inc]');
        if (incBtn) {
          const key     = incBtn.dataset.ccdInc;
          const qtyEl   = incBtn.closest('[data-ccd-qty-wrap]')?.querySelector('.ccd-item__qty-num');
          const current = parseInt(qtyEl?.textContent, 10) || 1;
          this._changeQty(key, current + 1);
          return;
        }

        // Upsell : ajouter au panier
        const upsellBtn = e.target.closest('[data-ccd-upsell-add]');
        if (upsellBtn) {
          upsellBtn.classList.add('is-loading');
          this._addToCart(upsellBtn.dataset.ccdUpsellAdd).finally(() => {
            upsellBtn.classList.remove('is-loading');
          });
        }
      });

      // Interception des clics sur le panier Dawn (phase capture)
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest(
          '#cart-icon-bubble, [aria-controls="CartDrawer"], [data-open-cart-drawer]'
        );
        if (!trigger) return;
        // Ne pas intercepter les clics dans le mega menu ou d'autres dropdowns
        if (e.target.closest('.mega-menu__content, .header__submenu, header-menu details[open]')) return;

        e.preventDefault();
        e.stopPropagation();
        this.fetchAndRender().then(() => this.open());
      }, true);
    }

    // ── Connexion aux événements Dawn (PubSub + custom events) ────
    _hookDawnEvents() {
      // Dawn 15 PubSub : subscribe est global
      // Ne PAS appeler open() ici — seule une action utilisateur doit ouvrir le drawer.
      // cart-update sert uniquement à synchroniser les données (compteur, total, items).
      if (typeof subscribe === 'function') {
        try {
          subscribe('cart-update', () => {
            this.fetchAndRender();
          });
        } catch (_) { /* noop si PubSub indisponible */ }
      }

      // Fallback : événement personnalisé dispatché par nos composants
      // Ne pas appeler open() ici : seule une action utilisateur doit ouvrir le drawer.
      // cart:refresh sert uniquement à synchroniser les données (compteur, total, items).
      document.addEventListener('cart:refresh', () => {
        this.fetchAndRender();
      });

      // Rechargement section éditeur
      document.addEventListener('shopify:section:load', () => {
        this._reInit();
      });
    }

    // ── Trap focus dans le drawer ─────────────────────────────────
    _trapFocus() {
      const focusable = this.drawer.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      this._focusableEls = Array.from(focusable);
      this._focusFirst   = this._focusableEls[0];
      this._focusLast    = this._focusableEls[this._focusableEls.length - 1];

      this._onKeydown = (e) => {
        if (e.key !== 'Tab') return;
        if (this._focusableEls.length === 0) return;

        if (e.shiftKey) {
          if (document.activeElement === this._focusFirst) {
            e.preventDefault();
            this._focusLast?.focus();
          }
        } else {
          if (document.activeElement === this._focusLast) {
            e.preventDefault();
            this._focusFirst?.focus();
          }
        }
      };

      document.addEventListener('keydown', this._onKeydown);
    }

    _releaseFocus() {
      if (this._onKeydown) {
        document.removeEventListener('keydown', this._onKeydown);
        this._onKeydown = null;
      }
    }

    // Ré-init après rechargement de section dans l'éditeur
    _reInit() {
      this.drawer     = document.getElementById('custom-cart-drawer');
      this.overlay    = document.querySelector('[data-ccd-overlay]');
      if (!this.drawer) return;
      this.itemsWrap  = this.drawer.querySelector('[data-ccd-items]');
      this.emptyWrap  = this.drawer.querySelector('[data-ccd-empty]');
      this.footer     = this.drawer.querySelector('[data-ccd-footer]');
      this.countEl    = this.drawer.querySelector('[data-ccd-count]');
      this.totalEl    = this.drawer.querySelector('[data-ccd-total]');
      this.shippingWrap = this.drawer.querySelector('[data-ccd-shipping]');
      this.shippingMsg  = this.drawer.querySelector('[data-ccd-shipping-msg]');
      this.shippingBar  = this.drawer.querySelector('[data-ccd-shipping-bar]');
      this.upsellWrap   = this.drawer.querySelector('[data-ccd-upsell]');
      this.upsellList   = this.drawer.querySelector('[data-ccd-upsell-list]');
      this.savingsWrap  = this.drawer.querySelector('[data-ccd-savings]');
      this.savingsText  = this.drawer.querySelector('[data-ccd-savings-text]');
      this.closeBtn   = this.drawer.querySelector('[data-ccd-close]');
      this.threshold  = parseInt(this.drawer.dataset.threshold, 10) || 0;
      this.freeMsg    = this.drawer.dataset.freeMsg || '';
      this._bindEvents();
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    if (!window._ccdInstance) {
      window._ccdInstance = new CartDrawer();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
