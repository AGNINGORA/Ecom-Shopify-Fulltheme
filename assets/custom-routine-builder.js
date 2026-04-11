/**
 * custom-routine-builder.js
 * Routine beauté – calcul dynamique + ajout au panier via fetch
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class RoutineBuilder {
    constructor(root) {
      this.root        = root;
      this.discountPct = parseFloat(root.dataset.discountPct) || 0;

      // Éléments DOM
      this.steps       = Array.from(root.querySelectorAll('[data-crb-step]'));
      this.checkboxes  = Array.from(root.querySelectorAll('[data-crb-checkbox]'));
      this.addBtn      = root.querySelector('[data-crb-add-btn]');
      this.btnLabel    = root.querySelector('[data-crb-btn-label]');
      this.totalEl     = root.querySelector('[data-crb-total]');
      this.originalEl  = root.querySelector('[data-crb-original]');
      this.savingsEl   = root.querySelector('[data-crb-savings]');
      this.noticeEl    = root.querySelector('[data-crb-notice]');

      // Initialisation
      this._syncStepClasses();
      this._updateSummary();
      this._bindEvents();
    }

    // ── Liaisons ────────────────────────────────────────────────
    _bindEvents() {
      this.checkboxes.forEach((cb) => {
        cb.addEventListener('change', () => {
          this._syncStepClasses();
          this._updateSummary();
          this._clearNotice();
        });
      });

      this.addBtn?.addEventListener('click', () => this._addToCart());
    }

    // ── Sync classes visuelles des étapes ─────────────────────
    _syncStepClasses() {
      this.steps.forEach((step) => {
        const cb = step.querySelector('[data-crb-checkbox]');
        if (!cb) return;
        step.classList.toggle('is-checked', cb.checked);
        step.classList.toggle('is-unavailable', cb.disabled);
      });
    }

    // ── Calcul et affichage des prix ───────────────────────────
    _updateSummary() {
      const checkedSteps = this.steps.filter((step) => {
        const cb = step.querySelector('[data-crb-checkbox]');
        return cb && cb.checked && !cb.disabled;
      });

      const totalCents = checkedSteps.reduce((sum, step) => {
        return sum + (parseInt(step.dataset.price, 10) || 0);
      }, 0);

      const hasDiscount   = this.discountPct > 0;
      const discountedCents = hasDiscount
        ? Math.round(totalCents * (1 - this.discountPct / 100))
        : totalCents;
      const savedCents    = totalCents - discountedCents;

      // Mise à jour DOM
      if (this.totalEl)    this.totalEl.textContent    = this._formatMoney(discountedCents);
      if (this.originalEl) this.originalEl.textContent = this._formatMoney(totalCents);
      if (this.savingsEl)  this.savingsEl.textContent  = savedCents > 0
        ? '- ' + this._formatMoney(savedCents)
        : '—';

      // Désactiver le bouton si aucun produit sélectionné
      if (this.addBtn) {
        this.addBtn.disabled = checkedSteps.length === 0;
      }
    }

    // ── Ajout au panier via fetch ──────────────────────────────
    async _addToCart() {
      const items = this.steps
        .filter((step) => {
          const cb = step.querySelector('[data-crb-checkbox]');
          return cb && cb.checked && !cb.disabled;
        })
        .map((step) => ({
          id:       parseInt(step.dataset.variantId, 10),
          quantity: 1,
        }));

      if (items.length === 0) return;

      this._setLoading(true);
      this._clearNotice();

      try {
        const response = await fetch('/cart/add.js', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body:    JSON.stringify({ items }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.description || 'Erreur lors de l\'ajout au panier.');
        }

        this._setNotice('Routine ajoutée au panier !', 'success');

        // Déclencher l'événement cart update de Dawn (ouvre le cart drawer)
        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));

        // Fallback : mise à jour du compteur panier via fetch
        this._refreshCartCount();

      } catch (err) {
        this._setNotice(err.message || 'Une erreur est survenue.', 'error');
      } finally {
        this._setLoading(false);
      }
    }

    // ── Rafraîchit le compteur du panier Dawn ─────────────────
    async _refreshCartCount() {
      try {
        const res  = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
        const cart = await res.json();

        // Dawn utilise bubble-event cart:update ou met à jour via custom element
        document.dispatchEvent(
          new CustomEvent('cart:update', {
            bubbles: true,
            detail:  { cart },
          })
        );

        // Mise à jour directe du compteur si disponible
        document.querySelectorAll('[data-cart-count]').forEach((el) => {
          el.textContent = cart.item_count;
        });
      } catch {
        // Silencieux — non bloquant
      }
    }

    // ── Formatage monétaire ────────────────────────────────────
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

    // ── Helpers UI ────────────────────────────────────────────
    _setLoading(on) {
      if (!this.addBtn) return;
      this.addBtn.classList.toggle('is-loading', on);
      this.addBtn.disabled = on;
    }

    _setNotice(msg, type) {
      if (!this.noticeEl) return;
      this.noticeEl.textContent  = msg;
      this.noticeEl.className    = `crb__notice crb__notice--${type}`;
    }

    _clearNotice() {
      if (!this.noticeEl) return;
      this.noticeEl.textContent = '';
      this.noticeEl.className   = 'crb__notice';
    }
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.custom-routine-builder[data-section-id]').forEach((el) => {
      if (!el._rbInit) el._rbInit = new RoutineBuilder(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('.custom-routine-builder');
    if (el) el._rbInit = new RoutineBuilder(el);
  });
})();
