import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const SOURCES=["SportyBet","Bet9ja","Betway","1xBet"];
function detectSource(code:string,requested:string){
  if(requested && requested!=="auto" && SOURCES.includes(requested)) return requested;
  const c=code.trim();
  // Source detection is intentionally conservative: a code shape is only a candidate, never proof.
  if(/^[A-Z0-9]{6}$/i.test(c)) return "SportyBet candidate";
  return "Unknown";
}
async function resolveWithProvider(source:string,code:string){
  const url=Deno.env.get("BET_CODE_RESOLVER_URL");
  const key=Deno.env.get("BET_CODE_RESOLVER_KEY");
  if(!url) return {resolved:false,reason:"No verified bookmaker-code resolver is configured."};
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",...(key?{"Authorization":`Bearer ${key}`}:{})},body:JSON.stringify({source,code})});
  if(!r.ok) return {resolved:false,reason:`Resolver returned HTTP ${r.status}.`};
  const data=await r.json();
  if(!data?.verified || !Array.isArray(data.selections) || !data.selections.length) return {resolved:false,reason:"Resolver did not verify the code or return selections."};
  return {resolved:true,source:data.source||source,selections:data.selections,expiresAt:data.expiresAt||null};
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return new Response(JSON.stringify({error:"POST required"}),{status:405,headers:cors});
  try{
    const body=await req.json(); const code=String(body?.code||"").trim(); const requested=String(body?.source||"auto");
    if(!code) return new Response(JSON.stringify({verified:false,error:"Bet code is required."}),{status:400,headers:cors});
    const detected=detectSource(code,requested);
    const result=await resolveWithProvider(detected,code);
    return new Response(JSON.stringify({verified:result.resolved,detectedSource:detected,...result}),{status:result.resolved?200:422,headers:cors});
  }catch(e){return new Response(JSON.stringify({verified:false,error:"Resolver unavailable."}),{status:500,headers:cors});}
});
