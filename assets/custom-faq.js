/**
 * custom-faq.js
 * FAQ Accordéon – une seule question ouverte à la fois
 * Vanilla JS · Dawn 15.x
 */

(function () {
  'use strict';

  class ProductFaq {
    constructor(root) {
      this.root     = root;
      this.items    = Array.from(root.querySelectorAll('.cfaq__item'));
      this.triggers = Array.from(root.querySelectorAll('[data-faq-trigger]'));

      if (this.triggers.length === 0) return;

      this._bindEvents();
    }

    // ── Liaisons événements ──────────────────────────────────────
    _bindEvents() {
      this.triggers.forEach((trigger) => {
        trigger.addEventListener('click', () => this._toggle(trigger));

        // Navigation clavier : flèches haut/bas
        trigger.addEventListener('keydown', (e) => {
          const idx = this.triggers.indexOf(trigger);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.triggers[(idx + 1) % this.triggers.length].focus();
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = (idx - 1 + this.triggers.length) % this.triggers.length;
            this.triggers[prev].focus();
          }
          if (e.key === 'Home') {
            e.preventDefault();
            this.triggers[0].focus();
          }
          if (e.key === 'End') {
            e.preventDefault();
            this.triggers[this.triggers.length - 1].focus();
          }
        });
      });
    }

    // ── Ouverture / fermeture ────────────────────────────────────
    _toggle(trigger) {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      // Fermer tous
      this.triggers.forEach((t) => this._close(t));

      // Ouvrir celui-ci s'il était fermé
      if (!isOpen) this._open(trigger);
    }

    _open(trigger) {
      const answer = document.getElementById(
        trigger.getAttribute('aria-controls')
      );
      if (!answer) return;

      trigger.setAttribute('aria-expanded', 'true');
      answer.hidden = false;

      // On force max-height à 0 avant d'animer
      answer.style.maxHeight = '0';
      // Forcer le reflow pour que la transition se déclenche
      answer.offsetHeight; // eslint-disable-line no-unused-expressions
      answer.style.maxHeight = answer.scrollHeight + 'px';

      // Nettoyage après transition
      answer.addEventListener(
        'transitionend',
        () => { answer.style.maxHeight = 'none'; },
        { once: true }
      );
    }

    _close(trigger) {
      const answer = document.getElementById(
        trigger.getAttribute('aria-controls')
      );
      if (!answer || trigger.getAttribute('aria-expanded') === 'false') return;

      trigger.setAttribute('aria-expanded', 'false');

      // Remettre max-height chiffrée avant d'animer vers 0
      answer.style.maxHeight = answer.scrollHeight + 'px';
      answer.offsetHeight; // reflow
      answer.style.maxHeight = '0';

      answer.addEventListener(
        'transitionend',
        () => { answer.hidden = true; },
        { once: true }
      );
    }
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.custom-product-faq[data-section-id]').forEach((el) => {
      if (!el._faqInit) el._faqInit = new ProductFaq(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Rechargement dans l'éditeur de thème Shopify
  document.addEventListener('shopify:section:load', (e) => {
    const el = e.target.querySelector('.custom-product-faq');
    if (el) el._faqInit = new ProductFaq(el);
  });
})();
