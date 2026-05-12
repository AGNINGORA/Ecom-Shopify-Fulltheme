# CONTEXT — EcomRevolution Shopify Theme
**Dernière mise à jour :** Mai 2026  
**GitHub :** https://github.com/AGNINGORA/Ecom-Shopify-Fulltheme  
**Path local :** `F:\PROJETS\MES APPLICATIONS\Shopify theme`  
**Base :** Dawn 15.x (Shopify OS 2.0)

---

## 🎯 Objectif du projet
Construire un thème Shopify "FullStack" tout-en-un (inspiré de themefullstack.com) qui remplace ~30 apps payantes. Le thème s'appelle **Sheerise** (boutique test).

---

## 🏗️ Architecture générale

### Fichiers clés
```
layout/theme.liquid          ← Layout principal — fin de body :
  {%- section 'custom-cart-drawer' -%}
  {%- render 'custom-sticky-cart' -%}
  {%- section 'custom-newsletter-popup' -%}
  {%- section 'custom-exit-intent' -%}
  {%- render 'custom-cart-upsell-popup' -%}

sections/header.liquid       ← Header Dawn modifié
  → render 'header-mega-menu-pro'  (si menu_type_desktop != 'drawer')

snippets/header-mega-menu-pro.liquid  ← Mega menu snippet dans le header
sections/custom-mega-menu.liquid      ← Section mega menu STANDALONE (header group)
assets/mega-menu-pro.css              ← CSS du snippet header-mega-menu-pro
assets/custom-mega-menu.css           ← CSS de la section custom-mega-menu

config/settings_data.json    ← cart_type: "notification" (Dawn native désactivé)
```

### PubSub / Events
- `subscribe('cart-update', ...)` → ouvre le drawer si `source === 'product-form'`
- `shopify:section:load` → ré-initialise sections (NE PAS appeler `_show()` dedans)

---

## ✅ FONCTIONNALITÉS CONSTRUITES (56 assets, 35+ sections)

| Feature | Section/Snippet | Assets |
|---|---|---|
| Cart drawer custom | `sections/custom-cart-drawer.liquid` | `custom-cart-drawer.js/.css` |
| Newsletter popup | `sections/custom-newsletter-popup.liquid` | `custom-newsletter-popup.js/.css` |
| Exit intent | `sections/custom-exit-intent.liquid` | `custom-exit-intent.js/.css` |
| Wishlist | `snippets/custom-wishlist-*.liquid` | `custom-wishlist.js/.css` |
| Bundle offer | `sections/custom-bundle-offer.liquid` | `custom-bundle-offer.js/.css` |
| Buy X Get Y | `sections/custom-bxgy.liquid` | `custom-bxgy.js/.css` |
| Quantity breaks | `sections/custom-quantity-breaks.liquid` | `custom-quantity-breaks.js/.css` |
| Cross-sell | `sections/custom-cross-sell.liquid` | `custom-cross-sell.js/.css` |
| Upsell popup | `snippets/custom-cart-upsell-popup.liquid` | `custom-cart-upsell-popup.js/.css` |
| Back in stock | `sections/custom-back-in-stock.liquid` | `custom-back-in-stock.js/.css` |
| Mega menu (standalone) | `sections/custom-mega-menu.liquid` | `custom-mega-menu.css` |
| Mega menu (header snippet) | `snippets/header-mega-menu-pro.liquid` | `mega-menu-pro.css` |
| Collection filters | `sections/custom-collection-filters.liquid` | `custom-collection-filters.js/.css` |
| A/B testing | `sections/custom-ab-testing.liquid` | `custom-ab-testing.js/.css` |
| Before/after | `sections/custom-before-after.liquid` | `custom-before-after.css` |
| Stories | `sections/custom-stories.liquid` | `custom-stories.js/.css` |
| FAQ | `sections/custom-faq.liquid` | `custom-faq.css` |
| Social proof | `sections/custom-social-proof.liquid` | `custom-social-proof.js/.css` |
| Shipping bar | `sections/custom-shipping-bar.liquid` | `custom-shipping-bar.css` |
| Sticky cart | `snippets/custom-sticky-cart.liquid` | `custom-sticky-cart.js/.css` |
| Featured routine | `sections/custom-featured-routine.liquid` | `custom-featured-routine.css` |
| Testimonials | `sections/custom-testimonials.liquid` | `custom-testimonials.js/.css` |
| Cookie banner | `sections/custom-cookie-banner.liquid` | `custom-cookie-banner.js/.css` |
| Announcement bar | custom | — |
| Gift options | `sections/custom-gift-options.liquid` | `custom-gift-options.js/.css` |
| Variant selector | custom | — |
| Recently viewed | `snippets/custom-recently-viewed.liquid` | `custom-recently-viewed.js/.css` |
| Trust badges | `sections/custom-trust-badges.liquid` | `custom-trust-badges.css` |
| Hero banner | `sections/custom-hero-banner.liquid` | — |
| Image + texte | `sections/custom-image-text.liquid` | — |
| Collection list | `sections/custom-collection-list.liquid` | — |
| Reviews | `sections/custom-reviews.liquid` | — |

---

## 🐛 BUGS CORRIGÉS (Mai 2026)

