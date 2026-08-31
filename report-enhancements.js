/* PredictIQ AI — report UX layer
 * Turns the model output into plain-language guidance without changing the underlying probability engine.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  function update() {
    const results = $('results');
    if (!results || results.classList.contains('hidden')) return;
    const prob = parseFloat(($('topPickProb')?.textContent || '').replace('%',''));
    const conf = ($('topPickConfidence')?.textContent || '').trim();
    const health = document.querySelector('#dataHealth');
    const bar = document.querySelector('#dataHealthBar');
    const top = $('topPickMarket')?.textContent || '';
    const noBet = conf === 'NO BET' || /No qualifying/.test(top);

    if ($('decisionHeadline')) $('decisionHeadline').textContent = noBet ? 'No strong option' : `${conf === 'HIGH' ? 'Strong' : conf === 'MEDIUM' ? 'Moderate' : 'Limited'} model signal`;
    if ($('decisionText')) $('decisionText').textContent = noBet
      ? 'The system did not find a market that met its current probability, price and data-quality rules. It will not force a pick.'
      : `The top option is ${top}. The ${Number.isFinite(prob) ? prob.toFixed(1) + '%' : 'available'} probability is a model estimate, not a guarantee.`;

    const form = document.querySelectorAll('.form-card');
    let quality = 0;
    form.forEach(card => {
      const match = card.textContent.match(/Last 5\s+(\d+)W\s+(\d+)D\s+(\d+)L/);
      if (match) quality += 50;
    });
    quality = Math.min(100, quality || (Number.isFinite(prob) ? 60 : 0));
    if (health) health.textContent = quality >= 90 ? 'GOOD' : quality >= 60 ? 'PARTIAL' : 'LIMITED';
    if (bar) bar.style.width = quality + '%';

    document.querySelectorAll('.pick-item').forEach((item, i) => {
      if (!item.querySelector('.pick-label')) {
        const label = document.createElement('span');
        label.className = 'pick-label';
        label.textContent = i === 0 ? 'BEST MATCH' : i === 1 ? 'SECOND CHOICE' : 'THIRD CHOICE';
        item.querySelector('.rank')?.appendChild(label);
      }
    });
  }
  const observer = new MutationObserver(update);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('load', update);
})();
