const S = { odds: [], text: '', home: '', away: '' };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const clean = s => String(s).replace(/[^\p{L}\p{N}&.' -]/gu, ' ').replace(/\s+/g, ' ').trim();

$('dropzone').addEventListener('dragover', e => { e.preventDefault(); $('dropzone').classList.add('drag'); });
$('dropzone').addEventListener('dragleave', () => $('dropzone').classList.remove('drag'));
$('dropzone').addEventListener('drop', e => { e.preventDefault(); $('dropzone').classList.remove('drag'); readImages([...e.dataTransfer.files]); });
$('fileInput').addEventListener('change', e => readImages([...e.target.files]));

async function readImages(files) {
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (!imgs.length) return;
  $('uploadList').innerHTML = imgs.map(f => `<div class="upload-item"><span>${esc(f.name)}</span><span>${Math.round(f.size/1024)} KB</span></div>`).join('');
  let text = '';
  $('ocrStatus').textContent = 'Reading screenshot…';
  for (const f of imgs) {
    try {
      const r = await Tesseract.recognize(f, 'eng', { logger: m => {
        if (m.status === 'recognizing text') $('ocrStatus').textContent = `Reading ${f.name}: ${Math.round(m.progress*100)}%`;
      }});
      text += '\n' + r.data.text;
    } catch (e) { console.warn('OCR failed', e); }
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
  for (const x of lines) {
    const m = x.match(/^(.{2,36})\s+(?:vs\.?|v\.?|[-–])\s+(.{2,36})$/i);
    if (m) { S.home = clean(m[1]); S.away = clean(m[2]); break; }
  }
  if (!S.home || !S.away) {
    const bad = /^(markets?|stats?|codes?|all|main|goals|corners|half|players?|teams?|match|over|under|asian|double chance|handicap|early goals|1st goal|details|live|new)$/i;
    const candidates = lines.filter(x => x.length >= 3 && x.length <= 28 && !bad.test(x) && !/[0-9]{2,}/.test(x));
    if (candidates.length > 1) { S.home = candidates[0]; S.away = candidates[1]; }
  }
  if (S.home) $('homeTeam').value = S.home;
  if (S.away) $('awayTeam').value = S.away;
}

function parseOdds(text) {
  let market = 'Other', out = [];
  for (const raw of text.split(/\r?\n/)) {
    const x = raw.replace(/[*•]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!x) continue;
    if (/^1x2/i.test(x)) { market = '1X2'; continue; }
    if (/^over\s*\/\s*under\s*-\s*early/i.test(x)) { market = 'Early Goals'; continue; }
    if (/^asian\s+over/i.test(x)) { market = 'Asian Over/Under'; continue; }
    if (/^over\s*\/\s*under$/i.test(x)) { market = 'Over/Under'; continue; }
    if (/^double\s+chance/i.test(x)) { market = 'Double Chance'; continue; }
    if (/^both\s+teams\s+to\s+score|^btts/i.test(x)) { market = 'BTTS'; continue; }
    if (/^handicap/i.test(x)) { market = 'Handicap'; continue; }

    const nums = [...x.matchAll(/(?<!\d)(\d+(?:\.\d+)?)(?!\d)/g)].map(m => +m[1]);
    if (!nums.length) continue;
    const odds = nums.filter(v => v >= 1.001 && v <= 100);

    if ((market === 'Over/Under' || market === 'Asian Over/Under') && odds.length >= 2) {
      out.push({ market, line: nums[0], sel: 'Over', odd: odds[0] }, { market, line: nums[0], sel: 'Under', odd: odds[1] });
    } else if (market === 'Early Goals' && odds.length) {
      out.push({ market, line: nums[0], sel: 'Over', odd: odds[0] });
    } else if (market === '1X2' && odds.length >= 3) {
      out.push({ market, sel: 'Home', odd: odds[0] }, { market, sel: 'Draw', odd: odds[1] }, { market, sel: 'Away', odd: odds[2] });
    } else if (market === 'BTTS' && odds.length >= 2) {
      out.push({ market, sel: 'Yes', odd: odds[0] }, { market, sel: 'No', odd: odds[1] });
    }
  }
  S.odds = out.slice(0, 150);
}

function renderOdds() {
  if (!S.odds.length) {
    $('oddsTableWrap').innerHTML = '<div class="empty-state">No readable markets yet. Upload a screenshot or use the demo.</div>';
    return;
  }
  $('oddsTableWrap').innerHTML = `<table class="odds-table"><thead><tr><th>Market</th><th>Selection</th><th>Line</th><th>Odds</th></tr></thead><tbody>${S.odds.map((o,i) => `<tr><td>${esc(o.market)}</td><td>${esc(o.sel)}</td><td>${o.line ?? '—'}</td><td><input class="odd-input" data-i="${i}" value="${o.odd.toFixed(2)}" type="number" min="1.001" step="0.01"></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('.odd-input').forEach(x => x.onchange = e => S.odds[+e.target.dataset.i].odd = +e.target.value);
}

function demo() {
  S.home = 'Copenhagen'; S.away = 'Opponent';
  $('homeTeam').value = S.home; $('awayTeam').value = S.away; $('competition').value = 'Sample fixture';
  S.odds = [
    {market:'1X2',sel:'Home',odd:1.95},{market:'1X2',sel:'Draw',odd:3.60},{market:'1X2',sel:'Away',odd:3.80},
    ...[[.5,1.02,12.5],[1.5,1.15,5.2],[2.5,1.5,2.55],[3.5,2.25,1.64],[4.5,3.75,1.26],[5.5,6.7,1.1]].flatMap(([line,o,u]) => [
      {market:'Over/Under',line,sel:'Over',odd:o},{market:'Over/Under',line,sel:'Under',odd:u}
    ]),
    {market:'BTTS',sel:'Yes',odd:1.72},{market:'BTTS',sel:'No',odd:2.05}
  ];
  renderOdds(); $('ocrStatus').textContent = 'Demo odds loaded. Replace them with your screenshot.';
}
$('demoBtn').onclick = demo;
$('clearOddsBtn').onclick = () => { S.odds = []; renderOdds(); };

async function getForm(team) {
  try {
    if (window.PredictIQFreeData?.recentMatches) return await window.PredictIQFreeData.recentMatches(team, 5);
    if (window.fetchForm) return await window.fetchForm(team, 5);
  } catch (e) { console.warn('Free data lookup failed', e); }
  return null;
}

function formatPick(x) {
  return `${x.market} — ${x.sel}${x.line != null ? ' ' + x.line : ''}`;
}

function renderReport(h, a, result) {
  $('results').classList.remove('hidden');
  $('resultMatch').textContent = `${h.team} vs ${a.team}`;
  $('resultCompetition').textContent = $('competition').value || 'Match analysis';
  $('resultDate').textContent = $('matchDate').value || '';
  $('homeXg').textContent = result.xg.home.toFixed(2);
  $('awayXg').textContent = result.xg.away.toFixed(2);
  $('totalXg').textContent = result.xg.total.toFixed(2);

  $('matchProbabilities').innerHTML = [['Home',result.p.home],['Draw',result.p.draw],['Away',result.p.away]].map(([n,p]) =>
    `<div class="prob-line"><span>${n}</span><div class="prob-bar"><i style="width:${p*100}%"></i></div><strong>${(p*100).toFixed(1)}%</strong></div>`).join('');

  $('formCards').innerHTML = [result.home, result.away].map(f => `<div class="form-card"><h4>${esc(f.team)}</h4><div class="metrics">
    <div class="metric"><span>Attack</span><b>${f.attack.toFixed(0)}/100</b></div>
    <div class="metric"><span>Defence</span><b>${f.defence.toFixed(0)}/100</b></div>
    <div class="metric"><span>Form</span><b>${f.form.toFixed(0)}/100</b></div>
    <div class="metric"><span>Last 5</span><b>${f.win ?? 0}W ${f.draw ?? 0}D ${f.loss ?? 0}L</b></div>
  </div></div>`).join('');

  const top = result.top3[0];
  $('noBetBox').classList.toggle('hidden', !result.noBet);
  if (top) {
    $('topPickMarket').textContent = formatPick(top);
    $('topPickProb').textContent = (top.probability*100).toFixed(1) + '%';
    $('topPickOdds').textContent = top.odd.toFixed(2);
    $('topPickImplied').textContent = (top.implied*100).toFixed(1) + '%';
    $('topPickEdge').textContent = `${top.edge >= 0 ? '+' : ''}${(top.edge*100).toFixed(1)} pp`;
    $('topPickConfidence').textContent = top.confidence >= 85 && top.probability >= .85 ? 'HIGH' : top.confidence >= 60 ? 'MEDIUM' : 'DATA LIMITED';
    $('topPickReason').textContent = `Model probability ${ (top.probability*100).toFixed(1) }%, bookmaker implied probability ${(top.implied*100).toFixed(1)}%, data confidence ${top.confidence}%.`;
  } else {
    $('topPickMarket').textContent = 'No qualifying market';
    $('topPickProb').textContent = '—'; $('topPickOdds').textContent = '—'; $('topPickImplied').textContent = '—'; $('topPickEdge').textContent = '—'; $('topPickConfidence').textContent = 'NO BET';
    $('topPickReason').textContent = 'The model did not find a market that met its probability, data-quality and price filters.';
  }

  $('topThree').innerHTML = result.top3.map((x,i) => `<div class="pick-item"><div class="rank">#${i+1}</div><div><h4>${esc(formatPick(x))}</h4><p>Odds ${x.odd.toFixed(2)} • model ${(x.probability*100).toFixed(1)}% • implied ${(x.implied*100).toFixed(1)}% • edge ${(x.edge*100).toFixed(1)} pp</p></div><div class="prob">${(x.probability*100).toFixed(1)}%</div></div>`).join('') || '<div class="empty-state">No qualifying selections. Try another match or provide clearer odds/data.</div>';

  const scores = result.correctScores.slice(0,3).map(x => `${x.home}-${x.away} ${(x.p*100).toFixed(1)}%`).join(' • ');
  $('modelNotes').innerHTML = [
    `Last five matches are weighted by recency; the newest match carries the most weight.`,
    `Expected goals: ${result.xg.home.toFixed(2)} home / ${result.xg.away.toFixed(2)} away.`,
    `Top score probabilities: ${scores || 'not available'}.`,
    `Data confidence: ${result.dataConfidence}%. Missing or incomplete data lowers eligibility rather than being replaced with invented statistics.`,
    `Bookmaker odds are used for price comparison, not as the model's prediction.`
  ].map(x => `<li>${x}</li>`).join('');

  $('results').scrollIntoView({ behavior:'smooth' });
}

$('analyzeBtn').onclick = async () => {
  const home = $('homeTeam').value.trim(), away = $('awayTeam').value.trim();
  if (!home || !away) { alert('Please confirm both team names.'); return; }
  if (!S.odds.length) { alert('Please upload an odds screenshot first.'); return; }
  $('analyzeBtn').disabled = true; $('analyzeBtn').textContent = 'Analyzing…';
  S.home = home; S.away = away;
  try {
    const [h, a] = await Promise.all([getForm(home), getForm(away)]);
    if (!h || !a) {
      $('results').classList.remove('hidden');
      $('noBetBox').classList.remove('hidden');
      $('topPickMarket').textContent = 'No prediction — insufficient verified data';
      $('topPickProb').textContent = '—'; $('topPickConfidence').textContent = 'NO BET';
      $('topPickReason').textContent = 'We could not verify enough recent match data for both teams from the free data source.';
      $('topThree').innerHTML = '<div class="empty-state">No prediction was generated. This protects users from fabricated statistics.</div>';
      $('results').scrollIntoView({behavior:'smooth'});
      return;
    }
    const result = window.PredictIQEngine.analyze(S.odds, h, a);
    renderReport(h, a, result);
  } finally {
    $('analyzeBtn').disabled = false; $('analyzeBtn').textContent = 'Analyze match';
  }
};
