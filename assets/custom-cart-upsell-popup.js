/* =============================================================
   custom-cart-upsell-popup.js
   Popup post-ATC : confirmation + upsell produits
   Dawn 15.x · Vanilla JS · fetch API
   ============================================================= */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────
  const SEL = {
    overlay:        '[data-cup-overlay]',
    modal:          '[data-cup-modal]',
    close:          '[data-cup-close]',
    addedImg:       '[data-cup-added-img]',
    addedName:      '[data-cup-added-name]',
    addedVariant:   '[data-cup-added-variant]',
    addedPrice:     '[data-cup-added-price]',
    shipping:       '[data-cup-shipping]',
    shippingMsg:    '[data-cup-shipping-msg]',
    shippingFill:   '[data-cup-shipping-fill]',
    shippingWrap:   '[data-cup-shipping-bar-wrap]',
    upsell:         '[data-cup-upsell]',
    upsellLabel:    '[data-cup-upsell-label]',
    upsellList:     '[data-cup-upsell-list]',
    cartLink:       '[data-cup-cart-link]',
    cartCount:      '[data-cup-cart-count]',
  };

  // ── Helpers ───────────────────────────────────────────────────
  function money(cents) {
    const amount = (cents / 100).toFixed(2).replace('.', ',');
    return amount + '\u00A0€';
  }

  function trapFocus(modal) {
    const focusable = modal.querySelectorAll(
      'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return () => {};
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    function handler(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }
    modal.addEventListener('keydown', handler);
    return () => modal.removeEventListener('keydown', handler);
  }

  // ── CartUpsellPopup ───────────────────────────────────────────
  class CartUpsellPopup {
    constructor() {
      this.overlay      = document.querySelector(SEL.overlay);
      this.modal        = document.querySelector(SEL.modal);
      if (!this.modal) return;

      this._removeTrap  = null;
      this._prevFocus   = null;

      // Données injectables depuis le thème (optionnel)
      this.threshold    = parseInt(this.modal.dataset.threshold || '0', 10);      // en centimes
      this.freeMsg      = this.modal.dataset.freeMsg || 'Livraison offerte !';
      this.upsellLabel  = this.modal.dataset.upsellLabel || 'Complétez votre routine';
      this.upsellIds    = (this.modal.dataset.upsellIds || '')
        .split(',').map(s => s.trim()).filter(Boolean);

      this._bindClose();
      this._listenATC();
    }

    // ── Ouvrir ────────────────────────────────────────────────
    open(item, cart) {
      this._fillAdded(item);
      this._fillShipping(cart);
      this._fillUpsell(cart);

      const count = cart.item_count || 0;
      const countEl = this.modal.querySelector(SEL.cartCount);
      if (countEl) countEl.textContent = count ? `(${count})` : '';

      this.modal.removeAttribute('hidden');
      this.overlay?.classList.add('is-open');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.modal.classList.add('is-open');
        });
      });

      this._prevFocus = document.activeElement;
      this._removeTrap = trapFocus(this.modal);
      setTimeout(() => {
        const btn = this.modal.querySelector('.cup__close');
        btn?.focus();
      }, 50);

      document.addEventListener('keydown', this._onKeydown);
      document.body.style.overflow = 'hidden';
    }

    // ── Fermer ────────────────────────────────────────────────
    close() {
      this.modal.classList.remove('is-open');
      this.overlay?.classList.remove('is-open');

      const dur = parseFloat(
        getComputedStyle(this.modal).transitionDuration || '0.3'
      ) * 1000;

      setTimeout(() => {
        this.modal.setAttribute('hidden', '');
        document.body.style.overflow = '';
      }, dur);

      this._removeTrap?.();
      this._prevFocus?.focus?.();
      document.removeEventListener('keydown', this._onKeydown);
    }

    // ── Remplir le produit ajouté ─────────────────────────────
    _fillAdded(item) {
      const img     = this.modal.querySelector(SEL.addedImg);
      const name    = this.modal.querySelector(SEL.addedName);
      const variant = this.modal.querySelector(SEL.addedVariant);
      const price   = this.modal.querySelector(SEL.addedPrice);

      if (img) {
        img.alt = item.product_title || '';
        const rawSrc = item.featured_image?.url || item.image || '';
        if (rawSrc) {
          img.src = rawSrc.replace(/(\.\w+)(\?.*)?$/, '_160x160$1$2');
        } else if (item.handle) {
          fetch(`/products/${item.handle}.js`)
            .then(r => r.json())
            .then(p => { if (p.featured_image) img.src = p.featured_image; })
            .catch(() => {});
        }
      }
      if (name)    name.textContent    = item.product_title || '';
      if (variant) variant.textContent = item.variant_title && item.variant_title !== 'Default Title'
        ? item.variant_title : '';

      if (price) {
        if (item.compare_at_price > item.price) {
          price.innerHTML =
            `<span class="price--sale">${money(item.price)}</span>` +
            `<s class="price--compare">${money(item.compare_at_price)}</s>`;
        } else {
          price.textContent = money(item.price);
        }
      }
    }

    // ── Barre livraison gratuite ──────────────────────────────
    _fillShipping(cart) {
      const wrap  = this.modal.querySelector(SEL.shipping);
      if (!wrap || !this.threshold) return;

      const msg   = wrap.querySelector(SEL.shippingMsg);
      const fill  = wrap.querySelector(SEL.shippingFill);
      const bar   = wrap.querySelector(SEL.shippingWrap);
      const total = cart.total_price || 0;
      const pct   = Math.min(100, Math.round((total / this.threshold) * 100));
      const free  = total >= this.threshold;

      wrap.removeAttribute('hidden');

      if (msg) {
        if (free) {
          msg.innerHTML = `<strong>${this.freeMsg}</strong>`;
          msg.classList.add('is-free');
        } else {
          const remaining = this.threshold - total;
          msg.innerHTML = `Plus que <strong>${money(remaining)}</strong> pour la livraison gratuite !`;
          msg.classList.remove('is-free');
        }
      }
      if (fill) {
        fill.style.width = pct + '%';
        fill.toggleAttribute('data-free', free);
      }
      if (bar) {
        bar.setAttribute('aria-valuenow', pct);
      }
    }

    // ── Upsell ────────────────────────────────────────────────
    async _fillUpsell(cart) {
      const wrap  = this.modal.querySelector(SEL.upsell);
      const list  = this.modal.querySelector(SEL.upsellList);
      const label = this.modal.querySelector(SEL.upsellLabel);
      if (!wrap || !list) return;

      // IDs déjà dans le panier
      const inCart = new Set((cart.items || []).map(i => i.product_id));

      // Sources d'upsell : IDs configurés OU recommandations Shopify
      let candidates = [...this.upsellIds];
      if (!candidates.length) {
        // Utilise le premier produit du panier pour les recs
        const firstId = cart.items?.[0]?.product_id;
        if (firstId) {
          try {
            const res  = await fetch(`/recommendations/products.json?product_id=${firstId}&limit=4&intent=related`);
            const data = await res.json();
            candidates = (data.products || [])
              .filter(p => !inCart.has(p.id) && p.available)
              .slice(0, 2)
              .map(p => p.id);
            this._renderUpsellFromRecs(data.products, inCart, wrap, list, label);
            return;
          } catch (e) {
            // Silencieux
          }
        }
      }

      // IDs configurés manuellement
      const toShow = candidates.filter(id => !inCart.has(Number(id)));
      if (!toShow.length) { wrap.setAttribute('hidden', ''); return; }

      list.innerHTML = '';
      let rendered = 0;

      await Promise.all(toShow.slice(0, 2).map(async (id) => {
        try {
          const res  = await fetch(`/products.json?ids=${id}&fields=id,title,variants,images`);
          const data = await res.json();
          const p    = data.products?.[0];
          if (!p || !p.variants[0]?.available) return;
          list.appendChild(this._buildUpsellItem(p));
          rendered++;
        } catch (e) {}
      }));

      if (rendered) {
        if (label) label.textContent = this.upsellLabel;
        wrap.removeAttribute('hidden');
      } else {
        wrap.setAttribute('hidden', '');
      }
    }

    _renderUpsellFromRecs(products, inCart, wrap, list, label) {
      const eligible = products.filter(p => !inCart.has(p.id) && p.available).slice(0, 2);
      if (!eligible.length) { wrap.setAttribute('hidden', ''); return; }
      list.innerHTML = '';
      eligible.forEach(p => list.appendChild(this._buildUpsellItemFromRec(p)));
      if (label) label.textContent = this.upsellLabel;
      wrap.removeAttribute('hidden');
    }

    _buildUpsellItem(product) {
      const v     = product.variants[0];
      const img   = product.images?.[0]?.src?.replace(/(\.\w+)(\?.*)?$/, '_120x120$1') || '';
      return this._makeItemEl(product.id, v.id, img, product.title, v.price, v.compare_at_price);
    }

    _buildUpsellItemFromRec(product) {
      const v     = product.variants[0];
      const img   = product.featured_image?.replace(/(\.\w+)(\?.*)?$/, '_120x120$1') || '';
      return this._makeItemEl(product.id, v.id, img, product.title, v.price, v.compare_at_price);
    }

    _makeItemEl(productId, variantId, imgSrc, title, price, compareAtPrice) {
      const el = document.createElement('div');
      el.className = 'cup__upsell-item';
      el.dataset.cupUpsellProduct = productId;

      const priceHtml = (compareAtPrice && compareAtPrice > price)
        ? `<span class="price--sale">${money(price)}</span> <s class="price--compare">${money(compareAtPrice)}</s>`
        : money(price);

      el.innerHTML = `
        <div class="cup__upsell-item-img">
          ${imgSrc ? `<img src="${imgSrc}" alt="${title}" width="56" height="56" loading="lazy">` : ''}
        </div>
        <div class="cup__upsell-item-info">
          <p class="cup__upsell-item-name">${title}</p>
          <p class="cup__upsell-item-price">${priceHtml}</p>
        </div>
        <button
          class="cup__upsell-add"
          type="button"
          data-cup-upsell-add="${variantId}"
          aria-label="Ajouter ${title}"
        >
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      `;

      el.querySelector('[data-cup-upsell-add]')
        ?.addEventListener('click', (e) => this._addUpsell(e.currentTarget));

      return el;
    }

    // ── Ajouter un upsell au panier ───────────────────────────
    async _addUpsell(btn) {
      const variantId = btn.dataset.cupUpsellAdd;
      if (!variantId) return;

      btn.disabled = true;

      try {
        const res = await fetch('/cart/add.json', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body:    JSON.stringify({ id: variantId, quantity: 1 }),
        });
        if (!res.ok) throw new Error('add failed');

        // Feedback visuel
        btn.innerHTML = `
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M4 10L8.5 14.5L16 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        btn.style.background = '#22c55e';

        // Mettre à jour le compteur + la barre livraison
        const cartRes  = await fetch('/cart.json');
        const cartData = await cartRes.json();
        this._fillShipping(cartData);
        const countEl = this.modal.querySelector(SEL.cartCount);
        if (countEl) countEl.textContent = `(${cartData.item_count})`;

        // Dispatch pour le drawer / header
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cartData }));

      } catch (e) {
        btn.disabled = false;
      }
    }

    // ── Event listeners ───────────────────────────────────────
    _bindClose() {
      this._onKeydown = (e) => { if (e.key === 'Escape') this.close(); };

      this.modal?.querySelectorAll(SEL.close).forEach(btn =>
        btn.addEventListener('click', () => this.close())
      );
      this.overlay?.addEventListener('click', () => this.close());
    }

    // ── Écoute les soumissions de formulaires ATC ─────────────
    _listenATC() {
      document.addEventListener('submit', async (e) => {
        const form = e.target;
        if (form.dataset.type !== 'add-to-cart-form') return;

        e.preventDefault();

        const formData = new FormData(form);
        const submitBtn = form.querySelector('[name="add"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
          const res = await fetch('/cart/add.json', {
            method:  'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body:    formData,
          });
          if (!res.ok) throw new Error('ATC failed');

          const item     = await res.json();
          const cartRes  = await fetch('/cart.json');
          const cartData = await cartRes.json();

          // Dispatch pour mettre à jour drawer / header count
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: cartData }));

          this.open(item, cartData);

        } catch (err) {
          console.warn('[CartUpsellPopup] ATC error:', err);
          // Fallback : soumission native
          form.submit();
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    if (!document.querySelector('[data-cup-modal]')) return;
    window._cupInstance = new CartUpsellPopup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
