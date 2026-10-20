# Perps docs "Open interest cap" is 1/2 or 1/4 of the on-chain `maxOpenInterest` on 20 of 21 markets
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/001-oi-cap-docs-vs-chain.mjs` (read-only, no key).
3. The script reads each market's `maxOpenInterest` with `client.getPerpRiskParams(pool)`, scales it by `baseDecimals`, and compares it with the "Open interest cap" column of the docs "Markets" table.

## Expected
Docs page `/docs/trading/perps-testnet`, "Markets" table, column "Open interest cap", then: "The open interest cap is market-wide, across every account, and is held in the base asset."
The figure in the table should equal the cap the pool enforces, and live open interest should not exceed it.

## Actual
For 20 of 21 markets the on-chain `maxOpenInterest` differs from the documented cap: 2x on BTC, ETH, SOL, HYPE and 4x on the other 16 (ADA, AVAX, BNB, DOGE, LINK, NEAR, SUI, XLM, XRP, 1000PEPE, LIT, PUMP, VVV, WLD, ZEC, ZRO). Only TAO matches (2185.491).
Live open interest on BTC (285.79349) and XRP (805,002) is already above the documented cap (246.81545 BTC, 344,632 XRP), which the docs describe as the market-wide limit.

| Market | Docs cap | On-chain `maxOpenInterest` | Live OI |
|---|---|---|---|
| BTC | 246.81545 | 493.6309 | 285.79349 |
| XRP | 344,632 | 1,378,528 | 805,002 |
| ZEC | 420 | 1,680 | 81.734 |
| TAO | 2,185.491 | 2,185.491 | 108.511 |

(Full 21-row output in `evidence/001-run1.json`; live OI values move between runs.)

## Evidence
- `evidence/001-run1.json`, `evidence/001-run2.json`: two fresh-process runs of the repro; `chainOverDoc` values are identical in both.
- The figures come from `getPerpRiskParams` (on-chain pool parameters) and `listPerpMarkets` (indexer), no transaction involved.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none needed (probe wallet 0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b not used)
- Date: 2026-10-20
