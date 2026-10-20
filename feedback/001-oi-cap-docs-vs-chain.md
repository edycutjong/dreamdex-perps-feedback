# Perps docs "Open interest cap" disagrees with live open interest (above it on BTC and XRP) and with the pool's `maxOpenInterest` on 20 of 21 markets
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/001-oi-cap-docs-vs-chain.mjs` (read-only, no key).
3. The script copies the "Open interest cap" column of the docs "Markets" table (`repro/lib/docs-table.mjs`), then reads live open interest from `client.listPerpMarkets()` and the pool parameter `maxOpenInterest` from `client.getPerpRiskParams(pool)`, both scaled by `baseDecimals`.

## Expected
App docs page `/docs/trading/perps-testnet`, "Markets" table, column "Open interest cap", followed by: "The open interest cap is market-wide, across every account, and is held in the base asset."
Open interest should not be above the cap the docs state, and the table should match the pool's own `maxOpenInterest`. (The same page says "These figures are read from the live markets and can be retuned at any time", so a retune would explain a difference, but not live open interest sitting above the stated cap.)

## Actual
Live open interest is above the documented cap on 2 markets, BTC and XRP (`marketsAboveDocCap` in the output).
The on-chain `maxOpenInterest` differs from the documented cap on 20 of 21 markets: 2x on BTC, ETH, SOL and HYPE, 4x on the other 16 (ADA, AVAX, BNB, DOGE, LINK, NEAR, SUI, XLM, XRP, 1000PEPE, LIT, PUMP, VVV, WLD, ZEC, ZRO). Only TAO matches.

| Market | Docs cap | On-chain `maxOpenInterest` | Live OI (run 1) | Live OI / docs cap |
|---|---|---|---|---|
| BTC | 246.81545 | 493.6309 | 285.50606 | 1.157 |
| XRP | 344,632 | 1,378,528 | 804,713.6 | 2.335 |
| ZEC | 420 | 1,680 | 52.856 | 0.126 |
| TAO | 2,185.491 | 2,185.491 | 102.748 | 0.047 |

Live OI changes between runs; the full 21-row output of run 1 is in `evidence/001-run1.json` (run 2: `evidence/001-run2.json`). `chainOverDoc` is identical in both runs.

## Evidence
- `evidence/001-run1.json`, `evidence/001-run2.json`: two fresh-process runs of the repro.
- `evidence/docs-excerpts-2026-10-20.txt`: the docs "Markets" table and the paragraph under it (both quotes above) as served on 2026-10-20 (UTC), the same values as `repro/lib/docs-table.mjs`.
- Numbers come from `getPerpRiskParams` (pool parameters) and `listPerpMarkets` (indexer); no transaction is involved.
- This report does not claim which of the two caps the matching engine enforces; it only shows the three sources (docs table, pool parameter, live open interest) disagree.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20 (UTC)
