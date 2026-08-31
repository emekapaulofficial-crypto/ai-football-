/* PredictIQ SportyBet screenshot parser v5 — conservative structured extraction. */
const PredictIQSportyParser=(()=>{
  const HEADERS=[
    [/^1x2\s*[-–—]?\s*1up/i,'1X2 - 1UP'],[/^1x2\s*[-–—]?\s*2up/i,'1X2 - 2UP'],[/^1x2\s*[-–—]?\s*never\s*down/i,'1X2 - Never Down'],[/^1x2/i,'1X2'],
    [/^double\s+chance/i,'Double Chance'],[/^(both\s+teams\s+to\s+score|btts)/i,'BTTS'],[/^over\s*\/\s*under\s*-\s*early|^early\s+goals/i,'Early Goals'],
    [/^asian\s+over/i,'Asian Over/Under'],[/^over\s*\/\s*under/i,'Over/Under'],[/^handicap/i,'Handicap'],[/^(1st|first)\s+goal/i,'First Goal'],[/^match\s+goals/i,'Match Goals'],[/^team\s+goals/i,'Team Goals'],[/^corners/i,'Corners'],[/^(bookings?|cards?)/i,'Cards']
  ];
  const LABELS=/^(over|under|home|away|draw|yes|no|1x|12|x2|no goal|both teams to score)$/i;
  const clean=s=>String(s||'').replace(/[|*•]/g,' ').replace(/\bI(?=\.?\d)/g,'1').replace(/,(?=\d)/g,'.').replace(/\s+/g,' ').trim();
  const odd=n=>{let s=clean(n).replace(/[^0-9.]/g,'');if(!s)return null;let v=Number(s);if(v>=100&&v<1000)v/=100;return Number.isFinite(v)&&v>=1.001&&v<=100?Number(v.toFixed(2)):null;};
  const header=s=>{s=clean(s);for(const [re,name] of HEADERS)if(re.test(s))return name;return null;};
  const nums=s=>[...clean(s).matchAll(/(?<!\d)(\d+(?:\.\d+)?)(?!\d)/g)].map(m=>Number(m[1]));
  const lineValue=n=>Number.isFinite(n)&&n>=0&&n<=20?n:null;
  function parseOddsLines(text=''){
    const lines=String(text).split(/\r?\n/).map(clean).filter(Boolean); let market=null, pendingLine=null; const rows=[];
    const push=(m,line,sel,v)=>{const o=odd(v);if(o)rows.push({market:m,line:line??null,sel,odd:o});};
    for(const raw of lines){
      const line=raw.replace(/\s+/g,' '); const h=header(line); if(h){market=h;pendingLine=null;continue;} if(!market||LABELS.test(line))continue;
      const n=nums(line);
      if((market==='Over/Under'||market==='Asian Over/Under')&&n.length===1&&lineValue(n[0])!==null){pendingLine=n[0];continue;}
      if((market==='Over/Under'||market==='Asian Over/Under')&&n.length>=3){
        const l=pendingLine??lineValue(n[0]); const start=pendingLine!=null?0:1;
        const over=odd(n[start]),under=odd(n[start+1]); if(l!==null&&over&&under){push(market,l,'Over',over);push(market,l,'Under',under);} pendingLine=null; continue;
      }
      if(market==='Early Goals'&&n.length>=2){const l=lineValue(n[0]);push(market,l,'Over',n[1]);continue;}
      if(market==='1X2'&&n.length>=3){push(market,null,'Home',n[0]);push(market,null,'Draw',n[1]);push(market,null,'Away',n[2]);continue;}
      if(market==='BTTS'&&n.length>=2){push(market,null,'Yes',n[0]);push(market,null,'No',n[1]);continue;}
      if(market==='Double Chance'&&n.length>=3){push(market,null,'1X',n[0]);push(market,null,'12',n[1]);push(market,null,'X2',n[2]);continue;}
      if(market==='First Goal'&&n.length>=3){push(market,null,'Home',n[0]);push(market,null,'No Goal',n[1]);push(market,null,'Away',n[2]);continue;}
    }
    const seen=new Set();return rows.filter(r=>{const k=`${r.market}|${r.line??''}|${r.sel}|${r.odd}`;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,250);
  }
  function parse(text){
    const rows=parseOddsLines(text); const sourceLines=String(text).split(/\r?\n/).map(clean).filter(Boolean);
    const marketHeaders=sourceLines.filter(x=>!!header(x)).length;
    const linesWithOdds=sourceLines.filter(x=>nums(x).some(n=>n>=1.001&&n<=100)).length;
    const quality=rows.length?Math.min(100,Math.round(45+Math.min(35,rows.length*1.5)+Math.min(20,marketHeaders*5)+Math.min(10,linesWithOdds))):0;
    return{rows,quality,marketCount:new Set(rows.map(r=>r.market)).size,markets:[...new Set(rows.map(r=>r.market))]};
  }
  return{parseOddsLines,parse,normalizeOdd:odd,detectMarketHeader:header};
})();
if(typeof window!=='undefined')window.PredictIQSportyParser=PredictIQSportyParser;
