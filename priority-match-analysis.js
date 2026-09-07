/* PredictIQ AI — reliable team research + prediction workflow. */
(function(){
'use strict';
const BASES=['https://api.sofascore.com/api/v1','https://www.sofascore.com/api/v1'];
const cache=new Map(),TTL=10*60*1000;
const KNOWN={
 'dynamo kyiv u21':52680,'fc dynamo kyiv u21':52680,'dynamo k u21':52680,
 'lnz cherkasy u21':1256107,'lnz u21':1256107,'fc lnz cherkasy u21':1256107,
 'lnz cherkasy(u21)':1256107
};
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(fc|afc|sc|fk|football club)\b/g,' ').replace(/\s+/g,' ').trim();
const isYouth=s=>/\b(?:u\s*21|u21|under\s*21|youth)\b/i.test(String(s||''));
async function jsonFetch(url){
 const c=cache.get(url);if(c&&Date.now()-c.t<TTL)return c.v;
 const urls=[url];
 if(url.includes('api.sofascore.com')) urls.push('https://www.sofascore.com'+url.split('api.sofascore.com')[1]);
 for(const u of urls){
  try{const r=await fetch(u,{headers:{Accept:'application/json'}});if(r.ok){const v=await r.json();cache.set(url,{t:Date.now(),v});return v;}}catch(e){console.warn('direct football source failed',u,e);}
 }
 try{
  const proxy='https://api.allorigins.win/raw?url='+encodeURIComponent(url);
  const r=await fetch(proxy);if(r.ok){const v=await r.json();cache.set(url,{t:Date.now(),v});return v;}
 }catch(e){console.warn('fallback football proxy failed',e);}
 throw new Error('Football data provider unavailable');
}
function teamScore(q,name){
 const a=norm(q),b=norm(name);if(a===b)return 1;
 if(isYouth(a)!==isYouth(b))return 0;
 const A=new Set(a.split(/[^a-z0-9]+/).filter(Boolean)),B=new Set(b.split(/[^a-z0-9]+/).filter(Boolean));
 const overlap=[...A].filter(x=>B.has(x)).length;
 return Math.min(1,(2*overlap)/(A.size+B.size)+(b.includes(a)||a.includes(b)?0.25:0));
}
async function findTeam(input){
 const q=String(input||'').trim();if(!q)return null;const key=norm(q);
 if(KNOWN[key])return{teamId:String(KNOWN[key]),teamName:key.includes('lnz')?'LNZ Cherkasy U21':'Dynamo Kyiv U21',score:1};
 const queries=[q];
 if(isYouth(q)&&!q.toLowerCase().includes('u21'))queries.push(q+' U21');
 if(/^fc\s+/i.test(q))queries.push(q.replace(/^fc\s+/i,''));
 let candidates=[];
 for(const x of queries){try{
   const d=await jsonFetch(BASES[0]+'/search/all?q='+encodeURIComponent(x));
   for(const r of d.results||[]){const e=r.entity||r;if(!e?.id||!e?.name)continue;const sport=String(e.sport?.slug||e.sport?.name||e.type||'').toLowerCase();if(e.sport?.slug==='football'||sport==='football'||String(e.type||'').toLowerCase()==='team')candidates.push(e);}
 }catch(e){console.warn('team search failed',x,e);}}
 const youth=isYouth(q);if(youth)candidates=candidates.filter(t=>isYouth(t.name));
 const uniq=new Map(candidates.map(t=>[String(t.id),t]));candidates=[...uniq.values()].sort((a,b)=>teamScore(q,b.name)-teamScore(q,a.name));
 if(!candidates.length)return null;const t=candidates[0],s=teamScore(q,t.name);return s>=0.28?{teamId:String(t.id),teamName:t.name,score:s}:null;
}
function row(e,id){
 const status=e?.status||{};const finished=status.finished===true||/finished|awarded/i.test(String(status.type||''));if(!finished)return null;
 const home=String(e.homeTeam?.id)===String(id),away=String(e.awayTeam?.id)===String(id);if(!home&&!away)return null;
 const hs=Number(e.homeScore?.current??e.homeScore?.normaltime??e.homeScore?.display),as=Number(e.awayScore?.current??e.awayScore?.normaltime??e.awayScore?.display);if(!Number.isFinite(hs)||!Number.isFinite(as))return null;
 const gf=home?hs:as,ga=home?as:hs;return{date:e.startTimestamp?new Date(e.startTimestamp*1000).toISOString():'',opponent:home?e.awayTeam?.name:e.homeTeam?.name,venue:home?'H':'A',gf,ga,r:gf>ga?'W':gf===ga?'D':'L',competition:e.tournament?.name||e.uniqueTournament?.name||e.tournament?.uniqueTournament?.name||'Football'};
}
async function recentById(id,name,limit=5){
 const rows=[],seen=new Set();
 for(let page=0;page<20&&rows.length<limit;page++){
  try{const d=await jsonFetch(BASES[0]+'/team/'+encodeURIComponent(id)+'/events/last/'+page);for(const e of d.events||[]){const r=row(e,id);if(!r)continue;const k=[r.date,r.opponent,r.gf,r.ga].join('|');if(!seen.has(k)){seen.add(k);rows.push(r);}}if(d.hasNextPage===false&&!(d.events||[]).length)break;}catch(e){console.warn('history page failed',page,e);}
 }
 rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const five=rows.slice(0,5);if(five.length<5)return null;
 return{team:name,rows:five,win:five.filter(x=>x.r==='W').length,draw:five.filter(x=>x.r==='D').length,loss:five.filter(x=>x.r==='L').length,provider:'SofaScore public football data',complete:true,teamId:String(id)};
}
async function recentMatches(input,limit=5){const t=await findTeam(input);return t?recentById(t.teamId,t.teamName,Math.max(5,limit)):null;}
window.PredictIQTeamResearch={findTeam,recentMatches,recentById,clearCache:()=>cache.clear()};
function youthName(name,other){if(isYouth(other)&&!isYouth(name))return name.replace(/\s+$/,'')+' U21';return name;}
function showMissing(msg){
 const results=document.getElementById('results'),box=document.getElementById('noBetBox');if(results)results.classList.remove('hidden');if(box)box.classList.remove('hidden');
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
 set('topPickMarket','No verified prediction yet');set('topPickProb','—');set('topPickConfidence','DATA MISSING');set('topPickReason',msg);
 const list=document.getElementById('topThree');if(list)list.innerHTML='<div class="empty-state">PredictIQ could not verify five completed results for both teams from the available public football sources.</div>';
}
async function run(){
 const homeEl=document.getElementById('homeTeam'),awayEl=document.getElementById('awayTeam'),btn=document.getElementById('analyzeBtn');
 if(!homeEl||!awayEl||!btn||!window.PredictIQEngine||typeof window.renderReport!=='function')return;
 btn.onclick=async function(){
  let home=homeEl.value.trim(),away=awayEl.value.trim();if(!home||!away){alert('Enter the home team and away team.');return;}
  if(isYouth(home+' '+away)){home=youthName(home,away);away=youthName(away,home);homeEl.value=home;awayEl.value=away;}
  btn.disabled=true;btn.textContent='Finding verified last 5 matches…';const status=document.getElementById('researchStatus');if(status)status.textContent='Searching multiple public football data routes for both teams…';
  try{
   const [h,a]=await Promise.all([recentMatches(home,5),recentMatches(away,5)]);
   if(!h||!a||h.rows.length<5||a.rows.length<5){showMissing('The football source did not return five completed matches for one or both teams. PredictIQ has already tried the direct data route and a fallback route. No statistics were invented.');return;}
   const r=window.PredictIQEngine.analyze([],h,a);window.renderReport(h,a,r);if(status)status.textContent='Research complete — verified last 5 matches found for both teams.';
  }catch(e){console.error(e);showMissing('Football data could not be reached right now. The system tried multiple public routes. Please retry in a moment.');if(status)status.textContent='Football data connection failed — retrying is safe.';}
  finally{btn.disabled=false;btn.textContent='Analyze match';}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
