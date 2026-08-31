/* PredictIQ AI — zero-cost football data layer.
 * Uses TheSportsDB public free endpoint and never fabricates missing results.
 */
(function(){
  'use strict';
  const BASE='https://www.thesportsdb.com/api/v1/json/123/';
  const TTL=30*60*1000, cache=new Map();
  async function json(url){
    const hit=cache.get(url); if(hit&&Date.now()-hit.time<TTL)return hit.value;
    const r=await fetch(url,{headers:{Accept:'application/json'}}); if(!r.ok)throw new Error('Free football data unavailable');
    const v=await r.json(); cache.set(url,{time:Date.now(),value:v}); return v;
  }
  function normalizeEvent(e){
    const utc=e.strTimestamp||e.dateEvent||null;
    return {id:String(e.idEvent||''),sport:'football',competition:e.strLeague||'Football',home:e.strHomeTeam||'',away:e.strAwayTeam||'',kickoff:utc,status:'SCHEDULED'};
  }
  async function getDailyFixtures(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))throw new Error('Invalid fixture date');
    const data=await json(BASE+'eventsday.php?d='+encodeURIComponent(date)+'&s=Soccer');
    const now=Date.now();
    const fixtures=(Array.isArray(data.events)?data.events:[]).map(normalizeEvent).filter(f=>f.home&&f.away&&f.kickoff&&Date.parse(f.kickoff)>now);
    return {fixtures,source:'TheSportsDB Free API',date,verified:fixtures.length>0};
  }
  async function recentMatches(teamName,limit=5){
    const q=String(teamName||'').trim(); if(!q)return null;
    const search=await json(BASE+'searchteams.php?t='+encodeURIComponent(q));
    const teams=Array.isArray(search.teams)?search.teams:[]; if(!teams.length)return null;
    const wanted=q.toLowerCase();
    const team=teams.slice().sort((a,b)=>{
      const aa=String(a.strTeam||'').toLowerCase(),bb=String(b.strTeam||'').toLowerCase();
      return (aa===wanted?-1:0)-(bb===wanted?-1:0);
    })[0];
    if(!team?.idTeam)return null;
    const data=await json(BASE+'eventslast.php?id='+encodeURIComponent(team.idTeam));
    const events=(data.results||[]).filter(e=>e&&e.intHomeScore!==null&&e.intAwayScore!==null&&Number.isFinite(Number(e.intHomeScore))&&Number.isFinite(Number(e.intAwayScore))).slice(0,limit);
    if(!events.length)return null;
    const rows=events.map(e=>{
      const home=String(e.idHomeTeam)===String(team.idTeam)||String(e.strHomeTeam||'').toLowerCase()===String(team.strTeam||'').toLowerCase();
      const gf=Number(home?e.intHomeScore:e.intAwayScore),ga=Number(home?e.intAwayScore:e.intHomeScore);
      return {date:e.dateEvent||e.strTimestamp||null,opponent:home?e.strAwayTeam:e.strHomeTeam,venue:home?'H':'A',gf,ga,r:gf>ga?'W':gf===ga?'D':'L'};
    });
    return {team:team.strTeam,rows,win:rows.filter(r=>r.r==='W').length,draw:rows.filter(r=>r.r==='D').length,loss:rows.filter(r=>r.r==='L').length,provider:'TheSportsDB Free API',complete:rows.length>=5};
  }
  window.PredictIQFreeData={provider:'TheSportsDB Free API',free:true,cacheMinutes:30,recentMatches,getDailyFixtures,clearCache:()=>cache.clear()};
})();
