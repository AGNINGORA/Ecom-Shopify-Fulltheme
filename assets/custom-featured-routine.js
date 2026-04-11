/**
 * custom-featured-routine.js
 * Bouton "Ajouter toute la routine au panier"
 * Vanilla JS · Dawn 15.x · fetch /cart/add.js
 */

(function () {
  'use strict';

  class FeaturedRoutine {
    constructor(section) {
      this.section = section;
      this.btn     = section.querySelector('[data-cfr-add-all]');
      if (!this.btn) return;

      this.btnText = section.querySelector('[data-cfr-btn-text]');
      this._bindEvents();
    }

    _bindEvents() {
      this.btn.addEventListener('click', () => this._addAll());
    }

    async _addAll() {
      if (this.btn.classList.contains('is-loading')) return;

      // Collecter les variant IDs depuis data-variants
      const raw = this.btn.dataset.variants || '';
      const ids  = raw.split(',').map((s) => s.trim()).filter(Boolean);

      if (ids.length === 0) return;

      // State: chargement
      this.btn.classList.add('is-loading');
      const originalText = this.btnText?.textContent || '';
      if (this.btnText) this.btnText.textContent = 'Ajout en cours…';

      const items = ids.map((id) => ({ id, quantity: 1 }));

      try {
        const res = await fetch('/cart/add.js', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ items }),
        });

        if (!res.ok) throw new Error('Cart add failed');

        // Fetch le panier mis à jour
        const cartRes = await fetch('/cart.js');
        const cart    = cartRes.ok ? await cartRes.json() : null;

        // Dispatch pour le drawer et la barre de livraison
        document.dispatchEvent(new CustomEvent('cart:refresh', { detail: cart }));
        if (cart) {
          document.dispatchEvent(new CustomEvent('cart:update', {
            detail: { count: cart.item_count },
          }));
          // Mettre à jour les compteurs Dawn
          document.querySelectorAll('[data-cart-count]').forEach((el) => {
            el.textContent = cart.item_count;
          });
        }

        // State: succès
        this.btn.classList.remove('is-loading');
        this.btn.classList.add('is-success');
        if (this.btnText) this.btnText.textContent = '✓ Routine ajoutée !';

        setTimeout(() => {
          this.btn.classList.remove('is-success');
          if (this.btnText) this.btnText.textContent = originalText;
        }, 3000);

      } catch (_) {
        this.btn.classList.remove('is-loading');
        if (this.btnText) this.btnText.textContent = originalText;
      }
    }
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.section-custom-featured-routine').forEach((section) => {
      if (!section._cfrInit) {
        section._cfrInit = new FeaturedRoutine(section);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const section = e.target.querySelector('.section-custom-featured-routine')
                 ?? (e.target.classList.contains('section-custom-featured-routine') ? e.target : null);
    if (section) section._cfrInit = new FeaturedRoutine(section);
  });
})();
