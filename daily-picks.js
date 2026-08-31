/* PredictIQ Daily Picks — current-date fixture orchestration. */
(function(){
  'use strict';
  const state={fixtures:[],updatedAt:null,source:null,error:null};
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function todayISO(){const n=new Date();return new Intl.DateTimeFormat('en-CA',{timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(n);}
  function render(){
    const host=$('#dailyList')||$('#daily-picks-list')||$('#picks-list')||$('.picks-list');
    const count=$('#dailyCount');
    if(count)count.textContent=state.fixtures.length?`${state.fixtures.length} verified fixtures found`:'No verified fixtures found';
    if(!host)return;
    if(state.error){host.innerHTML='<div class="panel"><strong>Daily Picks unavailable</strong><p>'+esc(state.error)+'</p></div>';return;}
    if(!state.fixtures.length){host.innerHTML='<div class="panel"><strong>No verified picks yet</strong><p>No upcoming football fixtures were returned for '+esc(todayISO())+'. The system will not invent or reuse stale matches.</p></div>';return;}
    host.innerHTML=state.fixtures.slice(0,30).map((f,i)=>`<article class="pick-item"><div class="rank">#${i+1}</div><div><h4>${esc(f.home)} vs ${esc(f.away)}</h4><p>${esc(f.competition||'Football')} • ${esc(new Date(f.kickoff).toLocaleString())}</p><p><span class="pick-label">VERIFIED FIXTURE</span> • Source: ${esc(state.source||'free provider')}</p></div><div class="prob">—</div></article>`).join('');
  }
  async function load(){
    state.error=null;state.fixtures=[];
    try{
      if(window.PredictIQDataProvider?.getDailyFixtures){const r=await window.PredictIQDataProvider.getDailyFixtures(todayISO());state.fixtures=Array.isArray(r?.fixtures)?r.fixtures:[];state.source=r?.source||'provider';}
      else if(window.PredictIQFreeData?.getDailyFixtures){const r=await window.PredictIQFreeData.getDailyFixtures(todayISO());state.fixtures=Array.isArray(r?.fixtures)?r.fixtures:[];state.source=r?.source||'TheSportsDB Free API';}
      else throw new Error('No daily fixture provider is connected.');
      state.updatedAt=new Date().toISOString();
    }catch(e){state.error=e?.message||'Unable to load verified daily fixtures.';}
    render();
    const stamp=$('#dailyUpdated');if(stamp&&!state.error)stamp.textContent='Last verified refresh: '+new Date(state.updatedAt).toLocaleString();
  }
  function scheduleRefresh(){const now=new Date(),slots=[8,14,20];let delay=0;for(const h of slots){const next=new Date(now);next.setHours(h,0,0,0);if(next>now){delay=next-now;break;}}if(!delay){const next=new Date(now);next.setDate(next.getDate()+1);next.setHours(8,0,0,0);delay=next-now;}setTimeout(async()=>{await load();scheduleRefresh();},delay);}
  window.PredictIQDailyPicks={load,refresh:load,getState:()=>({...state})};
  document.addEventListener('DOMContentLoaded',()=>{load();scheduleRefresh();});
})();