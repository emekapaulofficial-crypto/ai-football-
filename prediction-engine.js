/* PredictIQ AI — Prediction Engine v2
 * Deterministic statistical layer. It never claims a prediction is guaranteed.
 * Inputs: verified recent team form + bookmaker markets.
 */
(function () {
  'use strict';

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const RECENCY = [0.30, 0.24, 0.20, 0.15, 0.11];

  function poisson(lambda, k) {
    let p = Math.exp(-lambda);
    for (let i = 1; i <= k; i++) p *= lambda / i;
    return p;
  }

  function weightedAverage(values) {
    const usable = values.slice(0, 5);
    let total = 0, weight = 0;
    usable.forEach((v, i) => { total += v * (RECENCY[i] || 0); weight += RECENCY[i] || 0; });
    return weight ? total / weight : 0;
  }

  function enrichTeam(team, side) {
    const rows = (team.rows || []).slice(0, 5);
    const scored = weightedAverage(rows.map(r => Number(r.gf) || 0));
    const conceded = weightedAverage(rows.map(r => Number(r.ga) || 0));
    const points = weightedAverage(rows.map(r => r.result === 'W' ? 3 : r.result === 'D' ? 1 : 0));
    const scoredRate = rows.length ? rows.filter(r => r.gf > 0).length / rows.length : 0;
    const cleanRate = rows.length ? rows.filter(r => r.ga === 0).length / rows.length : 0;

    return {
      ...team,
      side,
      weightedScored: scored,
      weightedConceded: conceded,
      pointsPerMatch: points,
      scoringRate: scoredRate,
      cleanRate,
      attack: clamp(50 + scored * 22 + scoredRate * 12, 20, 95),
      defence: clamp(92 - conceded * 25 + cleanRate * 8, 20, 95),
      form: clamp((points / 3) * 100, 0, 100),
      dataQuality: rows.length >= 5 ? 1 : rows.length / 5
    };
  }

  function expectedGoals(home, away) {
    // Blend each team's recent attack with the opponent's recent concession rate.
    // Home advantage is deliberately modest and is not allowed to dominate the data.
    const homeBase = home.weightedScored * 0.62 + away.weightedConceded * 0.38;
    const awayBase = away.weightedScored * 0.62 + home.weightedConceded * 0.38;
    const formAdjHome = 0.92 + (home.form - away.form) / 100 * 0.12;
    const formAdjAway = 0.92 + (away.form - home.form) / 100 * 0.08;
    const homeAdvantage = 1.08;
    return {
      home: clamp(homeBase * homeAdvantage * formAdjHome, 0.15, 4.2),
      away: clamp(awayBase * formAdjAway, 0.10, 3.8)
    };
  }

  function scoreMatrix(hx, ax, maxGoals = 10) {
    const cells = [];
    let total = 0;
    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const p = poisson(hx, h) * poisson(ax, a);
        cells.push({ home: h, away: a, total: h + a, p });
        total += p;
      }
    }
    cells.forEach(c => { c.p /= total; });
    return cells;
  }

  function fromMatrix(cells, predicate) {
    return cells.filter(predicate).reduce((sum, c) => sum + c.p, 0);
  }

  function markets(cells) {
    const result = { result: {}, totals: {}, btts: {} };
    result.result.home = fromMatrix(cells, c => c.home > c.away);
    result.result.draw = fromMatrix(cells, c => c.home === c.away);
    result.result.away = fromMatrix(cells, c => c.home < c.away);

    [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].forEach(line => {
      result.totals[line] = {
        over: fromMatrix(cells, c => c.total > line),
        under: fromMatrix(cells, c => c.total < line)
      };
    });
    result.btts.yes = fromMatrix(cells, c => c.home > 0 && c.away > 0);
    result.btts.no = 1 - result.btts.yes;
    result.doubleChance = {
      '1X': result.result.home + result.result.draw,
      'X2': result.result.draw + result.result.away,
      '12': result.result.home + result.result.away
    };
    result.correctScores = cells.slice().sort((a, b) => b.p - a.p).slice(0, 5);
    return result;
  }

  function model(homeRaw, awayRaw) {
    const home = enrichTeam(homeRaw, 'home');
    const away = enrichTeam(awayRaw, 'away');
    const xg = expectedGoals(home, away);
    const cells = scoreMatrix(xg.home, xg.away);
    const m = markets(cells);
    const dataConfidence = Math.round(((home.dataQuality + away.dataQuality) / 2) * 100);

    return {
      home, away,
      xg: { home: xg.home, away: xg.away, total: xg.home + xg.away },
      p: m.result,
      ou: m.totals,
      btts: m.btts,
      doubleChance: m.doubleChance,
      correctScores: m.correctScores,
      dataConfidence,
      method: 'Weighted recent form + attack/defence + home advantage + Poisson score distribution'
    };
  }

  function probabilityForMarket(o, m) {
    const market = String(o.market || '').toLowerCase();
    const sel = String(o.sel || '').toLowerCase();
    if (market === '1x2') return sel === 'home' ? m.p.home : sel === 'draw' ? m.p.draw : sel === 'away' ? m.p.away : null;
    if (market === 'over/under' || market === 'asian over/under' || market === 'early goals') {
      const q = m.ou[o.line];
      if (!q) return null;
      return sel === 'over' ? q.over : sel === 'under' ? q.under : null;
    }
    if (market === 'double chance') {
      const key = String(o.sel || '').replace(/\s+/g, '').toUpperCase();
      return m.doubleChance[key] ?? null;
    }
    if (market === 'btts' || market === 'both teams to score') {
      return /yes/i.test(o.sel) ? m.btts.yes : /no/i.test(o.sel) ? m.btts.no : null;
    }
    return null;
  }

  function rankMarkets(odds, m) {
    return odds.map(o => {
      const p = probabilityForMarket(o, m);
      if (p == null || !Number.isFinite(o.odd) || o.odd <= 1) return null;
      const implied = 1 / o.odd;
      const edge = p - implied;
      // Safety rewards probability; value and data quality prevent a low-price market
      // from automatically winning solely because its raw probability is high.
      const safety = p * 100;
      const value = clamp(50 + edge * 500, 0, 100);
      const confidence = m.dataConfidence;
      const score = safety * 0.55 + value * 0.25 + confidence * 0.20;
      const qualifying = p >= 0.70 && confidence >= 60 && edge >= -0.06;
      return {
        ...o, probability: p, implied, edge, safety, value, confidence, score, qualifying
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  }

  function analyze(odds, home, away) {
    const m = model(home, away);
    const ranked = rankMarkets(odds, m);
    const qualifying = ranked.filter(x => x.qualifying).slice(0, 3);
    return { ...m, ranked, top3: qualifying, noBet: qualifying.length === 0 };
  }

  window.PredictIQEngine = { model, analyze, rankMarkets, probabilityForMarket };
})();
