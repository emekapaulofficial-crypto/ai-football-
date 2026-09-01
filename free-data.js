/* PredictIQ AI — zero-cost football data layer.
 * Uses TheSportsDB first, with a public ESPN scoreboard fallback when the
 * free provider returns no fixtures or is unavailable. No credentials.
 */
(function(){
  'use strict';
  const BASE='https://www.thesportsdb.com/api/v1/json/123/';
  const TTL=30*60*1000, cache=new Map();
  async function json(url){
    const hit=cache.get(url); if(hit&&Date.now()-hit.time<TTL)return hit.value;
    const r=await fetch(url,{headers:{Accept:'application/json'}}); if(!r.ok)throw new Error('Provider returned '+r.status);
    const v=await r.json(); cache.set(url,{time:Date.now(),value:v}); return v;
  }
  function eventKickoff(e){
    if(e.strTimestamp){const t=Date.parse(e.strTimestamp);if(Number.isFinite(t))return new Date(t).toISOString();}
    const date=String(e.dateEventLocal||e.dateEvent||'').trim(),time=String(e.strTimeLocal||e.strTime||'').trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(date)){const candidate=Date.parse(date+'T'+(time||'12:00:00'));if(Number.isFinite(candidate))return new Date(candidate).toISOString();return date;}
    return null;
  }
  function normalizeEvent(e){return {id:String(e.idEvent||''),sport:'football',competition:e.strLeague||'Football',home:e.strHomeTeam||'',away:e.strAwayTeam||'',homeTeamId:String(e.idHomeTeam||''),awayTeamId:String(e.idAwayTeam||''),kickoff:eventKickoff(e),kickoffLocal:e.dateEventLocal||e.dateEvent||null,timeLocal:e.strTimeLocal||e.strTime||null,status:e.strStatus||'NS'};}
  async function sportsDbFixtures(date){
    const data=await json(BASE+'eventsday.php?d='+encodeURIComponent(date)+'&s=Soccer');
    const now=Date.now(),blocked=new Set(['FT','AET','PEN','CANC','ABD','AWD','WO','PST']);
    return (Array.isArray(data.events)?data.events:[]).map(normalizeEvent).filter(f=>f.home&&f.away&&!blocked.has(String(f.status).toUpperCase())).filter(f=>{if(!f.kickoff)return true;const t=Date.parse(f.kickoff);return !Number.isFinite(t)||t>now;});
  }
  async function espnFixtures(date){
    const leagues=['eng.1','esp.1','ger.1','ita.1','fra.1','ned.1','por.1','tur.1','usa.1','mex.1'];
    const ymd=String(date).replaceAll('-','');
    const all=[];
    for(const league of leagues){
      try{
        const data=await json('https://site.api.espn.com/apis/site/v2/sports/soccer/'+league+'/scoreboard?dates='+ymd);
        for(const e of (data.events||[])){
          const c=e.competitions?.[0],teams=c?.competitors||[];const home=teams.find(t=>t.homeAway==='home'),away=teams.find(t=>t.homeAway==='away');
          if(!home||!away)continue;
          const kickoff=e.date||c.date; if(kickoff&&Date.parse(kickoff)<=Date.now())continue;
          all.push({id:'espn-'+String(e.id),sport:'football',competition:data.leagues?.[0]?.name||league,home:home.team?.displayName||home.team?.name||'',away:away.team?.displayName||away.team?.name||'',homeTeamId:'',awayTeamId:'',kickoff:kickoff||null,kickoffLocal:null,timeLocal:null,status:e.status?.type?.shortDetail||'Scheduled',provider:'ESPN'});
        }
      }catch(_){/* continue with other leagues */}
    }
    const seen=new Set();return all.filter(f=>f.home&&f.away&&!seen.has(f.home+'|'+f.away)&&seen.add(f.home+'|'+f.away));
  }
  async function getDailyFixtures(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))throw new Error('Invalid fixture date');
    let first=[];try{first=await sportsDbFixtures(date);}catch(_){first=[];}
    if(first.length)return {fixtures:first,source:'TheSportsDB Free API',date,verified:true};
    const fallback=await espnFixtures(date);
    return {fixtures:fallback,source:fallback.length?'ESPN public scoreboard fallback':'No public fixture provider returned matches',date,verified:fallback.length>0};
  }
  async function recentMatchesById(teamId,teamName='',limit=5){
    const id=String(teamId||'').trim();if(!id)return null;
    const data=await json(BASE+'eventslast.php?id='+encodeURIComponent(id));
    const events=(data.results||[]).filter(e=>e&&e.intHomeScore!==null&&e.intAwayScore!==null&&Number.isFinite(Number(e.intHomeScore))&&Number.isFinite(Number(e.intAwayScore))).slice(0,limit);
    if(!events.length)return null;
    const rows=events.map(e=>{const home=String(e.idHomeTeam)===id,gf=Number(home?e.intHomeScore:e.intAwayScore),ga=Number(home?e.intAwayScore:e.intHomeScore);return {date:e.dateEvent||e.strTimestamp||null,opponent:home?e.strAwayTeam:e.strHomeTeam,venue:home?'H':'A',gf,ga,r:gf>ga?'W':gf===ga?'D':'L'};});
    return {team:teamName||'',rows,win:rows.filter(r=>r.r==='W').length,draw:rows.filter(r=>r.r==='D').length,loss:rows.filter(r=>r.r==='L').length,provider:'TheSportsDB Free API',complete:rows.length>=5};
  }
  async function recentMatches(teamName,limit=5){
    const q=String(teamName||'').trim();if(!q)return null;const search=await json(BASE+'searchteams.php?t='+encodeURIComponent(q));const teams=Array.isArray(search.teams)?search.teams:[];if(!teams.length)return null;const wanted=q.toLowerCase();const team=teams.slice().sort((a,b)=>{const aa=String(a.strTeam||'').toLowerCase(),bb=String(b.strTeam||'').toLowerCase();return (aa===wanted?-1:0)-(bb===wanted?-1:0);})[0];return team?.idTeam?recentMatchesById(team.idTeam,team.strTeam||q,limit):null;
  }
  window.PredictIQFreeData={provider:'TheSportsDB Free API + ESPN fallback',free:true,cacheMinutes:30,recentMatches,recentMatchesById,getDailyFixtures,clearCache:()=>cache.clear()};
})();