/**
 * custom-product-addons.js
 * Gère la sélection d'add-ons produit et les ajoute au panier
 * avec le produit principal via l'événement cart:item-added
 */
(function () {
  'use strict';

  function money(cents) {
    const currency = window.Shopify?.currency?.active || 'EUR';
    const locale   = document.documentElement.lang || 'fr-FR';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch (_) {
      return (cents / 100).toFixed(2) + ' ' + currency;
    }
  }

  class ProductAddons {
    constructor(el) {
      this.root    = el;
      this.items   = Array.from(el.querySelectorAll('[data-cpa-item]'));
      this.summary = el.querySelector('[data-cpa-summary]');
      this.sumText = el.querySelector('[data-cpa-summary-text]');

      this.items.forEach((item) => {
        item.addEventListener('click', () => this._toggle(item));
      });

      // Intercepter l'ATC du produit principal pour ajouter les add-ons
      this._hookATC();
    }

    _toggle(item) {
      item.classList.toggle('is-selected');
      this._updateSummary();
    }

    _getSelected() {
      return this.items
        .filter((el) => el.classList.contains('is-selected'))
        .map((el) => ({
          id:    el.dataset.variantId,
          price: parseInt(el.dataset.price, 10) || 0,
        }));
    }

    _updateSummary() {
      const selected = this._getSelected();
      if (!this.summary) return;

      if (selected.length === 0) {
        this.summary.classList.remove('is-visible');
        return;
      }

      const total = selected.reduce((sum, s) => sum + s.price, 0);
      if (this.sumText) {
        this.sumText.textContent = total > 0
          ? `${selected.length} add-on${selected.length > 1 ? 's' : ''} sélectionné${selected.length > 1 ? 's' : ''} (+${money(total)})`
          : `${selected.length} add-on${selected.length > 1 ? 's' : ''} gratuit${selected.length > 1 ? 's' : ''} sélectionné${selected.length > 1 ? 's' : ''}`;
      }
      this.summary.classList.add('is-visible');
    }

    _hookATC() {
      // Écouter le submit du form produit le plus proche
      const form = this.root.closest('form[action*="/cart/add"]')
        || document.querySelector('form[action*="/cart/add"]');

      if (!form) return;

      form.addEventListener('submit', (e) => {
        const selected = this._getSelected();
        if (selected.length === 0) return;

        // Empêcher le submit par défaut, on fait un fetch groupé
        e.preventDefault();
        e.stopPropagation();

        const formData = new FormData(form);
        const mainId   = formData.get('id');
        const mainQty  = parseInt(formData.get('quantity'), 10) || 1;

        const items = [{ id: parseInt(mainId, 10), quantity: mainQty }];
        selected.forEach((addon) => {
          items.push({ id: parseInt(addon.id, 10), quantity: 1 });
        });

        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        })
          .then((res) => {
            if (!res.ok) throw new Error('ATC failed');
            return res.json();
          })
          .then(() => {
            // Déclencher les événements pour ouvrir le drawer / notification
            document.dispatchEvent(new CustomEvent('cart:refresh'));
            if (typeof publish === 'function') {
              try { publish('cart-update'); } catch (_) {}
            }
          })
          .catch(() => {
            // Fallback : soumettre le form normalement sans les add-ons
            form.submit();
          });
      });
    }
  }

  function init() {
    document.querySelectorAll('[data-cpa-section]').forEach((el) => {
      if (!el._cpaInit) {
        el._cpaInit = new ProductAddons(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('[data-cpa-section]');
    if (el) el._cpaInit = new ProductAddons(el);
  });
})();
