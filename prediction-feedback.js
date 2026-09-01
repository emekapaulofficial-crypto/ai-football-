/* PredictIQ — automatic post-match feedback loop
 * Stores locked predictions, scores them after results, and exposes rolling model metrics.
 * Browser-safe/localStorage implementation; a server-side job can later replace the result fetcher.
 */
(function(){'use strict';
const KEY='predictiq_prediction_history_v1';
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
const save=x=>localStorage.setItem(KEY,JSON.stringify(x.slice(-5000)));
const brier=(p,y)=>{const v=p.home-(y==='home'?1:0),d=p.draw-(y==='draw'?1:0),a=p.away-(y==='away'?1:0);return v*v+d*d+a*a};
const logloss=(p,y)=>-Math.log(Math.max(1e-6,p[y]));
function lock(pred){const h=load();const id=pred.id||`${pred.home}|${pred.away}|${pred.kickoff||Date.now()}`;if(h.some(x=>x.id===id))return id;h.push({...pred,id,status:'locked',createdAt:new Date().toISOString()});save(h);return id}
function settle(id,result){const h=load(),i=h.findIndex(x=>x.id===id);if(i<0)return null;const x=h[i];const y=result==='H'?'home':result==='D'?'draw':'away';x.actual=y;x.actualScore=result;x.status='settled';x.settledAt=new Date().toISOString();x.correct=x.p[y]>=Math.max(x.p.home,x.p.draw,x.p.away);x.brier=brier(x.p,y);x.logLoss=logloss(x.p,y);save(h);return x}
function metrics(){const a=load().filter(x=>x.status==='settled'&&x.p&&x.actual);if(!a.length)return{count:0};const avg=k=>a.reduce((s,x)=>s+(Number(x[k])||0),0)/a.length;return{count:a.length,accuracy:a.filter(x=>x.correct).length/a.length,brier:avg('brier'),logLoss:avg('logLoss')};}
function weights(){const h=load().filter(x=>x.status==='settled'&&x.engineScores);if(h.length<20)return null;const sums={};for(const x of h)for(const [k,v] of Object.entries(x.engineScores))sums[k]=(sums[k]||[]).concat(Number(v));const raw={};for(const [k,v] of Object.entries(sums)){const m=v.reduce((a,b)=>a+b,0)/v.length;raw[k]=1/Math.max(.01,m)}const z=Object.values(raw).reduce((a,b)=>a+b,0);return Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v/z]));}
window.PredictIQFeedback={lockPrediction:lock,settlePrediction:settle,getHistory:load,getMetrics:metrics,getAdaptiveWeights:weights};
})();
