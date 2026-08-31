/* PredictIQ Daily Picks — date/time-safe orchestration layer.
   This module deliberately does not invent fixtures, odds, injuries or results.
   A connected fixture/data provider must supply verified upcoming matches. */
(function(){
  'use strict';
  const DAY_MS=86400000;
  function localDayKey(date=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
  function normalizeFixture(f,timeZone){
    const kickoff=new Date(f.kickoff);
    if(!f.id||Number.isNaN(kickoff.getTime())||!f.home||!f.away)return null;
    return {...f,kickoff: kickoff.toISOString(),dateKey:localDayKey(kickoff,timeZone)};
  }
  function isUpcomingToday(f,now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){
    const n=normalizeFixture(f,timeZone); if(!n)return false;
    const t=new Date(n.kickoff).getTime();
    return n.dateKey===localDayKey(now,timeZone)&&t>now.getTime()&&t-now.getTime()<=DAY_MS;
  }
  function explainPick(p){
    const reasons=[];
    if(p.form)reasons.push(`Recent form supports the selection (${p.form}).`);
    if(p.attack!=null&&p.defence!=null)reasons.push(`Attack/defence indicators are favorable (${p.attack}/100 attack, ${p.defence}/100 defence).`);
    if(p.xg!=null)reasons.push(`Expected-goals estimate is ${Number(p.xg).toFixed(2)}.`);
    if(p.edge!=null)reasons.push(`The model estimates a ${(Number(p.edge)*100).toFixed(1)} percentage-point edge versus the market.`);
    if(p.dataConfidence!=null)reasons.push(`Data confidence is ${Number(p.dataConfidence).toFixed(0)}%.`);
    return reasons.length?reasons:['The model selected this market after comparing the available verified evidence.'];
  }
  function rank(candidates){
    return candidates.filter(x=>x&&x.probability!=null&&x.confidence!=null&&x.odd>1).sort((a,b)=>(b.probability*b.confidence)-(a.probability*a.confidence)).map((x,i)=>({...x,rank:i+1,reasons:explainPick(x)}));
  }
  window.PredictIQDaily={localDayKey,normalizeFixture,isUpcomingToday,rank,explainPick};
})();