### 1. FOUC Cart Drawer (flash HTML avant CSS)
- **Fichier :** `sections/custom-cart-drawer.liquid`
- **Fix :** `<style>.ccd__drawer{visibility:hidden}</style>` avant le `<link>` CSS async
- **Raison :** CSS en `media="print" onload` → drawer HTML visible 50-200ms avant que styles s'appliquent
- **Spécificité :** `.ccd__drawer.is-open { visibility:visible }` (0,2,0) > inline (0,1,0) ✓

### 2. Cart-notification Dawn (flash après ATC)
- **Fichier :** `assets/custom-cart-drawer.js`
- **Fix :** `_suppressCartNotification()` dans le constructeur `CartDrawer`
- **Mécanisme :** Override `renderContents()` sur l'instance `cart-notification` → update bulle uniquement, jamais `open()`

### 3. Newsletter popup (s'ouvrait sur chaque clic dans l'éditeur Shopify)
- **Cause :** Handler `shopify:section:load` appelait `popup._show()` immédiatement, contournant délai et localStorage
- **Fix :** `assets/custom-newsletter-popup.js` → remplacé par simple `new NewsletterPopup(el)` (re-init sans force-show)
- **Fix FOUC :** `sections/custom-newsletter-popup.liquid` → `<style>.cnp__modal,.cnp__overlay{display:none}</style>`

### 4. Mega menu (Black vertical overlay + refonte CSS)
- **Cause :** Classes `mega-menu mega-menu__content color-{scheme} gradient` → conflits avec `component-mega-menu.css` Dawn
- **Fix :** `snippets/header-mega-menu-pro.liquid` → nouvelles classes `mmp__details` / `mmp__panel` uniquement
- **Fix :** `assets/mega-menu-pro.css` → 100% indépendant de Dawn, positionnement propre

### 5. Cart drawer s'ouvrait sur n'importe quel clic
- **Cause :** Mauvaise config du `_captureHandler` (bubble mode au lieu de capture mode)
- **Fix :** `assets/custom-cart-drawer.js` → restaurer `addEventListener('click', handler, true)` + `e.stopImmediatePropagation()`

---

## ⚠️ RÈGLES CRITIQUES (NE JAMAIS CHANGER)

### custom-cart-drawer.js
```javascript
// MODE CAPTURE OBLIGATOIRE — ne jamais passer en bubble mode
document.addEventListener('click', this._captureHandler, true);

// DANS _captureHandler :
const trigger = e.target.closest('#cart-icon-bubble, [data-open-cart-drawer]');
if (!trigger) return;
if (e.target.closest('.header__inline-menu, .mega-menu__content')) return;
e.preventDefault();
e.stopImmediatePropagation();  // ← NE PAS remplacer par stopPropagation
this.fetchAndRender().then(() => this.open());
```

### custom-newsletter-popup.js
```javascript
// shopify:section:load → NE JAMAIS appeler _show() directement
document.addEventListener('shopify:section:load', (e) => {
  const el = e.target.querySelector('[data-cnp]');
  if (!el) return;
  el._cnpInit = null;
  el._cnpInit = new NewsletterPopup(el);  // re-init uniquement
});
```

---

## 🚨 SITUATION MEGA MENU (en cours — Mai 2026)

Il existe **deux** composants mega menu distincts :

| | Fichier | Type | Usage |
|---|---|---|---|
| **A** | `snippets/header-mega-menu-pro.liquid` | Snippet | Rendu DANS le header Dawn via `render` |
| **B** | `sections/custom-mega-menu.liquid` | Section | Section standalone dans le header group |

**CSS A :** `mega-menu-pro.css` (classes `mmp__details`, `mmp__panel`)  
**CSS B :** `custom-mega-menu.css` (classes `cmm__*`)

**Bug actuel :** Les deux s'affichent en même temps → double barre de navigation.  
**À faire :** Décider lequel garder et désactiver/supprimer l'autre.
- Option 1 : Garder **B** (section standalone avec plus de settings) + désactiver le `render` dans `header.liquid`
- Option 2 : Garder **A** (snippet dans header) + supprimer la section B du header group

---

## 📋 FONCTIONNALITÉS MANQUANTES vs FullStack

- [ ] **Countdown timer** — compte à rebours sur produits/promos
- [ ] **Stock urgency indicator** — "Plus que X en stock"
- [ ] **Shipping estimate** — estimateur de livraison sur fiche produit
- [ ] **Size guide popup** — guide des tailles
- [ ] **Color swatches** — aperçus couleur dans les collections
- [ ] **Landing page template** — template pour campagnes
- [ ] **Canonical URL / no-index** — gestion SEO URLs dupliquées

---

## 🗺️ PHASE 3 (projet séparé)
**AliExpress → Shopify automation tool**  
Stack : Next.js  
Repo : séparé de ce thème

---

## 🔑 Paramètres importants
```json
// config/settings_data.json
{
  "cart_type": "notification",          // Dawn native = désactivé
  "delay_seconds": 5,                   // Newsletter popup delay
  "dismiss_days": 7,                    // Newsletter popup dismiss
  "MOBILE_DELAY": 35000                 // Exit intent mobile (35s)
}
```

## CSS Variables clés
```css
--ccd-z: z-index cart drawer (≈100)
--header-bottom-position-desktop: hauteur header sticky (utilisé par mega menu max-height)
--ccd-accent: couleur accent cart drawer
--ccd-btn-txt: couleur texte boutons cart drawer
```
