/**
 * custom-bundle-offer.js
 * Bundle offer – sélection de tiers + sélection couleur par slot + ajout au panier
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class BundleOffer {
    constructor(root) {
      this.root = root;

      // Éléments DOM
      this.tierRadios    = Array.from(root.querySelectorAll('[data-tier-radio]'));
      this.tierLabels    = Array.from(root.querySelectorAll('[data-tier-label]'));
      this.productEls    = Array.from(root.querySelectorAll('[data-cbo-product]'));
      this.connectors    = Array.from(root.querySelectorAll('[data-cbo-connector]'));
      this.originalEl    = root.querySelector('[data-cbo-original]');
      this.discountedEl  = root.querySelector('[data-cbo-discounted]');
      this.savingsEl     = root.querySelector('[data-cbo-savings]');
      this.addBtn        = root.querySelector('[data-cbo-add-btn]');
      this.btnLabel      = root.querySelector('[data-cbo-btn-label]');
      this.noticeEl      = root.querySelector('[data-cbo-notice]');

      // Parser les variantes de chaque produit
      this.productEls.forEach((el) => {
        try {
          el._variants = JSON.parse(el.dataset.variants || '[]');
        } catch {
          el._variants = [];
        }
      });

      // État courant
      this.currentQty      = 0;
      this.currentDiscount = 0;

      // Init avec le tier sélectionné par défaut
      const checkedRadio = this.tierRadios.find((r) => r.checked);
      if (checkedRadio) this._applyTier(checkedRadio);

      this._bindEvents();
    }

    // ── Liaisons ────────────────────────────────────────────────
    _bindEvents() {
      this.tierRadios.forEach((radio) => {
        radio.addEventListener('change', () => {
          if (radio.checked) this._applyTier(radio);
        });
      });

      // Clic sur le label (toute la carte)
      this.tierLabels.forEach((label) => {
        label.addEventListener('click', () => {
          const radio = label.querySelector('[data-tier-radio]');
          if (radio && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
        });
      });

      // Clic sur les swatches couleur
      this.productEls.forEach((productEl) => {
        const swatches = productEl.querySelectorAll('[data-cbo-swatch]');
        swatches.forEach((swatch) => {
          swatch.addEventListener('click', () => {
            this._selectColor(productEl, swatch);
          });
        });
      });

      this.addBtn?.addEventListener('click', () => this._addToCart());
    }

    // ── Sélection de couleur par slot ───────────────────────────
    _selectColor(productEl, swatch) {
      const colorOptionIdx = parseInt(productEl.dataset.colorOptionIndex, 10);
      const selectedColor  = swatch.dataset.color;
      const variants       = productEl._variants;

      // Trouver la variante correspondant à cette couleur
      // On garde les autres options actuelles si possible
      const currentVariantId = parseInt(productEl.dataset.variantId, 10);
      const currentVariant   = variants.find((v) => v.id === currentVariantId);
      let newVariant = null;

      if (currentVariant) {
        // Chercher une variante avec la même taille mais la nouvelle couleur
        newVariant = variants.find((v) => {
          if (v.options[colorOptionIdx] !== selectedColor) return false;
          // Vérifier que les autres options matchent
          return v.options.every((opt, i) =>
            i === colorOptionIdx || opt === currentVariant.options[i]
          );
        });
      }

      // Sinon, prendre la première variante de cette couleur
      if (!newVariant) {
        newVariant = variants.find(
          (v) => v.options[colorOptionIdx] === selectedColor && v.available
        ) || variants.find(
          (v) => v.options[colorOptionIdx] === selectedColor
        );
      }

      if (!newVariant) return;

      // Mettre à jour les data attributes
      productEl.dataset.variantId = newVariant.id;
      productEl.dataset.price     = newVariant.price;
      productEl.dataset.available = newVariant.available;

      // Mettre à jour l'image si la variante en a une
      if (newVariant.image) {
        const img = productEl.querySelector('[data-cbo-product-img]');
        if (img) {
          img.src    = newVariant.image;
          img.srcset = newVariant.image;
        }
      }

      // Mettre à jour le prix affiché
      const priceEl = productEl.querySelector('[data-cbo-unit-price]');
      if (priceEl) {
        priceEl.textContent = this._formatMoney(newVariant.price);
      }

      // Mettre à jour le badge épuisé
      const soldOutEl = productEl.querySelector('[data-cbo-sold-out]');
      if (newVariant.available) {
        if (soldOutEl) soldOutEl.remove();
      } else if (!soldOutEl) {
        const imgWrap = productEl.querySelector('.cbo__product-img-wrap');
        if (imgWrap) {
          const badge = document.createElement('span');
          badge.className       = 'cbo__product-sold-out';
          badge.dataset.cboSoldOut = '';
          badge.textContent     = 'Épuisé';
          imgWrap.appendChild(badge);
        }
      }

      // Mettre à jour l'état actif du swatch
      productEl.querySelectorAll('[data-cbo-swatch]').forEach((s) => {
        s.classList.toggle('is-active', s.dataset.color === selectedColor);
      });

      // Recalculer les prix globaux
      this._updatePrices();
    }

    // ── Appliquer un tier ────────────────────────────────────────
    _applyTier(radio) {
      this.currentQty      = parseInt(radio.dataset.qty, 10) || 0;
      this.currentDiscount = parseFloat(radio.dataset.discount) || 0;

      // Mise à jour visuelle des labels
      this.tierLabels.forEach((label) => {
        const r = label.querySelector('[data-tier-radio]');
        label.classList.toggle('is-selected', r && r === radio);
      });

      // Afficher/masquer les produits et connecteurs selon la quantité
      this.productEls.forEach((el, i) => {
        el.classList.toggle('is-hidden', i >= this.currentQty);
      });

      this.connectors.forEach((c, i) => {
        // Le connecteur i est entre produit i et i+1
        c.classList.toggle('is-hidden', i >= this.currentQty - 1);
        c.style.display = i >= this.currentQty - 1 ? 'none' : '';
      });

      this._updatePrices();
      this._clearNotice();
    }

    // ── Calcul des prix ─────────────────────────────────────────
    _updatePrices() {
      const visibleProducts = this.productEls
        .slice(0, this.currentQty)
        .filter((el) => el.dataset.available !== 'false');

      const totalCents = visibleProducts.reduce((sum, el) => {
        return sum + (parseInt(el.dataset.price, 10) || 0);
      }, 0);

      const discountedCents = this.currentDiscount > 0
        ? Math.round(totalCents * (1 - this.currentDiscount / 100))
        : totalCents;

      const savedCents = totalCents - discountedCents;

      if (this.originalEl) {
        this.originalEl.textContent = this.currentDiscount > 0
          ? this._formatMoney(totalCents)
          : '';
        this.originalEl.style.display = this.currentDiscount > 0 ? '' : 'none';
      }

      if (this.discountedEl) {
        this.discountedEl.textContent = this._formatMoney(discountedCents);
      }

      if (this.savingsEl) {
        this.savingsEl.textContent = savedCents > 0
          ? `Vous économisez ${this._formatMoney(savedCents)}`
          : '';
      }

      // Désactiver le bouton si aucun produit visible ou disponible
      if (this.addBtn) {
        this.addBtn.disabled = visibleProducts.length === 0;
      }
    }

    // ── Ajout au panier ─────────────────────────────────────────
    async _addToCart() {
      const items = this.productEls
        .slice(0, this.currentQty)
        .filter((el) => el.dataset.available !== 'false')
        .map((el) => ({
          id:       parseInt(el.dataset.variantId, 10),
          quantity: 1,
        }));

      if (items.length === 0) return;

      this._setLoading(true);
      this._clearNotice();

      try {
        const response = await fetch('/cart/add.js', {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept':       'application/json',
          },
          body: JSON.stringify({ items }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.description || 'Erreur lors de l\'ajout au panier.');
        }

        this._setNotice('Lot ajouté au panier !', 'success');

        // Ouvrir le custom cart drawer si disponible
        const ccd = window._ccdInstance;
        if (ccd && typeof ccd.fetchAndRender === 'function') {
          await ccd.fetchAndRender();
          ccd.open();
        }

        // Événements Dawn pour rafraîchir le panier
        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
        this._refreshCartCount();

      } catch (err) {
        this._setNotice(err.message || 'Une erreur est survenue.', 'error');
      } finally {
        this._setLoading(false);
      }
    }

    // ── Rafraîchit le compteur panier Dawn ──────────────────────
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
        // Non bloquant
      }
    }

    // ── Formatage monétaire ──────────────────────────────────────
    _formatMoney(cents) {
      const currency = window.Shopify?.currency?.active || 'EUR';
      const locale   = document.documentElement.lang || 'fr-FR';
      try {
        return new Intl.NumberFormat(locale, {
          style:    'currency',
          currency: currency,
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
