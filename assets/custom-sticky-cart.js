/**
 * custom-sticky-cart.js
 * Barre fixe ATC – IntersectionObserver + variante dynamique
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class StickyCart {
    constructor(bar) {
      this.bar        = bar;
      this.variantIdInput = bar.querySelector('[data-csc-variant-id]');
      this.priceEl    = bar.querySelector('[data-csc-price]');
      this.select     = bar.querySelector('[data-csc-select]');
      this.atcBtn     = bar.querySelector('[data-csc-atc]');
      this.btnLabel   = bar.querySelector('[data-csc-btn-label]');

      // Données variantes
      const jsonEl    = bar.querySelector('[data-csc-variants]');
      this.variants   = jsonEl ? JSON.parse(jsonEl.textContent) : [];

      this._initObserver();
      this._bindSelect();
      this._bindVariantChange();
      this._bindForm();
    }

    // ── IntersectionObserver sur le bouton ATC principal ──────────
    _initObserver() {
      // Cherche le bouton ATC principal (custom-variant-selector ou Dawn natif)
      const mainAtc =
        document.querySelector('[data-cvs-atc]') ||
        document.querySelector('#ProductSubmitButton-' + this._sectionId()) ||
        document.querySelector('.product-form__submit');

      if (!mainAtc) {
        // Fallback : afficher après 300px de scroll
        window.addEventListener('scroll', () => {
          this._toggle(window.scrollY > 300);
        }, { passive: true });
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => this._toggle(!entry.isIntersecting),
        { threshold: 0, rootMargin: '0px 0px 0px 0px' }
      );

      observer.observe(mainAtc);
    }

    _sectionId() {
      // Tente de récupérer le section id depuis l'URL ou le DOM
      const el = document.querySelector('[data-section-id]');
      return el ? el.dataset.sectionId : '';
    }

    // ── Afficher / masquer la barre ────────────────────────────────
    _toggle(show) {
      this.bar.classList.toggle('is-visible', show);
      this.bar.setAttribute('aria-hidden', String(!show));
    }

    // ── Sync depuis les swatches/pills du sélecteur principal ────
    _bindVariantChange() {
      document.addEventListener('variant:change', (e) => {
        const variant = e.detail?.variant;
        if (!variant) return;

        // Sync le select si l'option existe
        if (this.select) {
          const opt = this.select.querySelector(`option[value="${variant.id}"]`);
          if (opt) this.select.value = variant.id;
        }

        if (this.variantIdInput) this.variantIdInput.value = variant.id;
        this._updatePrice(variant);
        this._setAtcState(variant.available);
      });
    }

    // ── Changement de variante via le select ─────────────────────
    _bindSelect() {
      if (!this.select) return;

      this.select.addEventListener('change', () => {
        const variantId = parseInt(this.select.value, 10);
        const variant   = this.variants.find((v) => v.id === variantId);
        if (!variant) return;

        // Mise à jour input caché
        if (this.variantIdInput) this.variantIdInput.value = variantId;

        // Mise à jour prix
        this._updatePrice(variant);

        // Mise à jour bouton
        this._setAtcState(variant.available);
      });
    }

    // ── Mise à jour affichage prix ───────────────────────────────
    _updatePrice(variant) {
      if (!this.priceEl) return;

      const price     = this._formatMoney(variant.price);
      const compareAt = variant.compare_at_price;

      if (compareAt && compareAt > variant.price) {
        this.priceEl.innerHTML = `
          <span class="csc__price-sale">${price}</span>
          <s class="csc__price-compare">${this._formatMoney(compareAt)}</s>
        `;
      } else {
        this.priceEl.innerHTML = `<span class="csc__price-regular">${price}</span>`;
      }
    }

    // ── État bouton ATC ──────────────────────────────────────────
    _setAtcState(available) {
      if (!this.atcBtn || !this.btnLabel) return;
      this.atcBtn.disabled = !available;
      this.atcBtn.setAttribute('aria-disabled', String(!available));
      this.btnLabel.textContent = available ? 'Ajouter' : 'Épuisé';
    }

    // ── Soumission du formulaire ─────────────────────────────────
    _bindForm() {
      const form = this.bar.querySelector('[data-type="add-to-cart-form"]');
      if (!form) return;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (this.atcBtn?.disabled) return;

        const variantId = parseInt(this.variantIdInput?.value, 10);
        if (!variantId) return;

        this._setLoading(true);

        try {
          const res = await fetch('/cart/add.js', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body:    JSON.stringify({ id: variantId, quantity: 1 }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.description || 'Erreur');
          }

          // Feedback visuel
          if (this.btnLabel) {
            this.btnLabel.textContent = '✓ Ajouté';
            setTimeout(() => {
              if (this.btnLabel) this.btnLabel.textContent = 'Ajouter';
            }, 2000);
          }

          // Rafraîchir le panier Dawn
          document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
          this._refreshCartCount();

        } catch (err) {
          if (this.btnLabel) {
            this.btnLabel.textContent = 'Erreur';
            setTimeout(() => {
              if (this.btnLabel) this.btnLabel.textContent = 'Ajouter';
            }, 2000);
          }
        } finally {
          this._setLoading(false);
        }
      });
    }

    // ── Rafraîchir le compteur panier Dawn ───────────────────────
    async _refreshCartCount() {
      try {
        const res  = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
        const cart = await res.json();
        document.dispatchEvent(
          new CustomEvent('cart:update', { bubbles: true, detail: { cart } })
        );
        document.querySelectorAll('[data-cart-count]').forEach((el) => {
          el.textContent = cart.item_count;
        });
      } catch { /* silencieux */ }
    }

    // ── Formatage monétaire ──────────────────────────────────────
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

    // ── Loading ──────────────────────────────────────────────────
    _setLoading(on) {
      this.atcBtn?.classList.toggle('is-loading', on);
      if (this.atcBtn) this.atcBtn.disabled = on;
    }
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    const bar = document.getElementById('custom-sticky-cart');
    if (bar && !bar._stickyInit) {
      bar._stickyInit = new StickyCart(bar);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
