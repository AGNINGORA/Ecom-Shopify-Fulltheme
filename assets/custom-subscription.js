/**
 * Custom Subscription Widget
 * Dawn 15.x · Vanilla JS · Selling Plans API
 *
 * Handles toggling between one-time purchase and subscription,
 * frequency selection, and selling_plan_id injection into the form.
 */
(function () {
  'use strict';

  document.querySelectorAll('[data-csub]').forEach(initWidget);

  function initWidget(widget) {
    const options       = widget.querySelectorAll('[data-csub-option]');
    const freqWrap      = widget.querySelector('[data-csub-frequency]');
    const freqBtns      = widget.querySelectorAll('[data-csub-freq]');
    const benefitsWrap  = widget.querySelector('[data-csub-benefits]');
    const hiddenInput   = widget.querySelector('[data-csub-selling-plan]');
    const priceDisplay  = widget.querySelector('[data-csub-sub-price]');
    const compareDisplay = widget.querySelector('[data-csub-compare-price]');

    if (!hiddenInput) return;

    /* ── Option toggle (one-time / subscribe) ── */
    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        options.forEach((o) => o.classList.remove('is-active'));
        opt.classList.add('is-active');

        const isSubscription = opt.dataset.csubOption === 'subscribe';

        if (freqWrap)    freqWrap.classList.toggle('is-visible', isSubscription);
        if (benefitsWrap) benefitsWrap.classList.toggle('is-visible', isSubscription);

        if (isSubscription) {
          // Select first frequency if none active
          const activeFreq = widget.querySelector('.csub__freq-btn.is-active');
          if (!activeFreq && freqBtns.length > 0) {
            freqBtns[0].click();
          } else if (activeFreq) {
            hiddenInput.value = activeFreq.dataset.csubFreq;
          }
        } else {
          hiddenInput.value = '';
          hiddenInput.removeAttribute('name');
        }

        updatePriceDisplay(widget, isSubscription);
      });
    });

    /* ── Frequency selection ── */
    freqBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        freqBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        hiddenInput.value = btn.dataset.csubFreq;
        hiddenInput.setAttribute('name', 'selling_plan');

        // Update displayed price per frequency
        if (btn.dataset.csubPrice) {
          if (priceDisplay) priceDisplay.textContent = btn.dataset.csubPrice;
        }
      });
    });

    /* ── Price display helper ── */
    function updatePriceDisplay(w, isSub) {
      const oneTimePrice = w.querySelector('[data-csub-onetime-price]');
      const subPrice     = w.querySelector('[data-csub-sub-price]');
      // Both are always shown; the active card highlights the relevant one
    }

    /* ── Init: activate default option ── */
    const defaultActive = widget.querySelector('.csub__option.is-active');
    if (defaultActive && defaultActive.dataset.csubOption === 'subscribe') {
      if (freqWrap) freqWrap.classList.add('is-visible');
      if (benefitsWrap) benefitsWrap.classList.add('is-visible');
      const firstFreq = widget.querySelector('.csub__freq-btn.is-active');
      if (firstFreq) {
        hiddenInput.value = firstFreq.dataset.csubFreq;
        hiddenInput.setAttribute('name', 'selling_plan');
      }
    }
  }

})();
