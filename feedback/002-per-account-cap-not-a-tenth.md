# Docs say a single account is capped at "a tenth" of the OI cap "on most markets"; on-chain it is a tenth on only 1 of 21
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/002-per-account-cap-not-a-tenth.mjs` (read-only, no key).
3. The script reads `maxPositionSize` and `maxOpenInterest` from `client.getPerpRiskParams(pool)` for all 21 markets and prints `maxPositionSize / maxOpenInterest`.

## Expected
Docs page `/docs/trading/perps-testnet`, after the Markets table: "A single account is capped at a tenth of it on most markets."
So `maxPositionSize / maxOpenInterest` should be 0.1 on most markets.

## Actual
The ratio is 0.1 on 1 market (TAO). It is 0.025 on 6 markets (ZRO, LIT, VVV, 1000PEPE, PUMP, WLD), 0.05 on 10 (XLM, AVAX, LINK, SUI, ADA, DOGE, XRP, HYPE, SOL, ETH), 0.0499 on NEAR and 0.0504 on BNB, and higher on two: ZEC 0.25 and BTC 0.2026.
A trader sizing against the documented rule over-estimates what a pool accepts on 18 markets (it will hit `MaxPositionSizeExceeded`) and under-estimates it on ZEC and BTC (0.25 and 0.2026).

## Evidence
- `evidence/002-run1.json`, `evidence/002-run2.json`: two fresh-process runs, byte-identical; `byShare` lists markets per ratio.
- Source of the numbers: `getPerpRiskParams` on each pool (on-chain), no transaction involved.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none needed (probe wallet 0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b not used)
- Date: 2026-10-20
