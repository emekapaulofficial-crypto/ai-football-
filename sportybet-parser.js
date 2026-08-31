/* PredictIQ SportyBet screenshot parser v3
 * Browser-safe structured market parser. It never invents unreadable odds.
 */
const PredictIQSportyParser = (() => {
  const MARKET_PATTERNS = [
    [/^1x2\s*[-–—]?\s*1up/i,'1X2 - 1UP'],[/^1x2\s*[-–—]?\s*2up/i,'1X2 - 2UP'],[/^1x2\s*[-–—]?\s*never\s*down/i,'1X2 - Never Down'],[/^1x2/i,'1X2'],
    [/^double\s+chance/i,'Double Chance'],[/^(both\s+teams\s+to\s+score|btts)/i,'BTTS'],[/^over\s*\/\s*under\s*-\s*early|^early\s+goals/i,'Early Goals'],
    [/^asian\s+over\s*\/\s*under|^asian/i,'Asian Over/Under'],[/^over\s*\/\s*under/i,'Over/Under'],[/^handicap/i,'Handicap'],[/^(1st|first)\s+goal/i,'First Goal'],
    [/^match\s+goals/i,'Match Goals'],[/^team\s+goals/i,'Team Goals'],[/^corners/i,'Corners'],[/^(bookings?|cards?)/i,'Cards']
  ];
  function normalizeOcrLine(value='') { return String(value).replace(/[|]/g,' ').replace(/\bI(?=\.?\d)/g,'1').replace(/,(?=\d)/g,'.').replace(/(\d)\s+(?=\d{2}\b)/g,'$1.').replace(/\s+/g,' ').trim(); }
  function normalizeOdd(value) { const clean=normalizeOcrLine(value).replace(/[^0-9.]/g,''); if(!clean)return null; let n=Number(clean); if(!Number.isFinite(n))return null; if(n>=100&&n<=999)n/=100; if(n<1.001||n>1000)return null; return Number(n.toFixed(2)); }
  function detectMarketHeader(line) { const clean=normalizeOcrLine(line); for(const [re,name] of MARKET_PATTERNS)if(re.test(clean))return name; return null; }
  function parseOddsLines(text='') {
    const lines=String(text).split(/\r?\n/).map(normalizeOcrLine).filter(Boolean), markets=[]; let current=null;
    for(const line of lines){
      const header=detectMarketHeader(line); if(header){current={market:header,selections:[],sourceLines:[]};markets.push(current);continue;} if(!current)continue; current.sourceLines.push(line);
      const nums=line.match(/(?<!\d)\d+(?:\.\d+)?(?!\d)/g)||[]; if(nums.length<2||nums.length>4)continue;
      const lineValue=Number(nums[0]), odds=nums.slice(1).map(normalizeOdd).filter(Boolean); if(!odds.length)continue;
      current.selections.push({line:Number.isFinite(lineValue)&&lineValue<=20?lineValue:null,first:odds[0]||null,second:odds[1]||null,third:odds[2]||null,confidence:odds.length===nums.length-1?'medium':'low'});
    }
    return markets.filter(m=>m.selections.length||m.sourceLines.length);
  }
  function flattenMarkets(markets){return markets.flatMap(m=>m.selections.map(s=>({market:m.market,...s})));}
  function parserQuality(markets){const rows=flattenMarkets(markets);if(!rows.length)return{score:0,label:'No readable odds',rows:0};const usable=rows.filter(r=>r.first||r.second||r.third).length;const score=Math.round(usable/rows.length*100);return{score,label:score>=85?'Good':score>=60?'Needs review':'Low',rows:rows.length};}
  function bridgeToLegacyUi(text){const markets=parseOddsLines(text);return{markets,rows:flattenMarkets(markets),quality:parserQuality(markets)};}
  return {parseOddsLines,flattenMarkets,parserQuality,normalizeOdd,detectMarketHeader,bridgeToLegacyUi};
})();
if(typeof window!=='undefined')window.PredictIQSportyParser=PredictIQSportyParser;
