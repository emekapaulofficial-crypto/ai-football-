/* PredictIQ AI — bookmaker market audit
 * Browser-only helper. It does not create predictions; it checks the supplied prices
 * and makes pricing diagnostics understandable to the user.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);

  function readOdds() {
    return [...document.querySelectorAll('.odd-input')]
      .map(input => ({
        value: Number(input.value),
        row: input.closest('tr')?.textContent || ''
      }))
      .filter(x => Number.isFinite(x.value) && x.value > 1);
  }

  function overround(values) {
    if (values.length < 2) return null;
    return values.reduce((sum, x) => sum + (1 / x), 0);
  }

  function updateAudit() {
    const wrap = $('oddsTableWrap');
    if (!wrap || !document.querySelector('.odd-input')) return;
    let box = $('marketAudit');
    if (!box) {
      box = document.createElement('div');
      box.id = 'marketAudit';
      box.className = 'market-audit';
      wrap.parentElement.appendChild(box);
    }

    const odds = readOdds();
    const values = odds.map(x => x.value);
    const impliedTotal = overround(values);
    const count = odds.length;
    const groups = new Set(odds.map(x => x.row.split(/\s+/).slice(0, 2).join(' ')));

    box.innerHTML = `
      <strong>Odds quality check</strong>
      <span>${count} readable price${count === 1 ? '' : 's'} currently available.</span>
      <span>${groups.size ? `${groups.size} market row groups detected.` : 'Add or correct odds above.'}</span>
      <small>Bookmaker prices are reference data. PredictIQ calculates its own probabilities separately.</small>`;
  }

  const observer = new MutationObserver(() => updateAudit());
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', updateAudit);
  window.addEventListener('load', updateAudit);
})();
