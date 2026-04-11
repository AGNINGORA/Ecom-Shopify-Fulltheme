/**
 * custom-faq-contact.js
 * Accordéon FAQ — une seule question ouverte à la fois
 * Vanilla JS · Dawn 15.x · Animation via CSS grid-template-rows
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  //  ITEM D'ACCORDÉON INDIVIDUEL
  // ══════════════════════════════════════════════════════════════

  class AccordionItem {
    constructor(el) {
      this.el      = el;
      this.trigger = el.querySelector('[data-cfc-trigger]');
      this.answer  = el.querySelector('[data-cfc-answer]');
      if (!this.trigger || !this.answer) return;
    }

    get isOpen() {
      return this.trigger.getAttribute('aria-expanded') === 'true';
    }

    open() {
      this.trigger.setAttribute('aria-expanded', 'true');
      this.answer.classList.add('is-open');
    }

    close() {
      this.trigger.setAttribute('aria-expanded', 'false');
      this.answer.classList.remove('is-open');
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  GESTIONNAIRE DE L'ACCORDÉON COMPLET
  // ══════════════════════════════════════════════════════════════

  class FaqAccordion {
    constructor(el) {
      this.el    = el;
      this.items = Array.from(el.querySelectorAll('[data-cfc-item]'))
        .map((itemEl) => new AccordionItem(itemEl));

      this._bindEvents();
    }

    _bindEvents() {
      this.items.forEach((item) => {
        if (!item.trigger) return;

        item.trigger.addEventListener('click', () => {
          const wasOpen = item.isOpen;

          // Fermer tous les items
          this.items.forEach((other) => other.close());

          // Ouvrir celui cliqué uniquement s'il était fermé
          if (!wasOpen) item.open();
        });

        // Clavier : Entrée et Espace sont gérés nativement par <button>
        // Flèches haut/bas pour navigation entre les questions
        item.trigger.addEventListener('keydown', (e) => {
          const idx = this.items.indexOf(item);
          if (e.key === 'ArrowDown' && idx < this.items.length - 1) {
            e.preventDefault();
            this.items[idx + 1].trigger?.focus();
          }
          if (e.key === 'ArrowUp' && idx > 0) {
            e.preventDefault();
            this.items[idx - 1].trigger?.focus();
          }
          if (e.key === 'Home') {
            e.preventDefault();
            this.items[0].trigger?.focus();
          }
          if (e.key === 'End') {
            e.preventDefault();
            this.items[this.items.length - 1].trigger?.focus();
          }
        });
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════

  function init() {
    document.querySelectorAll('[data-cfc-accordion]').forEach((el) => {
      if (!el._cfcInit) {
        el._cfcInit = new FaqAccordion(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Rechargement dans l'éditeur de thème
  document.addEventListener('shopify:section:load', (e) => {
    const accordion = e.target.querySelector('[data-cfc-accordion]');
    if (accordion) {
      accordion._cfcInit = new FaqAccordion(accordion);
    }
  });

  // Rechargement d'un block individuel (ajout/modif dans l'éditeur)
  document.addEventListener('shopify:block:select', (e) => {
    const item = e.target.closest('[data-cfc-item]');
    if (!item) return;
    const accordion = item.closest('[data-cfc-accordion]');
    if (!accordion?._cfcInit) return;

    // Ouvrir l'item sélectionné dans l'éditeur
    const accordionInstance = accordion._cfcInit;
    const matchingItem = accordionInstance.items.find((i) => i.el === item);
    if (matchingItem) {
      accordionInstance.items.forEach((other) => other.close());
      matchingItem.open();
    }
  });
})();
