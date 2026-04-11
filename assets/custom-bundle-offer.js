/**
 * custom-bundle-offer.js
 * Bundle multi-produits : checkbox, variant select, remise, ajout groupé
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class BundleOffer {
    constructor(root) {
      this.root = root;

      this.cards       = Array.from(root.querySelectorAll('[data-cbo-card]'));
      this.originalEl  = root.querySelector('[data-cbo-original]');
      this.discountedEl= root.querySelector('[data-cbo-discounted]');
      this.savingsEl   = root.querySelector('[data-cbo-savings]');
      this.addBtn      = root.querySelector('[data-cbo-add-btn]');
      this.btnLabel    = root.querySelector('[data-cbo-btn-label]');
      this.noticeEl    = root.querySelector('[data-cbo-notice]');

      this.discountPct  = parseInt(root.dataset.discount, 10) || 0;
      this.minProducts  = parseInt(root.dataset.minProducts, 10) || 2;

      if (this.cards.length === 0) return;

      this._bindEvents();
      this._updatePrices();
    }

    // ── Liaisons ────────────────────────────────────────────────
    _bindEvents() {
      this.cards.forEach((card) => {
        const check  = card.querySelector('[data-cbo-check]');
        const select = card.querySelector('[data-cbo-variant-select]');

        check?.addEventListener('change', () => {
          card.classList.toggle('is-unchecked', !check.checked);
          this._updatePrices();
        });

        select?.addEventListener('change', () => {
          const opt = select.selectedOptions[0];
          if (!opt) return;

          card.dataset.variantId = opt.value;
          card.dataset.price     = opt.dataset.price;
          card.dataset.available = opt.dataset.available;

          // Mettre à jour l'image si disponible
          const img = card.querySelector('[data-cbo-img]');
          if (img && opt.dataset.img) {
            img.src = opt.dataset.img;
          }

          // Mettre à jour le prix affiché
          const priceEl = card.querySelector('[data-cbo-card-price]');
          if (priceEl) {
            priceEl.textContent = this._formatMoney(parseInt(opt.dataset.price, 10));
          }

          this._updatePrices();
        });
      });

      this.addBtn?.addEventListener('click', () => this._addToCart());
    }

    // ── Cartes cochées ──────────────────────────────────────────
    _getCheckedCards() {
      return this.cards.filter((card) => {
        const check = card.querySelector('[data-cbo-check]');
        return check && check.checked;
      });
    }

    // ── Calcul et affichage des prix ────────────────────────────
    _updatePrices() {
      const checked = this._getCheckedCards();
      const count   = checked.length;

      const totalCents = checked.reduce((sum, card) => {
        return sum + (parseInt(card.dataset.price, 10) || 0);
      }, 0);

      const hasDiscount    = count >= this.minProducts && this.discountPct > 0;
      const discountedCents = hasDiscount
        ? Math.round(totalCents * (1 - this.discountPct / 100))
        : totalCents;
      const savedCents = totalCents - discountedCents;

      if (this.originalEl) {
        if (hasDiscount) {
          this.originalEl.textContent = this._formatMoney(totalCents);
          this.originalEl.hidden = false;
        } else {
          this.originalEl.hidden = true;
        }
      }

      if (this.discountedEl) {
        this.discountedEl.textContent = this._formatMoney(discountedCents);
      }

      if (this.savingsEl) {
        if (savedCents > 0) {
          this.savingsEl.textContent = `Vous économisez ${this._formatMoney(savedCents)} (-${this.discountPct}%)`;
        } else if (count > 0 && count < this.minProducts) {
          this.savingsEl.textContent = `Cochez ${this.minProducts - count} produit(s) de plus pour -${this.discountPct}%`;
          this.savingsEl.className = 'cbo__savings-line cbo__savings-line--hint';
        } else {
          this.savingsEl.textContent = '';
        }
      }

      if (this.addBtn) {
        this.addBtn.disabled = count === 0;
      }
    }

    // ── Ajout au panier ─────────────────────────────────────────
    async _addToCart() {
      const checked = this._getCheckedCards();
      if (checked.length === 0) return;

      const items = checked
        .filter((card) => card.dataset.available === 'true')
        .map((card) => ({
          id:       parseInt(card.dataset.variantId, 10),
          quantity: 1,
        }));

      if (items.length === 0) {
        this._setNotice('Certains produits sont épuisés.', 'error');
        return;
      }

      this._setLoading(true);
      this._clearNotice();

      try {
        const response = await fetch('/cart/add.js', {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept:         'application/json',
          },
          body: JSON.stringify({ items }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.description || 'Erreur lors de l\'ajout au panier.');
        }

        this._setNotice('Bundle ajouté au panier !', 'success');

        const ccd = window._ccdInstance;
        if (ccd && typeof ccd.fetchAndRender === 'function') {
          await ccd.fetchAndRender();
          ccd.open();
        }

        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
        this._refreshCartCount();

      } catch (err) {
        this._setNotice(err.message || 'Une erreur est survenue.', 'error');
      } finally {
        this._setLoading(false);
      }
    }

    // ── Rafraîchit le compteur panier ──────────────────────────
    async _refreshCartCount() {
      try {
        const res  = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
        const cart = await res.json();
        document.dispatchEvent(
          new CustomEvent('cart:update', { bubbles: true, detail: { cart } })
        );
        document.querySelectorAll('[data-cart-count]').forEach((el) => {
          el.textContent = cart.item_count;
        });
        document.querySelectorAll('.cart-count-bubble span[aria-hidden="true"]').forEach((el) => {
          el.textContent = cart.item_count;
        });
        document.querySelectorAll('.cart-count-bubble').forEach((el) => {
          el.style.display = cart.item_count > 0 ? '' : 'none';
        });
      } catch {
        // silencieux
      }
    }

    // ── Formatage monétaire ─────────────────────────────────────
    _formatMoney(cents) {
      const currency = window.Shopify?.currency?.active || 'EUR';
      const locale   = document.documentElement.lang || 'fr-FR';
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
        }).format(cents / 100);
      } catch {
        return (cents / 100).toFixed(2).replace('.', ',') + '\u00a0' + currency;
      }
    }

    // ── Helpers UI ───────────────────────────────────────────────
    _setLoading(on) {
      if (!this.addBtn) return;
      this.addBtn.classList.toggle('is-loading', on);
      this.addBtn.disabled = on;
    }

    _setNotice(msg, type) {
      if (!this.noticeEl) return;
      this.noticeEl.textContent = msg;
      this.noticeEl.className   = `cbo__notice cbo__notice--${type}`;
    }

    _clearNotice() {
      if (!this.noticeEl) return;
      this.noticeEl.textContent = '';
      this.noticeEl.className   = 'cbo__notice';
    }
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.custom-bundle-offer[data-section-id]').forEach((el) => {
      if (!el._boInit) el._boInit = new BundleOffer(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('.custom-bundle-offer');
    if (el) el._boInit = new BundleOffer(el);
  });
})();
