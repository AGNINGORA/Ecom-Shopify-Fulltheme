/**
 * custom-shipping-bar.js
 * Barre de livraison gratuite — mise à jour dynamique
 * Vanilla JS · Dawn 15.x
 *
 * Écoute :
 *  - cart:refresh (événement custom dispatché par nos composants)
 *  - cart:update  (événement custom avec detail.count)
 *  - subscribe('cart-update', ...) via PubSub Dawn 15
 */

(function () {
  'use strict';

  class ShippingBar {
    constructor(el) {
      this.el         = el;
      this.msgEl      = el.querySelector('[data-csb-msg]');
      this.fillEl     = el.querySelector('[data-csb-fill]');
      this.trackEl    = el.querySelector('.csb__track');
      this.pctEl      = el.querySelector('[data-csb-pct]');
      this.closeBtn   = el.querySelector('[data-csb-close]');

      // Config depuis data-attributes
      this.threshold  = parseInt(el.dataset.threshold, 10) || 0;
      this.hideFree   = el.dataset.hideFree === 'true';
      this.showPct    = el.dataset.showPct === 'true';
      this.freeMsg    = el.dataset.msgFree || '🎉 Livraison gratuite !';

      this._readMessages();
      this._bindClose();
      this._listenEvents();
    }

    _readMessages() {
      this.msgPrefix = this.el.dataset.msgPrefix || 'Plus que';
      this.msgSuffix = this.el.dataset.msgSuffix || 'pour la livraison gratuite !';
      this.msgEmpty  = this.el.dataset.msgEmpty  || 'Livraison gratuite dès';
    }

    _bindClose() {
      if (!this.closeBtn) return;
      this.closeBtn.addEventListener('click', () => {
        this.el.hidden = true;
        try { sessionStorage.setItem('csb_closed', '1'); } catch (_) {}
      });
      // Ne pas réafficher si fermé dans cette session
      try {
        if (sessionStorage.getItem('csb_closed') === '1') this.el.hidden = true;
      } catch (_) {}
    }

    // ── Mettre à jour depuis un total en centimes ────────────────
    update(totalCents) {
      if (!this.threshold) return;

      const remaining = Math.max(0, this.threshold - totalCents);
      const pct       = Math.min(100, Math.round((totalCents / this.threshold) * 100));
      const isFree    = remaining === 0;

      // Masquer si option activée et livraison gratuite atteinte
      if (this.hideFree && isFree) {
        this.el.hidden = true;
        return;
      }
      this.el.hidden = false;

      // Classe CSS --free
      this.el.classList.toggle('csb__wrap--free', isFree);

      // Barre
      if (this.fillEl) {
        this.fillEl.style.width = pct + '%';
        this.fillEl.toggleAttribute('data-free', isFree);
      }
      if (this.trackEl) {
        this.trackEl.setAttribute('aria-valuenow', pct);
      }

      // Pourcentage
      if (this.pctEl) {
        this.pctEl.textContent = pct + '%';
      }

      // Message
      if (this.msgEl) {
        if (isFree) {
          this.msgEl.innerHTML = this._esc(this.freeMsg);
        } else if (totalCents === 0) {
          const thresholdEur = this.threshold / 100;
          const thresholdDisplay = Number.isInteger(thresholdEur)
            ? thresholdEur + '€'
            : thresholdEur.toFixed(2) + '€';
          this.msgEl.innerHTML =
            this._esc(this.msgEmpty) + ' <strong>' + thresholdDisplay + '</strong>';
        } else {
          const remainingFormatted = this._money(remaining);
          this.msgEl.innerHTML =
            this._esc(this.msgPrefix) +
            ' <strong data-csb-remaining>' + remainingFormatted + '</strong> ' +
            this._esc(this.msgSuffix);
        }
      }
    }

    // ── Fetch le panier et mettre à jour ─────────────────────────
    async fetchAndUpdate() {
      try {
        const res  = await fetch('/cart.js', { headers: { 'Content-Type': 'application/json' } });
        const cart = res.ok ? await res.json() : null;
        if (cart) this.update(cart.total_price || 0);
      } catch (_) { /* noop */ }
    }

    // ── Écouter les événements panier ────────────────────────────
    _listenEvents() {
      // Événements personnalisés (dispatché par cart drawer, ATC, etc.)
      document.addEventListener('cart:refresh', (e) => {
        const total = e.detail?.total_price ?? null;
        if (total !== null) {
          this.update(total);
        } else {
          this.fetchAndUpdate();
        }
      });

      document.addEventListener('cart:update', (e) => {
        // cart:update peut ne pas avoir le total — on fetch pour être sûr
        this.fetchAndUpdate();
      });

      // Dawn 15 PubSub (subscribe est global si Dawn est chargé)
      if (typeof subscribe === 'function') {
        try {
          subscribe('cart-update', () => this.fetchAndUpdate());
        } catch (_) { /* noop */ }
      }
    }

    // ── Formatage monnaie ────────────────────────────────────────
    _money(cents) {
      const currency = window.Shopify?.currency?.active || 'EUR';
      const locale   = document.documentElement.lang || 'fr-FR';
      try {
        return new Intl.NumberFormat(locale, {
          style:                 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(cents / 100);
      } catch (_) {
        return Math.ceil(cents / 100) + '€';
      }
    }

    // ── Échappement HTML ─────────────────────────────────────────
    _esc(str) {
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-shipping-bar]').forEach((el) => {
      if (!el._csbInit) {
        el._csbInit = new ShippingBar(el);
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
