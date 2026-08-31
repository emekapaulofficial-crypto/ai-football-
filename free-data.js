/* PredictIQ AI — zero-cost football data layer.
 * Primary free source: TheSportsDB v1 public API key 123.
 * This file deliberately contains no paid credentials.
 * It supplies recent completed matches and refuses to invent form when data is unavailable.
 */
(function () {
  'use strict';

  const BASE = 'https://www.thesportsdb.com/api/v1/json/123';
  const CACHE_TTL = 30 * 60 * 1000;
  const cache = new Map();

  function cached(key) {
    const hit = cache.get(key);
    if (!hit || Date.now() - hit.time > CACHE_TTL) return null;
    return hit.value;
  }
  function put(key, value) {
    cache.set(key, { time: Date.now(), value });
    return value;
  }
  async function get(path) {
    const key = BASE + path;
    const hit = cached(key);
    if (hit) return hit;
    const res = await fetch(key, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Football data request failed (${res.status})`);
    return put(key, await res.json());
  }
  function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

  async function searchTeam(name) {
    const data = await get('/searchteams.php?t=' + encodeURIComponent(name));
    const teams = Array.isArray(data.teams) ? data.teams : [];
    if (!teams.length) return null;
    const wanted = name.trim().toLowerCase();
    return teams.slice().sort((a, b) => {
      const aa = String(a.strTeam || '').toLowerCase();
      const bb = String(b.strTeam || '').toLowerCase();
      return Number(aa === wanted) * -2 + Number(bb === wanted) * 2;
    })[0];
  }

  async function recentMatches(teamName, limit = 5) {
    const team = await searchTeam(teamName);
    if (!team || !team.idTeam) return null;
    const data = await get('/eventslast.php?id=' + encodeURIComponent(team.idTeam));
    const events = (data.results || []).filter(e =>
      e && e.intHomeScore !== null && e.intAwayScore !== null &&
      Number.isFinite(Number(e.intHomeScore)) && Number.isFinite(Number(e.intAwayScore))
    ).slice(0, limit);
    if (!events.length) return null;

    const rows = events.map(e => {
      const isHome = String(e.idHomeTeam) === String(team.idTeam) || String(e.strHomeTeam).toLowerCase() === String(team.strTeam).toLowerCase();
      const gf = Number(isHome ? e.intHomeScore : e.intAwayScore);
      const ga = Number(isHome ? e.intAwayScore : e.intHomeScore);
      return {
        date: e.dateEvent || e.strTimestamp || null,
        opponent: isHome ? e.strAwayTeam : e.strHomeTeam,
        venue: isHome ? 'H' : 'A',
        gf, ga,
        result: gf > ga ? 'W' : gf === ga ? 'D' : 'L'
      };
    });

    return {
      provider: 'TheSportsDB Free API',
      team: team.strTeam,
      teamId: team.idTeam,
      rows,
      scored: avg(rows.map(r => r.gf)),
      conceded: avg(rows.map(r => r.ga)),
      wins: rows.filter(r => r.result === 'W').length,
      draws: rows.filter(r => r.result === 'D').length,
      losses: rows.filter(r => r.result === 'L').length,
      complete: rows.length >= 5
    };
  }

  // Replace the prototype's old direct lookup with the documented free key.
  window.fetchForm = recentMatches;

  // Expose diagnostics for the UI and future backend migration.
  window.PredictIQFreeData = {
    provider: 'TheSportsDB Free API',
    free: true,
    cacheMinutes: 30,
    recentMatches,
    searchTeam,
    clearCache: () => cache.clear()
  };
})();
