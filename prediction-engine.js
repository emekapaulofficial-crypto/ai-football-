/* PredictIQ AI — Prediction Engine v4
 * Statistical layer: recent form + attack/defence + home advantage + Poisson scores.
 * Probabilities are estimates, never guarantees.
 */
(function () {
  'use strict';
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const W = [0.30, 0.24, 0.20, 0.15, 0.11];

  function weighted(values) {
    let s = 0, w = 0;
    values.slice(0, 5).forEach((v, i) => { const n = Number(v); if (Number.isFinite(n)) { s += n * W[i]; w += W[i]; } });
    return w ? s / w : 0;
  }
  function poisson(lambda, k) { let p = Math.exp(-lambda); for (let i = 1; i <= k; i++) p *= lambda / i; return p; }
  function matrix(hx, ax, max = 10) {
    const cells = []; let total = 0;
    for (let h = 0; h <= max; h++) for (let a = 0; a <= max; a++) { const p = poisson(hx,h)*poisson(ax,a); cells.push({home:h,away:a,total:h+a,p}); total += p; }
    cells.forEach(c => c.p /= total); return cells;
  }
  const sum = (cells, fn) => cells.reduce((s,c) => s + (fn(c) ? c.p : 0), 0);

  function enrich(team, side) {
    const rows = Array.isArray(team?.rows) ? team.rows.slice(0,5) : [];
    const gf = weighted(rows.map(r => r.gf));
    const ga = weighted(rows.map(r => r.ga));
    const points = weighted(rows.map(r => r.r === 'W' || r.result === 'W' ? 3 : r.r === 'D' || r.result === 'D' ? 1 : 0));
    const scoring = rows.length ? rows.filter(r => Number(r.gf) > 0).length / rows.length : 0;
    const clean = rows.length ? rows.filter(r => Number(r.ga) === 0).length / rows.length : 0;
    return { ...team, side, weightedScored: gf, weightedConceded: ga, attack: clamp(50 + gf*22 + scoring*12,20,95), defence: clamp(92-ga*25+clean*8,20,95), form: clamp(points/3*100,0,100), dataQuality: rows.length/5 };
  }

  function model(homeRaw, awayRaw) {
    const home = enrich(homeRaw,'home'), away = enrich(awayRaw,'away');
    const homeBase = home.weightedScored*.62 + away.weightedConceded*.38;
    const awayBase = away.weightedScored*.62 + home.weightedConceded*.38;
    const hx = clamp(homeBase * 1.08 * (0.92 + (home.form-away.form)/100*.12), .15, 4.2);
    const ax = clamp(awayBase * (0.92 + (away.form-home.form)/100*.08), .10, 3.8);
    const cells = matrix(hx,ax);
    const result = { home:sum(cells,c=>c.home>c.away), draw:sum(cells,c=>c.home===c.away), away:sum(cells,c=>c.home<c.away) };
    const ou = {};
    [.5,1.5,2.5,3.5,4.5,5.5].forEach(l => { ou[l] = {over:sum(cells,c=>c.total>l),under:sum(cells,c=>c.total<l)}; });
    const asianTotals = {};
    [1,2,3,4,5,6].forEach(l => { asianTotals[l] = {overWin:sum(cells,c=>c.total>l),underWin:sum(cells,c=>c.total<l),push:sum(cells,c=>c.total===l)}; });
    const bttsYes = sum(cells,c=>c.home>0&&c.away>0);
    const doubleChance = {'1X':result.home+result.draw,'12':result.home+result.away,'X2':result.draw+result.away};
    const correctScores = cells.slice().sort((a,b)=>b.p-a.p).slice(0,5);
    const dataConfidence = Math.round(clamp((home.dataQuality+away.dataQuality)/2*100,0,100));
    return {home,away,xg:{home:hx,away:ax,total:hx+ax},p:result,ou,asianTotals,btts:{yes:bttsYes,no:1-bttsYes},doubleChance,correctScores,dataConfidence,method:'Weighted recent form + attack/defence + home advantage + Poisson score distribution'};
  }

  function probability(o,m) {
    const market=String(o.market||'').toLowerCase().trim(), sel=String(o.sel||'').toLowerCase().trim();
    if (market==='1x2') return sel==='home'?m.p.home:sel==='draw'?m.p.draw:sel==='away'?m.p.away:null;
    if (['over/under','early goals','match goals','team goals'].includes(market)) { const q=m.ou[Number(o.line)]; return q ? (sel==='over'?q.over:sel==='under'?q.under:null) : null; }
    if (market==='asian over/under') { const q=m.asianTotals[Number(o.line)]; return q ? (sel==='over'?q.overWin:sel==='under'?q.underWin:null) : null; }
    if (market==='double chance') return m.doubleChance[String(o.sel||'').replace(/\s/g,'').toUpperCase()] ?? null;
    if (market==='btts') return /yes|gg/i.test(sel)?m.btts.yes:/no|ng/i.test(sel)?m.btts.no:null;
    return null;
  }

  function rankMarkets(odds,m) {
    return (odds||[]).map(o=>{
      const p=probability(o,m), odd=Number(o.odd);
      if(p==null||!Number.isFinite(odd)||odd<=1)return null;
      const implied=1/odd, edge=p-implied, safety=p*100, value=clamp(50+edge*500,0,100), confidence=m.dataConfidence;
      const score=safety*.55+value*.25+confidence*.20;
      return {...o,odd,probability:p,implied,edge,safety,value,confidence,score,qualifying:p>=.70&&confidence>=60&&edge>=-.06};
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
  }

  function analyze(odds, homeRaw, awayRaw) {
    const m=model(homeRaw,awayRaw), ranked=rankMarkets(odds,m), top3=ranked.filter(x=>x.qualifying).slice(0,3);
    return {...m,ranked,top3,noBet:top3.length===0};
  }

  window.PredictIQEngine = { model, analyze, rankMarkets, probability };
})();
