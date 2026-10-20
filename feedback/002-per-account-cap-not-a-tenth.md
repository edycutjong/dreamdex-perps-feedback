# Per-account position cap is a tenth of the documented open interest cap on only 10 of 21 markets (0.2 on 8, 0.202 on BNB, 0.405 on BTC, 1.0 on ZEC)
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/002-per-account-cap-not-a-tenth.mjs` (read-only, no key).
3. The script reads `maxPositionSize` from `client.getPerpRiskParams(pool)` for all 21 markets and divides it by the documented "Open interest cap" of that market (`repro/lib/docs-table.mjs`, copied from the docs "Markets" table).

## Expected
App docs page `/docs/trading/perps-testnet`, after the Markets table: "A single account is capped at a tenth of it on most markets."
Developer page `/docs/developers/perps-testnet`, "Common pitfalls": "Each account has a position cap per market, a tenth of the market's open interest cap on most markets."
So `maxPositionSize / documented cap` should be 0.1 on most (more than half of) the 21 markets.

## Actual
It is 0.1 on 10 markets: ZRO, LIT, VVV, 1000PEPE, PUMP, TAO, WLD, HYPE, SOL, ETH. That is fewer than half.
On the others it is higher: 0.2 on NEAR, XLM, AVAX, LINK, SUI, ADA, DOGE, XRP; 0.202 on BNB; 0.405 on BTC; and 1.0 on ZEC, where one account's cap equals the whole documented market cap.
A trader or bot that sizes against the documented "tenth" under-estimates what the pool allows on 11 markets, and the ZEC and BTC limits are far from the documented rule.

## Evidence
- `evidence/002-run1.json`, `evidence/002-run2.json`: two fresh-process runs, byte-identical; `byShare` lists the markets for each ratio.
- Source of the numbers: `getPerpRiskParams` on each pool (on-chain), no transaction involved. The documented caps are the ones also used in report 001.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20
