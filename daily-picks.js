/* PredictIQ Daily Picks — production-safe orchestration layer.
   Uses the configured data provider when available and never invents fixtures.
*/
(function(){
  'use strict';
  const state={fixtures:[],updatedAt:null,source:null,error:null};
  const $=s=>document.querySelector(s);
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function todayISO(){return new Date().toISOString().slice(0,10);}
  function render(){
    const host=$('#daily-picks-list')||$('#picks-list')||$('.picks-list');
    if(!host)return;
    if(state.error){host.innerHTML='<div class="panel"><strong>Daily Picks unavailable</strong><p>'+esc(state.error)+'</p><p>Refresh after the data provider is configured. No unverified fixtures are shown.</p></div>';return;}
    if(!state.fixtures.length){host.innerHTML='<div class="panel"><strong>No verified picks yet</strong><p>No qualifying fixtures were returned for '+esc(todayISO())+'. The system will not invent or reuse stale matches.</p></div>';return;}
    host.innerHTML=state.fixtures.map((f,i)=>'<article class="pick-card"><div><span class="eyebrow">PICK '+(i+1)+'</span><h3>'+esc(f.home||f.homeTeam||'Home')+' vs '+esc(f.away||f.awayTeam||'Away')+'</h3><p>'+esc(f.league||f.competition||'Football')+' • '+esc(f.kickoff||'Time unavailable')+'</p></div><div><strong>'+esc(f.market||'Analysis pending')+'</strong><p>'+esc(f.reason||'Selected only after model validation.')+'</p></div></article>').join('');
  }
  async function load(){
    state.error=null; state.fixtures=[];
    try{
      if(window.PredictIQDataProvider?.getDailyFixtures){
        const r=await window.PredictIQDataProvider.getDailyFixtures(todayISO());
        state.fixtures=Array.isArray(r?.fixtures)?r.fixtures:[]; state.source=r?.source||'provider'; state.updatedAt=new Date().toISOString();
      }else if(window.PredictIQFreeData?.getDailyFixtures){
        const r=await window.PredictIQFreeData.getDailyFixtures(todayISO());
        state.fixtures=Array.isArray(r?.fixtures)?r.fixtures:[]; state.source=r?.source||'free-provider'; state.updatedAt=new Date().toISOString();
      }else{
        throw new Error('No daily fixture provider is connected to this deployment.');
      }
    }catch(e){state.error=e?.message||'Unable to load verified daily fixtures.';}
    render();
    const stamp=$('#last-updated'); if(stamp)stamp.textContent=state.updatedAt?'Updated '+new Date(state.updatedAt).toLocaleString():'Not updated';
  }
  window.PredictIQDailyPicks={load,refresh:load,getState:()=>({...state})};
  document.addEventListener('DOMContentLoaded',load);
})();
