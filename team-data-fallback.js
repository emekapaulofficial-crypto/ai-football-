/* PredictIQ AI — primary team research layer. Uses public football result feeds and never invents results. */
(function(){
'use strict';
const API='https://www.sofascore.com/api/v1';
const cache=new Map();
const TTL=10*60*1000;
function clean(s){return String(s||'').trim().replace(/\s+/g,' ');}
function norm(s){return clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/\b(fc|afc|sc|football club)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function similarity(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;const A=new Set(a.split(' ')),B=new Set(b.split(' '));const overlap=[...A].filter(x=>B.has(x)).length;const dice=(2*overlap)/(A.size+B.size);const contains=a.includes(b)||b.includes(a)?0.18:0;return Math.min(1,dice+contains);}
async function get(url){const c=cache.get(url);if(c&&Date.now()-c.time<TTL)return c.value;const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Public football source returned '+r.status);const v=await r.json();cache.set(url,{time:Date.now(),value:v});return v;}
function entityTeam(row){const e=row?.entity||row;return e&&e.id&&e.name&&((e.type||'').toLowerCase()==='team'||e.sport?.slug==='football');}
async function findTeam(input){const q=clean(input);if(!q)return null;const d=await get(API+'/search/all?q='+encodeURIComponent(q));const candidates=(d.results||[]).filter(entityTeam).map(x=>x.entity||x);if(!candidates.length)return null;candidates.sort((a,b)=>similarity(q,b.name)-similarity(q,a.name));const t=candidates[0];const s=similarity(q,t.name);if(s<0.35)return null;return{teamId:String(t.id),teamName:t.name,score:s,slug:t.slug||''};}
function finished(e){const type=String(e?.status?.type||'').toLowerCase();return type==='finished'||type==='finishedorawarded'||e?.status?.finished===true;}
function toRow(e,id){if(!finished(e))return null;const home=String(e.homeTeam?.id)===String(id),away=String(e.awayTeam?.id)===String(id);if(!home&&!away)return null;const hs=Number(e.homeScore?.current),as=Number(e.awayScore?.current);if(!Number.isFinite(hs)||!Number.isFinite(as))return null;const gf=home?hs:as,ga=home?as:hs;return{date:e.startTimestamp?new Date(e.startTimestamp*1000).toISOString():null,opponent:home?e.awayTeam?.name:e.homeTeam?.name,venue:home?'H':'A',gf,ga,r:gf>ga?'W':gf===ga?'D':'L',competition:e.tournament?.name||e.uniqueTournament?.name||'Football'};}
async function sofaHistory(teamId,needed=5){const rows=[],seen=new Set();for(let page=0;page<8&&rows.length<needed;page++){try{const d=await get(API+'/team/'+encodeURIComponent(teamId)+'/events/last/'+page);for(const e of d.events||[]){const r=toRow(e,teamId);if(!r)continue;const key=[r.date,r.opponent,r.gf,r.ga].join('|');if(!seen.has(key)){seen.add(key);rows.push(r);}}}catch(e){console.warn('SofaScore history page',page,e);}}rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));return rows.slice(0,needed);}
async function recentMatches(teamName,limit=5){const requested=Math.max(5,Number(limit)||5);try{const t=await findTeam(teamName);if(!t)return null;const rows=await sofaHistory(t.teamId,requested);if(rows.length<5)return null;return{team:t.teamName,requestedTeam:teamName,rows,win:rows.filter(x=>x.r==='W').length,draw:rows.filter(x=>x.r==='D').length,loss:rows.filter(x=>x.r==='L').length,provider:'SofaScore public football data',complete:true,teamId:t.teamId};}catch(e){console.warn('Primary team research failed',teamName,e);return null;}}
window.PredictIQTeamResearch={findTeam,recentMatches,clearCache:()=>cache.clear()};
const previous=window.PredictIQFreeData||{};
window.PredictIQFreeData={...previous,recentMatches,provider:'SofaScore public football data + existing free providers'};
})();
