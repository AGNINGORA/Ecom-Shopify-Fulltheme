/**
 * custom-buy-x-get-y.js
 * Offre "Achetez X, obtenez Y gratuit" — sélecteur 2 cartes
 * Vanilla JS · Dawn 15.x
 *
 * Ce script gère :
 *   1. Sélection de carte → mise à jour de input[name="quantity"]
 *   2. Recalcul des prix au changement de variante
 *   3. Affichage du total dans le bouton "Ajouter au panier"
 *
 * ── Appliquer la remise au checkout ─────────────────────────────────────────
 * Ce script modifie uniquement la quantité dans le formulaire.
 * Pour que la remise soit réelle au checkout :
 *
 * Admin Shopify > Réductions > Créer une réduction automatique
 *   → Type : "Achetez X articles, obtenez Y articles"
 *   → Produit éligible : le(s) produit(s) concerné(s)
 *   → Quantité à acheter : data-qty-buy (ex: 2)
 *   → Articles offerts : data-qty-free (ex: 1) à 100 % de remise
 *   La réduction s'applique automatiquement dès le panier.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  class BuyXGetY {
    constructor(wrap) {
      this.wrap     = wrap;
      this.cards    = Array.from(wrap.querySelectorAll('[data-cbxgy-card]'));
      this.currency = wrap.dataset.currency || 'EUR';
      this.locale   = document.documentElement.lang || 'fr-FR';

      // Config de l'offre (lue depuis les data-attributes du Liquid)
      this.qtyBuy  = parseInt(wrap.dataset.qtyBuy,  10) || 2;
      this.qtyFree = parseInt(wrap.dataset.qtyFree, 10) || 1;
      this.discPct = parseFloat(wrap.dataset.discPct)   || 0;

      // Prix de toutes les variantes
      const pricesEl = wrap.querySelector('[data-cbxgy-prices]');
      this.variantPrices = pricesEl ? JSON.parse(pricesEl.textContent) : {};

      // Prix courant de base
      this.basePrice = parseInt(wrap.dataset.price, 10) || 0;

      // Éléments du formulaire
      this.form      = wrap.closest('form');
      this.qtyInput  = wrap.querySelector('[data-cbxgy-qty-input]');
      this.varInput  = this.form?.querySelector('input[name="id"]');
      this.submitBtn = this.form?.querySelector('[type="submit"][name="add"]');

      this._injectAtcSpan();
      this._bindEvents();

      // Activer la première carte sans dispatcher l'event quantity
      this._setActive(this.cards[0], false);
    }

    // ══════════════════════════════════════════════════════════════
    //  INJECTION DU SPAN PRIX DANS LE BOUTON ATC
    // ══════════════════════════════════════════════════════════════

    _injectAtcSpan() {
      if (!this.submitBtn) return;
      if (this.submitBtn.querySelector('.cbxgy__atc-total')) return;

      this.atcSpan = document.createElement('span');
      this.atcSpan.className = 'cbxgy__atc-total';
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

      // Clavier : flèches gauche/droite
      this.wrap.addEventListener('keydown', (e) => {
        const idx = this.cards.indexOf(document.activeElement);
        if (idx === -1) return;
        if (e.key === 'ArrowRight' && idx < this.cards.length - 1) {
          e.preventDefault();
          this.cards[idx + 1].focus();
          this._setActive(this.cards[idx + 1], true);
        }
        if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault();
          this.cards[idx - 1].focus();
          this._setActive(this.cards[idx - 1], true);
        }
      });

      // Changement de variante — input[name="id"] via Dawn ou variante JS custom
      if (this.varInput) {
        this.varInput.addEventListener('change', () => this._onVariantChange());
        new MutationObserver(() => this._onVariantChange())
          .observe(this.varInput, { attributes: true, attributeFilter: ['value'] });
      }

      // Changement de variante — event custom (ex: main-product.liquid Dawn)
      document.addEventListener('variant:change', (e) => {
        const price = e.detail?.variant?.price;
        if (price !== undefined) {
          this.basePrice = price;
          this._updatePrices();
        }
      });
    }

    // ══════════════════════════════════════════════════════════════
    //  CHANGEMENT DE VARIANTE
    // ══════════════════════════════════════════════════════════════

    _onVariantChange() {
      const varId   = this.varInput?.value;
      const newPrice = this.variantPrices[varId];
      if (newPrice !== undefined && newPrice !== this.basePrice) {
        this.basePrice = newPrice;
        this._updatePrices();
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  SÉLECTION D'UNE CARTE
    // ══════════════════════════════════════════════════════════════

    _setActive(card, updateQty) {
      this.cards.forEach((c) => {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('is-active');
      card.setAttribute('aria-pressed', 'true');

      const qty     = parseInt(card.dataset.cbxgyQty, 10) || 1;
      const isOffer = card.dataset.cbxgyOffer === 'true';

      if (updateQty && this.qtyInput) {
        this.qtyInput.value = qty;
        this.qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      this._updateAtcSpan(qty, isOffer);
    }

    // ══════════════════════════════════════════════════════════════
    //  MISE À JOUR DES PRIX (après changement de variante)
    // ══════════════════════════════════════════════════════════════

    _updatePrices() {
      const totalQty    = this.qtyBuy + this.qtyFree;
      const normalTotal = this.basePrice * totalQty;
      const offerTotal  = this.discPct > 0
        ? Math.round(normalTotal * (1 - this.discPct / 100))
        : this.basePrice * this.qtyBuy;

      // Carte 1 — prix unitaire
      const price1El = this.wrap.querySelector('[data-cbxgy-price1]');
      if (price1El) price1El.textContent = this._money(this.basePrice);

      // Carte 2 — prix remisé + prix barré
      const priceOfferEl  = this.wrap.querySelector('[data-cbxgy-price-offer]');
      const priceNormalEl = this.wrap.querySelector('[data-cbxgy-price-normal]');
      if (priceOfferEl)  priceOfferEl.textContent  = this._money(offerTotal);
      if (priceNormalEl) priceNormalEl.textContent = this._money(normalTotal);

      // Mettre à jour le bouton ATC selon la carte active
      const active = this.wrap.querySelector('[data-cbxgy-card].is-active');
      if (active) {
        this._updateAtcSpan(
          parseInt(active.dataset.cbxgyQty, 10) || 1,
          active.dataset.cbxgyOffer === 'true',
        );
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  BOUTON ATC — total du choix sélectionné
    // ══════════════════════════════════════════════════════════════

    _updateAtcSpan(qty, isOffer) {
      if (!this.atcSpan) return;

      if (!isOffer) {
        // Carte 1 : prix unitaire simple
        this.atcSpan.textContent = qty > 1 ? ' — ' + this._money(this.basePrice * qty) : '';
        return;
      }

      // Carte 2 : total remisé
      const totalQty   = this.qtyBuy + this.qtyFree;
      const normalTotal = this.basePrice * totalQty;
      const offerTotal  = this.discPct > 0
        ? Math.round(normalTotal * (1 - this.discPct / 100))
        : this.basePrice * this.qtyBuy;

      this.atcSpan.textContent = ' — ' + this._money(offerTotal);
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
    document.querySelectorAll('[data-cbxgy]').forEach((wrap) => {
      if (!wrap._cbxgyInit) {
        wrap._cbxgyInit = new BuyXGetY(wrap);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', init);
})();
