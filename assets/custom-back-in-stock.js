/* =============================================================
   custom-back-in-stock.js
   Formulaire alerte retour en stock
   Dawn 15.x · Vanilla JS · fetch /contact
   ============================================================= */

(function () {
  'use strict';

  class BackInStock {
    constructor(el) {
      this.el         = el;
      this.form       = el.querySelector('[data-cbis-form]');
      this.emailInput = el.querySelector('[data-cbis-email]');
      this.submitBtn  = el.querySelector('[data-cbis-submit]');
      this.errorEl    = el.querySelector('[data-cbis-error]');
      this.formWrap   = el.querySelector('[data-cbis-form-wrap]');
      this.successEl  = el.querySelector('[data-cbis-success]');

      if (!this.form) return;

      this._bindEvents();

      // Écoute les changements de variante pour mettre à jour le data-variant-id
      document.addEventListener('variant:changed', (e) => {
        const v = e.detail?.variant;
        if (!v || String(v.product_id) !== String(this.el.dataset.productId)) return;

        this.el.dataset.variantId = v.id;
        this.el.dataset.variantTitle = v.title || '';

        // Afficher/masquer selon la disponibilité
        if (v.available) {
          this.el.hidden = true;
        } else {
          this.el.hidden = false;
          // Reset état si l'utilisateur a déjà soumis
          this._reset();
        }
      });
    }

    _bindEvents() {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this._submit();
      });
    }

    async _submit() {
      const email = this.emailInput?.value?.trim();
      if (!email || !this._validEmail(email)) {
        this._showError('Veuillez saisir une adresse e-mail valide.');
        return;
      }

      this._clearError();
      this._setLoading(true);

      const variantId    = this.el.dataset.variantId;
      const variantTitle = this.el.dataset.variantTitle;
      const productTitle = this.el.dataset.productTitle;

      // Stocker localement pour éviter les doublons
      const storageKey = `cbis_${variantId}`;
      if (localStorage.getItem(storageKey)) {
        this._showSuccess();
        this._setLoading(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append('form_type', 'contact');
        formData.append('utf8', '✓');
        formData.append('contact[email]', email);
        formData.append('contact[subject]', `Alerte retour en stock : ${productTitle}`);
        formData.append('contact[body]',
          `Alerte stock demandée\n` +
          `Produit : ${productTitle}\n` +
          `Variante : ${variantTitle} (ID : ${variantId})\n` +
          `E-mail : ${email}`
        );
        formData.append('contact[tags]', `back-in-stock,variant-${variantId}`);

        const res = await fetch('/contact#contact_form', {
          method:  'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body:    formData,
        });

        if (res.ok) {
          localStorage.setItem(storageKey, '1');
          this._showSuccess();
        } else {
          throw new Error('Erreur réseau');
        }
      } catch (err) {
        this._showError("Une erreur s'est produite. Réessayez dans un instant.");
      } finally {
        this._setLoading(false);
      }
    }

    _showSuccess() {
      if (this.formWrap) this.formWrap.hidden = true;
      if (this.successEl) this.successEl.removeAttribute('hidden');
    }

    _reset() {
      if (this.formWrap) this.formWrap.hidden = false;
      if (this.successEl) this.successEl.setAttribute('hidden', '');
      if (this.emailInput) this.emailInput.value = '';
      this._clearError();
    }

    _showError(msg) {
      if (!this.errorEl) return;
      this.errorEl.textContent = msg;
      this.errorEl.removeAttribute('hidden');
    }

    _clearError() {
      if (!this.errorEl) return;
      this.errorEl.textContent = '';
      this.errorEl.setAttribute('hidden', '');
    }

    _setLoading(on) {
      if (!this.submitBtn) return;
      this.submitBtn.disabled = on;
      this.submitBtn.classList.toggle('is-loading', on);
    }

    _validEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-cbis]').forEach((el) => {
      if (!el._cbisInit) el._cbisInit = new BackInStock(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', init);

})();
