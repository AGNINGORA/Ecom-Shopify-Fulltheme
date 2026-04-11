/**
 * custom-urgency.js
 * Éléments d'urgence page produit :
 *   1. Stock bas avec barre de progression (réactif aux changements de variante)
 *   2. Compteur de visiteurs aléatoire + rotation
 *   3. Compte à rebours promo
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  //  1. STOCK BAS
  // ══════════════════════════════════════════════════════════════

  class StockIndicator {
    constructor(el) {
      this.el        = el;
      this.msgEl     = el.querySelector('[data-curg-stock-msg]');
      this.barEl     = el.querySelector('[data-curg-bar]');
      this.trackEl   = el.querySelector('.curg__bar-track');
      this.threshold = parseInt(el.dataset.threshold, 10) || 10;

      // Charger les données de stock de toutes les variantes
      const dataEl = el.closest('[data-curg]')?.querySelector('[data-curg-variants]');
      try {
        this.variants = dataEl ? JSON.parse(dataEl.textContent.trim()) : {};
      } catch (_) {
        this.variants = {};
      }

      this._listenVariantChange();
    }

    // ── Mise à jour de l'affichage ────────────────────────────────
    update(variantId) {
      const data = this.variants[String(variantId)];
      if (!data || data.managed !== 'shopify') {
        this.el.hidden = true;
        return;
      }

      const qty = data.qty || 0;

      if (qty >= this.threshold) {
        this.el.hidden = true;
        return;
      }

      // Afficher
      this.el.hidden = false;

      // Texte
      if (this.msgEl) {
        if (qty <= 0) {
          this.msgEl.textContent = 'Rupture de stock';
        } else if (qty === 1) {
          this.msgEl.textContent = 'Plus que 1 en stock !';
        } else if (qty < 3) {
          this.msgEl.textContent = `Plus que ${qty} en stock !`;
        } else {
          this.msgEl.textContent = `Plus que ${qty} en stock`;
        }
      }

      // Couleur critique
      if (qty < 3) {
        this.el.setAttribute('data-critical', '');
      } else {
        this.el.removeAttribute('data-critical');
      }

      // Barre
      const pct = Math.min(100, Math.round((qty / this.threshold) * 100));
      if (this.barEl) this.barEl.style.width = pct + '%';
      if (this.trackEl) {
        this.trackEl.setAttribute('aria-valuenow', qty);
        this.trackEl.setAttribute('aria-valuemax', this.threshold);
      }
    }

    // ── Écouter les changements de variante ───────────────────────
    _listenVariantChange() {
      // Dawn 15 dispatche 'variant:change' sur le product-info parent
      const productInfo = this.el.closest('product-info');
      if (productInfo) {
        productInfo.addEventListener('variant:change', (e) => {
          if (e.detail?.variant?.id) this.update(e.detail.variant.id);
        });
      }

      // Fallback : écouter le changement sur l'input[name="id"] du form
      const form = this.el.closest('.product')?.querySelector('form[action*="/cart/add"]')
                ?? document.querySelector('form[action*="/cart/add"]');
      if (form) {
        const idInput = form.querySelector('input[name="id"]');
        if (idInput) {
          // Utiliser un MutationObserver pour détecter les changements de valeur
          new MutationObserver(() => {
            if (idInput.value) this.update(idInput.value);
          }).observe(idInput, { attributes: true, attributeFilter: ['value'] });

          // Init avec la valeur initiale
          if (idInput.value) this.update(idInput.value);
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  2. COMPTEUR DE VISITEURS
  // ══════════════════════════════════════════════════════════════

  class VisitorCounter {
    constructor(el) {
      this.el       = el;
      this.countEl  = el.querySelector('[data-curg-count]');
      this.min      = parseInt(el.dataset.min, 10) || 8;
      this.max      = parseInt(el.dataset.max, 10) || 32;
      this.current  = this._random();

      this._update();
      // Changer toutes les 30s
      setInterval(() => {
        this._update();
      }, 30000);
    }

    _random() {
      return Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
    }

    _update() {
      // Variation légère ±1 à ±3 autour du précédent
      const delta   = Math.floor(Math.random() * 5) - 2; // -2 à +2
      this.current  = Math.min(this.max, Math.max(this.min, this.current + delta));

      if (this.countEl) {
        // Petit fade pour signaler le changement
        this.countEl.style.opacity = '0';
        setTimeout(() => {
          if (this.countEl) {
            this.countEl.textContent = this.current;
            this.countEl.style.opacity = '1';
          }
        }, 150);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  3. TIMER PROMO
  // ══════════════════════════════════════════════════════════════

  class PromoTimer {
    constructor(el) {
      this.el          = el;
      this.daysEl      = el.querySelector('[data-curg-days]');
      this.hoursEl     = el.querySelector('[data-curg-hours]');
      this.minsEl      = el.querySelector('[data-curg-mins]');
      this.secsEl      = el.querySelector('[data-curg-secs]');
      this.displayEl   = el.querySelector('[data-curg-timer-display]');
      this.endDate     = new Date(el.dataset.end);
      this.behavior    = el.dataset.expired || 'message';
      this.expiredMsg  = el.dataset.expiredMsg || 'Offre expirée';

      if (isNaN(this.endDate.getTime())) {
        // Date invalide : masquer le timer
        el.hidden = true;
        return;
      }

      this._tick();
      this._interval = setInterval(() => this._tick(), 1000);
    }

    _tick() {
      const now  = Date.now();
      const diff = this.endDate.getTime() - now;

      if (diff <= 0) {
        clearInterval(this._interval);
        this._onExpired();
        return;
      }

      const days  = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins  = Math.floor((diff % 3600000)  / 60000);
      const secs  = Math.floor((diff % 60000)    / 1000);

      const pad = (n) => String(n).padStart(2, '0');

      if (this.daysEl)  this.daysEl.textContent  = pad(days);
      if (this.hoursEl) this.hoursEl.textContent = pad(hours);
      if (this.minsEl)  this.minsEl.textContent  = pad(mins);
      if (this.secsEl)  this.secsEl.textContent  = pad(secs);
    }

    _onExpired() {
      if (this.behavior === 'hide') {
        this.el.hidden = true;
      } else {
        // Remplacer l'affichage par le message d'expiration
        if (this.displayEl) {
          this.displayEl.innerHTML =
            `<p class="curg__timer-expired">${this._escape(this.expiredMsg)}</p>`;
        }
      }
    }

    _escape(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════

  function init() {
    document.querySelectorAll('[data-curg]').forEach((wrap) => {
      if (wrap._curgInit) return;
      wrap._curgInit = true;

      // Stock
      const stockEl = wrap.querySelector('[data-curg-stock]');
      if (stockEl) new StockIndicator(stockEl);

      // Visiteurs
      const visitorsEl = wrap.querySelector('[data-curg-visitors]');
      if (visitorsEl) new VisitorCounter(visitorsEl);

      // Timer
      const timerEl = wrap.querySelector('[data-curg-timer]');
      if (timerEl) new PromoTimer(timerEl);
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
