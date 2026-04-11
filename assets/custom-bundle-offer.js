/**
 * custom-bundle-offer.js
 * Bundle : achat multiple du même produit avec couleur différente par slot
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class BundleOffer {
    constructor(root) {
      this.root = root;

      // Éléments DOM
      this.tierRadios   = Array.from(root.querySelectorAll('[data-tier-radio]'));
      this.tierLabels   = Array.from(root.querySelectorAll('[data-tier-label]'));
      this.configEl     = root.querySelector('[data-cbo-config]');
      this.slotsEl      = root.querySelector('[data-cbo-slots]');
      this.originalEl   = root.querySelector('[data-cbo-original]');
      this.discountedEl = root.querySelector('[data-cbo-discounted]');
      this.savingsEl    = root.querySelector('[data-cbo-savings]');
      this.addBtn       = root.querySelector('[data-cbo-add-btn]');
      this.btnLabel     = root.querySelector('[data-cbo-btn-label]');
      this.noticeEl     = root.querySelector('[data-cbo-notice]');

      if (!this.configEl) return;

      // Données produit
      this.basePrice      = parseInt(this.configEl.dataset.basePrice, 10) || 0;
      this.defaultVariant = parseInt(this.configEl.dataset.variantId, 10) || 0;
      this.hasColor       = this.configEl.dataset.hasColor === 'true';
      this.colorIdx       = parseInt(this.configEl.dataset.colorOptionIndex, 10) || 0;
      this.colorName      = this.configEl.dataset.colorOptionName || 'Color';
      this.sizeIdx        = parseInt(this.configEl.dataset.sizeOptionIndex, 10);
      this.currentSize    = this.configEl.dataset.currentSize || '';

      try {
        this.variants = JSON.parse(this.configEl.dataset.variants || '[]');
        this.colors   = JSON.parse(this.configEl.dataset.colors || '[]');
      } catch {
        this.variants = [];
        this.colors   = [];
      }

      // État : variant choisi par slot
      this.currentQty      = 0;
      this.currentDiscount = 0;
      this.slotSelections  = []; // array of { color, variantId, price }

      // Init
      const checkedRadio = this.tierRadios.find((r) => r.checked);
      if (checkedRadio) this._applyTier(checkedRadio);

      this._bindEvents();
    }

    // ── Liaisons ────────────────────────────────────────────────
    _bindEvents() {
      this.tierRadios.forEach((radio) => {
        radio.addEventListener('change', () => {
          if (radio.checked) this._applyTier(radio);
        });
      });

      this.tierLabels.forEach((label) => {
        label.addEventListener('click', () => {
          const radio = label.querySelector('[data-tier-radio]');
          if (radio && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
        });
      });

      this.addBtn?.addEventListener('click', () => this._addToCart());
    }

    // ── Appliquer un tier ────────────────────────────────────────
    _applyTier(radio) {
      this.currentQty      = parseInt(radio.dataset.qty, 10) || 1;
      this.currentDiscount = parseFloat(radio.dataset.discount) || 0;

      // Mise à jour visuelle des labels
      this.tierLabels.forEach((label) => {
        const r = label.querySelector('[data-tier-radio]');
        label.classList.toggle('is-selected', r && r === radio);
      });

      // Initialiser les sélections de slot
      this._initSlotSelections();
      this._renderSlots();
      this._updatePrices();
      this._clearNotice();
    }

    // ── Initialiser les sélections ──────────────────────────────
    _initSlotSelections() {
      const defaultColor = this.colors.length > 0 ? this.colors[0].name : '';
      this.slotSelections = [];

      for (let i = 0; i < this.currentQty; i++) {
        const variant = this._findVariant(defaultColor);
        this.slotSelections.push({
          color:     defaultColor,
          variantId: variant ? variant.id : this.defaultVariant,
          price:     variant ? variant.price : this.basePrice,
          available: variant ? variant.available : true,
        });
      }
    }

    // ── Trouver la variante pour une couleur (et la taille courante) ──
    _findVariant(color) {
      if (!this.hasColor) return this.variants[0] || null;

      // D'abord chercher avec la taille courante
      if (this.currentSize && this.sizeIdx >= 0) {
        const match = this.variants.find((v) =>
          v.options[this.colorIdx] === color &&
          v.options[this.sizeIdx] === this.currentSize &&
          v.available
        );
        if (match) return match;

        // Même taille, même couleur, même si épuisé
        const matchAny = this.variants.find((v) =>
          v.options[this.colorIdx] === color &&
          v.options[this.sizeIdx] === this.currentSize
        );
        if (matchAny) return matchAny;
      }

      // Sinon, première variante dispo de cette couleur
      return this.variants.find((v) =>
        v.options[this.colorIdx] === color && v.available
      ) || this.variants.find((v) =>
        v.options[this.colorIdx] === color
      );
    }

    // ── Rendu des slots couleur ─────────────────────────────────
    _renderSlots() {
      if (!this.slotsEl || !this.hasColor || this.colors.length <= 1) return;

      // Pas besoin de slots si qty = 1
      if (this.currentQty <= 1) {
        this.slotsEl.innerHTML = '';
        this.slotsEl.style.display = 'none';
        return;
      }

      this.slotsEl.style.display = '';
      let html = '<p class="cbo__slots-title">Choisissez une couleur par article :</p>';

      for (let i = 0; i < this.currentQty; i++) {
        const sel = this.slotSelections[i];
        html += `<div class="cbo__slot" data-slot-index="${i}">`;
        html += `<span class="cbo__slot-label">Article ${i + 1} :</span>`;
        html += `<div class="cbo__slot-swatches">`;

        for (const color of this.colors) {
          const isActive = sel.color === color.name;
          html += `<button type="button"
            class="cbo__swatch${isActive ? ' is-active' : ''}"
            data-cbo-slot-swatch
            data-slot="${i}"
            data-color="${color.name}"
            title="${color.name}"
            aria-label="${this.colorName}: ${color.name}"
            style="--swatch-color: ${color.css}">
            <span class="cbo__swatch-inner"></span>
          </button>`;
        }

        html += `</div>`;
        html += `<span class="cbo__slot-selected">${sel.color}</span>`;
        html += `</div>`;
      }

      this.slotsEl.innerHTML = html;

      // Bind les clics
      this.slotsEl.querySelectorAll('[data-cbo-slot-swatch]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const slotIdx = parseInt(btn.dataset.slot, 10);
          const color   = btn.dataset.color;
          this._selectSlotColor(slotIdx, color);
        });
      });
    }

    // ── Sélection de couleur sur un slot ────────────────────────
    _selectSlotColor(slotIdx, color) {
      const variant = this._findVariant(color);
      if (!variant) return;

      this.slotSelections[slotIdx] = {
        color:     color,
        variantId: variant.id,
        price:     variant.price,
        available: variant.available,
      };

      // Mettre à jour visuellement ce slot
      const slotEl = this.slotsEl.querySelector(`[data-slot-index="${slotIdx}"]`);
      if (slotEl) {
        slotEl.querySelectorAll('[data-cbo-slot-swatch]').forEach((s) => {
          s.classList.toggle('is-active', s.dataset.color === color);
        });
        const selectedLabel = slotEl.querySelector('.cbo__slot-selected');
        if (selectedLabel) selectedLabel.textContent = color;
      }

      this._updatePrices();
    }

    // ── Calcul des prix ─────────────────────────────────────────
    _updatePrices() {
      const totalCents = this.slotSelections.reduce((sum, s) => sum + s.price, 0);

      const discountedCents = this.currentDiscount > 0
        ? Math.round(totalCents * (1 - this.currentDiscount / 100))
        : totalCents;

      const savedCents = totalCents - discountedCents;

      if (this.originalEl) {
        this.originalEl.textContent = this.currentDiscount > 0
          ? this._formatMoney(totalCents)
          : '';
        this.originalEl.style.display = this.currentDiscount > 0 ? '' : 'none';
      }

      if (this.discountedEl) {
        this.discountedEl.textContent = this._formatMoney(discountedCents);
      }

      if (this.savingsEl) {
        this.savingsEl.textContent = savedCents > 0
          ? `Vous économisez ${this._formatMoney(savedCents)}`
          : '';
      }

      if (this.addBtn) {
        const anyUnavailable = this.slotSelections.some((s) => !s.available);
        this.addBtn.disabled = anyUnavailable;
      }
    }

    // ── Ajout au panier ─────────────────────────────────────────
    async _addToCart() {
      // Grouper par variant ID pour combiner les quantités
      const grouped = {};
      for (const slot of this.slotSelections) {
        if (!slot.available) continue;
        if (grouped[slot.variantId]) {
          grouped[slot.variantId].quantity += 1;
        } else {
          grouped[slot.variantId] = { id: slot.variantId, quantity: 1 };
        }
      }

      const items = Object.values(grouped);
      if (items.length === 0) return;

      this._setLoading(true);
      this._clearNotice();

      try {
        const response = await fetch('/cart/add.js', {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept':       'application/json',
          },
          body: JSON.stringify({ items }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.description || 'Erreur lors de l\'ajout au panier.');
        }

        this._setNotice('Lot ajouté au panier !', 'success');

        // Ouvrir le custom cart drawer
        const ccd = window._ccdInstance;
        if (ccd && typeof ccd.fetchAndRender === 'function') {
          await ccd.fetchAndRender();
          ccd.open();
        }

        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
        this._refreshCartCount();

      } catch (err) {
        this._setNotice(err.message || 'Une erreur est survenue.', 'error');
      } finally {
        this._setLoading(false);
      }
    }

    // ── Rafraîchit le compteur panier ──────────────────────────
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
        document.querySelectorAll('.cart-count-bubble span[aria-hidden="true"]').forEach((el) => {
          el.textContent = cart.item_count;
        });
        document.querySelectorAll('.cart-count-bubble').forEach((el) => {
          el.style.display = cart.item_count > 0 ? '' : 'none';
        });
      } catch {
        // silencieux
      }
    }

    // ── Formatage monétaire ─────────────────────────────────────
    _formatMoney(cents) {
      const currency = window.Shopify?.currency?.active || 'EUR';
      const locale   = document.documentElement.lang || 'fr-FR';
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
        }).format(cents / 100);
      } catch {
        return (cents / 100).toFixed(2).replace('.', ',') + '\u00a0' + currency;
      }
    }

    // ── Helpers UI ───────────────────────────────────────────────
    _setLoading(on) {
      if (!this.addBtn) return;
      this.addBtn.classList.toggle('is-loading', on);
      this.addBtn.disabled = on;
    }

    _setNotice(msg, type) {
      if (!this.noticeEl) return;
      this.noticeEl.textContent = msg;
      this.noticeEl.className   = `cbo__notice cbo__notice--${type}`;
    }

    _clearNotice() {
      if (!this.noticeEl) return;
      this.noticeEl.textContent = '';
      this.noticeEl.className   = 'cbo__notice';
    }
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.custom-bundle-offer[data-section-id]').forEach((el) => {
      if (!el._boInit) el._boInit = new BundleOffer(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('.custom-bundle-offer');
    if (el) el._boInit = new BundleOffer(el);
  });
})();
