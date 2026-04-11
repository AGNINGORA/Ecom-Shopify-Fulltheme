/* =============================================================
   custom-exit-intent.js
   Popup exit intent — souris hors fenêtre (desktop) + inactivité (mobile)
   Dawn 15.x · Vanilla JS · localStorage cooldown
   ============================================================= */

(function () {
  'use strict';

  const STORAGE_KEY    = 'cei_last_shown';
  const MOBILE_DELAY   = 35000; // 35s d'inactivité sur mobile

  class ExitIntent {
    constructor() {
      this.modal    = document.getElementById('exit-intent-modal');
      this.overlay  = document.querySelector('[data-ei-overlay]');
      if (!this.modal) return;

      this.cooldownH  = parseInt(this.modal.dataset.eiCooldown || '24', 10);
      this._isOpen    = false;
      this._triggered = false;
      this._mobileTimer = null;
      this._prevFocus   = null;

      if (this._shouldSkip()) return;

      this._bindClose();
      this._bindCopy();
      this._listenDesktop();
      this._listenMobile();
    }

    // ── Cooldown ──────────────────────────────────────────────
    _shouldSkip() {
      // Ne pas afficher sur checkout
      if (window.location.pathname.includes('/checkout')) return true;
      // Ne pas afficher sur cart si drawer est ouvert
      const last = localStorage.getItem(STORAGE_KEY);
      if (!last) return false;
      const elapsed = Date.now() - parseInt(last, 10);
      return elapsed < this.cooldownH * 3_600_000;
    }

    _markShown() {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    }

    // ── Ouvrir ────────────────────────────────────────────────
    open() {
      if (this._isOpen || this._triggered) return;
      this._triggered = true;
      this._isOpen    = true;
      this._markShown();

      clearTimeout(this._mobileTimer);
      document.removeEventListener('mouseleave', this._onMouseLeave);

      this.modal.removeAttribute('hidden');
      this.overlay?.classList.add('is-open');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.modal.classList.add('is-open');
        });
      });

      this._prevFocus = document.activeElement;
      setTimeout(() => {
        const btn = this.modal.querySelector('[data-ei-close]');
        btn?.focus();
      }, 100);

      document.addEventListener('keydown', this._onKeydown);
      document.body.style.overflow = 'hidden';
    }

    // ── Fermer ────────────────────────────────────────────────
    close() {
      if (!this._isOpen) return;
      this._isOpen = false;

      this.modal.classList.remove('is-open');
      this.overlay?.classList.remove('is-open');

      const dur = 300;
      setTimeout(() => {
        this.modal.setAttribute('hidden', '');
        document.body.style.overflow = '';
      }, dur);

      document.removeEventListener('keydown', this._onKeydown);
      this._prevFocus?.focus?.();
    }

    // ── Desktop : mouse leave vers le haut ───────────────────
    _listenDesktop() {
      // Seulement si l'utilisateur a une souris
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

      // Attendre 3s avant d'activer (évite les faux positifs au chargement)
      setTimeout(() => {
        this._onMouseLeave = (e) => {
          if (e.clientY <= 10) this.open();
        };
        document.addEventListener('mouseleave', this._onMouseLeave);
      }, 3000);
    }

    // ── Mobile : inactivité ──────────────────────────────────
    _listenMobile() {
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

      const reset = () => {
        clearTimeout(this._mobileTimer);
        this._mobileTimer = setTimeout(() => this.open(), MOBILE_DELAY);
      };

      ['touchstart', 'scroll', 'click'].forEach(ev =>
        document.addEventListener(ev, reset, { passive: true })
      );

      // Démarrer le timer
      this._mobileTimer = setTimeout(() => this.open(), MOBILE_DELAY);
    }

    // ── Fermer via boutons / overlay / ESC ───────────────────
    _bindClose() {
      this._onKeydown = (e) => {
        if (e.key === 'Escape') this.close();
      };

      this.modal.querySelectorAll('[data-ei-close]').forEach(btn =>
        btn.addEventListener('click', () => this.close())
      );

      this.overlay?.addEventListener('click', () => this.close());
    }

    // ── Copier le code promo ─────────────────────────────────
    _bindCopy() {
      const copyBtn = this.modal.querySelector('[data-ei-copy]');
      if (!copyBtn) return;

      copyBtn.addEventListener('click', async () => {
        const code    = copyBtn.dataset.eiCopy;
        const copiedEl = copyBtn.querySelector('[data-ei-copied]');
        const iconEl   = copyBtn.querySelector('.cei__code-copy-icon');

        try {
          await navigator.clipboard.writeText(code);
        } catch (_) {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = code;
          ta.style.position = 'fixed';
          ta.style.opacity  = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }

        if (copiedEl) {
          copiedEl.removeAttribute('hidden');
          if (iconEl) iconEl.style.display = 'none';
          setTimeout(() => {
            copiedEl.setAttribute('hidden', '');
            if (iconEl) iconEl.style.display = '';
          }, 2500);
        }
      });
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    if (!window._ceiInstance) {
      window._ceiInstance = new ExitIntent();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
