/* =============================================================
   custom-recently-viewed.js
   Carrousel produits récemment consultés
   Dawn 15.x · Vanilla JS · localStorage + fetch /products.json
   ============================================================= */

(function () {
  'use strict';

  const STORAGE_KEY = 'crv_products';

  function money(amount) {
    const currency = window.Shopify?.currency?.active || 'EUR';
    const locale   = document.documentElement.lang || 'fr-FR';
    // L'API /products.json retourne les prix en chaîne (ex: "18.00")
    // On convertit en nombre flottant
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency,
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(num);
    } catch (_) {
      return num.toFixed(2) + '\u00A0' + currency;
    }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Rendu d'une card produit ─────────────────────────────────
  function buildCard(product) {
    const v          = product.variants?.[0];
    const price      = v?.price || 0;
    const compare    = v?.compare_at_price || 0;
    const available  = product.available !== false;
    const imgSrc     = (product.featured_image || (product.images && product.images.length > 0 && product.images[0].src) || '')
      ? (typeof product.featured_image === 'string' ? product.featured_image : (product.images?.[0]?.src || ''))
      : '';

    const priceHtml = (compare && compare > price)
      ? `<span class="crv__card-price-sale">${money(price)}</span>
         <s class="crv__card-price-compare">${money(compare)}</s>`
      : `<span class="crv__card-price-regular">${money(price)}</span>`;

    const badgeHtml = !available
      ? `<span class="crv__card-badge">Épuisé</span>`
      : '';

    const atcLabel   = available ? 'Ajouter au panier' : 'Épuisé';
    const atcVariant = v?.id || '';

    return `
      <div class="crv__card">
        <a class="crv__card-link" href="/products/${esc(product.handle)}" aria-label="${esc(product.title)}">
          <div class="crv__card-img-wrap">
            ${imgSrc
              ? `<img class="crv__card-img" src="${esc(imgSrc)}" alt="${esc(product.title)}" loading="lazy" width="400" height="400" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';">
                 <div class="crv__card-placeholder" style="display:none;width:100%;aspect-ratio:1;background:#f5f5f5;align-items:center;justify-content:center;border-radius:8px;"><svg width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='#ccc' stroke-width='1.5'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg></div>`
              : `<div class="crv__card-placeholder" style="display:flex;width:100%;aspect-ratio:1;background:#f5f5f5;align-items:center;justify-content:center;border-radius:8px;"><svg width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='#ccc' stroke-width='1.5'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg></div>`
            }
            ${badgeHtml}
          </div>
          <div class="crv__card-info">
            ${product.vendor ? `<p class="crv__card-vendor">${esc(product.vendor)}</p>` : ''}
            <h3 class="crv__card-title">${esc(product.title)}</h3>
            <div class="crv__card-price">${priceHtml}</div>
          </div>
        </a>
        ${atcVariant
          ? `<button
               class="crv__card-atc"
               data-crv-atc="${atcVariant}"
               type="button"
               ${!available ? 'disabled' : ''}
               aria-label="${esc(atcLabel)} — ${esc(product.title)}"
             >${esc(atcLabel)}</button>`
          : ''
        }
      </div>`;
  }

  // ── Skeletons pendant le chargement ─────────────────────────
  function buildSkeleton(count) {
    return Array.from({ length: count }, () => `
      <div class="crv__skeleton" aria-hidden="true">
        <div class="crv__skeleton-img"></div>
        <div class="crv__skeleton-line"></div>
        <div class="crv__skeleton-line crv__skeleton-line--short"></div>
      </div>`
    ).join('');
  }

  // ── Ajout au panier (compatible custom-cart-drawer + cart-notification Dawn) ──
  async function addToCart(btn, variantId) {
    if (btn._loading) return;
    btn._loading  = true;
    const orig    = btn.textContent;
    btn.textContent = '…';
    btn.disabled  = true;

    try {
      // 1. Ajouter au panier via l'API Shopify
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
      });

      const data = await res.json();

      if (data.status) {
        // Erreur (rupture de stock, etc.)
        btn.textContent = data.description || 'Erreur';
        btn.style.background = '#e53935';
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.background = '';
          btn.disabled = false;
          btn._loading = false;
        }, 2500);
        return;
      }

      // 2. Ouvrir le custom cart drawer s'il existe
      const ccd = window._ccdInstance;
      if (ccd && typeof ccd.fetchAndRender === 'function') {
        await ccd.fetchAndRender();
        ccd.open();
      } else {
        // Fallback : cart-notification Dawn
        const cartNotif = document.querySelector('cart-notification');
        if (cartNotif && typeof cartNotif.renderContents === 'function') {
          // Re-fetch avec les sections pour la notification
          const sectionsRes = await fetch(
            `/cart/add.js`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
              body: JSON.stringify({
                id: Number(variantId),
                quantity: 0,
                sections: cartNotif.getSectionsToRender().map(s => s.id).join(','),
                sections_url: window.location.pathname,
              }),
            }
          );
          // Just open with the original data - update bubble manually
          const cartData = await fetch('/cart.js').then(r => r.json());
          const bubble = document.getElementById('cart-icon-bubble');
          if (bubble) {
            const countEl = bubble.querySelector('[aria-hidden="true"]');
            if (countEl) countEl.textContent = cartData.item_count;
          }
        }
      }

      // 3. Mettre à jour le compteur Dawn
      const cartData = await fetch('/cart.js').then(r => r.json());
      document.querySelectorAll('.cart-count-bubble span[aria-hidden="true"]').forEach(el => {
        el.textContent = cartData.item_count;
      });
      document.querySelectorAll('.cart-count-bubble').forEach(el => {
        el.style.display = cartData.item_count > 0 ? '' : 'none';
      });

      // 4. Feedback visuel sur le bouton
      btn.textContent = '✓ Ajouté';
      btn.style.background = '#22c55e';

      setTimeout(() => {
        btn.textContent = orig;
        btn.style.background = '';
        btn.disabled = false;
        btn._loading = false;
      }, 2000);

    } catch (err) {
      console.error('CRV addToCart error:', err);
      btn.textContent = orig;
      btn.disabled    = false;
      btn._loading    = false;
    }
  }

  // ── Classe principale ────────────────────────────────────────
  class RecentlyViewed {
    constructor(el) {
      this.el         = el;
      this.grid       = el.querySelector('[data-crv-grid]');
      this.max        = parseInt(el.dataset.max, 10) || 4;
      this.columns    = el.dataset.columns || '4';
      this.currentId  = el.dataset.current ? Number(el.dataset.current) : null;

      if (!this.grid) return;
      this._load();
    }

    async _load() {
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch (_) { return; }

      // Exclure le produit courant
      list = list.filter(p => p.id !== this.currentId);
      if (!list.length) return;

      // Limiter au max configuré
      list = list.slice(0, this.max);

      // Afficher la section + skeletons
      this.el.removeAttribute('hidden');
      this.grid.setAttribute('data-columns', this.columns);
      this.grid.innerHTML = buildSkeleton(list.length);

      // Fetch les données en parallèle
      const handles = list.map(p => p.handle);
      const products = await this._fetchProducts(handles);

      if (!products.length) {
        this.el.setAttribute('hidden', '');
        return;
      }

      // Rendre les cards dans l'ordre de visite
      const ordered = handles
        .map(h => products.find(p => p.handle === h))
        .filter(Boolean);

      this.grid.innerHTML = ordered.map(buildCard).join('');

      // Wrap dans un carrousel avec flèches
      this._initCarousel();

      // Délégation ATC
      this.grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-crv-atc]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        addToCart(btn, btn.dataset.crvAtc);
      });
    }

    _initCarousel() {
      // Créer le wrapper
      const wrap = document.createElement('div');
      wrap.className = 'crv__carousel-wrap';
      this.grid.parentNode.insertBefore(wrap, this.grid);
      wrap.appendChild(this.grid);

      // Flèches
      const prevBtn = document.createElement('button');
      prevBtn.className = 'crv__arrow crv__arrow--prev';
      prevBtn.type = 'button';
      prevBtn.setAttribute('aria-label', 'Précédent');
      prevBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`;

      const nextBtn = document.createElement('button');
      nextBtn.className = 'crv__arrow crv__arrow--next';
      nextBtn.type = 'button';
      nextBtn.setAttribute('aria-label', 'Suivant');
      nextBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`;

      wrap.appendChild(prevBtn);
      wrap.appendChild(nextBtn);

      const scrollAmount = () => {
        const card = this.grid.querySelector('.crv__card');
        return card ? card.offsetWidth + 12 : 200;
      };

      prevBtn.addEventListener('click', () => {
        this.grid.scrollBy({ left: -scrollAmount() * 2, behavior: 'smooth' });
      });

      nextBtn.addEventListener('click', () => {
        this.grid.scrollBy({ left: scrollAmount() * 2, behavior: 'smooth' });
      });

      // Mise à jour état flèches
      const updateArrows = () => {
        const { scrollLeft, scrollWidth, clientWidth } = this.grid;
        prevBtn.disabled = scrollLeft <= 2;
        nextBtn.disabled = scrollLeft + clientWidth >= scrollWidth - 2;
      };

      this.grid.addEventListener('scroll', updateArrows, { passive: true });
      updateArrows();
    }

    async _fetchProducts(handles) {
      // Fetch chaque produit individuellement via /products/{handle}.json
      const products = [];

      await Promise.all(handles.map(async (handle) => {
        try {
          const res = await fetch(`/products/${encodeURIComponent(handle)}.json`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.product) products.push(data.product);
        } catch (_) {}
      }));

      return products;
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('[data-crv]').forEach((el) => {
      if (!el._crvInit) el._crvInit = new RecentlyViewed(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('[data-crv]');
    if (el) { el._crvInit = null; el._crvInit = new RecentlyViewed(el); }
  });

})();
