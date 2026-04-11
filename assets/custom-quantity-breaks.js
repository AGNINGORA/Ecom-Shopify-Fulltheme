/**
 * custom-quantity-breaks.js
 * Sélecteur de quantité avec remises progressives
 * Vanilla JS · Dawn 15.x
 *
 * Ce script gère :
 *   1. La sélection de palier → mise à jour de input[name="quantity"]
 *   2. La mise à jour des prix au changement de variante
 *   3. L'injection du total dans le bouton "Ajouter au panier"
 */

(function () {
  'use strict';

  class QuantityBreaks {
    constructor(wrap) {
      this.wrap     = wrap;
      this.cards    = Array.from(wrap.querySelectorAll('[data-cqb-card]'));
      this.currency = wrap.dataset.currency || 'EUR';
      this.locale   = document.documentElement.lang || 'fr-FR';

      // Prix initiaux (en centimes) par variante ID
      const pricesEl = wrap.querySelector('[data-cqb-prices]');
      this.variantPrices = pricesEl ? JSON.parse(pricesEl.textContent) : {};

      // Prix courant de base
      this.basePrice = parseInt(wrap.dataset.price, 10) || 0;

      // Éléments du formulaire — le wrap est rendu À L'INTÉRIEUR du form
      this.form       = wrap.closest('form');
      this.qtyInput   = wrap.querySelector('[data-cqb-qty-input]');
      this.varInput   = this.form?.querySelector('input[name="id"]');
      this.submitBtn  = this.form?.querySelector('[type="submit"][name="add"]');

      // Span total injecté dans le bouton ATC
      this._injectAtcSpan();

      this._bindEvents();

      // Sélectionner la première carte sans mettre à jour la quantité
      // (l'input cache déjà la bonne valeur depuis le Liquid)
      this._setActive(this.cards[0], false);
    }

    // ══════════════════════════════════════════════════════════════
    //  INJECTION DU SPAN PRIX DANS LE BOUTON ATC
    // ══════════════════════════════════════════════════════════════

    _injectAtcSpan() {
      if (!this.submitBtn) return;

      // Éviter le double-inject
      if (this.submitBtn.querySelector('.cqb__atc-total')) return;

      this.atcSpan = document.createElement('span');
      this.atcSpan.className = 'cqb__atc-total';
      this.atcSpan.setAttribute('aria-hidden', 'true');
      this.submitBtn.appendChild(this.atcSpan);
    }

    // ══════════════════════════════════════════════════════════════
    //  ÉVÉNEMENTS
    // ══════════════════════════════════════════════════════════════

    _bindEvents() {
      // Clic sur une carte
      this.cards.forEach((card) => {
        card.addEventListener('click', () => this._setActive(card, true));
      });

      // Changement de variante — méthode 1 : observer l'input[name="id"]
      if (this.varInput) {
        // Changement via JS (ex. sélecteur de couleur/taille Dawn)
        this.varInput.addEventListener('change', () => this._onVariantChange());

        // Changement via mutation (ex. variant:select custom event de Dawn)
        new MutationObserver(() => this._onVariantChange())
          .observe(this.varInput, { attributes: true, attributeFilter: ['value'] });
      }

      // Changement de variante — méthode 2 : event custom
      document.addEventListener('variant:change', (e) => {
        const price = e.detail?.variant?.price;
        if (price !== undefined) {
          this.basePrice = price;
          this._updateAllPrices();
        }
      });

      // Clavier : flèches haut/bas pour naviguer entre les paliers (layout vertical)
      this.wrap.addEventListener('keydown', (e) => {
        const idx = this.cards.indexOf(document.activeElement);
        if (idx === -1) return;
        if (e.key === 'ArrowDown' && idx < this.cards.length - 1) {
          e.preventDefault();
          this.cards[idx + 1].focus();
          this._setActive(this.cards[idx + 1], true);
        }
        if (e.key === 'ArrowUp' && idx > 0) {
          e.preventDefault();
          this.cards[idx - 1].focus();
          this._setActive(this.cards[idx - 1], true);
        }
      });
    }

    // ══════════════════════════════════════════════════════════════
    //  CHANGEMENT DE VARIANTE
    // ══════════════════════════════════════════════════════════════

    _onVariantChange() {
      const varId = this.varInput?.value;
      if (!varId) return;

      const newPrice = this.variantPrices[varId];
      if (newPrice !== undefined && newPrice !== this.basePrice) {
        this.basePrice = newPrice;
        this._updateAllPrices();
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  SÉLECTION D'UNE CARTE
    // ══════════════════════════════════════════════════════════════

    _setActive(card, updateQty) {
      // Mettre à jour classes et aria
      this.cards.forEach((c) => {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('is-active');
      card.setAttribute('aria-pressed', 'true');

      const qty  = parseInt(card.dataset.cqbQty, 10) || 1;
      const disc = parseFloat(card.dataset.cqbDiscount) || 0;

      // Mettre à jour l'input quantité
      if (updateQty && this.qtyInput) {
        this.qtyInput.value = qty;
        this.qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Mettre à jour le bouton ATC
      this._updateAtcSpan(qty, disc);
    }

    // ══════════════════════════════════════════════════════════════
    //  MISE À JOUR DES PRIX (après changement de variante)
    // ══════════════════════════════════════════════════════════════

    _updateAllPrices() {
      this.cards.forEach((card) => {
        const disc        = parseFloat(card.dataset.cqbDiscount) || 0;
        const qty         = parseInt(card.dataset.cqbQty, 10) || 1;
        const discAmount  = Math.round(this.basePrice * disc / 100);
        const unitPrice   = this.basePrice - discAmount;
        const totalPrice  = unitPrice * qty;

        const priceEl    = card.querySelector('[data-cqb-price]');
        const originalEl = card.querySelector('[data-cqb-original]');
        const totalEl    = card.querySelector('[data-cqb-total]');

        if (priceEl)    priceEl.textContent    = this._money(unitPrice);
        if (originalEl) originalEl.textContent = this._money(this.basePrice);
        if (totalEl)    totalEl.textContent    = '= ' + this._money(totalPrice);
      });

      // Recalcul du bouton ATC avec le palier actif
      const active = this.wrap.querySelector('[data-cqb-card].is-active');
      if (active) {
        this._updateAtcSpan(
          parseInt(active.dataset.cqbQty, 10) || 1,
          parseFloat(active.dataset.cqbDiscount) || 0,
        );
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  BOUTON ATC — affiche le total du palier sélectionné
    // ══════════════════════════════════════════════════════════════

    _updateAtcSpan(qty, disc) {
      if (!this.atcSpan) return;

      const discAmount = Math.round(this.basePrice * disc / 100);
      const unitPrice  = this.basePrice - discAmount;
      const total      = unitPrice * qty;

      // N'affiche le total que si qty > 1 (inutile pour 1 article)
      this.atcSpan.textContent = qty > 1 ? ' — ' + this._money(total) : '';
    }

    // ══════════════════════════════════════════════════════════════
    //  FORMATAGE MONÉTAIRE
    // ══════════════════════════════════════════════════════════════

    _money(cents) {
      return new Intl.NumberFormat(this.locale, {
        style:                 'currency',
        currency:              this.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    }
  }

  // ── Init ──────────────────────────────────────────────────────

  function init() {
    document.querySelectorAll('[data-cqb]').forEach((wrap) => {
      if (!wrap._cqbInit) {
        wrap._cqbInit = new QuantityBreaks(wrap);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Rechargement dans l'éditeur de thème
  document.addEventListener('shopify:section:load', init);
})();
