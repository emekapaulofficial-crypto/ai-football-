/* PredictIQ AI — report UX layer
 * Turns the model output into plain-language guidance and adds goal totals.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);

  function poisson(lambda, k) {
    let p = Math.exp(-lambda);
    for (let i = 1; i <= k; i++) p *= lambda / i;
    return p;
  }

  function totalOverProbability(totalXg, line) {
    let underOrEqual = 0;
    for (let k = 0; k <= 12; k++) underOrEqual += poisson(totalXg, k);
    if (line === 0.5) return 1 - poisson(totalXg, 0);
    const cutoff = Math.floor(line);
    let pAtMost = 0;
    for (let k = 0; k <= cutoff; k++) pAtMost += poisson(totalXg, k);
    return 1 - pAtMost;
  }

  function addOverUnder(totalXg) {
    const results = $('results');
    if (!results || !Number.isFinite(totalXg)) return;
    let box = $('overUnderReport');
    if (!box) {
      box = document.createElement('div');
      box.id = 'overUnderReport';
      box.className = 'panel';
      const notes = $('modelNotes')?.closest('.report-grid');
      if (notes) notes.parentNode.insertBefore(box, notes.nextSibling);
      else results.appendChild(box);
    }

    const lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
    const rows = lines.map(line => {
      const over = Math.max(0, Math.min(1, totalOverProbability(totalXg, line)));
      const under = 1 - over;
      const best = over >= under ? `Over ${line}` : `Under ${line}`;
      const bestP = Math.max(over, under);
      return `<div class="ou-row"><div><strong>O/U ${line}</strong><span class="muted">${best} model probability</span></div><div class="ou-values"><span>Over <b>${(over * 100).toFixed(1)}%</b></span><span>Under <b>${(under * 100).toFixed(1)}%</b></span></div><div class="ou-bar"><i style="width:${bestP * 100}%"></i></div></div>`;
    }).join('');

    const strongest = lines.map(line => {
      const over = totalOverProbability(totalXg, line);
      const under = 1 - over;
      return over >= under ? {label:`Over ${line}`, p:over} : {label:`Under ${line}`, p:under};
    }).sort((a,b) => b.p - a.p)[0];

    box.innerHTML = `<div class="panel-head"><div><div class="step-label">GOALS MARKET</div><h3>Over / Under</h3></div><span class="muted">Based on total expected goals ${totalXg.toFixed(2)}</span></div><p class="muted">Model probabilities for common total-goals lines. These are estimates, not guarantees.</p><div class="ou-list">${rows}</div><div class="ou-best"><span>Strongest model total</span><strong>${strongest.label} • ${(strongest.p * 100).toFixed(1)}%</strong></div>`;
  }

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

    const totalXg = parseFloat($('totalXg')?.textContent || '');
    addOverUnder(totalXg);
  }

  const style = document.createElement('style');
  style.textContent = `.ou-list{display:grid;gap:10px}.ou-row{padding:12px 0;border-top:1px solid rgba(255,255,255,.08)}.ou-row>div:first-child{display:flex;justify-content:space-between;gap:12px}.ou-row strong{font-size:15px}.ou-values{display:flex;justify-content:space-between;gap:12px;margin-top:7px;font-size:13px}.ou-bar{height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px}.ou-bar i{display:block;height:100%;background:currentColor}.ou-best{display:flex;justify-content:space-between;gap:12px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1)}`;
  document.head.appendChild(style);

  const observer = new MutationObserver(update);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('load', update);
})();
