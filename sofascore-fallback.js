/* PredictIQ AI — additional public football data fallback.
 * Uses the publicly reachable Sofascore web API when the primary free providers
 * cannot resolve a team. The app still requires verified completed matches.
 */
(function(){'use strict';
  const original=window.PredictIQFreeData?.recentMatches;
  if(!original)return;
  const cache=new Map();
  async function json(url){if(cache.has(url))return cache.get(url);const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Sofascore '+r.status);const v=await r.json();cache.set(url,v);return v;}
  function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function scoreTeam(q,t){const a=norm(q),b=norm(t.name);if(a===b)return 100;if(b.startsWith(a)||a.startsWith(b))return 85;if(b.includes(a)||a.includes(b))return 70;return 0;}
  async function sofascoreRecent(name,limit=5){
    const q=String(name||'').trim(); if(!q)return null;
    const search=await json('https://www.sofascore.com/api/v1/search/all?q='+encodeURIComponent(q));
    const teams=(search.results||[]).filter(x=>x.entity?.sport?.slug==='football'&&x.entity?.id).map(x=>x.entity);
    if(!teams.length)throw new Error('Team not found');
    teams.sort((a,b)=>scoreTeam(q,b)-scoreTeam(q,a));
    const team=teams[0];
    const rows=[];
    for(let page=0;page<3&&rows.length<limit;page++){
      const d=await json(`https://www.sofascore.com/api/v1/team/${team.id}/events/last/${page}`);
      for(const e of d.events||[]){
        if(e.status?.type!=='finished')continue;
        const home=String(e.homeTeam?.id)===String(team.id); const hs=Number(e.homeScore?.current),as=Number(e.awayScore?.current);
        if(!Number.isFinite(hs)||!Number.isFinite(as))continue;
        const gf=home?hs:as,ga=home?as:hs;
        rows.push({date:e.startTimestamp?new Date(e.startTimestamp*1000).toISOString():null,opponent:home?e.awayTeam?.name:e.homeTeam?.name,venue:home?'H':'A',gf,ga,r:gf>ga?'W':gf===ga?'D':'L'});
      }
    }
    const unique=[];const seen=new Set();rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    for(const r of rows){const k=[r.date,r.opponent,r.gf,r.ga].join('|');if(!seen.has(k)){seen.add(k);unique.push(r);}if(unique.length>=limit)break;}
    if(unique.length<5)return null;
    return {team:team.name,rows:unique,win:unique.filter(x=>x.r==='W').length,draw:unique.filter(x=>x.r==='D').length,loss:unique.filter(x=>x.r==='L').length,provider:'Sofascore public data fallback',complete:true};
  }
  window.PredictIQFreeData.recentMatches=async function(name,limit=5){try{const primary=await original(name,Math.max(limit,5));if(primary?.rows?.length>=5)return primary;}catch(_){}try{return await sofascoreRecent(name,Math.max(limit,5));}catch(e){console.warn('Sofascore fallback failed',e);return null;}};
  window.PredictIQFreeData.provider='TheSportsDB + ESPN + Sofascore public fallback';
})();
