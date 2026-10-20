# SDK `docs/PERPS.md` says only BTC and ETH perps are live; the testnet lists 21
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/003-sdk-perps-doc-two-markets.mjs` (read-only, no key).
3. The script prints line 3 of `node_modules/@somnia-chain/markets-sdk/docs/PERPS.md` and the result of `client.listPerpMarkets()`.

## Expected
`docs/PERPS.md` (shipped in the npm package, also the SDK's "Perpetuals" docs page), opening paragraph: "Perps are live on testnet: `BTC/USDSO:USDSO` and `ETH/USDSO:USDSO`".
The list of live perp markets in the docs should match what the SDK returns, and agree with the app docs (`/docs/trading/perps-testnet`: "All 21 markets are margined in USDso").

## Actual
`listPerpMarkets()` returns 21 markets: ZRO, LIT, VVV, 1000PEPE, PUMP, ZEC, TAO, WLD, NEAR, XLM, AVAX, LINK, SUI, ADA, BNB, DOGE, XRP, HYPE, SOL, ETH, BTC. 19 of them are not named in the SDK page.
A developer who reads only the SDK docs concludes that two markets exist, and would hard-code those two.

## Evidence
- `evidence/003-run1.json`, `evidence/003-run2.json`: two fresh-process runs, byte-identical (`docLines` quotes line 3; `liveMarketCount` is 21).

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none needed (probe wallet 0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b not used)
- Date: 2026-10-20
