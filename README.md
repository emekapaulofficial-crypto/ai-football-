# PredictIQ AI

PredictIQ AI is a football match-analysis interface built around a simple user journey:

**Upload bookmaker odds → confirm the match → analyze → see the strongest qualifying markets.**

## Current rebuild

The project is moving from the original single-file prototype toward a clearer, maintainable static structure:

- `index.html` — accessible product UI and page structure
- `styles.css` — responsive design system
- `app.js` — OCR, odds parsing, data retrieval adapter, statistical model and report rendering

### User flow

1. Upload one or more bookmaker screenshots.
2. OCR proposes the home and away teams.
3. Confirm/edit the teams.
4. Review the detected odds and correct OCR mistakes.
5. Analyze the match.
6. See model probabilities and up to three qualifying markets.

## Prediction philosophy

The model must **not copy bookmaker favorites**. It builds its own probability estimate from recent team performance and a transparent goal-distribution model, then compares that estimate with bookmaker implied probability.

The UI deliberately avoids guarantees. A displayed probability is an estimate, not an assurance of a win. A future production release should be calibrated and backtested before marketing any confidence threshold as a historical success rate.

## Production architecture

The current browser build uses TheSportsDB as a best-effort development source and has a clearly marked fallback so the interface remains usable during development. **Do not put paid/private API keys into `app.js`.**

For production, add a server/API layer with:

- a licensed football-data provider for fixtures, last-five results, standings, xG, lineups and injuries;
- caching and rate limiting;
- provider normalization;
- historical data storage for backtesting;
- model calibration and monitoring;
- server-side secrets.

Recommended architecture:

`Web app → API → data provider(s) → normalized match data → prediction engine → calibrated market probabilities → report`

## Local development

Serve the repository with any static web server. For example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Important limitation

This release is a **foundation**, not a claim of 80% prediction accuracy. The real production milestone is an out-of-sample historical backtest showing calibration and hit rates by market and probability bucket.
