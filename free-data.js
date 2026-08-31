/* PredictIQ AI — zero-cost football data layer.
 * Primary free source: TheSportsDB v1 public API key 123.
 * No paid credentials are used. Recent form is cached in memory for 30 minutes.
 * The analysis handler refuses to fabricate team statistics when the free source fails.
 */
(function () {
  'use strict';

  const BASE_OLD = 'https://www.thesportsdb.com/api/v1/json/3/';
  const BASE_FREE = 'https://www.thesportsdb.com/api/v1/json/123/';
  const CACHE_TTL = 30 * 60 * 1000;
  const cache = new Map();
  const nativeFetch = window.fetch.bind(window);

  // The prototype used the old numeric key. Redirect those requests to the documented free key.
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.indexOf(BASE_OLD) === 0) {
      input = BASE_FREE + input.slice(BASE_OLD.length);
    } else if (input && input.url && input.url.indexOf(BASE_OLD) === 0) {
      input = new Request(BASE_FREE + input.url.slice(BASE_OLD.length), input);
    }
    return nativeFetch(input, init);
  };

  function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

  async function json(url) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.time < CACHE_TTL) return hit.value;
    const response = await nativeFetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Free football data unavailable (${response.status})`);
    const value = await response.json();
    cache.set(url, { time: Date.now(), value });
    return value;
  }

  async function recentMatches(teamName, limit = 5) {
    const search = await json(BASE_FREE + 'searchteams.php?t=' + encodeURIComponent(teamName));
    const teams = Array.isArray(search.teams) ? search.teams : [];
    if (!teams.length) return null;
    const wanted = teamName.trim().toLowerCase();
    const team = teams.slice().sort((a, b) => {
      const aa = String(a.strTeam || '').toLowerCase();
      const bb = String(b.strTeam || '').toLowerCase();
      return (aa === wanted ? -1 : 0) - (bb === wanted ? -1 : 0);
    })[0];
    if (!team || !team.idTeam) return null;

    const data = await json(BASE_FREE + 'eventslast.php?id=' + encodeURIComponent(team.idTeam));
    const events = (data.results || []).filter(e =>
      e && e.intHomeScore !== null && e.intAwayScore !== null &&
      Number.isFinite(Number(e.intHomeScore)) && Number.isFinite(Number(e.intAwayScore))
    ).slice(0, limit);
    if (!events.length) return null;

    const rows = events.map(e => {
      const isHome = String(e.idHomeTeam) === String(team.idTeam) ||
        String(e.strHomeTeam).toLowerCase() === String(team.strTeam).toLowerCase();
      const gf = Number(isHome ? e.intHomeScore : e.intAwayScore);
      const ga = Number(isHome ? e.intAwayScore : e.intHomeScore);
      return {
        date: e.dateEvent || e.strTimestamp || null,
        opponent: isHome ? e.strAwayTeam : e.strHomeTeam,
        venue: isHome ? 'H' : 'A',
        gf, ga,
        r: gf > ga ? 'W' : gf === ga ? 'D' : 'L'
      };
    });

    const w = [.30, .24, .20, .15, .11];
    let gf = 0, ga = 0, pts = 0;
    rows.forEach((r, i) => {
      const weight = w[i] || .10;
      gf += r.gf * weight;
      ga += r.ga * weight;
      pts += (r.r === 'W' ? 3 : r.r === 'D' ? 1 : 0) * weight;
    });

    return {
      team: team.strTeam,
      rows,
      gf,
      ga,
      win: rows.filter(r => r.r === 'W').length,
      draw: rows.filter(r => r.r === 'D').length,
      loss: rows.filter(r => r.r === 'L').length,
      attack: clamp(50 + gf * 25, 20, 95),
      def: clamp(90 - ga * 28, 20, 95),
      form: pts / 3 * 100,
      provider: 'TheSportsDB Free API',
      complete: rows.length >= 5
    };
  }

  window.PredictIQFreeData = {
    provider: 'TheSportsDB Free API',
    free: true,
    cacheMinutes: 30,
    recentMatches,
    clearCache: () => cache.clear()
  };

  // Replace the prototype handler so missing provider data never becomes fake form.
  $('analyzeBtn').onclick = async () => {
    const home = $('homeTeam').value.trim();
    const away = $('awayTeam').value.trim();
    if (!home || !away) {
      alert('Please confirm both team names.');
      return;
    }
    $('analyzeBtn').disabled = true;
    $('analyzeBtn').textContent = 'Checking free football data…';
    try {
      const [h, a] = await Promise.all([recentMatches(home), recentMatches(away)]);
      if (!h || !a || h.rows.length < 5 || a.rows.length < 5) {
        $('ocrStatus').textContent = 'Not enough verified recent-match data was found. No prediction was generated.';
        alert('PredictIQ could not verify the last five matches for both teams from the free data source. No prediction was generated so the system does not invent statistics.');
        return;
      }
      report(h, a, model(h, a), true);
      $('ocrStatus').textContent = 'Analysis complete using verified recent-match data from the free provider.';
    } catch (error) {
      console.error(error);
      $('ocrStatus').textContent = 'Free football data is temporarily unavailable. No prediction was generated.';
      alert('The free football data source is temporarily unavailable. Please try again later.');
    } finally {
      $('analyzeBtn').disabled = false;
      $('analyzeBtn').textContent = 'Analyze match';
    }
  };
})();
