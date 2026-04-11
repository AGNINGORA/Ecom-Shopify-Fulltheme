/**
 * Custom A/B Testing – Lightweight native split testing
 * Dawn 15.x · Vanilla JS · Cookie-based · GA4 compatible
 *
 * Usage in Liquid sections:
 *   <div data-ab-test="cta_color" data-ab-variant="A"> ... </div>
 *   <div data-ab-test="cta_color" data-ab-variant="B"> ... </div>
 *
 * The script automatically assigns each visitor to one variant per test,
 * persists the assignment in localStorage, shows only the active variant,
 * and fires analytics events.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'ab_tests';
  const DEBUG_PARAM = 'ab_debug';
  const EVENT_NAME  = 'ab_test_impression';

  /* ═══════════════ Utilities ═══════════════ */

  function getAssignments() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch { return {}; }
  }

  function saveAssignments(obj) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function isDebug() {
    return new URLSearchParams(window.location.search).has(DEBUG_PARAM);
  }

  /* ═══════════════ Core ═══════════════ */

  function discoverTests() {
    const tests = {};
    document.querySelectorAll('[data-ab-test]').forEach((el) => {
      const name    = el.dataset.abTest;
      const variant = el.dataset.abVariant;
      if (!tests[name]) tests[name] = [];
      if (!tests[name].includes(variant)) tests[name].push(variant);
    });
    return tests;
  }

  function assignVariants(tests) {
    const stored = getAssignments();
    let changed = false;

    Object.keys(tests).forEach((name) => {
      const variants = tests[name];
      if (!stored[name] || !variants.includes(stored[name].variant)) {
        stored[name] = {
          variant:    pickRandom(variants),
          assignedAt: Date.now(),
          impressions: 0,
          conversions: 0
        };
        changed = true;
      }
    });

    if (changed) saveAssignments(stored);
    return stored;
  }

  function activateVariants(assignments) {
    document.querySelectorAll('[data-ab-test]').forEach((el) => {
      const name    = el.dataset.abTest;
      const variant = el.dataset.abVariant;
      const data    = assignments[name];

      if (data && data.variant === variant) {
        el.classList.add('ab-active');
      } else {
        el.classList.remove('ab-active');
      }
    });
  }

  function trackImpression(name, variant) {
    const stored = getAssignments();
    if (stored[name]) {
      stored[name].impressions = (stored[name].impressions || 0) + 1;
      saveAssignments(stored);
    }

    // GA4 event
    if (typeof gtag === 'function') {
      gtag('event', EVENT_NAME, {
        test_name: name,
        variant:   variant
      });
    }

    // Shopify analytics
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.lib) {
      try {
        window.ShopifyAnalytics.lib.track('A/B Test Impression', {
          test_name: name,
          variant:   variant
        });
      } catch (e) { /* silent */ }
    }
  }

  /* ═══════════════ Conversion tracking ═══════════════ */

  function trackConversion(testName) {
    const stored = getAssignments();
    if (stored[testName]) {
      stored[testName].conversions = (stored[testName].conversions || 0) + 1;
      saveAssignments(stored);

      if (typeof gtag === 'function') {
        gtag('event', 'ab_test_conversion', {
          test_name: testName,
          variant:   stored[testName].variant
        });
      }
    }
  }

  // Auto-track add-to-cart as conversion
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[type="submit"][name="add"], .product-form__submit, .btn-add-to-cart');
    if (!btn) return;

    const stored = getAssignments();
    Object.keys(stored).forEach((name) => trackConversion(name));
  });

  /* ═══════════════ Debug panel ═══════════════ */

  function initDebug(tests, assignments) {
    if (!isDebug()) return;

    // Badge
    const badge = document.createElement('div');
    badge.className = 'ab-debug-badge is-visible';
    badge.innerHTML = '<span class="ab-debug-badge__dot"></span> A/B Testing';

    // Panel
    const panel = document.createElement('div');
    panel.className = 'ab-debug-panel';

    let listHTML = '';
    Object.keys(tests).forEach((name) => {
      const data = assignments[name] || {};
      const variantsHTML = tests[name].map((v) => {
        const active = data.variant === v ? ' is-active' : '';
        return `<button class="ab-debug-test__btn${active}" data-debug-test="${name}" data-debug-variant="${v}">${v}</button>`;
      }).join('');

      listHTML += `
        <div class="ab-debug-test">
          <div class="ab-debug-test__name">${name}</div>
          <div class="ab-debug-test__variants">${variantsHTML}</div>
          <div class="ab-debug-test__stats">
            Impressions: ${data.impressions || 0} · Conversions: ${data.conversions || 0}
            ${data.impressions > 0 ? ' · Taux: ' + ((data.conversions || 0) / data.impressions * 100).toFixed(1) + '%' : ''}
          </div>
        </div>`;
    });

    if (Object.keys(tests).length === 0) {
      listHTML = '<p style="font-size:.85rem;color:#888;padding:12px 0;">Aucun test A/B détecté sur cette page. Ajoutez <code>data-ab-test</code> et <code>data-ab-variant</code> à vos éléments.</p>';
    }

    panel.innerHTML = `
      <div class="ab-debug-panel__header">
        A/B Tests
        <button class="ab-debug-panel__close">&times;</button>
      </div>
      <div class="ab-debug-panel__list">${listHTML}</div>`;

    document.body.appendChild(badge);
    document.body.appendChild(panel);

    // Toggle panel
    badge.addEventListener('click', () => panel.classList.toggle('is-open'));
    panel.querySelector('.ab-debug-panel__close').addEventListener('click', () => panel.classList.remove('is-open'));

    // Force variant
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-debug-test]');
      if (!btn) return;

      const testName = btn.dataset.debugTest;
      const variant  = btn.dataset.debugVariant;
      const stored   = getAssignments();

      if (stored[testName]) {
        stored[testName].variant = variant;
        saveAssignments(stored);
        activateVariants(stored);

        // Update active buttons
        panel.querySelectorAll(`[data-debug-test="${testName}"]`).forEach((b) => {
          b.classList.toggle('is-active', b.dataset.debugVariant === variant);
        });
      }
    });
  }

  /* ═══════════════ Init ═══════════════ */

  function init() {
    const tests       = discoverTests();
    const assignments = assignVariants(tests);

    activateVariants(assignments);

    // Track impressions
    Object.keys(assignments).forEach((name) => {
      trackImpression(name, assignments[name].variant);
    });

    // Debug mode
    initDebug(tests, assignments);
  }

  // Expose global API
  window.ABTesting = {
    getAssignments,
    trackConversion,
    forceVariant: function (testName, variant) {
      const stored = getAssignments();
      if (stored[testName]) {
        stored[testName].variant = variant;
        saveAssignments(stored);
        activateVariants(stored);
      }
    },
    resetAll: function () {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
