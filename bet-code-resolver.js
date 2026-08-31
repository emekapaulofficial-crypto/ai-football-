/* PredictIQ bookmaker booking-code resolver.
   Source detection is conservative. A code is considered resolved only when a
   connected resolver returns verified selections. SportyBet booking codes are
   six-character share codes in common use; the resolver can call the official
   booking-code URL through a server-side proxy when one is configured.
*/
(function(){
  'use strict';
  const SOURCE_PATTERNS={
    SportyBet:[/sportybet\.com/i,/sporty\.bet/i],
    Bet9ja:[/bet9ja/i],
    Betway:[/betway/i],
    '1xBet':[/1xbet/i]
  };
  function detectSource(input,chosen='auto'){
    if(chosen&&chosen!=='auto')return chosen;
    const s=String(input||'');
    for(const [name,pats] of Object.entries(SOURCE_PATTERNS))if(pats.some(r=>r.test(s)))return name;
    // Do not claim certainty from code shape alone; it is only a candidate.
    if(/^[A-Z0-9]{6}$/i.test(s.trim()))return 'SportyBet (candidate)';
    return 'Unknown';
  }
  function sportBetUrl(code){return 'https://www.sportybet.com/ng/?shareCode='+encodeURIComponent(code.trim());}
  async function resolve(code,source='auto'){
    const raw=String(code||'').trim();
    if(!raw)throw new Error('Missing booking code');
    const detected=detectSource(raw,source);
    const configured=window.PredictIQConfig?.betCodeResolverUrl;
    if(!configured) return {verified:false,source:detected,selections:[],message:'No resolver service configured. A bookmaker booking page cannot be reliably decoded by frontend JavaScript alone.'};
    const response=await fetch(configured,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:raw,source:detected})});
    if(!response.ok)throw new Error('Resolver request failed: '+response.status);
    const data=await response.json();
    if(!data.verified||!Array.isArray(data.selections))return {verified:false,source:data.source||detected,selections:[],message:'Resolver did not verify this code.'};
    return {verified:true,source:data.source||detected,selections:data.selections,expiresAt:data.expiresAt||null};
  }
  window.PredictIQCodeResolver={detectSource,sportBetUrl,resolve};
})();
