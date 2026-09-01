/* PredictIQ mobile OCR + analysis hardening.
 * Loaded after main.js. Replaces the old strict 5-match Analyze handler with
 * a visible, timeout-bounded flow that accepts 3+ verified recent matches.
 * It never fabricates missing team data.
 */
(function(){
'use strict';

function init(){
  const $=id=>document.getElementById(id);
  const btn=$('analyzeBtn');
  const status=$('ocrStatus');
  if(!btn)return;

  function setStatus(message){
    if(status)status.textContent=message;
    let box=$('analysisStatus');
    if(!box){
      box=document.createElement('div');
      box.id='analysisStatus';
      box.setAttribute('role','status');
      box.style.cssText='margin-top:12px;padding:10px 12px;border:1px solid rgba(230,170,65,.45);border-radius:10px;font-size:14px;line-height:1.45;';
      btn.insertAdjacentElement('afterend',box);
    }
    box.textContent=message;
  }

  function timeout(ms){
    return new Promise((_,reject)=>setTimeout(()=>reject(new Error('TIMEOUT')),ms));
  }

  async function getVerifiedForm(team){
    const name=String(team||'').trim();
    if(!name)return null;
    const variants=[name,
      name.replace(/\bfootball club\b/ig,'').replace(/\bfc\b/ig,'').trim(),
      name.replace(/\bsc\b/ig,'').trim(),
      name.replace(/\bafc\b/ig,'').trim()
    ].filter((v,i,a)=>v&&a.indexOf(v)===i);

    for(const candidate of variants){
      try{
        const result=await Promise.race([
          window.PredictIQFreeData?.recentMatches(candidate,5),
          timeout(9000)
        ]);
        if(result?.rows?.length>=3)return result;
      }catch(_){}
    }
    return null;
  }

  btn.onclick=async function(){
    const home=$('homeTeam')?.value.trim()||'';
    const away=$('awayTeam')?.value.trim()||'';

    if(!home||!away){
      setStatus('Please confirm both team names before analysis.');
      $('homeTeam')?.focus();
      return;
    }

    if(!Array.isArray(window.S?.odds)||!window.S.odds.length){
      setStatus('No readable odds were detected from this screenshot. Please upload a clearer odds screenshot, then try Analyze match again.');
      $('oddsTableWrap')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }

    btn.disabled=true;
    btn.textContent='Finding verified data…';
    setStatus(`Checking recent verified results for ${home} and ${away}…`);

    try{
      const [hf,af]=await Promise.all([
        getVerifiedForm(home),
        getVerifiedForm(away)
      ]);

      const hn=hf?.rows?.length||0;
      const an=af?.rows?.length||0;

      if(!hf||!af){
        $('results')?.classList.remove('hidden');
        if($('resultMatch'))$('resultMatch').textContent=`${home} vs ${away}`;
        if($('resultCompetition'))$('resultCompetition').textContent=$('competition')?.value||'Match analysis';
        if($('resultDate'))$('resultDate').textContent=$('matchDate')?.value||'';
        if($('topPickMarket'))$('topPickMarket').textContent='No verified prediction available';
        if($('topPickProb'))$('topPickProb').textContent='—';
        if($('topPickOdds'))$('topPickOdds').textContent='—';
        if($('topPickImplied'))$('topPickImplied').textContent='—';
        if($('topPickEdge'))$('topPickEdge').textContent='—';
        if($('topPickConfidence'))$('topPickConfidence').textContent='NO BET';
        if($('topPickReason'))$('topPickReason').textContent=`Verified recent data was insufficient (home: ${hn} matches, away: ${an} matches). The system will not invent missing statistics.`;
        if($('topThree'))$('topThree').innerHTML='<div class="empty-state">Analysis stopped safely because verified team data was incomplete.</div>';
        if($('noBetBox'))$('noBetBox').classList.remove('hidden');
        if($('noBetBox'))$('noBetBox').innerHTML='<strong>No verified prediction.</strong><span>At least 3 recent verified matches are required for each team. Try the official team name or a clearer fixture screenshot.</span>';
        setStatus(`Verified data found: ${hn} home matches and ${an} away matches. At least 3 for each team are required.`);
        $('results')?.scrollIntoView({behavior:'smooth'});
        return;
      }

      btn.textContent='Running model…';
      setStatus(`Verified data found: ${hn} matches for ${hf.team||home}, ${an} for ${af.team||away}. Running the model…`);

      const result=window.PredictIQEngine?.analyze(window.S.odds,hf,af);
      if(!result)throw new Error('Prediction engine unavailable');

      renderReport(hf,af,result);
      setStatus(`Analysis complete. Data confidence: ${result.dataConfidence}%.`);
    }catch(err){
      console.error('PredictIQ analysis failed',err);
      $('results')?.classList.remove('hidden');
      if($('topPickMarket'))$('topPickMarket').textContent='Analysis could not be completed';
      if($('topPickConfidence'))$('topPickConfidence').textContent='NO BET';
      if($('topPickReason'))$('topPickReason').textContent='The verified data provider or prediction engine did not respond in time. No fabricated prediction was produced.';
      if($('topThree'))$('topThree').innerHTML='<div class="empty-state">Please try again. If the team cannot be verified, the system will not invent results.</div>';
      setStatus('Analysis stopped safely because verified data was unavailable or timed out. Please try again.');
    }finally{
      btn.disabled=false;
      btn.textContent='Analyze match';
    }
  };
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
