/* PredictIQ Bet Slip analyzer.
   Resolves slips only when a connected provider supplies verified selections.
   It also accepts normalized selections from the screenshot/OCR workflow.
   Never claims a code was decoded when the provider did not resolve it. */
(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalizeSelection(x){
    if(!x||!x.sport||!x.event||!x.market||!x.selection)return null;
    return {id:x.id||crypto.randomUUID?.()||String(Date.now()+Math.random()),sport:String(x.sport),event:String(x.event),market:String(x.market),selection:String(x.selection),odd:Number(x.odd)||null,kickoff:x.kickoff||null,status:x.status||'upcoming'};
  }
  function analyzeSelections(selections,engine){
    const rows=selections.map(normalizeSelection).filter(Boolean).map(x=>{const p=x.probability!=null?Number(x.probability):null;return {...x,probability:p,implied:x.odd>1?1/x.odd:null,risk:p==null?'UNKNOWN':p>=.80?'LOW':p>=.65?'MEDIUM':'HIGH'};});
    const valid=rows.filter(x=>x.probability!=null);
    const combined=valid.length?valid.reduce((a,x)=>a*x.probability,1):null;
    const weakest=valid.slice().sort((a,b)=>a.probability-b.probability)[0]||null;
    return {rows,combined,weakest,overallRisk:combined==null?'UNKNOWN':combined>=.55?'MEDIUM':'HIGH',message:valid.length===rows.length?'Every selection has a model estimate.':'Some selections could not be independently modeled and should not be treated as safe.'};
  }
  function render(container,result){
    if(!container)return;
    container.innerHTML=`<div class="decision-strip"><div><span>SLIP ASSESSMENT</span><strong>${esc(result.overallRisk)} RISK</strong><p>${esc(result.message)}</p></div><div class="data-health"><span>COMBINED MODEL PROBABILITY</span><strong>${result.combined==null?'—':(result.combined*100).toFixed(1)+'%'}</strong></div></div><div class="pick-list">${result.rows.map((x,i)=>`<div class="pick-item"><div class="rank">#${i+1}</div><div><h4>${esc(x.event)}</h4><p>${esc(x.sport)} • ${esc(x.market)} • ${esc(x.selection)}${x.odd?' • odds '+x.odd.toFixed(2):''}</p><p>Model: ${x.probability==null?'Not available':(x.probability*100).toFixed(1)+'%'} • Risk: ${esc(x.risk)}</p></div><div class="prob">${x.probability==null?'—':(x.probability*100).toFixed(1)+'%'}</div></div>`).join('')}</div>${result.weakest?`<div class="panel no-bet"><strong>Weakest selection: ${esc(result.weakest.event)}</strong><span>${esc(result.weakest.market)} — ${esc(result.weakest.selection)}. Review this selection first.</span></div>`:''}`;
  }
  window.PredictIQBetSlip={normalizeSelection,analyzeSelections,render};
})();
