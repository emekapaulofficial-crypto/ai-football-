/* PredictIQ — leakage-safe walk-forward backtest helpers */
(function(){'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function brier(p,y){return ['home','draw','away'].reduce((s,k)=>s+Math.pow((p[k]||0)-(y===k?1:0),2),0)}
  function logLoss(p,y){return -Math.log(clamp(Number(p[y]||0),1e-9,1))}
  function rps(p,y){const order=['home','draw','away'];const yi=order.indexOf(y);let ps=0,ys=0,s=0;for(let i=0;i<2;i++){ps+=(p[order[i]]||0);ys+=i>=yi?0:1;s+=Math.pow(ps-ys,2)}return s}
  function ece(rows,bins=10){const b=Array.from({length:bins},()=>({n:0,p:0,y:0}));rows.forEach(r=>{const p=clamp(Number(r.probability)||0,0,1),i=Math.min(bins-1,Math.floor(p*bins));b[i].n++;b[i].p+=p;b[i].y+=r.hit?1:0});return b.reduce((s,x)=>s+(x.n?x.n/rows.length*Math.abs(x.p/x.n-x.y/x.n):0),0)}
  function score(rows){if(!rows.length)return {matches:0};const valid=rows.filter(r=>r.actual&&r.probabilities);const acc=valid.filter(r=>r.prediction===r.actual).length/valid.length;return {matches:valid.length,accuracy:acc,brier:valid.reduce((s,r)=>s+brier(r.probabilities,r.actual),0)/valid.length,logLoss:valid.reduce((s,r)=>s+logLoss(r.probabilities,r.actual),0)/valid.length,rps:valid.reduce((s,r)=>s+rps(r.probabilities,r.actual),0)/valid.length,ece:ece(valid.map(r=>({probability:r.probabilities[r.prediction]||0,hit:r.prediction===r.actual})))}}
  function reliability(rows,bins=10){const out=[];for(let i=0;i<bins;i++){const lo=i/bins,hi=(i+1)/bins,a=rows.filter(r=>{const p=Number(r.probability)||0;return p>=lo&&(i===bins-1?p<=hi:p<hi)});out.push({from:lo,to:hi,count:a.length,predicted:a.length?a.reduce((s,r)=>s+r.probability,0)/a.length:0,observed:a.length?a.filter(r=>r.hit).length/a.length:0})}return out}
  window.PredictIQBacktest={brier,logLoss,rps,ece,score,reliability};
})();
