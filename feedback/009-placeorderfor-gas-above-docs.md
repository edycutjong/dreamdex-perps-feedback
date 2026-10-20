# Developer docs understate `placeOrderFor` gas and cost: recent IOC orders used up to 13.4M gas (docs: about 1.56M, bot kit limit 10M) and cost 0.005-0.081 STT (docs: 0.0003-0.003)
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/009-placeorderfor-gas-above-docs.mjs` (read-only, no key).
3. The script reads five public `placeOrderFor` transactions sent to perp pools on 2026-10-20 (UTC). They were found among the fills returned by `client.getFills(pool)`. For each it fetches the transaction and receipt over the chain RPC, decodes the call, and prints the market, `orderType`, `status`, gas limit, `gasUsed`, `effectiveGasPrice` and cost (`gasUsed x effectiveGasPrice`). The hashes are fixed in the script, so two runs print the same rows.

## Expected
Developer page `/docs/developers/perps-testnet`, "Leave plenty of gas": "Successful placeOrderFor transactions on testnet used up to about 1.56M gas, and a simple resting order simulated with a 1.5M limit reverts while the same call with 3.2M succeeds. eth_estimateGas returned 3.2M for a resting order and 7.7M for an IOC that crossed several price levels. Gas is billed on what is used, so a generous limit costs nothing extra: the bot kit sends every perp order with 10,000,000."
Same page, "Get test funds": "transactions to perp pools measured on testnet cost between 0.0003 and 0.003 STT each."
So a successful `placeOrderFor` should use about 1.56M gas or less, a 10,000,000 limit should be generous, and a pool transaction should cost at most about 0.003 STT.

## Actual
All five transactions are successful IOC orders (`orderType` 2) sent directly to a perp pool (`successful: 5`, `toPerpPool: 5`):

| Market | Time (UTC) | Gas limit | `gasUsed` | Cost (STT) | Tx |
|---|---|---|---|---|---|
| ADA | 2026-10-20 16:30:45 | 10,000,000 | 838,808 | 0.005032848 | `0x94f9c6e14d1c6c94822f94082f4feac8a0993246db929f0ca5b7053559d5ffac` |
| ADA | 2026-10-20 16:34:50 | 10,000,000 | 2,771,932 | 0.016631592 | `0x9abaa49de446e8ca4203337cb8e9f5fd28c087a05d47f3b8fbc7298778ebf1c6` |
| NEAR | 2026-10-20 17:45:41 | 46,738,641 | 10,356,133 | 0.062136798 | `0x978cc8ff166263878f4c1e6f514112233114a5f987593de62823b5686a0ae7cf` |
| XRP | 2026-10-20 17:43:06 | 58,971,189 | 13,104,709 | 0.078628254 | `0x5cdb4cf75c28f977b891b02f6d0805146323f1667dbcf12ca8dafced7ea2256e` |
| XRP | 2026-10-20 17:41:21 | 29,166,906 | 13,445,881 | 0.080675286 | `0x20d76faf412d3a4b3d632b6fb95c4981cc8899568b03fad56bfb28613dbd8327` |

- 4 of 5 used more than the documented "about 1.56M" (`gasUsedAbove1_56M: 4`).
- 3 of 5 IOC orders used more than the 7.7M the docs give for a crossing IOC (`iocGasUsedAbove7_7M: 3`), and more than the 10,000,000 limit the docs call generous (`gasUsedAbove10M: 3`). Sent with a 10,000,000 limit, those three calls would have run out of gas. The same page says such a transaction "lands with status 0 and no reason in the receipt".
- All 5 cost more than the documented 0.003 STT maximum (`costAbove0_003STT: 5`), including the smallest one (838,808 gas). Every receipt has an `effectiveGasPrice` of 6 gwei (6,000,000,000 wei).

A bot that follows the page sets its gas limit and its STT budget too low.

## Evidence
- `evidence/009-run1.json`, `evidence/009-run2.json`: two fresh-process runs, byte-identical. They hold the counts above and one row per transaction (hash, market, UTC time, `orderType`, `status`, `gasLimit`, `gasUsed`, `effectiveGasPrice`, `costSTT`).
- `evidence/docs-excerpts-2026-10-20.txt`: both docs passages, as served on 2026-10-20 (UTC).
- The five transactions belong to other accounts and are public chain data. This report only reads their receipts; no transaction is sent. It does not show a 10,000,000-limit order failing; the out-of-gas statement follows from `gasUsed` exceeding that limit.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1 (viem 2.57.7), Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20 (UTC)
