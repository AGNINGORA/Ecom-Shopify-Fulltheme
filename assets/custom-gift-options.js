/* =============================================================
   custom-gift-options.js
   Options cadeau : message personnalisé + emballage
   Dawn 15.x · Vanilla JS · fetch /cart/update.js
   ============================================================= */

(function () {
  'use strict';

  class GiftOptions {
    constructor(el) {
      this.el          = el;
      this.toggle      = el.querySelector('[data-cgo-toggle]');
      this.panel       = el.querySelector('[data-cgo-panel]');
      this.wrapping    = el.querySelector('[data-cgo-wrapping]');
      this.message     = el.querySelector('[data-cgo-message]');
      this.charCount   = el.querySelector('[data-cgo-char-count]');
      this.saveBtn     = el.querySelector('[data-cgo-save]');
      this.confirmEl   = el.querySelector('[data-cgo-confirm]');
      this.badge       = el.querySelector('[data-cgo-badge]');

      if (!this.toggle || !this.panel) return;

      this._confirmTimer = null;
      this._bindEvents();
      this._updateBadge();
    }

    // ── Accordéon ──────────────────────────────────────────────
    _bindEvents() {
      this.toggle.addEventListener('click', () => this._togglePanel());

      // Compteur de caractères
      this.message?.addEventListener('input', () => {
        const len = this.message.value.length;
        if (this.charCount) this.charCount.textContent = `${len}/200`;
      });

      // Sauvegarder
      this.saveBtn?.addEventListener('click', () => this._save());

      // Sauvegarde auto au blur du textarea
      this.message?.addEventListener('blur', () => this._save());
    }

    _togglePanel() {
      const open = this.toggle.getAttribute('aria-expanded') === 'true';
      this.toggle.setAttribute('aria-expanded', String(!open));
      if (open) {
        this.panel.setAttribute('hidden', '');
      } else {
        this.panel.removeAttribute('hidden');
        this.message?.focus();
      }
    }

    // ── Badge "Ajouté" dans le header ──────────────────────────
    _updateBadge() {
      if (!this.badge) return;
      const hasWrap = this.wrapping?.checked;
      const hasMsg  = this.message?.value?.trim().length > 0;
      if (hasWrap || hasMsg) {
        this.badge.removeAttribute('hidden');
      } else {
        this.badge.setAttribute('hidden', '');
      }
    }

    // ── Sauvegarder dans les attributs du panier ───────────────
    async _save() {
      this._setLoading(true);
      this._hideConfirm();

      const isWrapping = this.wrapping?.checked || false;
      const msgText    = this.message?.value?.trim() || '';

      const attributes = {
        emballage_cadeau: isWrapping ? 'oui' : '',
        message_cadeau:   msgText,
      };

      try {
        const res = await fetch('/cart/update.js', {
          method:  'POST',
          headers: {
            'Content-Type':    'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ attributes }),
        });

        if (!res.ok) throw new Error('update failed');

        const cart = await res.json();

        // Mettre à jour le badge
        this._updateBadge();

        // Afficher confirmation
        this._showConfirm();

        // Dispatcher pour sync drawer / autres composants
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));

      } catch (err) {
        console.warn('[GiftOptions] Save error:', err);
      } finally {
        this._setLoading(false);
      }
    }

    // ── UI helpers ─────────────────────────────────────────────
    _setLoading(on) {
      if (!this.saveBtn) return;
      this.saveBtn.disabled = on;
      this.saveBtn.classList.toggle('is-loading', on);
    }

    _showConfirm() {
      if (!this.confirmEl) return;
      this.confirmEl.removeAttribute('hidden');
      clearTimeout(this._confirmTimer);
      this._confirmTimer = setTimeout(() => this._hideConfirm(), 2500);
    }

    _hideConfirm() {
      this.confirmEl?.setAttribute('hidden', '');
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-cgo]').forEach((el) => {
      if (!el._cgoInit) el._cgoInit = new GiftOptions(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', init);

})();
