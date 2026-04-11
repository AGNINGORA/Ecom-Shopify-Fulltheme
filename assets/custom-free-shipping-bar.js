/* =============================================================
   custom-free-shipping-bar.js
   Barre livraison gratuite — mise à jour temps réel via cart:updated
   Dawn 15.x · Vanilla JS
   ============================================================= */

(function () {
  'use strict';

  class FreeShippingBar {
    constructor(el) {
      this.el        = el;
      this.threshold = parseInt(el.dataset.threshold || '0', 10);
      this.freeMsg   = el.dataset.cfsbFreeMsg || el.dataset.freeMsg || 'Livraison offerte !';

      this.msgEl     = el.querySelector('[data-cfsb-msg]');
      this.fillEl    = el.querySelector('[data-cfsb-fill]');
      this.trackEl   = el.querySelector('[data-cfsb-bar-wrap]');

      if (!this.threshold) return;

      // Écoute les mises à jour du panier (drawer, popup, etc.)
      document.addEventListener('cart:updated', (e) => {
        this.update(e.detail?.total_price ?? 0);
      });

      // Écoute aussi les events natifs Shopify (thème Dawn)
      document.addEventListener('cart:refresh', () => this._fetchAndUpdate());
    }

    update(totalCents) {
      const threshold = this.threshold;
      const free      = totalCents >= threshold;
      const pct       = Math.min(100, Math.round((totalCents / threshold) * 100));
      const remaining = threshold - totalCents;

      // ── Classe wrapper
      this.el.classList.toggle('cfsb__wrap--free', free);

      // ── Message
      if (this.msgEl) {
        if (free) {
          this.msgEl.innerHTML = `<strong>${this.freeMsg}</strong>`;
          this.msgEl.classList.add('cfsb__msg--free');
        } else {
          const amountStr = this._money(remaining);
          this.msgEl.innerHTML = `Plus que <strong>${amountStr}</strong> pour la livraison gratuite`;
          this.msgEl.classList.remove('cfsb__msg--free');
        }
        this.msgEl.setAttribute('aria-label',
          free ? this.freeMsg : `Plus que ${this._money(remaining)} pour la livraison gratuite`
        );
      }

      // ── Barre
      if (free) {
        // Masquer la track quand livraison atteinte
        if (this.trackEl) this.trackEl.hidden = true;
      } else {
        if (this.trackEl) {
          this.trackEl.hidden = false;
          this.trackEl.setAttribute('aria-valuenow', pct);
        }
        if (this.fillEl) {
          this.fillEl.style.width = pct + '%';
          this.fillEl.removeAttribute('data-free');
        }
      }
    }

    async _fetchAndUpdate() {
      try {
        const res  = await fetch('/cart.json');
        const data = await res.json();
        this.update(data.total_price || 0);
      } catch (e) {}
    }

    _money(cents) {
      const euros   = Math.floor(cents / 100);
      const decimal = cents % 100;
      return decimal === 0
        ? `${euros}\u00A0€`
        : `${euros},${String(decimal).padStart(2, '0')}\u00A0€`;
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-cfsb]').forEach((el) => {
      if (!el._cfsbInit) {
        el._cfsbInit = new FreeShippingBar(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Rechargement éditeur Shopify
  document.addEventListener('shopify:section:load', init);

})();
