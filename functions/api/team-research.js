/* PredictIQ AI — same-origin server-side football research for Cloudflare Pages. */
const SOFA = 'https://www.sofascore.com/api/v1';
const SOFA_API = 'https://api.sofascore.com/api/v1';
const TDB = 'https://www.thesportsdb.com/api/v1/json/123';

const KNOWN = {
  'dynamo kyiv u21': 52680,
  'fc dynamo kyiv u21': 52680,
  'dynamo k u21': 52680,
  'lnz cherkasy u21': 1256107,
  'lnz u21': 1256107,
  'fc lnz cherkasy u21': 1256107,
  'lnz cherkasy(u21)': 1256107
};

const youth = s => /\b(?:u\s*21|u21|u\s*19|u19|youth|under\s*21|under\s*19)\b/i.test(String(s || ''));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|afc|sc|fk|football club)\b/g, ' ').replace(/\s+/g, ' ').trim();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function fetchJson(url) {
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    'referer': 'https://www.sofascore.com/'
  };
  for (const u of [url, url.replace(SOFA, SOFA_API)]) {
    try {
      const r = await fetch(u, { headers });
      if (r.ok) return await r.json();
    } catch (_) {}
  }
  return null;
}

function similarity(q, n) {
  const a = norm(q), b = norm(n);
  if (a === b) return 1;
  if (youth(a) !== youth(b)) return 0;
  const A = new Set(a.split(/[^a-z0-9]+/).filter(Boolean));
  const B = new Set(b.split(/[^a-z0-9]+/).filter(Boolean));
  const overlap = [...A].filter(x => B.has(x)).length;
  return Math.min(1, (2 * overlap) / Math.max(1, A.size + B.size) + (b.includes(a) || a.includes(b) ? 0.25 : 0));
}

async function sofaTeam(query) {
  const key = norm(query);
  if (KNOWN[key]) return { id: String(KNOWN[key]), name: key.includes('lnz') ? 'LNZ Cherkasy U21' : 'Dynamo Kyiv U21' };
  const data = await fetchJson(`${SOFA}/search/all?q=${encodeURIComponent(query)}`);
  let candidates = (data?.results || []).map(x => x.entity || x).filter(x => x?.id && x?.name && (x?.sport?.slug === 'football' || String(x?.type || '').toLowerCase() === 'team'));
  if (youth(query)) candidates = candidates.filter(x => youth(x.name));
  candidates = [...new Map(candidates.map(x => [String(x.id), x])).values()];
  candidates.sort((a, b) => similarity(query, b.name) - similarity(query, a.name));
  const team = candidates[0];
  return team && similarity(query, team.name) >= 0.28 ? { id: String(team.id), name: team.name } : null;
}

function sofaRow(e, id) {
  const status = e?.status || {};
  if (!(status.finished === true || /finished|awarded/i.test(String(status.type || '')))) return null;
  const home = String(e.homeTeam?.id) === String(id);
  const away = String(e.awayTeam?.id) === String(id);
  if (!home && !away) return null;
  const hs = Number(e.homeScore?.current ?? e.homeScore?.normaltime ?? e.homeScore?.display);
  const as = Number(e.awayScore?.current ?? e.awayScore?.normaltime ?? e.awayScore?.display);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return null;
  const gf = home ? hs : as, ga = home ? as : hs;
  return {
    date: e.startTimestamp ? new Date(e.startTimestamp * 1000).toISOString() : '',
    opponent: home ? e.awayTeam?.name : e.homeTeam?.name,
    venue: home ? 'H' : 'A', gf, ga,
    r: gf > ga ? 'W' : gf === ga ? 'D' : 'L',
    competition: e.tournament?.name || e.uniqueTournament?.name || 'Football'
  };
}

async function sofaResearch(query) {
  const team = await sofaTeam(query);
  if (!team) return null;
  const rows = [], seen = new Set();
  for (let page = 0; page < 20 && rows.length < 5; page++) {
    const data = await fetchJson(`${SOFA}/team/${encodeURIComponent(team.id)}/events/last/${page}`);
    if (!data) break;
    for (const event of data.events || []) {
      const row = sofaRow(event, team.id);
      if (!row) continue;
      const key = [row.date, row.opponent, row.gf, row.ga].join('|');
      if (!seen.has(key)) { seen.add(key); rows.push(row); }
    }
    if (data.hasNextPage === false) break;
  }
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return rows.length >= 5 ? { team: team.name, rows: rows.slice(0, 5), provider: 'SofaScore server research', complete: true } : null;
}

function tdbRow(e, id) {
  const home = String(e.idHomeTeam) === String(id), away = String(e.idAwayTeam) === String(id);
  if ((!home && !away) || e.intHomeScore == null || e.intAwayScore == null) return null;
  const hs = Number(e.intHomeScore), as = Number(e.intAwayScore);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return null;
  const gf = home ? hs : as, ga = home ? as : hs;
  return { date: e.dateEvent || e.strTimestamp || '', opponent: home ? e.strAwayTeam : e.strHomeTeam, venue: home ? 'H' : 'A', gf, ga, r: gf > ga ? 'W' : gf === ga ? 'D' : 'L', competition: e.strLeague || 'Football' };
}

async function tdbResearch(query) {
  try {
    const data = await fetchJson(`${TDB}/searchteams.php?t=${encodeURIComponent(query)}`);
    const teams = Array.isArray(data?.teams) ? data.teams : [];
    if (!teams.length) return null;
    const wantYouth = youth(query);
    const candidates = teams.filter(t => !wantYouth || youth(t.strTeam)).sort((a, b) => similarity(query, b.strTeam) - similarity(query, a.strTeam));
    const team = candidates[0] || teams[0];
    if (!team?.idTeam) return null;
    const last = await fetchJson(`${TDB}/eventslast.php?id=${encodeURIComponent(team.idTeam)}`);
    const rows = (last?.results || []).map(e => tdbRow(e, team.idTeam)).filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
    return rows.length >= 5 ? { team: team.strTeam, rows, provider: 'TheSportsDB server research', complete: true } : null;
  } catch (_) { return null; }
}

async function research(query) {
  return (await sofaResearch(query)) || (await tdbResearch(query));
}

export async function onRequestPost({ request }) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'Invalid JSON request.' }, 400); }
  const home = String(body?.home || '').trim();
  const away = String(body?.away || '').trim();
  if (!home || !away) return json({ ok: false, error: 'Home and away teams are required.' }, 400);
  try {
    const [homeResearch, awayResearch] = await Promise.all([research(home), research(away)]);
    const complete = !!homeResearch && !!awayResearch && homeResearch.rows.length >= 5 && awayResearch.rows.length >= 5;
    return json({ ok: complete, complete, home: homeResearch, away: awayResearch, checked: { home, away }, message: complete ? 'Five completed matches verified for both teams.' : 'Five completed matches could not be verified for both teams.' });
  } catch (error) {
    return json({ ok: false, complete: false, error: 'Football research provider failed.', detail: String(error?.message || error) }, 502);
  }
}

export async function onRequestGet() {
  return json({ ok: true, service: 'PredictIQ team research', endpoint: '/api/team-research', method: 'POST' });
}
