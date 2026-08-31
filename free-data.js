/* PredictIQ AI — zero-cost football data layer.
 * Uses TheSportsDB public free endpoint and never fabricates missing results.
 * Daily fixtures keep their team IDs and preserve scheduled matches even when
 * the provider omits strTimestamp and only supplies dateEvent/dateEventLocal.
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
  function eventKickoff(e){
    if(e.strTimestamp){const t=Date.parse(e.strTimestamp);if(Number.isFinite(t))return new Date(t).toISOString();}
    const date=String(e.dateEventLocal||e.dateEvent||'').trim();
    const time=String(e.strTimeLocal||e.strTime||'').trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(date)){
      const candidate=Date.parse(date+'T'+(time||'12:00:00'));
      if(Number.isFinite(candidate))return new Date(candidate).toISOString();
      return date;
    }
    return null;
  }
  function normalizeEvent(e){
    return {id:String(e.idEvent||''),sport:'football',competition:e.strLeague||'Football',home:e.strHomeTeam||'',away:e.strAwayTeam||'',homeTeamId:String(e.idHomeTeam||''),awayTeamId:String(e.idAwayTeam||''),kickoff:eventKickoff(e),kickoffLocal:e.dateEventLocal||e.dateEvent||null,timeLocal:e.strTimeLocal||e.strTime||null,status:e.strStatus||'NS'};
  }
  async function getDailyFixtures(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))throw new Error('Invalid fixture date');
    const data=await json(BASE+'eventsday.php?d='+encodeURIComponent(date)+'&s=Soccer');
    const now=Date.now();
    const blocked=new Set(['FT','AET','PEN','CANC','ABD','AWD','WO','PST']);
    const fixtures=(Array.isArray(data.events)?data.events:[]).map(normalizeEvent).filter(f=>f.home&&f.away&&f.homeTeamId&&f.awayTeamId&&!blocked.has(String(f.status).toUpperCase())).filter(f=>{
      if(!f.kickoff)return true;
      const t=Date.parse(f.kickoff); return !Number.isFinite(t)||t>now;
    });
    return {fixtures,source:'TheSportsDB Free API',date,verified:fixtures.length>0};
  }
  async function recentMatchesById(teamId,teamName='',limit=5){
    const id=String(teamId||'').trim(); if(!id)return null;
    const data=await json(BASE+'eventslast.php?id='+encodeURIComponent(id));
    const events=(data.results||[]).filter(e=>e&&e.intHomeScore!==null&&e.intAwayScore!==null&&Number.isFinite(Number(e.intHomeScore))&&Number.isFinite(Number(e.intAwayScore))).slice(0,limit);
    if(!events.length)return null;
    const rows=events.map(e=>{const home=String(e.idHomeTeam)===id;const gf=Number(home?e.intHomeScore:e.intAwayScore),ga=Number(home?e.intAwayScore:e.intHomeScore);return {date:e.dateEvent||e.strTimestamp||null,opponent:home?e.strAwayTeam:e.strHomeTeam,venue:home?'H':'A',gf,ga,r:gf>ga?'W':gf===ga?'D':'L'};});
    return {team:teamName||'',rows,win:rows.filter(r=>r.r==='W').length,draw:rows.filter(r=>r.r==='D').length,loss:rows.filter(r=>r.r==='L').length,provider:'TheSportsDB Free API',complete:rows.length>=5};
  }
  async function recentMatches(teamName,limit=5){
    const q=String(teamName||'').trim(); if(!q)return null;
    const search=await json(BASE+'searchteams.php?t='+encodeURIComponent(q));
    const teams=Array.isArray(search.teams)?search.teams:[]; if(!teams.length)return null;
    const wanted=q.toLowerCase(); const team=teams.slice().sort((a,b)=>{const aa=String(a.strTeam||'').toLowerCase(),bb=String(b.strTeam||'').toLowerCase();return (aa===wanted?-1:0)-(bb===wanted?-1:0);})[0];
    return team?.idTeam ? recentMatchesById(team.idTeam,team.strTeam||q,limit) : null;
  }
  window.PredictIQFreeData={provider:'TheSportsDB Free API',free:true,cacheMinutes:30,recentMatches,recentMatchesById,getDailyFixtures,clearCache:()=>cache.clear()};
})();