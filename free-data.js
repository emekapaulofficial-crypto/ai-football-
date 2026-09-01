/* PredictIQ AI — zero-cost football data layer.
 * Uses TheSportsDB first, with a broad ESPN public scoreboard fallback.
 * No credentials. Never invents or infers fixtures.
 */
(function(){
  'use strict';
  const BASE='https://www.thesportsdb.com/api/v1/json/123/';
  const TTL=30*60*1000, cache=new Map();
  const ESPN_LEAGUES=[
    'eng.1','eng.2','eng.3','eng.4','eng.5','esp.1','esp.2','esp.3',
    'ger.1','ger.2','ita.1','ita.2','fra.1','fra.2','ned.1','bel.1',
    'por.1','tur.1','sco.1','sco.2','gre.1','aut.1','sui.1','den.1',
    'nor.1','swe.1','usa.1','mex.1','bra.1','bra.2','arg.1','col.1',
    'ecu.1','per.1','chi.1','par.1','uru.1','jpn.1','kor.1','aus.1',
    'chn.1','ind.1','nga.1','rsa.1','uefa.champions','uefa.europa',
    'uefa.europa.conf','caf.champions'
  ];
  async function json(url){
    const hit=cache.get(url); if(hit&&Date.now()-hit.time<TTL)return hit.value;
    const r=await fetch(url,{headers:{Accept:'application/json'}}); if(!r.ok)throw new Error('Provider returned '+r.status);
    const v=await r.json(); cache.set(url,{time:Date.now(),value:v}); return v;
  }
  function localDateFromInstant(value){
    if(!value)return null;
    const t=Date.parse(value); if(!Number.isFinite(t))return null;
    return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
  }
  function eventKickoff(e){
    if(e.strTimestamp){const t=Date.parse(e.strTimestamp);if(Number.isFinite(t))return new Date(t).toISOString();}
    const date=String(e.dateEventLocal||e.dateEvent||'').trim(),time=String(e.strTimeLocal||e.strTime||'').trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(date)){const candidate=Date.parse(date+'T'+(time||'12:00:00'));if(Number.isFinite(candidate))return new Date(candidate).toISOString();return date;}
    return null;
  }
  function sameRequestedDate(value,date){return !!value&&String(value).slice(0,10)===date;}
  function normalizeEvent(e,provider,date){return {id:String(e.idEvent||''),sport:'football',competition:e.strLeague||'Football',home:e.strHomeTeam||'',away:e.strAwayTeam||'',homeTeamId:String(e.idHomeTeam||''),awayTeamId:String(e.idAwayTeam||''),kickoff:eventKickoff(e),kickoffLocal:e.dateEventLocal||e.dateEvent||null,timeLocal:e.strTimeLocal||e.strTime||null,status:e.strStatus||'NS',provider};}
  function validateFixture(f,date){
    if(!f||!f.id||!f.home||!f.away||!f.provider)return false;
    if(!sameRequestedDate(f.kickoffLocal||f.kickoff,date))return false;
    const blocked=new Set(['FT','AET','PEN','CANC','ABD','AWD','WO','PST','POSTPONED','FINAL','FINAL/OT']);
    if(blocked.has(String(f.status).toUpperCase()))return false;
    if(f.kickoff){const t=Date.parse(f.kickoff);if(Number.isFinite(t)&&t<=Date.now())return false;}
    return true;
  }
  async function sportsDbFixtures(date){
    const data=await json(BASE+'eventsday.php?d='+encodeURIComponent(date)+'&s=Soccer');
    return (Array.isArray(data.events)?data.events:[]).map(e=>normalizeEvent(e,'TheSportsDB',date)).filter(f=>validateFixture(f,date));
  }
  async function espnFixtures(date){
    const ymd=String(date).replaceAll('-','');
    const all=[];
    for(const league of ESPN_LEAGUES){
      try{
        const data=await json('https://site.api.espn.com/apis/site/v2/sports/soccer/'+league+'/scoreboard?dates='+ymd);
        for(const e of (data.events||[])){
          const c=e.competitions?.[0],teams=c?.competitors||[],home=teams.find(t=>t.homeAway==='home'),away=teams.find(t=>t.homeAway==='away');
          if(!home||!away)continue;
          const kickoff=e.date||c.date;
          const f={
            id:'espn-'+String(e.id),sport:'football',
            competition:data.leagues?.[0]?.name||league,
            home:home.team?.displayName||home.team?.name||'',away:away.team?.displayName||away.team?.name||'',
            homeTeamId:'',awayTeamId:'',kickoff:kickoff||null,
            kickoffLocal:localDateFromInstant(kickoff),timeLocal:kickoff?new Date(kickoff).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):null,
            status:e.status?.type?.shortDetail||e.status?.type?.name||'Scheduled',provider:'ESPN'
          };
          if(validateFixture(f,date))all.push(f);
        }
      }catch(_){/* one league failing must not stop the remaining leagues */}
    }
    const seen=new Set();
    return all.filter(f=>{const key=f.home+'|'+f.away+'|'+f.kickoff;return !seen.has(key)&&seen.add(key);});
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
    const q=String(teamName||'').trim();if(!q)return null;
    const search=await json(BASE+'searchteams.php?t='+encodeURIComponent(q));
    const teams=Array.isArray(search.teams)?search.teams:[];if(!teams.length)return null;
    const wanted=q.toLowerCase();
    const team=teams.slice().sort((a,b)=>{const aa=String(a.strTeam||'').toLowerCase(),bb=String(b.strTeam||'').toLowerCase();return (aa===wanted?-1:0)-(bb===wanted?-1:0);})[0];
    return team?.idTeam?recentMatchesById(team.idTeam,team.strTeam||q,limit):null;
  }
  window.PredictIQFreeData={provider:'TheSportsDB Free API + broad ESPN fallback',free:true,cacheMinutes:30,recentMatches,recentMatchesById,getDailyFixtures,clearCache:()=>cache.clear()};
})();
