/**
 * custom-mega-menu.js
 * Mega menu — panneaux desktop + drawer accordéon mobile
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class MegaMenu {
    constructor(el) {
      this.section   = el;
      this.bar       = el.querySelector('[data-cmm-bar]');
      this.overlay   = el.querySelector('[data-cmm-overlay]');
      this.triggers  = Array.from(el.querySelectorAll('[data-cmm-trigger]'));
      this.panels    = Array.from(el.querySelectorAll('[data-cmm-panel]'));
      this.hamburger = el.querySelector('[data-cmm-hamburger]');
      this.drawer    = el.querySelector('[data-cmm-drawer]');
      this.drawerClose = el.querySelector('[data-cmm-drawer-close]');
      this.accordionTriggers = Array.from(el.querySelectorAll('[data-cmm-accordion-trigger]'));

      this._active   = null;     // index du panneau ouvert
      this._isMobile = false;
      this._leaveTimer = null;

      this._updateBarBottom();
      this._bindDesktop();
      this._bindMobile();
      this._bindKeyboard();
      this._bindResize();
    }

    // ──────────────────────────────────────────────────────────
    //  POSITION — met à jour --cmm-bar-bottom via l'offset réel
    // ──────────────────────────────────────────────────────────

    _updateBarBottom() {
      if (!this.bar) return;
      const rect = this.section.getBoundingClientRect();
      const bottom = rect.bottom + window.scrollY;
      // On utilise la position bottom de la section dans le viewport
      document.documentElement.style.setProperty(
        '--cmm-bar-bottom',
        `${this.section.getBoundingClientRect().bottom}px`
      );
    }

    // ──────────────────────────────────────────────────────────
    //  DESKTOP — ouverture / fermeture des panneaux
    // ──────────────────────────────────────────────────────────

    _bindDesktop() {
      this.triggers.forEach((trigger) => {
        const idx = trigger.getAttribute('data-cmm-trigger');

        // Hover → ouvrir
        trigger.addEventListener('mouseenter', () => {
          if (!this._isMobile) {
            this._clearLeaveTimer();
            this._openPanel(idx);
          }
        });

        // Clic → toggle (utile si pas de hover sur touch-laptop)
        trigger.addEventListener('click', (e) => {
          if (!this._isMobile) {
            e.preventDefault();
            this._active === idx ? this._closeAll() : this._openPanel(idx);
          }
        });

        trigger.addEventListener('mouseleave', () => {
          if (!this._isMobile) this._startLeaveTimer();
        });
      });

      // Rester ouvert quand la souris est sur le panneau
      this.panels.forEach((panel) => {
        panel.addEventListener('mouseenter', () => this._clearLeaveTimer());
        panel.addEventListener('mouseleave', () => this._startLeaveTimer());
      });

      // Overlay → fermer
      this.overlay?.addEventListener('click', () => this._closeAll());
    }

    _openPanel(idx) {
      if (this._active === idx) return;

      // Fermer l'éventuel panneau précédent sans animation (swap immédiat)
      if (this._active !== null) this._closePanel(this._active, false);

      this._active = idx;

      const panel   = this._getPanel(idx);
      const trigger = this._getTrigger(idx);
      if (!panel || !trigger) return;

      // Recalculer la position avant d'afficher
      this._updateBarBottom();

      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('is-active');

      this.overlay?.classList.add('is-visible');
      document.body.classList.add('cmm-panel-open');
    }

    _closePanel(idx, animate = true) {
      const panel   = this._getPanel(idx);
      const trigger = this._getTrigger(idx);
      if (!panel) return;

      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      trigger?.setAttribute('aria-expanded', 'false');
      trigger?.classList.remove('is-active');
    }

    _closeAll() {
      this._clearLeaveTimer();
      if (this._active !== null) this._closePanel(this._active);
      this._active = null;

      this.overlay?.classList.remove('is-visible');
      document.body.classList.remove('cmm-panel-open');
    }

    _startLeaveTimer() {
      this._leaveTimer = setTimeout(() => this._closeAll(), 120);
    }

    _clearLeaveTimer() {
      clearTimeout(this._leaveTimer);
    }

    _getPanel(idx) {
      return this.panels.find((p) => p.getAttribute('data-cmm-panel') === String(idx));
    }

    _getTrigger(idx) {
      return this.triggers.find((t) => t.getAttribute('data-cmm-trigger') === String(idx));
    }

    // ──────────────────────────────────────────────────────────
    //  MOBILE — drawer + accordéon
    // ──────────────────────────────────────────────────────────

    _bindMobile() {
      this.hamburger?.addEventListener('click', () => this._openDrawer());
      this.drawerClose?.addEventListener('click', () => this._closeDrawer());

      // Clic overlay (hamburger ouvert) → fermer drawer
      this.overlay?.addEventListener('click', () => {
        if (this.drawer?.classList.contains('is-open')) this._closeDrawer();
      });

      // Accordéon : une seule section ouverte à la fois
      this.accordionTriggers.forEach((trigger) => {
        trigger.addEventListener('click', () => {
          const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
          const bodyId     = trigger.getAttribute('aria-controls');
          const body       = document.getElementById(bodyId);

          // Fermer tous
          this.accordionTriggers.forEach((t) => {
            t.setAttribute('aria-expanded', 'false');
            const bid  = t.getAttribute('aria-controls');
            const b    = document.getElementById(bid);
            if (b) b.classList.remove('is-open');
          });

          // Ouvrir si était fermé
          if (!isExpanded && body) {
            trigger.setAttribute('aria-expanded', 'true');
            body.classList.add('is-open');
          }
        });
      });
    }

    _openDrawer() {
      if (!this.drawer) return;
      this.drawer.classList.add('is-open');
      this.drawer.setAttribute('aria-hidden', 'false');
      this.overlay?.classList.add('is-visible');
      this.hamburger?.setAttribute('aria-expanded', 'true');
      document.body.classList.add('cmm-drawer-open');

      // Focus sur le premier lien du drawer
      const firstLink = this.drawer.querySelector('a, button:not([data-cmm-drawer-close])');
      firstLink?.focus();
    }

    _closeDrawer() {
      if (!this.drawer) return;
      this.drawer.classList.remove('is-open');
      this.drawer.setAttribute('aria-hidden', 'true');
      this.overlay?.classList.remove('is-visible');
      this.hamburger?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('cmm-drawer-open');
      this.hamburger?.focus(); // restituer le focus
    }

    // ──────────────────────────────────────────────────────────
    //  CLAVIER
    // ──────────────────────────────────────────────────────────

    _bindKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        if (this._active !== null) {
          this._closeAll();
          this._getTrigger(this._active)?.focus();
        }

        if (this.drawer?.classList.contains('is-open')) {
          this._closeDrawer();
        }
      });

      // Focus trap dans le drawer (Tab)
      this.drawer?.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusable = Array.from(
          this.drawer.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])')
        ).filter((el) => !el.hasAttribute('disabled'));

        if (focusable.length === 0) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });
    }

    // ──────────────────────────────────────────────────────────
    //  RESIZE
    // ──────────────────────────────────────────────────────────

    _bindResize() {
      const mq = window.matchMedia('(max-width: 989px)');
      this._isMobile = mq.matches;

      mq.addEventListener('change', (e) => {
        this._isMobile = e.matches;
        this._updateBarBottom();

        if (!this._isMobile && this.drawer?.classList.contains('is-open')) {
          this._closeDrawer();
        }
        if (this._isMobile && this._active !== null) {
          this._closeAll();
        }
      });

      // Recalculer lors du scroll (header sticky change la position)
      window.addEventListener('scroll', () => this._updateBarBottom(), { passive: true });
      window.addEventListener('resize', () => this._updateBarBottom(), { passive: true });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════

  function init() {
    document.querySelectorAll('[data-cmm-section]').forEach((el) => {
      if (!el._cmmInit) el._cmmInit = new MegaMenu(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('[data-cmm-section]') || e.target;
    if (el.hasAttribute('data-cmm-section') && !el._cmmInit) {
      el._cmmInit = new MegaMenu(el);
    }
  });
})();
