# Pinned-head reads (`getOpenOrdersOnchain`, `getMarginAccount`, `getAccountEquity`) run behind the receipt the SDK just returned: the order just placed is missing (13 of 20, then 3 of 20), the position just opened is not in the margin account (8 of 10, then 5 of 10)
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. Use a testnet key with STT for gas and at least 2 USDso in the perps margin account (the order is the SOL minimum size, 0.1, resting 20% below the mark). Put it in `PROBE_PRIVATE_KEY`.
3. `PROBE_PRIVATE_KEY=0x… CYCLES=20 node repro/016-open-orders-onchain-pinned-behind-own-receipt.mjs`. Each cycle: `trader.placePerpOrder` (the SDK returns the mined receipt), then at once `client.getOpenOrdersOnchain([pool], owner)`; then `trader.cancelOrder` and the same read again. As a control, `client.getOwnOpenOrdersOnchain(pool, owner)` is called at the same moment. The order never fills and no funds move (about 40 small transactions).
4. `PROBE_PRIVATE_KEY=0x… CYCLES=10 node repro/016-margin-reads-pinned-behind-own-fill.mjs`. Each cycle: an IOC market buy of 0.1 SOL (fills at the touch), then at once `client.getMarginAccount` and `client.getAccountEquity`; then the closing IOC sell and the same reads. Control: `client.getPerpPosition` (no pin). Costs about the spread per cycle; the account ends flat.

## Expected
`getOpenOrdersOnchain` (JSDoc, `dist/orders.d.ts` lines 653-665): "Use when you must list your own resting orders and cannot depend on the indexer ... This read answers from the chain itself". Its `blockNumber` option is described as "Read at this exact block instead of pinning the current head" (line 647), and the implementation does pin the head first (`dist/orders.js` line 574: `opts?.blockNumber ?? (await pc.getBlockNumber())`).
The how-tos `docs/how-to/detect-fills.md` line 61 ("Read your own writes at chain head") and `docs/how-to/handle-errors.md` lines 127-128 tell the caller to read their open orders at chain head to learn whether a write happened, and to "send again only when that state shows the write did not happen". They name `getOwnOpenOrdersOnchain`, which does show the write (the control below); `getOpenOrdersOnchain` is its full-rows sibling in the same read-tier table (`docs/reference/read-tiers.md` line 227), documented the same way, and a caller who wants prices and quantities will use it. A read at "the current head" after the SDK has returned the receipt of the write should show the write.

## Actual
`getBlockNumber()` (eth_blockNumber) returns a block that is behind the block of a receipt the same endpoint has already served, so the pinned read is taken before the write:
- Run 1 (`evidence/016-run1.json`): in 13 of 20 cycles the pinned read's block was behind the `placePerpOrder` receipt block (by 1 to 6 blocks) and the placed order was missing from `getOpenOrdersOnchain`; after `cancelOrder`, 9 of 20 reads were behind the cancel receipt and listed the already-cancelled order.
- Run 2 (`evidence/016-run2.json`): 3 of 20 missing after placing; after cancelling, 20 of 20 reads were behind the cancel receipt (5 to 6 blocks) and 17 of 20 still listed the cancelled order.
- Control in the same moments, both runs: `getOwnOpenOrdersOnchain` (no pin, `eth_call` at latest) agreed with the receipt in 40 of 40 placements and 40 of 40 cancellations.
The result carries `blockNumber`, so a caller who compares it with their own receipt's block could see it; nothing in the docs for these reads says to. A bot that rebuilds its quote list with this call (its JSDoc says to use it "when you must list your own resting orders") sees a quote as missing and places it again, or sees a cancelled quote as still resting.
The account-risk reads behave the same way (`evidence/016-margin-run1.json`, `evidence/016-margin-run2.json`, 10 open + close cycles each, 0.1 SOL IOC fills; the repro prints `summary`):
- After the opening fill: `getMarginAccount` was read at a block behind the fill's receipt in 9 of 10 (run 1) and 5 of 10 (run 2) cycles, and showed no active perp pool and `imReq` 0 (the pre-fill account) in 8 of 10 and 5 of 10. `getPerpPosition` (control) showed the 0.1 SOL position in 10 of 10 and 10 of 10.
- After the closing fill: `getMarginAccount` still listed the pool as active in 3 of 10 and 5 of 10 cycles; the control showed flat in 10 of 10 and 10 of 10.
So a bot that checks margin or equity straight after its own fill reads the account as it was before the trade. Both runs ended flat (every cycle closed its own position; fills of 100,000,000 base units each way in all 40 orders).

`getAccountEquity` reported an `asOfBlock` behind the opening fill's receipt in the same share of cycles (9 of 10 and 5 of 10) and behind the closing receipt in 3 of 10 and 6 of 10.

The same `pc.getBlockNumber()` pin is in `getBookTopsOnchain` (`dist/orders.js` line 249) and `drainOpenOrdersOnchain` (line 719); this report did not test them.

## Evidence
- `evidence/016-run1.json`, `evidence/016-run2.json`: every cycle with the order id, both tx hashes, receipt blocks, the block each read was pinned to, and what each read showed; `summary` holds the counts above.
- `evidence/016-margin-run1.json`, `evidence/016-margin-run2.json`: the open/close cycles with both tx hashes, the receipt blocks, and the block and result of each margin read.
- Source lines quoted above are in the installed 0.32.1 package (`dist/orders.js`, `dist/orders.d.ts`, `docs/how-to/*.md`).

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383)
- Wallet: `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`
- Date: 2026-10-21 (UTC)
