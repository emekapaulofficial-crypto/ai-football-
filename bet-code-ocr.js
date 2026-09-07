/* PredictIQ Bet Slip screenshot reader.
 * No bookmaker credentials are used. OCR runs in the browser and only
 * produces selections that can be read from the supplied screenshot.
 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const clean=s=>String(s||'').replace(/[|•·]/g,' ').replace(/\s+/g,' ').trim();
  const wait=ms=>new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),ms));
  const oddsRe=/(?<![A-Za-z0-9])(\d{1,3}(?:[.,]\d{1,3})?)(?![A-Za-z0-9])/g;
  const marketRules=[
    [/^1x2\b/i,'1X2'],[/^double\s+chance/i,'Double Chance'],[/^(both\s+teams\s+to\s+score|btts)\b/i,'BTTS'],
    [/^(over|under|over\s*\/\s*under)/i,'Over/Under'],[/^handicap/i,'Handicap'],[/^first\s+goal/i,'First Goal'],
    [/^team\s+goals?/i,'Team Goals'],[/^match\s+goals?/i,'Match Goals'],[/^corners?/i,'Corners'],[/^(bookings?|cards?)/i,'Cards']
  ];
  const ignore=/^(football|soccer|markets?|market|selection|odds?|stake|potential|return|total|combo|acca|single|multiple|bet\s*slip|bet\s*code|booking\s*code|share\s*code|sportybet|bet9ja|betway|1xbet|home|away|draw|yes|no|over|under|double\s+chance|handicap|corners?|cards?|first\s+goal)$/i;
  function detectSource(text,chosen){
    if(chosen&&chosen!=='auto')return chosen;
    if(/sportybet|sporty\.bet/i.test(text))return 'SportyBet';
    if(/bet9ja/i.test(text))return 'Bet9ja';
    if(/betway/i.test(text))return 'Betway';
    if(/1xbet/i.test(text))return '1xBet';
    return 'Unknown';
  }
  function extractCode(text){
    const t=String(text||'');
    const labeled=t.match(/(?:bet\s*code|booking\s*code|share\s*code)\s*[:#-]?\s*([A-Z0-9]{6,12})/i);
    if(labeled)return labeled[1].toUpperCase();
    const all=[...t.matchAll(/\b[A-Z0-9]{6}\b/gi)].map(m=>m[0].toUpperCase());
    return all.find(x=>/[A-Z]/.test(x)&&/\d/.test(x))||all[0]||'';
  }
  function parseTeamsLine(line){
    const m=clean(line).match(/^(.{2,55}?)\s+(?:vs?\.?|v\.?|[-–—])\s+(.{2,55})$/i);
    return m?[clean(m[1]),clean(m[2])]:null;
  }
  function oddFromEnd(line){
    const matches=[...String(line).matchAll(oddsRe)];
    if(!matches.length)return null;
    const last=matches[matches.length-1];
    const n=Number(String(last[1]).replace(',','.'));
    return n>=1.01&&n<=100?{odd:n,index:last.index,raw:last[1]}:null;
  }
  function marketFor(line,current){
    for(const [re,name] of marketRules)if(re.test(line))return name;
    return current||'Other';
  }
  function selectionFor(text,market){
    let s=clean(text).replace(/^(?:[-–—:])\s*/,'').trim();
    s=s.replace(/^\d+\s*[.)-]\s*/,'').trim();
    if(!s)return '';
    if(market==='1X2'&&/^(home|draw|away|1|x|2)$/i.test(s))return /^(x|draw)$/i.test(s)?'Draw':/^(2|away)$/i.test(s)?'Away':'Home';
    if(market==='BTTS'&&/^(yes|no)$/i.test(s))return s[0].toUpperCase()+s.slice(1).toLowerCase();
    if(market==='Double Chance'&&/^(1x|12|x2)$/i.test(s))return s.toUpperCase();
    if(/^over\s*([0-9]+(?:[.,][0-9]+)?)/i.test(s))return 'Over '+s.match(/^over\s*([0-9]+(?:[.,][0-9]+)?)/i)[1].replace(',','.');
    if(/^under\s*([0-9]+(?:[.,][0-9]+)?)/i.test(s))return 'Under '+s.match(/^under\s*([0-9]+(?:[.,][0-9]+)?)/i)[1].replace(',','.');
    if(/^double\s+chance\s+/i.test(s))s=s.replace(/^double\s+chance\s+/i,'');
    if(ignore.test(s))return '';
    if(market==='1X2'&&/^(1|x|2)$/i.test(s))return s.toUpperCase();
    return s.slice(0,100);
  }
  function parseSelections(text,source){
    const lines=String(text||'').split(/\r?\n/).map(clean).filter(Boolean);
    let market='Other',event='',sport='Football';
    const rows=[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      const teams=parseTeamsLine(line);
      if(teams){event=`${teams[0]} vs ${teams[1]}`;continue;}
      const hit=oddFromEnd(line);
      const m=marketFor(line,null);
      if(!hit){
        if(m!=='Other'&&/^(1x2|double chance|btts|over|under|handicap|first goal|team goals|match goals|corners|bookings|cards)/i.test(line))market=m;
        continue;
      }
      if(m!=='Other')market=m;
      let before=clean(line.slice(0,hit.index));
      let selection=selectionFor(before,market);
      if(!selection){
        const prev=lines[i-1]||'';
        const prevHit=oddFromEnd(prev);
        if(!prevHit&&!parseTeamsLine(prev)&&!marketFor(prev,null).match(/^(1X2|Double Chance|BTTS|Over\/Under|Handicap|First Goal|Corners|Cards)$/))selection=selectionFor(prev,market);
      }
      if(!selection)continue;
      rows.push({sport,event:event||'Event read from slip',market,selection,odd:Number(hit.odd),source:`${source||'screenshot'} OCR`});
    }
    const seen=new Set();
    return rows.filter(r=>{const k=`${r.event}|${r.market}|${r.selection}|${r.odd}`;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,100);
  }
  async function readFiles(files){
    if(!window.Tesseract)throw new Error('OCR library unavailable');
    let worker;
    try{
      worker=await Promise.race([Tesseract.createWorker('eng'),wait(20000)]);
      await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300'});
      let text='';
      for(const file of files){
        const result=await Promise.race([worker.recognize(file),wait(45000)]);
        text+='\n'+(result?.data?.text||'');
      }
      return text;
    }finally{try{await worker?.terminate()}catch(_){} }
  }
  function render(rows){
    const host=$('slipResult');if(!host)return;
    if(!rows.length){host.innerHTML='<div class="panel no-bet"><strong>No selections could be read from this screenshot.</strong><span>Use a clear full bet-slip screenshot showing the event, market, selection and odds. Nothing was invented.</span></div>';return;}
    const analyzed=window.PredictIQBetSlip?.analyzeSelections(rows);
    if(analyzed)window.PredictIQBetSlip.render(host,analyzed);
  }
  async function handle(){
    const input=$('betSlipScreenshot'),status=$('codeStatus'),files=[...(input?.files||[])].filter(f=>f.type.startsWith('image/'));
    if(!files.length)return;
    status.textContent='Reading bet-slip screenshot…';
    try{
      const text=await readFiles(files);
      const detected=detectSource(text,$('betSource')?.value);
      const code=extractCode(text);
      if(code&&$('betCode'))$('betCode').value=code;
      const rows=parseSelections(text,detected);
      render(rows);
      status.textContent=rows.length?`Screenshot verified locally: ${rows.length} selection${rows.length===1?'':'s'} read from ${detected}.`:'Screenshot read, but no complete selections were detected.';
    }catch(err){console.error(err);status.textContent='Screenshot reading failed or timed out. Try a clearer full-slip image.';}
  }
  window.PredictIQBetCodeOCR={extractCode,parseSelections,readFiles};
  function init(){
    const input=$('betSlipScreenshot'),btn=$('uploadBetSlipBtn');
    if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('change',handle);}
    if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',()=>input?.click());}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();