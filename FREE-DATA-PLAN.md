# PredictIQ AI — Zero-Cost Data Strategy

## Current approach

PredictIQ starts with **no paid football API**. The browser uses the free TheSportsDB v1 API key (`123`) for team lookup and recent completed matches. The free provider currently advertises a 30 requests/minute limit, while some individual free endpoints have tighter limits, so PredictIQ caches responses for 30 minutes and only requests the two teams needed for an analysis.

Source: https://www.thesportsdb.com/docs_api_guide

## What the system does

1. User uploads bookmaker odds screenshots.
2. Tesseract OCR reads the screenshots locally in the browser.
3. The odds parser extracts readable markets and decimal odds.
4. The team names are confirmed by the user.
5. The free football-data layer looks up both teams.
6. PredictIQ retrieves the most recent completed matches and requires five matches for a full analysis.
7. Recent matches are weighted more heavily than older matches.
8. The statistical model calculates expected goals and market probabilities.
9. The bookmaker odds are converted to implied probability and compared with the model.
10. The interface ranks up to three qualifying markets.
11. If verified data is missing, the system **does not invent statistics and does not generate a prediction**.

## Why this is important

The project should never display made-up recent results just to produce a pick. A missing data source should result in a clear `No prediction`/`Data unavailable` state.

## Future upgrade path

The provider is isolated in `free-data.js`. When the project can afford a better data source, a server-side provider can be added without redesigning the prediction UI. Paid API credentials should never be placed in browser JavaScript.

## Important accuracy note

A model probability is not a guarantee. The project should only publish an accuracy or 80%+ success claim after historical, out-of-sample backtesting and calibration demonstrate that performance under a clearly defined test set.
