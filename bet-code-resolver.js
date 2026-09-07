/* PredictIQ bookmaker booking-code resolver.
 * A code is only marked VERIFIED when a trusted server-side resolver returns
 * actual selections. Otherwise we provide a safe bookmaker link and the
 * screenshot/OCR path instead of inventing selections.
 */
(function(){
  'use strict';
  const SOURCE_PATTERNS={SportyBet:[/sportybet\.com/i,/sporty\.bet/i],Bet9ja:[/bet9ja/i],Betway:[/betway/i],'1xBet':[/1xbet/i]};
  function cleanCode(input){
    const s=String(input||'').trim();
    const labeled=s.match(/(?:bet|booking|share)\s*code\s*[:#-]?\s*([A-Z0-9]{6,12})/i);
    if(labeled)return labeled[1].toUpperCase();
    try{const u=new URL(s);for(const key of ['shareCode','sharecode','bookingCode','bookingcode','code']){const v=u.searchParams.get(key);if(v)return v.trim().toUpperCase();}}catch(_){}
    const token=s.match(/\b[A-Z0-9]{6,12}\b/i);return token?token[0].toUpperCase():s.replace(/\s+/g,'').toUpperCase();
  }
  function detectSource(input,chosen='auto'){
    if(chosen&&chosen!=='auto')return chosen;
    const s=String(input||'');
    for(const [name,pats] of Object.entries(SOURCE_PATTERNS))if(pats.some(r=>r.test(s)))return name;
    if(/^[A-Z0-9]{6}$/i.test(cleanCode(s)))return 'SportyBet (candidate)';
    return 'Unknown';
  }
  function sportBetUrl(code){return 'https://www.sportybet.com/ng/?shareCode='+encodeURIComponent(cleanCode(code));}
  async function resolve(code,source='auto'){
    const raw=String(code||'').trim();if(!raw)throw new Error('Missing booking code');
    const normalized=cleanCode(raw),detected=detectSource(raw,source),configured=window.PredictIQConfig?.betCodeResolverUrl;
    if(!configured)return {verified:false,source:detected,selections:[],code:normalized,externalUrl:detected.toLowerCase().includes('sportybet')?sportBetUrl(normalized):null,needsScreenshot:true,message:'No trusted booking-code resolver is configured. Use a slip screenshot to analyze the actual selections.'};
    const response=await fetch(configured,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:normalized,source:detected})});
    if(!response.ok)throw new Error('Resolver request failed: '+response.status);
    const data=await response.json();
    if(!data.verified||!Array.isArray(data.selections))return {verified:false,source:data.source||detected,selections:[],code:normalized,externalUrl:data.externalUrl||null,needsScreenshot:true,message:'Resolver did not verify this code.'};
    return {verified:true,source:data.source||detected,selections:data.selections,expiresAt:data.expiresAt||null,code:normalized};
  }
  window.PredictIQCodeResolver={cleanCode,detectSource,sportBetUrl,resolve};
})();