# `getMarginAccount`, `getAccountEquity` and `getOpenOrdersOnchain` read at a block behind the receipt the SDK has just returned for the caller's own order
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. Use a testnet key with STT for gas and about 50 USDso of perps margin (the saved runs started with 49.6861 or 49.6561 USDso unlocked; the orders are the SOL minimum size, 0.1). Put it in `PROBE_PRIVATE_KEY`.
3. Margin reads: `PROBE_PRIVATE_KEY=0x… CYCLES=10 node repro/016-margin-reads-pinned-behind-own-fill.mjs`. Each cycle: an IOC market buy of 0.1 SOL (fills at the touch; the SDK returns the mined receipt), then at once `client.getMarginAccount` and `client.getAccountEquity`; then the closing IOC sell and the same reads. Control: `client.getPerpPosition` (no pin). Each cycle costs the touch spread (the 10 cycles of run 1 lowered the account from 49.6861 to 49.6561 USDso, the `funds` field of the two margin evidence files); every cycle closes its own position.
4. Order list: `PROBE_PRIVATE_KEY=0x… CYCLES=20 node repro/016-open-orders-onchain-pinned-behind-own-receipt.mjs`. Each cycle: `trader.placePerpOrder` for a resting bid 20% below the mark, then at once `client.getOpenOrdersOnchain([pool], owner)`; then `trader.cancelOrder` and the same read. Control: `client.getOwnOpenOrdersOnchain(pool, owner)` at the same moment. The order never fills (about 40 small transactions).

## Expected
The account reads are chain-tier reads: `dist/perp/margin.d.ts` lines 52-54 (`getMarginAccount`): "The SDK samples the chain head once and pins every component read to that block. All returned fields therefore describe one chain state, even if the head advances while the fan-out is in flight." `getAccountEquity` reads through `getMarginEquity`, documented as `equity` and `lockedCollateral` "pinned to one block" (lines 57-60). After the SDK has returned the receipt of the caller's own fill, the head it samples should include that fill.
`getOpenOrdersOnchain` (JSDoc, `dist/orders.d.ts` lines 653-665): "Use when you must list your own resting orders and cannot depend on the indexer ... This read answers from the chain itself". Its `blockNumber` option is described as "Read at this exact block instead of pinning the current head" (line 647). The how-tos `docs/how-to/detect-fills.md` line 61 ("Read your own writes at chain head") and `docs/how-to/handle-errors.md` lines 127-128 tell the caller to read their open orders at chain head to learn whether a write happened ("send again only when that state shows the write did not happen"). They name `getOwnOpenOrdersOnchain`, which does show the write (the control below); `getOpenOrdersOnchain` is its full-rows sibling in the same read-tier table (`docs/reference/read-tiers.md` line 227).

## Actual
The pin is `getBlockNumber()` (`eth_blockNumber`): `dist/perp/margin.js` line 33 (`getMarginAccount`), line 66 (`getMarginEquity`, which `getAccountEquity` calls at `dist/accountEquity.js` line 29), `dist/orders.js` line 574 (`getOpenOrdersOnchain`: `opts?.blockNumber ?? (await pc.getBlockNumber())`). The block it returns is up to 6 blocks behind (0 to 6 across the saved runs) the block of the receipt the SDK returned a moment earlier for the caller's own transaction, so the read describes the state before that transaction (the cause on the node side is not determined by this report).

Margin reads (`evidence/016-margin-run1.json`, `evidence/016-margin-run2.json`; 10 open + close cycles each, 0.1 SOL IOC fills, 100,000,000 base units each way in all 40 orders):
- After the opening fill, `getMarginAccount` was read at a block behind the fill's receipt in 4 of 10 (run 1) and 10 of 10 (run 2) cycles, and showed no active perp pool (the pre-fill account) in 4 of 10 and 9 of 10. `getAccountEquity`'s `asOfBlock` was behind the receipt in 4 and 10 of 10. The control `getPerpPosition` showed the 0.1 SOL position in 10 of 10 and 10 of 10.
- After the closing fill, `getMarginAccount` was behind the receipt in 8 and 3 of 10 and still listed the pool as active in 7 and 2 of 10; `getAccountEquity` was behind in 8 and 3 of 10. The control showed flat in 10 of 10 and 10 of 10.

Order list (`evidence/016-run1.json`, `evidence/016-run2.json`; 20 place + cancel cycles each):
- After `placePerpOrder`, the pinned read was behind the receipt in 8 of 20 (run 1) and 20 of 20 (run 2) cycles and the placed order was missing from `getOpenOrdersOnchain` in all of those.
- After `cancelOrder`, the pinned read was behind the receipt in 13 and 2 of 20, and listed the already-cancelled order in 12 and 2 of 20.
- Control in the same moments, both runs: `getOwnOpenOrdersOnchain` (no pin, `eth_call` at latest) agreed with the receipt in 40 of 40 placements and 40 of 40 cancellations.

The results carry `asOfBlock` / `blockNumber`, so a caller who compares them with their own receipt's block could see the lag; `grep -i asOfBlock` over the SDK's `docs/` finds no such advice for these reads. The caller cannot pin `getMarginAccount` at all: `SomniaMarketsClient.getMarginAccount(marginBank, account)` (`dist/somniaMarketsClient.d.ts` line 3212) takes no block option. `getAccountEquity` (`blockNumber`, `dist/accountEquity.d.ts` line 23) and `getOpenOrdersOnchain` (`blockNumber`) do, so there the caller can pass the receipt's block, but nothing tells them they must. Code that checks margin or equity straight after its own fill could read the account as it was before the trade, and code that rebuilds its quote list from `getOpenOrdersOnchain` could see a quote as missing or a cancelled one as resting. The documented `getOwnOpenOrdersOnchain` was not affected in these runs.
The same `getBlockNumber()` pin is in `getBookTopsOnchain` (`dist/orders.js` line 249) and `drainOpenOrdersOnchain` (line 719); this report did not test them.

## Suggested fix
Have the reads include the caller's own writes: either make the SDK's writer return the receipt block and let the read helpers use `max(head, lastOwnReceiptBlock)` (or retry until `eth_blockNumber` reaches it), or add a `blockNumber` option to `getMarginAccount` like the one `getAccountEquity` and `getOpenOrdersOnchain` already have. If neither is wanted, document on these reads that the head they pin can be behind the caller's last receipt and that `getOwnOpenOrdersOnchain` / `getPerpPosition` (no pin) are the read-your-writes calls.

## Evidence
- `evidence/016-margin-run1.json`, `evidence/016-margin-run2.json`: every cycle with both tx hashes, the receipt blocks, the block and result of each margin read and of the control; `summary` holds the counts above (including the `getAccountEquity` counts).
- `evidence/016-run1.json`, `evidence/016-run2.json`: every cycle with the order id, both tx hashes, receipt blocks, the block each read was pinned to, and what each read showed; `summary` holds the counts above.
- Source lines quoted above are in the installed 0.32.1 package (`dist/perp/margin.js`, `dist/accountEquity.js`, `dist/orders.js`, `dist/orders.d.ts`, `dist/perp/margin.d.ts`, `docs/how-to/*.md`, `docs/reference/read-tiers.md`).

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383)
- Wallet: `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`
- Date: 2026-10-21 (UTC)
