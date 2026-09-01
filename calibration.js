/* PredictIQ AI — probability calibration + rolling model score tracker
 * Uses only predictions already recorded before a result. No look-ahead.
 */
(function(){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function logLoss(p,y){return -Math.log(clamp(Number(p[y]||0),1e-6,1));}
function brier(p,y){return ['home','draw','away'].reduce((s,k)=>s+Math.pow(Number(p[k]||0)-(k===y?1:0),2),0)/3;}
function rps(p,y){const keys=['home','draw','away'];const target=keys.indexOf(y);let cumP=0,cumY=0,s=0;for(let i=0;i<2;i++){cumP+=Number(p[keys[i]]||0);cumY+=i>=target?0:1;s+=Math.pow(cumP-cumY,2);}return s/2;}
function outcomeFromScore(h,a){return h>a?'home':h===a?'draw':'away';}
function record(store,prediction,result){if(!store||!prediction)return;const y=outcomeFromScore(Number(result.homeGoals),Number(result.awayGoals));store.push({timestamp:Date.now(),prediction:{home:Number(prediction.home||0),draw:Number(prediction.draw||0),away:Number(prediction.away||0)},actual:y,score:{home:Number(result.homeGoals),away:Number(result.awayGoals)}});if(store.length>500)store.splice(0,store.length-500);}
function metrics(store){const a=Array.isArray(store)?store:[];if(!a.length)return{n:0,accuracy:null,logLoss:null,brier:null,rps:null,calibration:null};let acc=0,ll=0,br=0,rp=0;const bins=Array.from({length:10},()=>({n:0,sumP:0,sumY:0}));a.forEach(x=>{const p=x.prediction,y=x.actual;const best=['home','draw','away'].sort((u,v)=>p[v]-p[u])[0];if(best===y)acc++;ll+=logLoss(p,y);br+=brier(p,y);rp+=rps(p,y);const q=Math.max(p.home,p.draw,p.away),bin=Math.min(9,Math.floor(q*10)),hit=best===y?1:0;bins[bin].n++;bins[bin].sumP+=q;bins[bin].sumY+=hit;});let ece=0;bins.forEach(b=>{if(b.n)ece+=b.n/a.length*Math.abs(b.sumP/b.n-b.sumY/b.n);});return{n:a.length,accuracy:acc/a.length,logLoss:ll/a.length,brier:br/a.length,rps:rp/a.length,calibration:ece};}
function adaptiveWeights(history){const m=history||{};const score=k=>{const x=m[k];return x&&Number.isFinite(x.logLoss)?x.logLoss:1.1};const raw={stat:1/score('stat'),elo:1/score('elo'),ml:1/score('ml'),market:1/score('market')};const z=Object.values(raw).reduce((a,b)=>a+b,0)||1;return Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v/z]));}
window.PredictIQCalibration={logLoss,brier,rps,record,metrics,adaptiveWeights};
})();
