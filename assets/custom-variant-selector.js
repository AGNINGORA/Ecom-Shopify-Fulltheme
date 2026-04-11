/**
 * custom-variant-selector.js
 * Beauty & Cosmetics – Sélecteur de variantes
 * Vanilla JS · Dawn 15.x · Mobile-first
 */

(function () {
  'use strict';

  class CustomVariantSelector {
    constructor(root) {
      this.root = root;

      // ── Données variantes ──────────────────────────────────────
      const jsonEl = root.querySelector('[data-cvs-variants]');
      this.variants = jsonEl ? JSON.parse(jsonEl.textContent) : [];

      // ── Éléments DOM ──────────────────────────────────────────
      this.variantIdInput = root.querySelector('[data-cvs-variant-id]');
      this.priceEl        = root.querySelector('[data-cvs-price]');
      this.stockEl        = root.querySelector('[data-stock-warning]');
      this.atcBtn         = root.querySelector('[data-cvs-atc]');
      this.qtyInput       = root.querySelector('[data-qty-input]');
      this.qtyMinus       = root.querySelector('[data-qty-minus]');
      this.qtyPlus        = root.querySelector('[data-qty-plus]');
      this.optionBtns     = Array.from(root.querySelectorAll('[data-option-btn]'));

      // Nombre d'options (groupes de boutons)
      this._numOptions = root.querySelectorAll('.cvs__option-group').length;

      // ── État initial des sélections ────────────────────────────
      // Récupère la valeur sélectionnée pour chaque index d'option
      this.selectedValues = {};
      this.optionBtns.forEach((btn) => {
        if (btn.classList.contains('is-selected')) {
          this.selectedValues[btn.dataset.optionBtn] = btn.dataset.value;
        }
      });

      this._bindEvents();
    }

    // ── Liaisons événements ────────────────────────────────────────
    _bindEvents() {
      // Boutons d'option (swatches + pills)
      this.optionBtns.forEach((btn) =>
        btn.addEventListener('click', () => this._onOptionClick(btn))
      );

      // Quantité
      this.qtyMinus?.addEventListener('click', () => this._changeQty(-1));
      this.qtyPlus?.addEventListener('click',  () => this._changeQty(1));
      this.qtyInput?.addEventListener('change', () => {
        const v = parseInt(this.qtyInput.value, 10);
        if (isNaN(v) || v < 1) this.qtyInput.value = 1;
      });

      // Animation ATC au submit
      const form = this.root.querySelector('[data-type="add-to-cart-form"]');
      form?.addEventListener('submit', () => this._onFormSubmit());
    }

    // ── Clic sur une option ────────────────────────────────────────
    _onOptionClick(btn) {
      // Ignorer les indisponibles si on veut (commentez pour laisser sélectionner)
      if (btn.classList.contains('is-unavailable')) return;

      const optionIdx = btn.dataset.optionBtn;
      const value     = btn.dataset.value;

      this.selectedValues[optionIdx] = value;

      // Mise à jour des états visuels pour ce groupe
      this.optionBtns.forEach((b) => {
        if (b.dataset.optionBtn !== optionIdx) return;
        const active = b.dataset.value === value;
        b.classList.toggle('is-selected', active);
        b.setAttribute('aria-pressed', String(active));
      });

      // Label valeur sélectionnée (swatches)
      const labelEl = this.root.querySelector(
        `[data-selected-value="${optionIdx}"]`
      );
      if (labelEl) labelEl.textContent = value;

      // Trouver la variante correspondante et mettre à jour la page
      const variant = this._findVariant();
      this._updatePage(variant);
    }

    // ── Recherche de variante ──────────────────────────────────────
    _findVariant() {
      // Tableau ordonné des valeurs sélectionnées par index d'option
      const values = [];
      for (let i = 0; i < this._numOptions; i++) {
        values.push(this.selectedValues[String(i)]);
      }

      return (
        this.variants.find((v) =>
          values.every((val, i) => v.options[i] === val)
        ) || null
      );
    }

    // ── Mise à jour de la page ─────────────────────────────────────
    _updatePage(variant) {
      if (!variant) {
        this._setAtcState(false, 'Indisponible');
        return;
      }

      // Input caché formulaire
      if (this.variantIdInput) {
        this.variantIdInput.value    = variant.id;
        this.variantIdInput.disabled = !variant.available;
      }

      // URL sans rechargement
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());

      this._updatePrice(variant);
      this._updateStock(variant);
      this._updateAtcBtn(variant);
      this._updateOptionAvailability();

      // Notifie les autres composants (sticky cart, etc.)
      document.dispatchEvent(new CustomEvent('variant:change', {
        bubbles: true,
        detail: { variant },
      }));
    }

    // ── Prix ───────────────────────────────────────────────────────
    _updatePrice(variant) {
      if (!this.priceEl) return;

      const price       = this._formatMoney(variant.price);
      const compareAt   = variant.compare_at_price;

      if (compareAt && compareAt > variant.price) {
        this.priceEl.innerHTML = `
          <span class="cvs__price-sale">${price}</span>
          <s class="cvs__price-compare">${this._formatMoney(compareAt)}</s>
        `;
      } else {
        this.priceEl.innerHTML = `<span class="cvs__price-regular">${price}</span>`;
      }
    }

    // ── Formatage monétaire ────────────────────────────────────────
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

    // ── Stock bas ──────────────────────────────────────────────────
    _updateStock(variant) {
      if (!this.stockEl) return;

      const lowStock =
        variant.inventory_management === 'shopify' &&
        variant.inventory_policy     === 'deny'    &&
        variant.inventory_quantity   >  0           &&
        variant.inventory_quantity   <  5;

      this.stockEl.innerHTML = lowStock
        ? `<span class="cvs__stock-badge">Plus que ${variant.inventory_quantity} en stock\u00a0!</span>`
        : '';
    }

    // ── Bouton ATC ─────────────────────────────────────────────────
    _updateAtcBtn(variant) {
      if (variant.available) {
        this._setAtcState(true, 'Ajouter au panier');
      } else {
        this._setAtcState(false, 'Épuisé');
      }
    }

    _setAtcState(enabled, label) {
      if (!this.atcBtn) return;
      const labelEl = this.atcBtn.querySelector('.cvs__atc-label');
      if (labelEl) labelEl.textContent = label;
      this.atcBtn.disabled = !enabled;
      this.atcBtn.setAttribute('aria-disabled', String(!enabled));
    }

    // ── Disponibilité des options ──────────────────────────────────
    // Pour chaque bouton, vérifie si au moins une variante disponible
    // existe avec cette valeur + toutes les autres sélections en cours.
    _updateOptionAvailability() {
      this.optionBtns.forEach((btn) => {
        const optIdx = parseInt(btn.dataset.optionBtn, 10);
        const value  = btn.dataset.value;

        const hasAvailableVariant = this.variants.some((v) => {
          if (!v.available) return false;
          if (v.options[optIdx] !== value) return false;
          for (let i = 0; i < this._numOptions; i++) {
            if (i === optIdx) continue;
            if (v.options[i] !== this.selectedValues[String(i)]) return false;
          }
          return true;
        });

        btn.classList.toggle('is-unavailable', !hasAvailableVariant);
      });
    }

    // ── Quantité ───────────────────────────────────────────────────
    _changeQty(delta) {
      if (!this.qtyInput) return;
      const current = parseInt(this.qtyInput.value, 10) || 1;
      this.qtyInput.value = Math.max(1, current + delta);
    }

    // ── Animation submit ───────────────────────────────────────────
    _onFormSubmit() {
      if (!this.atcBtn || this.atcBtn.disabled) return;
      this.atcBtn.classList.add('is-loading');

      // Dawn's product-form.js gère la requête fetch ;
      // on retire le spinner sur l'événement cart:updated ou après timeout.
      const cleanup = () => this.atcBtn.classList.remove('is-loading');

      document.addEventListener('cart:updated', cleanup, { once: true });
      // Fallback sécurité si l'événement n'arrive pas
      setTimeout(cleanup, 3000);
    }
  }

  // ── Initialisation ─────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-cvs][data-section-id]').forEach((el) => {
      if (!el._cvsInit) {
        el._cvsInit = new CustomVariantSelector(el);
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
    const el = e.target.querySelector('[data-cvs]');
    if (el) el._cvsInit = new CustomVariantSelector(el);
  });
})();
