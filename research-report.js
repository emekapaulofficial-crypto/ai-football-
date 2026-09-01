/* PredictIQ AI — fixture research & explanation layer
 * Converts structured model evidence into a match-specific report.
 * Never invents injuries, line-ups, H2H or contextual facts when unavailable.
 */
(function(){'use strict';
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function pct(x){return (Number(x)*100).toFixed(1)+'%';}
 function strengthLabel(x){x=Number(x);return x>=80?'Very strong':x>=68?'Strong':x>=55?'Above average':x>=45?'Average':x>=32?'Below average':'Weak';}
 function render(m){
  const results=$('results'); if(!results||results.classList.contains('hidden')||!m?.home||!m?.away)return;
  let box=$('researchReport');
  if(!box){box=document.createElement('div');box.id='researchReport';box.className='panel research-report';const notes=$('modelNotes')?.closest('.report-grid');if(notes)notes.parentNode.insertBefore(box,notes.nextSibling);else results.appendChild(box);}
  const h=m.home,a=m.away;
  const homeLead=h.form-a.form, attackLead=h.attack-a.attack, defenceLead=h.defence-a.defence, strengthLead=h.strength-a.strength;
  const winner=m.winner;
  const evidence=[];
  if(Math.abs(homeLead)>=5)evidence.push(`${homeLead>0?esc(h.team):esc(a.team)} has the stronger recent form (${Math.round(Math.max(h.form,a.form))}/100 vs ${Math.round(Math.min(h.form,a.form))}/100).`);
  if(Math.abs(attackLead)>=5)evidence.push(`${attackLead>0?esc(h.team):esc(a.team)} has the stronger attacking profile (${Math.round(Math.max(h.attack,a.attack))}/100).`);
  if(Math.abs(defenceLead)>=5)evidence.push(`${defenceLead>0?esc(h.team):esc(a.team)} has the stronger defensive profile (${Math.round(Math.max(h.defence,a.defence))}/100).`);
  if(Math.abs(strengthLead)>=5)evidence.push(`${strengthLead>0?esc(h.team):esc(a.team)} leads the overall strength rating.`);
  evidence.push(`Expected goals project ${esc(h.team)} at ${m.xg.home.toFixed(2)} and ${esc(a.team)} at ${m.xg.away.toFixed(2)}.`);
  evidence.push(`The scoreline model estimates ${pct(m.p.home)} home, ${pct(m.p.draw)} draw and ${pct(m.p.away)} away.`);
  const risks=[];
  if(m.dataConfidence<80)risks.push('Recent-match coverage is incomplete, so confidence is reduced.');
  if(Math.max(m.p.home,m.p.draw,m.p.away)<.55)risks.push('The three-way probabilities are relatively close; the match is not a strong result signal.');
  if(Math.abs(m.xg.home-m.xg.away)<.25)risks.push('Expected goals are close, increasing draw/variance risk.');
  if(!risks.length)risks.push('Football remains high variance; a model probability is not a guarantee.');
  const ou=Object.entries(m.ou||{}).map(([line,v])=>({line,over:v.over,under:v.under}));
  const bestOU=ou.sort((x,y)=>Math.max(y.over,y.under)-Math.max(x.over,x.under))[0];
  const scores=(m.correctScores||[]).slice(0,3).map(x=>`<span>${x.home}-${x.away} <b>${pct(x.p)}</b></span>`).join('');
  box.innerHTML=`<div class="panel-head"><div><div class="step-label">MATCH RESEARCH</div><h3>Why the model predicts this</h3></div><span class="badge">${esc(strengthLabel(Math.max(m.home.strength,m.away.strength)))}</span></div><div class="research-summary"><div><span>FINAL MODEL LEAD</span><strong>${esc(winner)}</strong><p>${pct(Math.max(m.p.home,m.p.draw,m.p.away))} highest 1X2 probability</p></div><div><span>EXPECTED GOALS</span><strong>${m.xg.total.toFixed(2)}</strong><p>${esc(h.team)} ${m.xg.home.toFixed(2)} • ${esc(a.team)} ${m.xg.away.toFixed(2)}</p></div><div><span>DATA CONFIDENCE</span><strong>${m.dataConfidence}%</strong><p>Verified recent-match coverage</p></div></div><div class="research-columns"><div><h4>Key evidence</h4><ul>${evidence.map(x=>`<li>${x}</li>`).join('')}</ul></div><div><h4>Risk factors</h4><ul>${risks.map(x=>`<li>${x}</li>`).join('')}</ul></div></div><div class="research-columns"><div><h4>Team profile</h4><div class="research-team"><b>${esc(h.team)}</b><span>Attack ${Math.round(h.attack)} • Defence ${Math.round(h.defence)} • Form ${Math.round(h.form)} • Strength ${Math.round(h.strength)}</span></div><div class="research-team"><b>${esc(a.team)}</b><span>Attack ${Math.round(a.attack)} • Defence ${Math.round(a.defence)} • Form ${Math.round(a.form)} • Strength ${Math.round(a.strength)}</span></div></div><div><h4>Most likely scorelines</h4><div class="score-chips">${scores||'<span>Not available</span>'}</div><h4 style="margin-top:14px">Best goal-total signal</h4><p>${bestOU?`Over/Under ${bestOU.line}: <b>${bestOU.over>=bestOU.under?'Over':'Under'} ${pct(Math.max(bestOU.over,bestOU.under))}</b>`:'Not available'}</p></div></div><div class="research-footnote">Context such as injuries, confirmed line-ups and head-to-head is shown only when a verified source provides it. PredictIQ will not fabricate missing information.</div>`;
 }
 window.PredictIQResearch={render};
 const style=document.createElement('style');style.textContent='.research-report{margin-top:18px}.research-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:15px 0}.research-summary>div,.research-team{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px}.research-summary span,.research-summary p{display:block;font-size:12px;opacity:.7}.research-summary strong{font-size:22px}.research-columns{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:16px}.research-columns h4{margin:0 0 9px}.research-columns ul{margin:0;padding-left:20px}.research-columns li{margin:7px 0}.research-team{display:flex;justify-content:space-between;gap:12px;margin:7px 0;font-size:13px}.score-chips{display:flex;flex-wrap:wrap;gap:8px}.score-chips span{padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.06)}.research-footnote{margin-top:16px;font-size:12px;opacity:.65}@media(max-width:700px){.research-summary,.research-columns{grid-template-columns:1fr}.research-team{flex-direction:column}}';document.head.appendChild(style);
})();
