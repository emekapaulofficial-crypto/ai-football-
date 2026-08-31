/* PredictIQ SportyBet-style odds parser v2
 * Converts OCR text into structured, validated markets.
 * It deliberately skips ambiguous odds instead of inventing values.
 */
(function () {
  const MARKET_RULES = [
    [/^1x2\s*[-–—]?\s*1up/i, '1X2 - 1UP'],
    [/^1x2\s*[-–—]?\s*2up/i, '1X2 - 2UP'],
    [/^1x2\s*[-–—]?\s*never\s*down/i, '1X2 - Never Down'],
    [/^1x2\b/i, '1X2'],
    [/^double\s+chance/i, 'Double Chance'],
    [/^(both\s+teams\s+to\s+score|btts)\b/i, 'BTTS'],
    [/^(over\s*\/\s*under\s*-\s*early|early\s+goals?)\b/i, 'Early Goals'],
    [/^asian\s+over\s*\/\s*under/i, 'Asian Over/Under'],
    [/^over\s*\/\s*under/i, 'Over/Under'],
    [/^handicap/i, 'Handicap'],
    [/^(1st|first)\s+goal/i, 'First Goal'],
    [/^match\s+goals?/i, 'Match Goals'],
    [/^team\s+goals?/i, 'Team Goals'],
    [/^corners?/i, 'Corners'],
    [/^(bookings?|cards?)/i, 'Cards']
  ];

  const HEADER_WORDS = /^(over|under|asian|home|away|draw|yes|no|all|main|goals?|corners?|half|players?|teams?|match|bookings?|cards?|combo|minutes?|live|in[- ]play|available|markets?|early|handicap|double|chance|1x2|first|1st)$/i;
  const ODDS_RE = /(?<!\d)(\d{1,3}(?:[.,]\d{1,3})?)(?!\d)/g;

  function fixOcrToken(token) {
    let s = String(token).trim()
      .replace(/[Oo]/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8')
      .replace(/\s+/g, '')
      .replace(',', '.');
    // Common OCR omission of the decimal in short decimal odds: 150 -> 1.50.
    if (/^\d{3}$/.test(s) && s[0] === '1') s = `${s[0]}.${s.slice(1)}`;
    return s;
  }

  function numberCandidates(line) {
    return [...String(line).matchAll(ODDS_RE)]
      .map(m => fixOcrToken(m[1]))
      .map(Number)
      .filter(Number.isFinite);
  }

  function isOdd(n) { return n >= 1.001 && n <= 100; }
  function isLine(n) { return n >= 0 && n <= 20; }

  function detectHeader(line) {
    for (const [re, name] of MARKET_RULES) if (re.test(line)) return name;
    return null;
  }

  function cleanLine(line) {
    return String(line)
      .replace(/[•*]/g, ' ')
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function probableLine(nums, market) {
    if (!nums.length) return null;
    const candidates = nums.filter(isLine);
    if (!candidates.length) return null;
    // In totals markets the line normally appears before the two odds.
    if (/Goals|Over\/Under|Handicap|Corners|Cards/i.test(market)) return candidates[0];
    return null;
  }

  function add(out, market, sel, odd, line, source) {
    if (!isOdd(odd)) return;
    out.push({ market, sel, odd: +odd.toFixed(3), ...(line != null ? { line } : {}), source });
  }

  function parseSportyOdds(text) {
    const lines = String(text || '').split(/\r?\n/).map(cleanLine).filter(Boolean);
    const out = [];
    let market = 'Other';
    let pendingLine = null;

    for (const raw of lines) {
      const header = detectHeader(raw);
      if (header) { market = header; pendingLine = null; continue; }
      if (HEADER_WORDS.test(raw)) continue;

      const nums = numberCandidates(raw);
      if (!nums.length) continue;

      // Preserve a standalone total/handicap line for the next odds row.
      if (nums.length === 1 && isLine(nums[0]) && !isOdd(nums[0])) {
        pendingLine = nums[0];
        continue;
      }

      const line = pendingLine ?? probableLine(nums, market);
      const odds = nums.filter(isOdd);
      const source = raw;

      if (market === 'Over/Under' || market === 'Asian Over/Under') {
        // Expected OCR forms: "2.5 1.50 2.55" or separate line then odds.
        const usable = line != null && nums[0] === line ? odds : odds;
        if (usable.length >= 2) {
          add(out, market, 'Over', usable[0], line, source);
          add(out, market, 'Under', usable[1], line, source);
          pendingLine = null;
        }
      } else if (market === 'Early Goals') {
        if (odds.length >= 1) {
          add(out, market, 'Over', odds[0], line, source);
          pendingLine = null;
        }
      } else if (market === '1X2' || /^1X2\s*-/.test(market)) {
        if (odds.length >= 3) {
          add(out, market, 'Home', odds[0], null, source);
          add(out, market, 'Draw', odds[1], null, source);
          add(out, market, 'Away', odds[2], null, source);
        }
      } else if (market === 'BTTS') {
        if (odds.length >= 2) {
          add(out, market, 'Yes', odds[0], null, source);
          add(out, market, 'No', odds[1], null, source);
        }
      } else if (market === 'Double Chance') {
        if (odds.length >= 3) {
          add(out, market, '1X', odds[0], null, source);
          add(out, market, '12', odds[1], null, source);
          add(out, market, 'X2', odds[2], null, source);
        }
      } else if (market === 'First Goal') {
        if (odds.length >= 3) {
          add(out, market, 'Home', odds[0], null, source);
          add(out, market, 'No Goal', odds[1], null, source);
          add(out, market, 'Away', odds[2], null, source);
        }
      } else if (market === 'Handicap') {
        if (odds.length >= 2) {
          add(out, market, 'Home', odds[0], line, source);
          add(out, market, 'Away', odds[1], line, source);
          pendingLine = null;
        }
      }
    }

    const seen = new Set();
    const unique = out.filter(o => {
      const key = `${o.market}|${o.line ?? ''}|${o.sel}|${o.odd}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    return unique.slice(0, 400);
  }

  window.PredictIQSportyParser = { parseSportyOdds, fixOcrToken };

  // main.js calls the global parser name. Replace it only after the improved parser exists.
  window.parseOdds = function (text) {
    const parsed = parseSportyOdds(text);
    if (window.S && Array.isArray(window.S.odds)) window.S.odds = parsed;
    return parsed;
  };
})();
