# Margin docs say no backstop bidders are registered on testnet, but one is, and it took over 3 positions
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/010-backstop-bidder-registered.mjs` (read-only, no key).
3. The script reads the LiquidationEngine address from `client.getPerpSystemConfig(marginBank)`. It then reads `bidderCount` from `client.getLiquidationEngineConfig(engine)` and the bidder list from the engine's `getBidders()`. Finally it lists the indexed backstop takeovers (`client.getLiquidations({ kind: "PositionTakenOver" })`) up to 2026-10-20 16:00 UTC, so two runs print the same takeover rows. `bidderCount` and `getBidders()` are live reads; `evidence/010-run1.json` holds the values read on 2026-10-20 (UTC).

## Expected
App docs page `/docs/trading/perps-testnet/margin-and-liquidations`, "Liquidations": "If closing on the book is not enough, the protocol escalates: a registered backstop bidder can take the position over, the Insurance Fund covers any remaining shortfall, and only when both are exhausted does auto-deleveraging (ADL) start. [...] No backstop bidders are registered on testnet, so the later stages come in sooner."
So `bidderCount` should be 0 and `getBidders()` should return an empty list.

## Actual
The LiquidationEngine (`0xA66d3C24Ad4a389d863846905D8173e1017e9F4D`) has one registered backstop bidder: `bidderCount` is 1, and `getBidders()` returns `0xAF327764345c2f54C1F2bc3322D28E4f633793b9`.
Before 16:00 UTC on 2026-10-20 that bidder took over 3 positions, one takeover event each (`takeoversUpToCutoff: 3`, all by the registered bidder: `takeoverBiddersAreRegistered: true`):

| Time (UTC) | Market | Tx |
|---|---|---|
| 2026-10-20 14:10:40 | ETH | `0xeed95612916a94094a3791bcae20eccf0f729d606c70094394704eeaf99ab431` |
| 2026-10-20 14:14:08 | SOL | `0x40099b2c64df594961a4b113da8132795efd58cc15e67a9dced866ae4e8b3300` |
| 2026-10-20 14:14:08 | SOL | `0x170891a3829d9362c44805fbbcf3ea8b02747c7c129a1cf57eeb1d00927f855e` |

The docs page, fetched between 17:11 and 17:14 UTC (about three hours later), still says no bidders are registered. A trader reading it expects the takeover stage to be skipped, so that a failed liquidation goes straight to the Insurance Fund, and on to ADL only if the fund is exhausted. In fact the takeover stage is live.
The docs sentence is about the registry ("No backstop bidders are registered"), and `getBidders()` is that registry. Whoever operates the registered address, the takeover stage is in use, as the three takeovers show.
The SDK docs describe the zero-bidder case as an operational signal (`dist/somniaMarketsClient.d.ts:3739-3741`, on `getLiquidationEngineConfig`): "`bidderCount === 0n` is an operational signal: with no registered bidders the takeover stage has nobody to take a position over, so the waterfall reaches ADL sooner than the configuration implies." On testnet that signal is absent.

## Evidence
- `evidence/010-run1.json`, `evidence/010-run2.json`: two fresh-process runs, byte-identical (`liquidationEngine`, `bidderCount`, `bidders`, `takeoversUpToCutoff`, `takeoverBiddersAreRegistered`, one row per takeover with UTC time, market, size, price, bidder and tx hash).
- `evidence/docs-excerpts-2026-10-20.txt`: the "Liquidations" paragraph quoted above, as served on 2026-10-20 (UTC).
- Chain reads (`getLiquidationEngineConfig`, `getBidders`) and indexer rows (`getLiquidations`). No transaction is sent; the takeovers are public chain data.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1 (viem 2.57.7), Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20 (UTC)
