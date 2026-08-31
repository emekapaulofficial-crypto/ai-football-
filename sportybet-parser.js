/* PredictIQ SportyBet screenshot parser v2
 * Converts OCR lines into normalized market records without inventing values.
 */
const MARKET_PATTERNS = [
  [/^1x2\s*[-–—]?\s*1up/i,'1X2 - 1UP'],
  [/^1x2\s*[-–—]?\s*2up/i,'1X2 - 2UP'],
  [/^1x2\s*[-–—]?\s*never\s*down/i,'1X2 - Never Down'],
  [/^1x2/i,'1X2'],
  [/^double\s+chance/i,'Double Chance'],
  [/^(both\s+teams\s+to\s+score|btts)/i,'BTTS'],
  [/^over\s*\/\s*under\s*-\s*early|^early\s+goals/i,'Early Goals'],
  [/^asian\s+over\s*\/\s*under|^asian/i,'Asian Over/Under'],
  [/^over\s*\/\s*under/i,'Over/Under'],
  [/^handicap/i,'Handicap'],
  [/^(1st|first)\s+goal/i,'First Goal'],
  [/^match\s+goals/i,'Match Goals'],
  [/^team\s+goals/i,'Team Goals'],
  [/^corners/i,'Corners'],
  [/^(bookings?|cards?)/i,'Cards']
];

export function normalizeOcrLine(value='') {
  return String(value)
    .replace(/[|]/g,' ')
    .replace(/\bI(?=\.?\d)/g,'1')
    .replace(/,(?=\d)/g,'.')
    .replace(/(\d)\s+(?=\d{2}\b)/g,'$1.')
    .replace(/\s+/g,' ')
    .trim();
}

export function normalizeOdd(value) {
  const raw = normalizeOcrLine(value).replace(/[^0-9.]/g,'');
  if (!raw) return null;
  let n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // Common OCR omission: 150 -> 1.50, but reject ambiguous values outside betting ranges.
  if (n >= 100 && n <= 999) n /= 100;
  if (n < 1.001 || n > 1000) return null;
  return Number(n.toFixed(2));
}

export function detectMarketHeader(line) {
  const clean = normalizeOcrLine(line);
  for (const [re,name] of MARKET_PATTERNS) if (re.test(clean)) return name;
  return null;
}

export function parseOddsLines(text='') {
  const lines = String(text).split(/\r?\n/).map(normalizeOcrLine).filter(Boolean);
  const markets = [];
  let current = null;

  for (let i=0; i<lines.length; i++) {
    const line = lines[i];
    const header = detectMarketHeader(line);
    if (header) {
      current = { market: header, selections: [], sourceLines: [] };
      markets.push(current);
      continue;
    }
    if (!current) continue;
    current.sourceLines.push(line);

    // A line containing a betting line plus two decimal odds.
    const pair = line.match(/(^|\s)(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?=\s|$)/);
    if (pair) {
      const lineValue = Number(pair[2]);
      const a = normalizeOdd(pair[3]);
      const b = normalizeOdd(pair[4]);
      if (Number.isFinite(lineValue) && a && b) {
        current.selections.push({ line: lineValue, first: a, second: b, confidence: 'medium' });
        continue;
      }
    }

    // One line may be an early-goal threshold followed by one or two odds.
    const nums = line.match(/\d+(?:\.\d+)?/g) || [];
    if (nums.length >= 2 && nums.length <= 3) {
      const values = nums.map(normalizeOdd).filter(Boolean);
      if (values.length >= 2) {
        current.selections.push({
          line: Number(nums[0]),
          first: values[1] ?? null,
          second: values[2] ?? null,
          confidence: values.length === nums.length ? 'medium' : 'low'
        });
      }
    }
  }

  return markets.filter(m => m.selections.length || m.sourceLines.length);
}

export function flattenMarkets(markets) {
  return markets.flatMap(m => m.selections.map(s => ({ market:m.market, ...s })));
}

export function parserQuality(markets) {
  const rows = flattenMarkets(markets);
  if (!rows.length) return { score:0, label:'No readable odds', rows:0 };
  const usable = rows.filter(r => r.first && r.second).length;
  const score = Math.round((usable / rows.length) * 100);
  return { score, label: score >= 85 ? 'Good' : score >= 60 ? 'Needs review' : 'Low', rows:rows.length };
}

if (typeof window !== 'undefined') window.PredictIQSportyParser = { parseOddsLines, flattenMarkets, parserQuality, normalizeOdd, detectMarketHeader };
