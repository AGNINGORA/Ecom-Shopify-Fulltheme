/**
 * custom-cross-sell.js
 * Carrousel de produits recommandés
 * Vanilla JS · CSS scroll-snap · fetch API · Dawn 15.x
 */

(function () {
  'use strict';

  // ── SVG étoile ──────────────────────────────────────────────
  const STAR_FILLED = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/>
  </svg>`;

  const STAR_EMPTY = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.51.91-5.32L2.27 6.62l5.34-.78z"/>
  </svg>`;

  class CrossSell {
    constructor(root) {
      this.root       = root;
      this.productId  = root.dataset.productId;
      this.limit      = parseInt(root.dataset.limit, 10) || 6;
      this.recoUrl    = root.dataset.recommendationsUrl;

      this.track      = root.querySelector('[data-ccs-track]');
      this.loadingEl  = root.querySelector('[data-ccs-loading]');
      this.fallbackEl = root.querySelector('[data-ccs-fallback]');
      this.resultsEl  = root.querySelector('[data-ccs-results]');
      this.prevBtn    = root.querySelector('[data-ccs-prev]');
      this.nextBtn    = root.querySelector('[data-ccs-next]');
      this.tpl        = root.parentElement?.querySelector(`#ccs-card-tpl-${root.dataset.sectionId}`)
                        || document.querySelector(`#ccs-card-tpl-${root.dataset.sectionId}`);

      this._loadRecommendations();
      this._bindArrows();
      this._bindSwipeTracking();
    }

    // ── Chargement des recommandations ──────────────────────────
    async _loadRecommendations() {
      if (!this.recoUrl || !this.productId) {
        this._showFallback();
        return;
      }

      const url = `${this.recoUrl}?section_id=custom-cross-sell&product_id=${this.productId}&limit=${this.limit}`;

      try {
        const res  = await fetch(url);
        if (!res.ok) throw new Error('API unavailable');
        const html = await res.text();

        // L'API retourne du HTML — on parse et extrait les produits JSON
        const parser = new DOMParser();
        const doc    = parser.parseFromString(html, 'text/html');

        // Dawn's recommendations API renvoie les données produit en JSON
        // dans un script[type="application/json"] ou directement dans le HTML.
        // On tente de parser les données produit depuis la réponse.
        const productsScript = doc.querySelector('script[data-products]');
        let products = [];

        if (productsScript) {
          products = JSON.parse(productsScript.textContent);
        } else {
          // Fallback : récupérer via l'API JSON Shopify directement
          products = await this._fetchProductsJson();
        }

        if (products.length === 0) {
          this._showFallback();
          return;
        }

        this._renderCards(products);

      } catch {
        this._showFallback();
      }
    }

    // ── Requête JSON Shopify recommendations ──────────────────────
    async _fetchProductsJson() {
      try {
        const url = `${this.recoUrl}.json?product_id=${this.productId}&limit=${this.limit}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) return [];
        const data = await res.json();
        return data.products || [];
      } catch {
        return [];
      }
    }

    // ── Afficher le fallback Liquid ──────────────────────────────
    _showFallback() {
      if (this.loadingEl) this.loadingEl.hidden = true;
      if (this.fallbackEl) {
        this.fallbackEl.hidden = false;
        this._revealArrows();
      }
    }

    // ── Render des cartes depuis JSON ────────────────────────────
    _renderCards(products) {
      if (!this.tpl || !this.resultsEl) {
        this._showFallback();
        return;
      }

      this.resultsEl.innerHTML = '';

      products.forEach((product) => {
        const variant    = product.variants?.[0];
        if (!variant) return;

        const card = this.tpl.content.cloneNode(true);
        const root = card.querySelector('[data-ccs-card]');

        // Images
        const imgWrap     = root.querySelector('.ccs__img-wrap');
        const imgPrimary  = root.querySelector('[data-ccs-img-primary]');
        const imgSecondary= root.querySelector('[data-ccs-img-secondary]');
        const img1 = product.images?.[0];
        const img2 = product.images?.[1];

        if (img1) {
          imgPrimary.src = this._imgUrl(img1.src, 400);
          imgPrimary.alt = img1.alt || product.title;
          imgPrimary.srcset = [160, 240, 400]
            .map((w) => `${this._imgUrl(img1.src, w)} ${w}w`)
            .join(', ');
          imgPrimary.sizes = '(min-width: 750px) 220px, 50vw';
        } else {
          imgPrimary.remove();
        }

        if (img2) {
          imgSecondary.src = this._imgUrl(img2.src, 400);
          imgSecondary.alt = img2.alt || product.title;
          imgWrap.dataset.hasSecondary = '1';
        } else {
          imgSecondary.remove();
        }

        // Liens
        const productUrl = `/products/${product.handle}`;
        root.querySelectorAll('[data-ccs-link]').forEach((a) => { a.href = productUrl; });

        // Nom
        const nameEl = root.querySelector('[data-ccs-name]');
        if (nameEl) {
          nameEl.textContent = product.title;
          nameEl.href        = productUrl;
        }

        // Prix
        const priceEl   = root.querySelector('[data-ccs-price]');
        const compareEl = root.querySelector('[data-ccs-compare]');
        const price     = variant.price;
        const compareAt = variant.compare_at_price;

        if (priceEl) {
          priceEl.textContent = this._formatMoney(price);
          if (compareAt && compareAt > price) {
            priceEl.classList.add('ccs__price--sale');
          }
        }

        if (compareEl && compareAt && compareAt > price) {
          compareEl.textContent = this._formatMoney(compareAt);
          compareEl.hidden      = false;
        }

        // Étoiles (metafield reviews.rating si disponible)
        const rating    = product.metafields?.reviews?.rating?.value;
        const starsEl   = root.querySelector('[data-ccs-stars]');
        if (starsEl && rating) {
          const ratingVal = parseFloat(rating.rating);
          const count     = parseInt(rating.count, 10) || 0;
          starsEl.innerHTML   = this._buildStars(ratingVal, count);
          starsEl.hidden      = false;
          starsEl.setAttribute('aria-label', `Note : ${ratingVal.toFixed(1)} sur 5`);
        }

        // Bouton ATC
        const atcBtn = root.querySelector('[data-ccs-atc]');
        if (atcBtn) {
          if (!variant.available) {
            atcBtn.disabled = true;
            atcBtn.querySelector('.ccs__atc-label').textContent = 'Épuisé';
          } else {
            atcBtn.dataset.variantId = variant.id;
            atcBtn.addEventListener('click', () => this._addToCart(atcBtn, variant.id));
          }
        }

        this.resultsEl.appendChild(card);
      });

      if (this.loadingEl) this.loadingEl.hidden = true;
      this.resultsEl.hidden = false;
      this._revealArrows();
    }

    // ── Construction des étoiles ─────────────────────────────────
    _buildStars(rating, count) {
      let html = '';
      for (let i = 1; i <= 5; i++) {
        const filled = i <= Math.round(rating);
        html += `<span class="ccs__star${filled ? '' : ' ccs__star--empty'}">${filled ? STAR_FILLED : STAR_EMPTY}</span>`;
      }
      if (count > 0) {
        html += `<span class="ccs__rating-count">(${count})</span>`;
      }
      return html;
    }

    // ── URL d'image Shopify CDN ──────────────────────────────────
    _imgUrl(src, width) {
      if (!src) return '';
      return src.replace(/(\.[^.]+)$/, `_${width}x$1`);
    }

    // ── Ajout rapide au panier ───────────────────────────────────
    async _addToCart(btn, variantId) {
      if (!variantId) return;

      btn.classList.add('is-loading');
      btn.disabled = true;

      try {
        const res = await fetch('/cart/add.js', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body:    JSON.stringify({ id: parseInt(variantId, 10), quantity: 1 }),
        });

        if (!res.ok) throw new Error();

        // Feedback visuel temporaire
        const label = btn.querySelector('.ccs__atc-label');
        if (label) label.textContent = '✓ Ajouté';
        setTimeout(() => {
          if (label) label.textContent = 'Ajouter';
          btn.disabled = false;
        }, 2000);

        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
        this._refreshCartCount();

      } catch {
        btn.disabled = false;
      } finally {
        btn.classList.remove('is-loading');
      }
    }

    // ── Rafraîchir le compteur panier ────────────────────────────
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

    // ── Flèches de navigation ────────────────────────────────────
    _revealArrows() {
      if (!this.track || !this.prevBtn || !this.nextBtn) return;

      const update = () => {
        const { scrollLeft, scrollWidth, clientWidth } = this.track;
        this.prevBtn.hidden = scrollLeft <= 4;
        this.nextBtn.hidden = scrollLeft + clientWidth >= scrollWidth - 4;
      };

      this.track.addEventListener('scroll', update, { passive: true });
      // Observe resize pour recalculer
      new ResizeObserver(update).observe(this.track);
      update();
    }

    _bindArrows() {
      const scrollBy = () => {
        const card = this.track?.querySelector('.ccs__card');
        return card
          ? card.offsetWidth + parseInt(getComputedStyle(this.track).gap || 0, 10)
          : 280;
      };

      this.prevBtn?.addEventListener('click', () => {
        this.track.scrollBy({ left: -scrollBy(), behavior: 'smooth' });
      });

      this.nextBtn?.addEventListener('click', () => {
        this.track.scrollBy({ left:  scrollBy(), behavior: 'smooth' });
      });
    }

    // ── Suivi du swipe (flèches masquées/affichées) ──────────────
    _bindSwipeTracking() {
      // Géré par l'event scroll dans _revealArrows
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
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.custom-cross-sell[data-section-id]').forEach((el) => {
      if (!el._csInit) el._csInit = new CrossSell(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('.custom-cross-sell');
    if (el) el._csInit = new CrossSell(el);
  });
})();
