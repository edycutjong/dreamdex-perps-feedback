# Paper USDso: the docs say 6 markets are closed to the voucher, but the on-chain voucher allowlist has all 21 markets on it
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/006-paper-usdso-allowlist-docs-vs-chain.mjs` (read-only, no key).
3. For each of the 21 markets from `client.listPerpMarkets()`, the script calls `client.getPerpLeverage({ marginBank, account, pool })` and prints `voucherMarketAllowed` next to the market's "Paper USDso" value in the docs table (`repro/lib/docs-table.mjs`). `account` is our probe wallet (no voucher, no funds); the allowlist flag is per market, not per account. It also prints `client.getPerpVoucherCampaign(marginBank)` to show the voucher campaign is running.

## Expected
App docs page `/docs/trading/perps-testnet`, "Markets" table: column "Paper USDso" is "No" for 1000PEPE, LIT, PUMP, VVV, ZEC and ZRO. The line above the table says: "Paper USDso shows whether the Perps Arena credit can open positions in that market."
App docs page `/docs/trading/perps-testnet/margin-and-liquidations`, "Paper USDso": "Only some markets. You can open or increase positions only in the markets marked Yes under Paper USDso in the market table. The six newest markets are not on that list."
Developer page `/docs/developers/perps-testnet`, "Common pitfalls": "Paper USDso blocks some markets. Increasing a position in a market outside the credit's allowlist reverts, and getMaxPerpOrderSize reports it as limitedBy: \"voucherBlocked\"."
The SDK's type docs for `PerpLeverage.voucherMarketAllowed` (`dist/perp/margin.d.ts:436`) say: "Whether THIS market is on the voucher allowlist." An increase on a market not on the list "reverts `VoucherMarketNotAllowed`".
So `voucherMarketAllowed` should be `false` for the 6 markets the docs mark "No".

## Actual
`voucherMarketAllowed` is `true` for all 21 markets (`allowedOnChain: 21`). That includes all 6 markets the docs mark "No": ZRO, LIT, VVV, 1000PEPE, PUMP, ZEC (`docsNoButAllowed`). `voucherLeverageCapX` is 20 on every market, so the "cap not set" case does not apply either.
The SDK computes `voucherBlocked` as `voucherActive && (!p.voucherMarketAllowed || p.voucherLeverageCapX === 0)` (`dist/perp/margin.js:1023`). With today's allowlist, `getMaxPerpOrderSize` cannot return `limitedBy: "voucherBlocked"` on any market, which is the opposite of what the developer page says.
The voucher campaign is running: `getPerpVoucherCampaign` returns `grantAmount` 1000 USDso, `startsAt` 1790553600 (2026-09-28 UTC), `endsAt` 1798477478 (2026-12-28 UTC), `leverageCapX` 20.
So either the three docs passages are out of date, or the allowlist is missing 6 entries. A Perps Arena trader who reads the docs avoids 6 markets the chain lets them trade. A bot that relies on `voucherBlocked` for those 6 markets never sees it.

## Evidence
- `evidence/006-run1.json`, `evidence/006-run2.json`: two fresh-process runs, byte-identical (`allowedOnChain`, `docsSayNo`, `docsNoButAllowed`, `campaign`, one row per market with `chainVoucherMarketAllowed` and `voucherLeverageCapX`).
- `evidence/docs-excerpts-2026-10-21.txt`: the three docs passages above as served on 2026-10-21 (hydrated page text, headless Chromium).
- All numbers come from on-chain reads (`getPerpLeverage` reads `MarginBank.isVoucherMarketAllowed(pool)` and `getVoucherLeverageCap()`). No transaction is involved. This report does not place a voucher-funded order, so it does not show which of the two the pool enforces.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`, used only as the `account` argument of the reads (no voucher, no funds, nothing signed)
- Date: 2026-10-21
