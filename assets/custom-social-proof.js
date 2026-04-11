/**
 * custom-social-proof.js
 * Toast de preuve sociale — rotation, slide-in/out, sessionStorage
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  const STORAGE_KEY  = 'csp_closed_count';
  const MAX_CLOSES   = 3;
  const SHOW_DELAY   = 3000;  // ms avant la 1ère apparition
  const VISIBLE_TIME = 6000;  // ms pendant laquelle le toast est visible

  class SocialProof {
    constructor(toastEl) {
      this.toast     = toastEl;
      this.nameEl    = toastEl.querySelector('[data-csp-name]');
      this.productEl = toastEl.querySelector('[data-csp-product]');
      this.timeEl    = toastEl.querySelector('[data-csp-time]');
      this.closeBtn  = toastEl.querySelector('[data-csp-close]');

      // Intervalle de rotation (ms) depuis la variable CSS
      const intervalMs = parseInt(
        getComputedStyle(toastEl).getPropertyValue('--csp-interval').trim(),
        10
      ) || 30000;
      this.intervalMs = intervalMs;

      // Lire les notifications depuis le JSON embarqué
      const dataEl = document.querySelector('[data-csp-data]');
      if (!dataEl) return;

      try {
        this.notifications = JSON.parse(dataEl.textContent.trim());
      } catch (_) {
        this.notifications = [];
      }

      if (this.notifications.length === 0) return;

      this.index    = 0;
      this.timer    = null;
      this.hideTimer = null;

      this._checkDisabled();
    }

    // ── Vérifier si l'utilisateur a trop fermé ────────────────────
    _checkDisabled() {
      const closes = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0', 10);
      if (closes >= MAX_CLOSES) return; // désactivé pour cette session

      this._bindClose();
      setTimeout(() => this._show(), SHOW_DELAY);
    }

    // ── Afficher la notification courante ─────────────────────────
    _show() {
      const notif = this.notifications[this.index];
      if (!notif) return;

      // Remplir le contenu
      if (this.nameEl)    this.nameEl.textContent    = notif.name    || '';
      if (this.productEl) this.productEl.textContent = notif.product || '';
      if (this.timeEl)    this.timeEl.textContent    = notif.time    || '';

      // Afficher
      this.toast.hidden = false;
      // Force reflow avant d'ajouter la classe d'animation
      void this.toast.offsetWidth;
      this.toast.classList.add('is-visible');

      // Masquer après VISIBLE_TIME
      this.hideTimer = setTimeout(() => this._hide(), VISIBLE_TIME);
    }

    // ── Masquer le toast, puis planifier le suivant ────────────────
    _hide() {
      this.toast.classList.remove('is-visible');

      // Attendre la fin de la transition CSS avant de mettre hidden
      const onEnd = () => {
        this.toast.hidden = true;
        this.toast.removeEventListener('transitionend', onEnd);

        // Passer à la notification suivante
        this.index = (this.index + 1) % this.notifications.length;

        // Planifier le prochain affichage
        this.timer = setTimeout(() => this._show(), this.intervalMs);
      };

      this.toast.addEventListener('transitionend', onEnd, { once: true });
    }

    // ── Bouton fermer ─────────────────────────────────────────────
    _bindClose() {
      this.closeBtn?.addEventListener('click', () => {
        // Annuler les timers en cours
        clearTimeout(this.timer);
        clearTimeout(this.hideTimer);

        // Incrémenter le compteur de fermetures
        const closes = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0', 10);
        sessionStorage.setItem(STORAGE_KEY, String(closes + 1));

        // Masquer immédiatement (sans relancer le cycle)
        this.toast.classList.remove('is-visible');
        const onEnd = () => {
          this.toast.hidden = true;
          this.toast.removeEventListener('transitionend', onEnd);

          // Si l'utilisateur n'a pas encore atteint MAX_CLOSES, on reprend
          const newCount = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0', 10);
          if (newCount < MAX_CLOSES) {
            this.index = (this.index + 1) % this.notifications.length;
            this.timer = setTimeout(() => this._show(), this.intervalMs);
          }
        };
        this.toast.addEventListener('transitionend', onEnd, { once: true });
      });
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    const el = document.querySelector('[data-social-proof]');
    if (el && !el._cspInit) {
      el._cspInit = new SocialProof(el);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Pas de shopify:section:load ici — le snippet est dans layout/theme.liquid
  // et n'est pas rechargeable indépendamment par l'éditeur de thème.
})();
