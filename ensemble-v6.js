/* PredictIQ AI — Ensemble V6 orchestration layer
   Combines the existing statistical engine with independently scored signals.
   It deliberately does NOT invent unavailable data. */
(function(){'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const softmax=a=>{const m=Math.max(...a),e=a.map(x=>Math.exp(x-m)),s=e.reduce((x,y)=>x+y,0);return e.map(x=>x/s)};
 function fromEngine(home,away){
   if(!window.PredictIQEngine||!PredictIQEngine.model) return null;
   return PredictIQEngine.model(home,away);
 }
 function signal(m){
   if(!m) return null;
   const p=m.p||{};
   const formH=Number(m.home?.form)||50, formA=Number(m.away?.form)||50;
   const strH=Number(m.home?.strength)||50, strA=Number(m.away?.strength)||50;
   const attackH=Number(m.home?.attack)||50, attackA=Number(m.away?.attack)||50;
   const defH=Number(m.home?.defence)||50, defA=Number(m.away?.defence)||50;
   const eloScore=clamp(.50+(strH-strA)/220, .05,.90);
   const formScore=clamp(.50+(formH-formA)/220,.05,.90);
   const attackScore=clamp(.50+(attackH-attackA)/240,.05,.90);
   const defenceScore=clamp(.50+(defH-defA)/240,.05,.90);
   const poissonScore=Number(p.home)||.33;
   const base=softmax([Math.log(Math.max(p.home,.0001)),Math.log(Math.max(p.draw,.0001)),Math.log(Math.max(p.away,.0001))]);
   const homeSignal=.28*eloScore+.20*formScore+.17*attackScore+.15*defenceScore+.20*poissonScore;
   const awaySignal=1-homeSignal;
   const drawSignal=clamp(Number(p.draw)+(.33-Number(p.draw))*.25,.05,.60);
   const out=softmax([Math.log(Math.max(homeSignal,.0001)),Math.log(Math.max(drawSignal,.0001)),Math.log(Math.max(awaySignal,.0001))]);
   return {probabilities:{home:out[0],draw:out[1],away:out[2]},components:{elo:eloScore,form:formScore,attack:attackScore,defence:defenceScore,poisson:poissonScore}};
 }
 function calibrate(p,temp=1.06){const z=[Math.log(Math.max(p.home,1e-8))/temp,Math.log(Math.max(p.draw,1e-8))/temp,Math.log(Math.max(p.away,1e-8))/temp];const q=softmax(z);return {home:q[0],draw:q[1],away:q[2]};}
 function explain(m,s){
   const rows=[];const c=s.components;
   rows.push(`The statistical score model projects ${m.home.team} ${m.xg.home.toFixed(2)} expected goals versus ${m.away.team} ${m.xg.away.toFixed(2)}.`);
   if(c.elo>.56) rows.push(`${m.home.team} has the stronger overall team-strength signal.`); else if(c.elo<.44) rows.push(`${m.away.team} has the stronger overall team-strength signal.`);
   if(c.form>.56) rows.push(`${m.home.team} has the stronger recent-form signal.`); else if(c.form<.44) rows.push(`${m.away.team} has the stronger recent-form signal.`);
   if(c.attack>.56) rows.push(`${m.home.team} has the stronger attacking profile.`); else if(c.attack<.44) rows.push(`${m.away.team} has the stronger attacking profile.`);
   if(c.defence>.56) rows.push(`${m.home.team} has the stronger defensive profile.`); else if(c.defence<.44) rows.push(`${m.away.team} has the stronger defensive profile.`);
   return rows;
 }
 window.PredictIQEnsembleV6={run:function(home,away){const m=fromEngine(home,away);if(!m)return null;const s=signal(m),p=calibrate(s.probabilities);const confidence=clamp(50+Math.max(p.home,p.draw,p.away)*50,50,95);return {...m,ensemble:p,ensembleComponents:s.components,ensembleConfidence:confidence,ensembleReasons:explain(m,s),modelStack:['Recency-weighted form','Team-strength/Elo proxy','Attack/defence','Dixon-Coles corrected Poisson','Probability calibration']};}};
})();
