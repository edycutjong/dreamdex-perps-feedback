# Per-account position cap is "a tenth" of the open interest cap on 10 of 21 markets against the docs table, and on 1 of 21 against the pool's own `maxOpenInterest`
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/002-per-account-cap-not-a-tenth.mjs` (read-only, no key).
3. The script reads `maxPositionSize` and `maxOpenInterest` from `client.getPerpRiskParams(pool)` for all 21 markets and divides `maxPositionSize` by (a) the documented "Open interest cap" of that market (`repro/lib/docs-table.mjs`, copied from the docs "Markets" table) and (b) the pool's own `maxOpenInterest`.

## Expected
App docs page `/docs/trading/perps-testnet`, after the Markets table: "A single account is capped at a tenth of it on most markets."
Developer page `/docs/developers/perps-testnet`, "Common pitfalls": "Each account has a position cap per market, a tenth of the market's open interest cap on most markets."
So `maxPositionSize` should be 0.1 of the market's open interest cap on most (more than half of) the 21 markets, whichever cap is meant: the documented one or the pool's `maxOpenInterest`.

## Actual
The rule does not hold against either cap.

Against the pool's own `maxOpenInterest` (`byChainShare` in the output), the ratio is 0.1 on 1 market (TAO). It is 0.05 on 10 (XLM, AVAX, LINK, SUI, ADA, DOGE, XRP, HYPE, SOL, ETH), about 0.05 on NEAR (0.0499) and BNB (0.0504), 0.025 on 6 (ZRO, LIT, VVV, 1000PEPE, PUMP, WLD), 0.2026 on BTC and 0.25 on ZEC.

Against the documented "Open interest cap" (`byShare`), it is 0.1 on 10 markets (ZRO, LIT, VVV, 1000PEPE, PUMP, TAO, WLD, HYPE, SOL, ETH), fewer than half. It is 0.2 on NEAR, XLM, AVAX, LINK, SUI, ADA, DOGE, XRP; 0.202 on BNB; 0.405 on BTC; and 1.0 on ZEC, where one account's cap equals the whole documented market cap.

A trader or bot that sizes against "a tenth" gets the wrong limit on 20 of 21 markets when it reads the pool's cap, and on 11 of 21 when it reads the docs table. ZEC and BTC are far from the rule under both.

## Evidence
- `evidence/002-run1.json`, `evidence/002-run2.json`: two fresh-process runs, byte-identical; `byShare` (docs cap) and `byChainShare` (pool `maxOpenInterest`) list the markets for each ratio; `marketsAtOneTenth` is 10 and `marketsAtOneTenthOfChainCap` is 1.
- `evidence/docs-excerpts-2026-10-21.txt`: the docs "Markets" table as served on 2026-10-21, the same values as `repro/lib/docs-table.mjs`.
- Source of the numbers: `getPerpRiskParams` on each pool (on-chain), no transaction involved. The documented caps are the ones also used in report 001.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20 (ratio against `maxOpenInterest` added 2026-10-21)
