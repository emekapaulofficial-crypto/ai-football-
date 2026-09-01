/* PredictIQ calibration engine v1
 * Tracks pre-match probability vectors and scores them after results are known.
 * Metrics: accuracy, Brier, log-loss, RPS and calibration error.
 */
(function(){'use strict';
const KEY='predictiq_prediction_history_v1';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){return[]}}
function save(a){try{localStorage.setItem(KEY,JSON.stringify(a.slice(-2000)))}catch(e){}}
function record(pred){if(!pred||!pred.probs)return null;const x={id:Date.now()+'-'+Math.random().toString(36).slice(2),date:new Date().toISOString(),home:pred.home,away:pred.away,probs:{home:+pred.probs.home,draw:+pred.probs.draw,away:+pred.probs.away},xg:pred.xg||null,engines:pred.engines||null,result:null};const a=load();a.push(x);save(a);return x}
function outcome(r){if(typeof r==='string')return r.toLowerCase();if(!r)return null;if(r.home>r.away)return'home';if(r.home<r.away)return'away';return'draw'}
function settle(id,r){const a=load(),i=a.findIndex(x=>x.id===id);if(i<0)return false;a[i].result=outcome(r);a[i].finalScore=r;save(a);return true}
function score(){const a=load().filter(x=>x.result&&x.probs),n=a.length;if(!n)return{n:0,accuracy:null,brier:null,logLoss:null,rps:null,ece:null};let acc=0,b=0,ll=0,rps=0;const bins=Array.from({length:10},()=>({p:0,y:0,n:0}));for(const x of a){const keys=['home','draw','away'],y=keys.map(k=>x.result===k?1:0),p=keys.map(k=>clamp(+x.probs[k],1e-9,1-1e-9));const mx=Math.max(...p);if(keys[p.indexOf(mx)]===x.result)acc++;b+=p.reduce((s,v,i)=>s+(v-y[i])**2,0);ll-=Math.log(p[keys.indexOf(x.result)]);let cp=0,cy=0;for(let i=0;i<2;i++){cp+=p[i];cy+=y[i];rps+=(cp-cy)**2}const bin=Math.min(9,Math.floor(mx*10));bins[bin].p+=mx;bins[bin].y+=keys[p.indexOf(mx)]===x.result?1:0;bins[bin].n++}let ece=0;bins.forEach(z=>{if(z.n){const mp=z.p/z.n,my=z.y/z.n;ece+=z.n/n*Math.abs(mp-my)}});return{n,accuracy:acc/n,brier:b/n,logLoss:ll/n,rps:rps/n,ece}}
function engineWeights(){const s=score();if(!s.n)return{statistical:1,elo:1,ml:1,context:1};const q=1/(1+s.logLoss+s.brier+s.ece);return{statistical:q,elo:q,ml:q,context:q}}
window.PredictIQCalibration={record,settle,score,history:load,engineWeights};
})();
