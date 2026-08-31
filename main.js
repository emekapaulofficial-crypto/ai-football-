const S = { odds: [], text: '', home: '', away: '' };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const clean = s => String(s).replace(/[^\p{L}\p{N}&.'()/_+ -]/gu, ' ').replace(/\s+/g, ' ').trim();

$('dropzone').addEventListener('dragover', e => { e.preventDefault(); $('dropzone').classList.add('drag'); });
$('dropzone').addEventListener('dragleave', () => $('dropzone').classList.remove('drag'));
$('dropzone').addEventListener('drop', e => { e.preventDefault(); $('dropzone').classList.remove('drag'); readImages([...e.dataTransfer.files]); });
$('fileInput').addEventListener('change', e => readImages([...e.target.files]));

function preprocessImage(file, scale = 2.2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = Math.max(1200, Math.round(img.naturalWidth * scale));
      const h = Math.max(1600, Math.round(img.naturalHeight * scale));
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < image.data.length; i += 4) {
        const g = 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
        const v = g > 150 ? 255 : g < 80 ? 0 : Math.round((g - 80) * 255 / 70);
        image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      }
      ctx.putImageData(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare image')), 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function readImages(files) {
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (!imgs.length) return;
  $('uploadList').innerHTML = imgs.map(f => `<div class="upload-item"><span>${esc(f.name)}</span><span>${Math.round(f.size/1024)} KB</span></div>`).join('');
  let text = '';
  $('ocrStatus').textContent = 'Preparing screenshots…';
  let worker;
  try {
    worker = await Tesseract.createWorker('eng');
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1', user_defined_dpi: '300' });
    for (const f of imgs) {
      try {
        $('ocrStatus').textContent = `Reading ${f.name}…`;
        const prepared = await preprocessImage(f);
        const r = await worker.recognize(prepared, {}, { blocks: true });
        text += `\n${r.data.text || ''}`;
        if (r.data.blocks) {
          text += '\n' + r.data.blocks.map(b => b.text || '').join('\n');
        }
      } catch (e) { console.warn('OCR failed', e); }
    }
  } finally {
    if (worker) await worker.terminate();
  }
  S.text = text;
  detectTeams(text);
  parseOdds(text);
  renderOdds();
  $('ocrStatus').textContent = S.home && S.away
    ? `Detected ${S.home} vs ${S.away}. Please confirm the names.`
    : 'OCR finished. Please enter or correct the team names.';
}

function detectTeams(text) {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const ignore = /^(markets?|stats?|codes?|all|main|goals?|corners?|half|players?|teams?|match|over|under|asian|double chance|handicap|early goals?|1st goal|details|live|new|home|away|draw|yes|no|booking|combo|minutes?)$/i;
  for (const x of lines) {
    const m = x.match(/^(.{2,40})\s+(?:vs\.?|v\.?|[-–—])\s+(.{2,40})$/i);
    if (m && !ignore.test(m[1]) && !ignore.test(m[2])) { S.home = clean(m[1]); S.away = clean(m[2]); break; }
  }
  if (!S.home || !S.away) {
    const candidates = lines.filter(x => x.length >= 3 && x.length <= 32 && !ignore.test(x) && !/\b(?:1\.\d{2}|[2-9]\d?\.\d{2})\b/.test(x) && !/^\d/.test(x));
    const likely = candidates.filter(x => /[A-Za-zÀ-ÿ]/.test(x));
    if (likely.length >= 2) { S.home = S.home || likely[0]; S.away = S.away || likely[1]; }
  }
  if (S.home) $('homeTeam').value = S.home;
  if (S.away) $('awayTeam').value = S.away;
}

const MARKET_HEADERS = [
  [/^1x2\s*[-–—]?\s*1up/i, '1X2 - 1UP'], [/^1x2\s*[-–—]?\s*2up/i, '1X2 - 2UP'],
  [/^1x2\s*[-–—]?\s*never\s*down/i, '1X2 - Never Down'], [/^1x2/i, '1X2'],
  [/^double\s+chance/i, 'Double Chance'], [/^both\s+teams\s+to\s+score|^btts/i, 'BTTS'],
  [/^over\s*\/\s*under\s*-\s*early/i, 'Early Goals'], [/^early\s+goals/i, 'Early Goals'],
  [/^asian\s+over/i, 'Asian Over/Under'], [/^over\s*\/\s*under/i, 'Over/Under'],
  [/^handicap/i, 'Handicap'], [/^1st\s+goal|^first\s+goal/i, 'First Goal'],
  [/^match\s+goals/i, 'Match Goals'], [/^team\s+goals/i, 'Team Goals'],
  [/^corners/i, 'Corners'], [/^bookings?|cards?/i, 'Cards']
];
function normalOdd(n) { return n >= 1.001 && n <= 100 ? n : null; }
function parseNums(x) {
  return [...x.replace(/,/g,'.').matchAll(/(?<!\d)(\d+(?:\.\d+)?)(?!\d)/g)].map(m => +m[1]);
}
function parseOdds(text) {
  let market = 'Other', out = [];
  for (const raw of text.split(/\r?\n/)) {
    const x = raw.replace(/[*•]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!x) continue;
    const header = MARKET_HEADERS.find(([re]) => re.test(x));
    if (header) { market = header[1]; continue; }
    const nums = parseNums(x);
    if (!nums.length) continue;
    const odds = nums.map(normalOdd).filter(Boolean);
    const line = nums.find(n => n <= 10 && !Number.isInteger(n) || [0,1,2,3,4,5,6,7,8,9,10].includes(n));
    if (market === 'Over/Under' || market === 'Asian Over/Under') {
      if (odds.length >= 2) out.push({ market, line: line ?? nums[0], sel:'Over', odd:odds[0] }, { market, line: line ?? nums[0], sel:'Under', odd:odds[1] });
    } else if (market === 'Early Goals' && odds.length >= 1) {
      out.push({ market, line: line ?? nums[0], sel:'Over', odd:odds[0] });
    } else if (market === '1X2' && odds.length >= 3) {
      out.push({ market, sel:'Home', odd:odds[0] }, { market, sel:'Draw', odd:odds[1] }, { market, sel:'Away', odd:odds[2] });
    } else if (market === 'BTTS' && odds.length >= 2) {
      out.push({ market, sel:'Yes', odd:odds[0] }, { market, sel:'No', odd:odds[1] });
    } else if (market === 'Double Chance' && odds.length >= 3) {
      out.push({ market, sel:'1X', odd:odds[0] }, { market, sel:'12', odd:odds[1] }, { market, sel:'X2', odd:odds[2] });
    } else if (market === 'First Goal' && odds.length >= 3) {
      out.push({ market, sel:'Home', odd:odds[0] }, { market, sel:'No Goal', odd:odds[1] }, { market, sel:'Away', odd:odds[2] });
    }
  }
  const seen = new Set();
  S.odds = out.filter(o => { const k = `${o.market}|${o.line ?? ''}|${o.sel}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 250);
}

function renderOdds() {
  if (!S.odds.length) { $('oddsTableWrap').innerHTML = '<div class="empty-state">No readable markets yet. Upload a clearer screenshot or use the demo.</div>'; return; }
  $('oddsTableWrap').innerHTML = `<table class="odds-table"><thead><tr><th>Market</th><th>Selection</th><th>Line</th><th>Odds</th></tr></thead><tbody>${S.odds.map((o,i) => `<tr><td>${esc(o.market)}</td><td>${esc(o.sel)}</td><td>${o.line ?? '—'}</td><td><input class="odd-input" data-i="${i}" value="${o.odd.toFixed(2)}" type="number" min="1.001" step="0.01" aria-label="${esc(o.market)} ${esc(o.sel)} odds"></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('.odd-input').forEach(x => x.onchange = e => { const v = +e.target.value; if (v >= 1.001 && v <= 100) S.odds[+e.target.dataset.i].odd = v; });
}

function demo() {
  S.home='Copenhagen'; S.away='Opponent'; $('homeTeam').value=S.home; $('awayTeam').value=S.away; $('competition').value='Sample fixture';
  S.odds=[{market:'1X2',sel:'Home',odd:1.95},{market:'1X2',sel:'Draw',odd:3.60},{market:'1X2',sel:'Away',odd:3.80},...[.5,1.5,2.5,3.5,4.5,5.5].flatMap((line,i)=>[{market:'Over/Under',line,sel:'Over',odd:[1.02,1.15,1.50,2.25,3.75,6.70][i]},{market:'Over/Under',line,sel:'Under',odd:[12.5,5.2,2.55,1.64,1.26,1.10][i]}),{market:'BTTS',sel:'Yes',odd:1.72},{market:'BTTS',sel:'No',odd:2.05},{market:'Double Chance',sel:'1X',odd:1.30},{market:'Double Chance',sel:'12',odd:1.28},{market:'Double Chance',sel:'X2',odd:1.65}];
  renderOdds(); $('ocrStatus').textContent='Demo odds loaded. Replace them with your screenshot.';
}
$('demoBtn').onclick=demo;
$('clearOddsBtn').onclick=()=>{S.odds=[];renderOdds();};

async function getForm(team){ try { if(window.PredictIQFreeData?.recentMatches) return await window.PredictIQFreeData.recentMatches(team,5); } catch(e){ console.warn('Free data lookup failed',e); } return null; }
function formatPick(x){ return `${x.market} — ${x.sel}${x.line!=null?' '+x.line:''}`; }

function renderReport(h,a,result){
  $('results').classList.remove('hidden'); $('resultMatch').textContent=`${h.team} vs ${a.team}`; $('resultCompetition').textContent=$('competition').value||'Match analysis'; $('resultDate').textContent=$('matchDate').value||'';
  $('homeXg').textContent=result.xg.home.toFixed(2); $('awayXg').textContent=result.xg.away.toFixed(2); $('totalXg').textContent=result.xg.total.toFixed(2);
  $('matchProbabilities').innerHTML=[['Home',result.p.home],['Draw',result.p.draw],['Away',result.p.away]].map(([n,p])=>`<div class="prob-line"><span>${n}</span><div class="prob-bar"><i style="width:${p*100}%"></i></div><strong>${(p*100).toFixed(1)}%</strong></div>`).join('');
  $('formCards').innerHTML=[result.home,result.away].map(f=>`<div class="form-card"><h4>${esc(f.team)}</h4><div class="metrics"><div class="metric"><span>Attack</span><b>${f.attack.toFixed(0)}/100</b></div><div class="metric"><span>Defence</span><b>${f.defence.toFixed(0)}/100</b></div><div class="metric"><span>Form</span><b>${f.form.toFixed(0)}/100</b></div><div class="metric"><span>Last 5</span><b>${f.win??0}W ${f.draw??0}D ${f.loss??0}L</b></div></div></div>`).join('');
  const top=result.top3[0]; $('noBetBox').classList.toggle('hidden',!result.noBet);
  if(top){ $('topPickMarket').textContent=formatPick(top); $('topPickProb').textContent=(top.probability*100).toFixed(1)+'%'; $('topPickOdds').textContent=top.odd.toFixed(2); $('topPickImplied').textContent=(top.implied*100).toFixed(1)+'%'; $('topPickEdge').textContent=`${top.edge>=0?'+':''}${(top.edge*100).toFixed(1)} pp`; $('topPickConfidence').textContent=top.confidence>=85&&top.probability>=.85?'HIGH':top.confidence>=60?'MEDIUM':'DATA LIMITED'; $('topPickReason').textContent=`Model probability ${(top.probability*100).toFixed(1)}%, bookmaker implied probability ${(top.implied*100).toFixed(1)}%, data confidence ${top.confidence}%.`;
  } else { $('topPickMarket').textContent='No qualifying market'; $('topPickProb').textContent='—'; $('topPickOdds').textContent='—'; $('topPickImplied').textContent='—'; $('topPickEdge').textContent='—'; $('topPickConfidence').textContent='NO BET'; $('topPickReason').textContent='The model did not find a market that met its probability, data-quality and price filters.'; }
  $('topThree').innerHTML=result.top3.map((x,i)=>`<div class="pick-item"><div class="rank">#${i+1}</div><div><h4>${esc(formatPick(x))}</h4><p>Odds ${x.odd.toFixed(2)} • model ${(x.probability*100).toFixed(1)}% • implied ${(x.implied*100).toFixed(1)}% • edge ${(x.edge*100).toFixed(1)} pp</p></div><div class="prob">${(x.probability*100).toFixed(1)}%</div></div>`).join('')||'<div class="empty-state">No qualifying selections. Try another match or provide clearer odds/data.</div>';
  const scores=result.correctScores.slice(0,3).map(x=>`${x.home}-${x.away} ${(x.p*100).toFixed(1)}%`).join(' • ');
  $('modelNotes').innerHTML=[`Last five matches are weighted by recency; the newest match carries the most weight.`,`Expected goals: ${result.xg.home.toFixed(2)} home / ${result.xg.away.toFixed(2)} away.`,`Top score probabilities: ${scores||'not available'}.`,`Data confidence: ${result.dataConfidence}%. Missing or incomplete data lowers eligibility rather than being replaced with invented statistics.`,`Bookmaker odds are used for price comparison, not as the model's prediction.`].map(x=>`<li>${x}</li>`).join(''); $('results').scrollIntoView({behavior:'smooth'});
}

$('analyzeBtn').onclick=async()=>{ const home=$('homeTeam').value.trim(),away=$('awayTeam').value.trim(); if(!home||!away){alert('Please confirm both team names.');return;} if(!S.odds.length){alert('Please upload an odds screenshot first.');return;} $('analyzeBtn').disabled=true;$('analyzeBtn').textContent='Analyzing…';S.home=home;S.away=away;try{const[h,a]=await Promise.all([getForm(home),getForm(away)]);if(!h||!a){$('results').classList.remove('hidden');$('noBetBox').classList.remove('hidden');$('topPickMarket').textContent='No prediction — insufficient verified data';$('topPickProb').textContent='—';$('topPickConfidence').textContent='NO BET';$('topPickReason').textContent='We could not verify enough recent match data for both teams from the free data source.';$('topThree').innerHTML='<div class="empty-state">No prediction was generated. This protects users from fabricated statistics.</div>';$('results').scrollIntoView({behavior:'smooth'});return;}const result=window.PredictIQEngine.analyze(S.odds,h,a);renderReport(h,a,result);}finally{$('analyzeBtn').disabled=false;$('analyzeBtn').textContent='Analyze match';}};
