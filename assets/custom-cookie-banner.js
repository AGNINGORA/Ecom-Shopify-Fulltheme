/**
 * custom-cookie-banner.js
 * Consentement cookies RGPD — localStorage · Vanilla JS · Dawn 15.x
 *
 * Événements émis :
 *   document → 'cookie:accepted'  → charger les scripts analytics / tracking
 *   document → 'cookie:refused'   → ne pas charger les scripts de tracking
 *   document → 'cookie:checked'   → dispatché au chargement si consentement déjà enregistré
 *                                    (detail.choice = 'accepted' | 'refused')
 */

(function () {
  'use strict';

  const CCB_KEY = 'ccb_consent';

  // ──────────────────────────────────────────────────────────────
  //  STORE
  // ──────────────────────────────────────────────────────────────

  const ConsentStore = {
    get() {
      try { return JSON.parse(localStorage.getItem(CCB_KEY)); }
      catch { return null; }
    },
    save(choice, expiryMonths) {
      const expires = Date.now() + expiryMonths * 30 * 24 * 60 * 60 * 1000;
      localStorage.setItem(CCB_KEY, JSON.stringify({ choice, expires }));
    },
    isValid() {
      const data = this.get();
      return data && data.expires > Date.now();
    },
    clear() {
      localStorage.removeItem(CCB_KEY);
    },
  };

  // ──────────────────────────────────────────────────────────────
  //  BANNIÈRE
  // ──────────────────────────────────────────────────────────────

  class CookieBanner {
    constructor(el) {
      this.el          = el;
      this.acceptBtn   = el.querySelector('[data-ccb-accept]');
      this.refuseBtn   = el.querySelector('[data-ccb-refuse]');
      this.expiryMonths = parseInt(el.getAttribute('data-ccb-expiry') || '6', 10);

      this._init();
    }

    _init() {
      if (ConsentStore.isValid()) {
        // Consentement déjà enregistré et non expiré → on informe les autres scripts
        const { choice } = ConsentStore.get();
        this._dispatch(choice);
        return; // Bannière reste cachée
      }

      // Afficher la bannière après un court délai (laisse la page se charger)
      setTimeout(() => this._show(), 600);

      this.acceptBtn?.addEventListener('click', () => this._choose('accepted'));
      this.refuseBtn?.addEventListener('click', () => this._choose('refused'));
    }

    _show() {
      this.el.classList.add('is-visible');
      this.el.removeAttribute('hidden');
      this.el.setAttribute('aria-hidden', 'false');
    }

    _hide() {
      this.el.classList.remove('is-visible');
      this.el.setAttribute('aria-hidden', 'true');
      // Masquer du DOM après la transition pour l'accessibilité
      this.el.addEventListener(
        'transitionend',
        () => this.el.setAttribute('hidden', ''),
        { once: true }
      );
    }

    _choose(choice) {
      ConsentStore.save(choice, this.expiryMonths);
      this._hide();
      this._dispatch(choice);
    }

    _dispatch(choice) {
      // Événement spécifique au choix
      document.dispatchEvent(new CustomEvent(`cookie:${choice}`, { bubbles: false }));
      // Événement générique avec le choix dans le détail (déjà enregistré)
      document.dispatchEvent(
        new CustomEvent('cookie:checked', { bubbles: false, detail: { choice } })
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  //  INIT
  // ──────────────────────────────────────────────────────────────

  function init() {
    const el = document.querySelector('[data-ccb]');
    if (el && !el._ccbInit) {
      el._ccbInit = new CookieBanner(el);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ──────────────────────────────────────────────────────────────
  //  API PUBLIQUE — réinitialiser le consentement (ex : lien pied de page)
  //  Appel : window.CookieBannerReset()
  // ──────────────────────────────────────────────────────────────

  window.CookieBannerReset = function () {
    ConsentStore.clear();
    const el = document.querySelector('[data-ccb]');
    if (el?._ccbInit) {
      el.removeAttribute('hidden');
      el._ccbInit._show();
    }
  };
})();
