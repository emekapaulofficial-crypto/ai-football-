/* PredictIQ AI — team-first analysis controller. No screenshot or bookmaker odds required. */
(function(){
'use strict';
function byId(id){return document.getElementById(id);}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function hideOptionalOddsUI(){
 const drop=byId('dropzone');
 if(drop){const panel=drop.closest('.panel');if(panel)panel.remove();}
 const odds=byId('oddsTableWrap');if(odds){const panel=odds.closest('.odds-panel')||odds.closest('.panel');if(panel)panel.remove();}
 const demo=byId('demoBtn');if(demo)demo.remove();
}
function showResearchFailure(home,away){
 const results=byId('results');if(results)results.classList.remove('hidden');
 const box=byId('noBetBox');if(box)box.classList.remove('hidden');
 const title=byId('topPickMarket');if(title)title.textContent='Research incomplete — no prediction made';
 const prob=byId('topPickProb');if(prob)prob.textContent='—';
 const conf=byId('topPickConfidence');if(conf)conf.textContent='DATA NOT VERIFIED';
 const reason=byId('topPickReason');if(reason)reason.textContent=`PredictIQ could not verify five completed matches for both “${home}” and “${away}”. No statistics or prediction were invented.`;
 const list=byId('topThree');if(list)list.innerHTML='<div class="empty-state">Check the spelling and use the official team names. The system only predicts when both teams have at least five verified completed matches.</div>';
 const form=byId('formCards');if(form)form.innerHTML='';
 const health=byId('dataHealth');if(health)health.textContent='NOT ENOUGH VERIFIED DATA';
 const bar=byId('dataHealthBar');if(bar)bar.style.width='0%';
}
function setResearchStatus(msg){let el=byId('ocrStatus');if(!el){el=document.createElement('div');el.id='ocrStatus';el.className='status';const section=document.querySelector('#analyze .panel');if(section)section.appendChild(el);}el.textContent=msg;}
async function run(){
 const home=String(byId('homeTeam')?.value||'').trim(),away=String(byId('awayTeam')?.value||'').trim();
 if(!home||!away){alert('Enter the home team and away team.');return;}
 const btn=byId('analyzeBtn');if(btn){btn.disabled=true;btn.textContent='Researching last 5 matches…';}
 setResearchStatus('Researching both teams independently. No screenshot is required.');
 try{
   const research=window.PredictIQTeamResearch;
   if(!research?.recentMatches)throw new Error('Team research module did not load');
   const [h,a]=await Promise.all([research.recentMatches(home,5),research.recentMatches(away,5)]);
   if(!h||!a||h.rows.length<5||a.rows.length<5){showResearchFailure(home,away);setResearchStatus('Research could not verify five completed matches for both teams. No prediction was produced.');return;}
   setResearchStatus(`Verified ${h.rows.length} recent matches for ${h.team} and ${a.rows.length} for ${a.team}.`);
   const r=window.PredictIQEngine.model(h,a);
   const full={...r,top3:[],ranked:[],noBet:true};
   if(typeof window.renderPredictIQReport==='function')window.renderPredictIQReport(h,a,full);else if(typeof renderReport==='function')renderReport(h,a,full);else throw new Error('Prediction report renderer not found');
 }catch(e){console.error(e);showResearchFailure(home,away);setResearchStatus('Team research failed. Please try the full official team names.');}
 finally{if(btn){btn.disabled=false;btn.textContent='Predict match';}}
}
function install(){hideOptionalOddsUI();const btn=byId('analyzeBtn');if(btn)btn.onclick=run;}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
window.PredictIQRunTeamAnalysis=run;
})();
