/**
 * custom-featured-product.js
 * Produit vedette — galerie + zoom + variantes + ATC
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════

  function money(cents) {
    return new Intl.NumberFormat(document.documentElement.lang || 'fr-FR', {
      style: 'currency',
      currency: window.Shopify?.currency?.active || 'EUR',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  }

  // ══════════════════════════════════════════════════════════════
  //  CLASSE PRINCIPALE
  // ══════════════════════════════════════════════════════════════

  class FeaturedProduct {
    constructor(el) {
      this.el = el;

      // Données JSON
      const variantsScript = el.querySelector('[data-cfp-variants-json]');
      const imagesScript   = el.querySelector('[data-cfp-images-json]');
      if (!variantsScript) return;

      this.variants = JSON.parse(variantsScript.textContent);
      this.images   = imagesScript ? JSON.parse(imagesScript.textContent) : [];

      // Références DOM
      this.mainImg      = el.querySelector('[data-cfp-main-img]');
      this.mainWrap     = el.querySelector('[data-cfp-main-wrap]');
      this.thumbs       = Array.from(el.querySelectorAll('[data-cfp-thumb]'));
      this.variantInput = el.querySelector('[data-cfp-variant-id]');
      this.priceEl      = el.querySelector('[data-cfp-price]');
      this.compareEl    = el.querySelector('[data-cfp-compare]');
      this.savingsEl    = el.querySelector('[data-cfp-savings]');
      this.addBtn       = el.querySelector('[data-cfp-add]');
      this.addLabel     = this.addBtn?.querySelector('.cfp__add-label');
      this.addPriceEl   = el.querySelector('[data-cfp-add-price]');
      this.addSep       = this.addBtn?.querySelector('.cfp__add-sep');
      this.buyBtn       = el.querySelector('[data-cfp-buy-now]');
      this.qtyInput     = el.querySelector('[data-cfp-qty]');
      this.qtyDec       = el.querySelector('[data-cfp-qty-dec]');
      this.qtyInc       = el.querySelector('[data-cfp-qty-inc]');
      this.optionBtns   = Array.from(el.querySelectorAll('[data-cfp-option]'));
      this.selectedVals = {};

      // État courant
      this._zoomActive  = false;
      this._currentVariant = this._findCurrentVariant();

      this._initSelectedVals();
      this._bindGallery();
      this._bindZoom();
      this._bindVariants();
      this._bindQty();
      this._bindAtc();
      this._bindBuyNow();
    }

    // ──────────────────────────────────────────────────────────
    //  INIT DES VALEURS SÉLECTIONNÉES (depuis l'état DOM)
    // ──────────────────────────────────────────────────────────

    _initSelectedVals() {
      const groups = this.el.querySelectorAll('[data-option-group]');
      groups.forEach((group) => {
        const pos    = group.getAttribute('data-option-group');
        const active = group.querySelector('[data-cfp-option][aria-pressed="true"]');
        if (active) {
          this.selectedVals[pos] = active.getAttribute('data-cfp-option');
        }
      });
    }

    _findCurrentVariant() {
      if (!this.variantInput) return this.variants[0] || null;
      const id = parseInt(this.variantInput.value, 10);
      return this.variants.find((v) => v.id === id) || this.variants[0] || null;
    }

    // ──────────────────────────────────────────────────────────
    //  GALERIE — MINIATURES
    // ──────────────────────────────────────────────────────────

    _bindGallery() {
      this.thumbs.forEach((thumb) => {
        thumb.addEventListener('click', () => this._selectThumb(thumb));
        thumb.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._selectThumb(thumb);
          }
        });
      });
    }

    _selectThumb(thumb) {
      const imageId = parseInt(thumb.getAttribute('data-image-id'), 10);
      const image   = this.images.find((img) => img.id === imageId);
      if (!image || !this.mainImg) return;

      // Mettre à jour l'image principale
      this._resetZoom();
      this.mainImg.src    = image.src;
      this.mainImg.srcset = '';
      this.mainImg.alt    = image.alt;
      this.mainImg.setAttribute('data-image-id', imageId);

      // Mettre à jour les états des miniatures
      this.thumbs.forEach((t) => {
        const active = t === thumb;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-pressed', String(active));
      });
    }

    _selectThumbByImageId(imageId) {
      const thumb = this.thumbs.find(
        (t) => parseInt(t.getAttribute('data-image-id'), 10) === imageId
      );
      if (thumb) this._selectThumb(thumb);
    }

    // ──────────────────────────────────────────────────────────
    //  ZOOM AU SURVOL (desktop uniquement)
    // ──────────────────────────────────────────────────────────

    _bindZoom() {
      if (!this.mainWrap || !this.mainImg) return;

      // Pas de zoom sur mobile/touch
      if ('ontouchstart' in window) return;

      this.mainWrap.addEventListener('mouseenter', () => this._startZoom());
      this.mainWrap.addEventListener('mouseleave', () => this._resetZoom());
      this.mainWrap.addEventListener('mousemove',  (e) => this._trackZoom(e));
    }

    _startZoom() {
      this._zoomActive = true;
      this.mainWrap.classList.add('is-zoomed');
    }

    _resetZoom() {
      this._zoomActive = false;
      this.mainWrap.classList.remove('is-zoomed');
      if (this.mainImg) {
        this.mainImg.style.transformOrigin = '50% 50%';
      }
    }

    _trackZoom(e) {
      if (!this._zoomActive || !this.mainImg) return;
      const rect = this.mainWrap.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width)  * 100;
      const yPct = ((e.clientY - rect.top)  / rect.height) * 100;
      this.mainImg.style.transformOrigin = `${xPct}% ${yPct}%`;
    }

    // ──────────────────────────────────────────────────────────
    //  SÉLECTEURS DE VARIANTES
    // ──────────────────────────────────────────────────────────

    _bindVariants() {
      this.optionBtns.forEach((btn) => {
        btn.addEventListener('click', () => this._selectOption(btn));
      });

      // Observer les changements externes (ex: autre widget sur la page)
      if (this.variantInput) {
        const observer = new MutationObserver(() => {
          const id      = parseInt(this.variantInput.value, 10);
          const variant = this.variants.find((v) => v.id === id);
          if (variant && variant !== this._currentVariant) {
            this._currentVariant = variant;
            this._updatePrice(variant);
            this._updateAtcState(variant);
          }
        });
        observer.observe(this.variantInput, { attributes: true, attributeFilter: ['value'] });
      }
    }

    _selectOption(btn) {
      const value = btn.getAttribute('data-cfp-option');
      const pos   = btn.getAttribute('data-option-pos');

      // Mettre à jour la sélection
      this.selectedVals[pos] = value;

      // Mettre à jour l'état visuel de tous les boutons du groupe
      const group = this.el.querySelector(`[data-option-group="${pos}"]`);
      if (group) {
        group.querySelectorAll('[data-cfp-option]').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', String(active));
        });

        // Mettre à jour l'affichage de la valeur sélectionnée
        const selectedValEl = group.querySelector('[data-cfp-selected-val]');
        if (selectedValEl) selectedValEl.textContent = value;
      }

      // Trouver la variante correspondante
      const matched = this._findMatchingVariant();
      if (matched) {
        this._currentVariant = matched;
        this._updatePrice(matched);
        this._updateAtcState(matched);
        this._updateVariantInput(matched.id);
        this._updateUnavailableOptions(matched);

        // Changer l'image si la variante a une image spécifique
        if (matched.featured_image_id) {
          this._selectThumbByImageId(matched.featured_image_id);
        }

        // Émettre un événement pour les autres composants (quantity-breaks, etc.)
        this.el.dispatchEvent(
          new CustomEvent('variant:change', {
            bubbles: true,
            detail: { variant: matched },
          })
        );
      }
    }

    _findMatchingVariant() {
      return this.variants.find((variant) => {
        if (variant.option1 !== null && this.selectedVals['1'] !== undefined) {
          if (variant.option1 !== this.selectedVals['1']) return false;
        }
        if (variant.option2 !== null && this.selectedVals['2'] !== undefined) {
          if (variant.option2 !== this.selectedVals['2']) return false;
        }
        if (variant.option3 !== null && this.selectedVals['3'] !== undefined) {
          if (variant.option3 !== this.selectedVals['3']) return false;
        }
        return true;
      });
    }

    _updateVariantInput(variantId) {
      if (!this.variantInput) return;
      this.variantInput.value = variantId;
    }

    _updateUnavailableOptions(selectedVariant) {
      // Marquer les options indisponibles pour chaque position
      const positions = ['1', '2', '3'];
      positions.forEach((pos) => {
        const group = this.el.querySelector(`[data-option-group="${pos}"]`);
        if (!group) return;

        group.querySelectorAll('[data-cfp-option]').forEach((btn) => {
          const value = btn.getAttribute('data-cfp-option');
          // Vérifier si au moins une variante avec cette valeur est disponible
          const isAvailable = this.variants.some((v) => {
            const optionKey = `option${pos}`;
            if (v[optionKey] !== value) return false;
            // Les autres positions doivent correspondre aux sélections courantes
            for (const p of positions) {
              if (p === pos) continue;
              if (this.selectedVals[p] === undefined) continue;
              if (v[`option${p}`] !== this.selectedVals[p]) return false;
            }
            return v.available;
          });
          btn.classList.toggle('is-unavailable', !isAvailable && !btn.classList.contains('is-active'));
        });
      });
    }

    // ──────────────────────────────────────────────────────────
    //  MISE À JOUR PRIX
    // ──────────────────────────────────────────────────────────

    _updatePrice(variant) {
      if (!this.priceEl) return;

      const hasSale = variant.compare_at_price > variant.price;

      this.priceEl.textContent = money(variant.price);
      this.priceEl.classList.toggle('cfp__price--sale', hasSale);

      if (this.compareEl) {
        if (hasSale) {
          this.compareEl.textContent = money(variant.compare_at_price);
          this.compareEl.removeAttribute('hidden');
        } else {
          this.compareEl.hidden = true;
        }
      }

      if (this.savingsEl) {
        if (hasSale) {
          const saved = variant.compare_at_price - variant.price;
          this.savingsEl.textContent = `Économisez ${money(saved)}`;
          this.savingsEl.removeAttribute('hidden');
        } else {
          this.savingsEl.hidden = true;
        }
      }

      // Mise à jour du prix dans le bouton ATC
      if (this.addPriceEl) {
        this.addPriceEl.textContent = money(variant.price);
      }
    }

    // ──────────────────────────────────────────────────────────
    //  ÉTAT DU BOUTON ATC (dispo / épuisé)
    // ──────────────────────────────────────────────────────────

    _updateAtcState(variant) {
      if (!this.addBtn) return;

      const available = variant.available;
      this.addBtn.disabled = !available;
      this.addBtn.setAttribute('aria-disabled', String(!available));

      if (this.addLabel) {
        this.addLabel.textContent = available ? 'Ajouter au panier' : 'Épuisé';
      }

      if (this.addSep)    this.addSep.hidden    = !available;
      if (this.addPriceEl) this.addPriceEl.hidden = !available;

      if (this.buyBtn) {
        this.buyBtn.disabled = !available;
        this.buyBtn.setAttribute('aria-disabled', String(!available));
      }
    }

    // ──────────────────────────────────────────────────────────
    //  QUANTITÉ
    // ──────────────────────────────────────────────────────────

    _bindQty() {
      if (!this.qtyInput) return;

      if (this.qtyDec) {
        this.qtyDec.addEventListener('click', () => {
          const val = parseInt(this.qtyInput.value, 10) || 1;
          if (val > 1) this.qtyInput.value = val - 1;
        });
      }

      if (this.qtyInc) {
        this.qtyInc.addEventListener('click', () => {
          const val = parseInt(this.qtyInput.value, 10) || 1;
          this.qtyInput.value = val + 1;
        });
      }

      this.qtyInput.addEventListener('change', () => {
        const val = parseInt(this.qtyInput.value, 10);
        if (isNaN(val) || val < 1) this.qtyInput.value = 1;
      });
    }

    // ──────────────────────────────────────────────────────────
    //  AJOUTER AU PANIER
    // ──────────────────────────────────────────────────────────

    _bindAtc() {
      if (!this.addBtn) return;
      this.addBtn.addEventListener('click', () => this._addToCart(false));
    }

    async _addToCart(buyNow = false) {
      if (!this._currentVariant?.available) return;

      const variantId = this._currentVariant.id;
      const qty       = parseInt(this.qtyInput?.value, 10) || 1;

      // État chargement
      this._setAtcLoading(true);

      try {
        const response = await fetch('/cart/add.js', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ id: variantId, quantity: qty }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await response.json();

        if (buyNow) {
          window.location.href = '/checkout';
          return;
        }

        // Succès — état visuel
        this._setAtcSuccess();

        // Notifier le mini-cart Shopify/Dawn
        document.dispatchEvent(new CustomEvent('cart:refresh'));
        document.dispatchEvent(new CustomEvent('cart:update'));

      } catch (err) {
        console.error('[CFP] Erreur ajout panier :', err);
        this._setAtcLoading(false);
      }
    }

    _setAtcLoading(state) {
      if (!this.addBtn) return;
      this.addBtn.classList.toggle('is-loading', state);
      this.addBtn.disabled = state;
    }

    _setAtcSuccess() {
      if (!this.addBtn) return;
      this.addBtn.classList.remove('is-loading');
      this.addBtn.classList.add('is-success');
      if (this.addLabel) this.addLabel.textContent = 'Ajouté ✓';

      setTimeout(() => {
        this.addBtn.classList.remove('is-success');
        this.addBtn.disabled = false;
        if (this.addLabel) this.addLabel.textContent = 'Ajouter au panier';
      }, 2000);
    }

    // ──────────────────────────────────────────────────────────
    //  ACHETER MAINTENANT
    // ──────────────────────────────────────────────────────────

    _bindBuyNow() {
      if (!this.buyBtn) return;
      this.buyBtn.addEventListener('click', () => this._addToCart(true));
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════

  function init() {
    document.querySelectorAll('.section-custom-featured-product').forEach((el) => {
      if (!el._cfpInit) {
        el._cfpInit = new FeaturedProduct(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Rechargement dans l'éditeur de thème
  document.addEventListener('shopify:section:load', (e) => {
    const section = e.target;
    if (section.classList.contains('section-custom-featured-product')) {
      section._cfpInit = new FeaturedProduct(section);
    }
  });
})();
