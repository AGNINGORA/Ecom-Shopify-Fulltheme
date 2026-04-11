/**
 * custom-quantity-breaks.js
 * Sélecteur de quantité avec remises progressives
 * + sélection de couleur par article quand qty > 1
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class QuantityBreaks {
    constructor(wrap) {
      this.wrap     = wrap;
      this.cards    = Array.from(wrap.querySelectorAll('[data-cqb-card]'));
      this.currency = wrap.dataset.currency || 'EUR';
      this.locale   = document.documentElement.lang || 'fr-FR';

      // Prix initiaux (en centimes) par variante ID
      const pricesEl = wrap.querySelector('[data-cqb-prices]');
      this.variantPrices = pricesEl ? JSON.parse(pricesEl.textContent) : {};

      // Prix courant de base
      this.basePrice = parseInt(wrap.dataset.price, 10) || 0;

      // Couleurs et variantes
      this.hasColor  = wrap.dataset.hasColor === 'true';
      this.colorIdx  = parseInt(wrap.dataset.colorIdx, 10) || 0;
      this.colorName = wrap.dataset.colorName || 'Color';

      const variantsEl = wrap.querySelector('[data-cqb-variants]');
      this.allVariants = variantsEl ? JSON.parse(variantsEl.textContent) : [];

      const colorsEl = wrap.querySelector('[data-cqb-colors]');
      this.colors = colorsEl ? JSON.parse(colorsEl.textContent) : [];

      // Éléments du formulaire — le wrap est rendu À L'INTÉRIEUR du form
      this.form       = wrap.closest('form');
      this.qtyInput   = wrap.querySelector('[data-cqb-qty-input]');
      this.varInput   = this.form?.querySelector('input[name="id"]');
      this.submitBtn  = this.form?.querySelector('[type="submit"][name="add"]');
      this.slotsEl    = wrap.parentElement?.querySelector('[data-cqb-slots]');

      // État
      this.currentQty  = 1;
      this.currentDisc = 0;
      this.slotSelections = [];
      this._multiColorMode = false;

      // Span total injecté dans le bouton ATC
      this._injectAtcSpan();

      this._bindEvents();

      // Sélectionner la première carte
      this._setActive(this.cards[0], false);
    }

    // ══════════════════════════════════════════════════════════════
    //  INJECTION DU SPAN PRIX DANS LE BOUTON ATC
    // ══════════════════════════════════════════════════════════════

    _injectAtcSpan() {
      if (!this.submitBtn) return;
      if (this.submitBtn.querySelector('.cqb__atc-total')) return;

      this.atcSpan = document.createElement('span');
      this.atcSpan.className = 'cqb__atc-total';
      this.atcSpan.setAttribute('aria-hidden', 'true');
      this.submitBtn.appendChild(this.atcSpan);
    }

    // ══════════════════════════════════════════════════════════════
    //  ÉVÉNEMENTS
    // ══════════════════════════════════════════════════════════════

    _bindEvents() {
      this.cards.forEach((card) => {
        card.addEventListener('click', () => this._setActive(card, true));
      });

      // Changement de variante
      if (this.varInput) {
        this.varInput.addEventListener('change', () => this._onVariantChange());
        new MutationObserver(() => this._onVariantChange())
          .observe(this.varInput, { attributes: true, attributeFilter: ['value'] });
      }

      document.addEventListener('variant:change', (e) => {
        const variant = e.detail?.variant;
        if (variant?.price !== undefined) {
          this.basePrice = variant.price;
          // Récupérer la taille courante depuis la variante
          if (this.hasColor && variant.options) {
            this._currentOptions = variant.options;
          }
          this._updateAllPrices();
          this._renderSlots();
        }
      });

      // Clavier
      this.wrap.addEventListener('keydown', (e) => {
        const idx = this.cards.indexOf(document.activeElement);
        if (idx === -1) return;
        if (e.key === 'ArrowDown' && idx < this.cards.length - 1) {
          e.preventDefault();
          this.cards[idx + 1].focus();
          this._setActive(this.cards[idx + 1], true);
        }
        if (e.key === 'ArrowUp' && idx > 0) {
          e.preventDefault();
          this.cards[idx - 1].focus();
          this._setActive(this.cards[idx - 1], true);
        }
      });

      // Intercepter le submit du formulaire pour le mode multi-couleur
      if (this.form) {
        this.form.addEventListener('submit', (e) => {
          if (this._multiColorMode && this.slotSelections.length > 1) {
            e.preventDefault();
            this._addMultiColorToCart();
          }
        });
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  CHANGEMENT DE VARIANTE
    // ══════════════════════════════════════════════════════════════

    _onVariantChange() {
      const varId = this.varInput?.value;
      if (!varId) return;

      const newPrice = this.variantPrices[varId];
      if (newPrice !== undefined && newPrice !== this.basePrice) {
        this.basePrice = newPrice;
        this._updateAllPrices();
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  SÉLECTION D'UNE CARTE
    // ══════════════════════════════════════════════════════════════

    _setActive(card, updateQty) {
      this.cards.forEach((c) => {
        c.classList.remove('is-active');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('is-active');
      card.setAttribute('aria-pressed', 'true');

      this.currentQty  = parseInt(card.dataset.cqbQty, 10) || 1;
      this.currentDisc = parseFloat(card.dataset.cqbDiscount) || 0;

      if (updateQty && this.qtyInput) {
        this.qtyInput.value = this.currentQty;
        this.qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      this._updateAtcSpan(this.currentQty, this.currentDisc);
      this._renderSlots();
    }

    // ══════════════════════════════════════════════════════════════
    //  SLOTS COULEUR PAR ARTICLE
    // ══════════════════════════════════════════════════════════════

    _renderSlots() {
      if (!this.slotsEl || !this.hasColor || this.colors.length <= 1) {
        this._multiColorMode = false;
        return;
      }

      if (this.currentQty <= 1) {
        this.slotsEl.style.display = 'none';
        this.slotsEl.innerHTML = '';
        this._multiColorMode = false;
        return;
      }

      // Activer le mode multi-couleur
      this._multiColorMode = true;

      // Déterminer la couleur par défaut (celle de la variante sélectionnée)
      const currentVarId = this.varInput ? parseInt(this.varInput.value, 10) : 0;
      const currentVar   = this.allVariants.find((v) => v.id === currentVarId);
      const defaultColor = currentVar ? currentVar.options[this.colorIdx] : this.colors[0].name;

      // Initialiser les sélections
      this.slotSelections = [];
      for (let i = 0; i < this.currentQty; i++) {
        const variant = this._findVariant(defaultColor);
        this.slotSelections.push({
          color:     defaultColor,
          variantId: variant ? variant.id : currentVarId,
          price:     variant ? variant.price : this.basePrice,
          available: variant ? variant.available : true,
        });
      }

      // Construire le HTML
      let html = '<p class="cqb__slots-title">Choisissez une couleur par article :</p>';
      for (let i = 0; i < this.currentQty; i++) {
        const sel = this.slotSelections[i];
        html += `<div class="cqb__slot" data-slot-index="${i}">`;
        html += `<span class="cqb__slot-label">Article ${i + 1} :</span>`;
        html += `<div class="cqb__slot-swatches">`;
        for (const color of this.colors) {
          const isActive = sel.color === color.name;
          html += `<button type="button"
            class="cqb__swatch${isActive ? ' is-active' : ''}"
            data-cqb-slot-swatch data-slot="${i}" data-color="${color.name}"
            title="${color.name}" aria-label="${this.colorName}: ${color.name}"
            style="--swatch-color: ${color.css}">
            <span class="cqb__swatch-inner"></span>
          </button>`;
        }
        html += `</div>`;
        html += `<span class="cqb__slot-color-name">${sel.color}</span>`;
        html += `</div>`;
      }

      this.slotsEl.innerHTML = html;
      this.slotsEl.style.display = '';

      // Bind les clics
      this.slotsEl.querySelectorAll('[data-cqb-slot-swatch]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const slotIdx = parseInt(btn.dataset.slot, 10);
          const color   = btn.dataset.color;
          this._selectSlotColor(slotIdx, color);
        });
      });
    }

    _findVariant(color) {
      // Chercher avec les options actuelles (taille) si possible
      if (this._currentOptions) {
        const match = this.allVariants.find((v) => {
          return v.options[this.colorIdx] === color &&
            v.options.every((opt, i) =>
              i === this.colorIdx || opt === this._currentOptions[i]
            ) && v.available;
        });
        if (match) return match;

        const matchAny = this.allVariants.find((v) => {
          return v.options[this.colorIdx] === color &&
            v.options.every((opt, i) =>
              i === this.colorIdx || opt === this._currentOptions[i]
            );
        });
        if (matchAny) return matchAny;
      }

      return this.allVariants.find((v) =>
        v.options[this.colorIdx] === color && v.available
      ) || this.allVariants.find((v) =>
        v.options[this.colorIdx] === color
      );
    }

    _selectSlotColor(slotIdx, color) {
      const variant = this._findVariant(color);
      if (!variant) return;

      this.slotSelections[slotIdx] = {
        color,
        variantId: variant.id,
        price:     variant.price,
        available: variant.available,
      };

      // Mettre à jour le visuel du slot
      const slotEl = this.slotsEl.querySelector(`[data-slot-index="${slotIdx}"]`);
      if (slotEl) {
        slotEl.querySelectorAll('[data-cqb-slot-swatch]').forEach((s) => {
          s.classList.toggle('is-active', s.dataset.color === color);
        });
        const nameEl = slotEl.querySelector('.cqb__slot-color-name');
        if (nameEl) nameEl.textContent = color;
      }

      this._updateAtcSpanMulti();
    }

    // ══════════════════════════════════════════════════════════════
    //  AJOUT AU PANIER MULTI-COULEUR
    // ══════════════════════════════════════════════════════════════

    async _addMultiColorToCart() {
      // Grouper par variant ID
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

      // Feedback visuel
      if (this.submitBtn) {
        this.submitBtn.disabled = true;
        this.submitBtn.classList.add('loading');
      }

      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ items }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.description || 'Erreur');
        }

        // Ouvrir le cart drawer
        const ccd = window._ccdInstance;
        if (ccd && typeof ccd.fetchAndRender === 'function') {
          await ccd.fetchAndRender();
          ccd.open();
        } else {
          // Fallback Dawn
          const cartNotif = document.querySelector('cart-notification');
          if (cartNotif) {
            const cartRes = await fetch('/cart.js');
            const cart    = await cartRes.json();
            document.dispatchEvent(new CustomEvent('cart:refresh'));
          }
        }

        // Mettre à jour le compteur panier
        const cartData = await fetch('/cart.js').then((r) => r.json());
        document.querySelectorAll('.cart-count-bubble span[aria-hidden="true"]').forEach((el) => {
          el.textContent = cartData.item_count;
        });
        document.querySelectorAll('.cart-count-bubble').forEach((el) => {
          el.style.display = cartData.item_count > 0 ? '' : 'none';
        });

      } catch (err) {
        console.error('CQB multi-color error:', err);
        alert(err.message || 'Erreur lors de l\'ajout au panier.');
      } finally {
        if (this.submitBtn) {
          this.submitBtn.disabled = false;
          this.submitBtn.classList.remove('loading');
        }
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  MISE À JOUR DES PRIX (après changement de variante)
    // ══════════════════════════════════════════════════════════════

    _updateAllPrices() {
      this.cards.forEach((card) => {
        const disc        = parseFloat(card.dataset.cqbDiscount) || 0;
        const qty         = parseInt(card.dataset.cqbQty, 10) || 1;
        const discAmount  = Math.round(this.basePrice * disc / 100);
        const unitPrice   = this.basePrice - discAmount;
        const totalPrice  = unitPrice * qty;

        const priceEl    = card.querySelector('[data-cqb-price]');
        const originalEl = card.querySelector('[data-cqb-original]');
        const totalEl    = card.querySelector('[data-cqb-total]');

        if (priceEl)    priceEl.textContent    = this._money(unitPrice);
        if (originalEl) originalEl.textContent = this._money(this.basePrice);
        if (totalEl)    totalEl.textContent    = '= ' + this._money(totalPrice);
      });

      const active = this.wrap.querySelector('[data-cqb-card].is-active');
      if (active) {
        this._updateAtcSpan(
          parseInt(active.dataset.cqbQty, 10) || 1,
          parseFloat(active.dataset.cqbDiscount) || 0,
        );
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  BOUTON ATC — affiche le total du palier sélectionné
    // ══════════════════════════════════════════════════════════════

    _updateAtcSpan(qty, disc) {
      if (!this.atcSpan) return;

      const discAmount = Math.round(this.basePrice * disc / 100);
      const unitPrice  = this.basePrice - discAmount;
      const total      = unitPrice * qty;

      this.atcSpan.textContent = qty > 1 ? ' — ' + this._money(total) : '';
    }

    _updateAtcSpanMulti() {
      if (!this.atcSpan) return;
      const total = this.slotSelections.reduce((sum, s) => {
        const disc = Math.round(s.price * this.currentDisc / 100);
        return sum + (s.price - disc);
      }, 0);
      this.atcSpan.textContent = ' — ' + this._money(total);
    }

    // ══════════════════════════════════════════════════════════════
    //  FORMATAGE MONÉTAIRE
    // ══════════════════════════════════════════════════════════════

    _money(cents) {
      return new Intl.NumberFormat(this.locale, {
        style:                 'currency',
        currency:              this.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    }
  }

  // ── Init ──────────────────────────────────────────────────────

  function init() {
    document.querySelectorAll('[data-cqb]').forEach((wrap) => {
      if (!wrap._cqbInit) {
        wrap._cqbInit = new QuantityBreaks(wrap);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', init);
})();
