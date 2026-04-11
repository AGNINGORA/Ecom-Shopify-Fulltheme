/**
 * custom-newsletter-popup.js
 * Popup newsletter — délai + exit intent + localStorage · Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  const CNP_DISMISSED_KEY  = 'cnp_dismissed';   // timestamp du dernier dismiss
  const CNP_SUBSCRIBED_KEY = 'cnp_subscribed';   // 1 si déjà inscrit

  // ══════════════════════════════════════════════════════════════
  //  CLASSE PRINCIPALE
  // ══════════════════════════════════════════════════════════════

  class NewsletterPopup {
    constructor(el) {
      this.el           = el;
      this.overlay      = el.querySelector('[data-cnp-overlay]');
      this.modal        = el.querySelector('[data-cnp-modal]');
      this.closeBtn     = el.querySelector('[data-cnp-close]');
      this.form         = el.querySelector('[data-cnp-form]');
      this.formContent  = el.querySelector('[data-cnp-form-content]');
      this.successEl    = el.querySelector('[data-cnp-success]');
      this.emailInput   = el.querySelector('[data-cnp-email]');
      this.submitBtn    = el.querySelector('[data-cnp-submit]');

      // Config depuis data-attributes
      this.delay        = parseInt(el.getAttribute('data-cnp-delay')    || '5',    10) * 1000;
      this.dismissDays  = parseInt(el.getAttribute('data-cnp-dismiss-days') || '7', 10);
      this.exitIntent   = el.getAttribute('data-cnp-exit-intent') === 'true';
      this.mobileHide   = el.getAttribute('data-cnp-mobile-hide')  === 'true';

      this._shown       = false;
      this._exitBound   = null;

      if (this._shouldShow()) this._schedule();
    }

    // ──────────────────────────────────────────────────────────
    //  VÉRIFICATIONS
    // ──────────────────────────────────────────────────────────

    _shouldShow() {
      // Déjà inscrit → jamais
      if (localStorage.getItem(CNP_SUBSCRIBED_KEY)) return false;

      // Caché sur mobile si option activée
      if (this.mobileHide && window.matchMedia('(max-width: 749px)').matches) return false;

      // Déjà fermé récemment
      const dismissed = localStorage.getItem(CNP_DISMISSED_KEY);
      if (dismissed) {
        const elapsed = Date.now() - parseInt(dismissed, 10);
        const limitMs = this.dismissDays * 24 * 60 * 60 * 1000;
        if (elapsed < limitMs) return false;
      }

      return true;
    }

    // ──────────────────────────────────────────────────────────
    //  PLANIFICATION
    // ──────────────────────────────────────────────────────────

    _schedule() {
      // Délai classique
      if (this.delay >= 0) {
        setTimeout(() => this._show(), this.delay);
      }

      // Exit intent (desktop uniquement)
      if (this.exitIntent && !window.matchMedia('(max-width: 749px)').matches) {
        this._exitBound = this._onExitIntent.bind(this);
        document.addEventListener('mouseleave', this._exitBound);
      }
    }

    _onExitIntent(e) {
      if (e.clientY <= 0) {
        document.removeEventListener('mouseleave', this._exitBound);
        this._show();
      }
    }

    // ──────────────────────────────────────────────────────────
    //  AFFICHAGE / MASQUAGE
    // ──────────────────────────────────────────────────────────

    _show() {
      if (this._shown) return;
      this._shown = true;

      // Supprimer exit intent si déjà affiché via délai
      if (this._exitBound) {
        document.removeEventListener('mouseleave', this._exitBound);
      }

      this.overlay?.classList.add('is-visible');
      this.modal?.classList.add('is-visible');

      // Focus sur le champ email pour accessibilité
      requestAnimationFrame(() => this.emailInput?.focus());

      this._bindClose();
      this._bindForm();
    }

    _hide() {
      this.overlay?.classList.remove('is-visible');
      this.modal?.classList.remove('is-visible');
      localStorage.setItem(CNP_DISMISSED_KEY, String(Date.now()));
    }

    // ──────────────────────────────────────────────────────────
    //  FERMETURE
    // ──────────────────────────────────────────────────────────

    _bindClose() {
      // Bouton ×
      this.closeBtn?.addEventListener('click', () => this._hide());

      // Clic sur l'overlay
      this.overlay?.addEventListener('click', () => this._hide());

      // Touche Échap
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._shown) this._hide();
      }, { once: true });
    }

    // ──────────────────────────────────────────────────────────
    //  SOUMISSION DU FORMULAIRE
    // ──────────────────────────────────────────────────────────

    _bindForm() {
      if (!this.form) return;

      this.form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = this.emailInput?.value?.trim();
        if (!email || !email.includes('@')) {
          this.emailInput?.focus();
          return;
        }

        this._setLoading(true);

        try {
          const formData = new FormData(this.form);

          const response = await fetch(this.form.action || '/contact', {
            method:  'POST',
            headers: { 'Accept': 'application/json' },
            body:    formData,
          });

          // Shopify retourne 200 sur succès, 422 si déjà inscrit (on considère les deux comme succès)
          if (response.ok || response.status === 422) {
            this._showSuccess();
            localStorage.setItem(CNP_SUBSCRIBED_KEY, '1');
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (err) {
          console.error('[CNP] Erreur soumission :', err);
          // Fallback : soumission classique
          this._setLoading(false);
          this.form.submit();
        }
      });
    }

    _setLoading(state) {
      if (!this.submitBtn) return;
      this.submitBtn.disabled = state;
      this.submitBtn.textContent = state ? '…' : this.submitBtn.getAttribute('data-label') || 'S\'inscrire';
    }

    // ──────────────────────────────────────────────────────────
    //  ÉTAT SUCCÈS
    // ──────────────────────────────────────────────────────────

    _showSuccess() {
      this.formContent?.classList.add('is-hidden');
      this.successEl?.classList.add('is-visible');

      // Fermer automatiquement après 6 secondes
      setTimeout(() => this._hide(), 6000);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════

  function init() {
    const el = document.querySelector('[data-cnp]');
    if (el && !el._cnpInit) {
      el._cnpInit = new NewsletterPopup(el);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Rechargement éditeur de thème — prévisualiser immédiatement
  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('[data-cnp]');
    if (!el) return;
    el._cnpInit = null;
    // En mode éditeur, ignorer les vérifications localStorage
    const popup = new NewsletterPopup(el);
    popup._shown = false;
    popup._show();
  });
})();
