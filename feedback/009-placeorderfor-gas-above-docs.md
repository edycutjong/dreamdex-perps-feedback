# Developer docs understate `placeOrderFor` gas: successful IOC orders used up to 13.4M gas, above the documented ~1.56M and the 10M bot-kit limit
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/009-placeorderfor-gas-above-docs.mjs` (read-only, no key).
3. The script reads five public `placeOrderFor` transactions sent to perp pools on 2026-10-20 (UTC). For each it fetches the transaction and receipt over the chain RPC, decodes the call, and prints the market, `orderType`, `status`, gas limit, `gasUsed`, `effectiveGasPrice` and cost (`gasUsed x effectiveGasPrice`). The hashes are fixed in the script, so two runs print the same rows.
4. How the five were found: `node repro/009-find-placeorderfor-txs.mjs` takes the latest 40 fills of every market (`client.getFills`), keeps the distinct transactions, and lists every one that calls `placeOrderFor` (selector `0x80054449`) directly on the market's pool. At about 17:55 UTC that survey returned exactly these five, out of 339 distinct transactions (the rest went through other contracts or the batch `placeOrders`). Its result moves with the fills: a re-run at 18:00:55 UTC (saved) found 2 of 352, the two ADA orders below.

## Expected
Developer page `/docs/developers/perps-testnet`, "Leave plenty of gas": "Successful placeOrderFor transactions on testnet used up to about 1.56M gas, and a simple resting order simulated with a 1.5M limit reverts while the same call with 3.2M succeeds. eth_estimateGas returned 3.2M for a resting order and 7.7M for an IOC that crossed several price levels. Gas is billed on what is used, so a generous limit costs nothing extra: the bot kit sends every perp order with 10,000,000."
Same page, "Get test funds": "transactions to perp pools measured on testnet cost between 0.0003 and 0.003 STT each."
So a 10,000,000 gas limit should be generous for a perp order, a successful `placeOrderFor` should use about 1.56M gas or less, and pool transactions cost between 0.0003 and 0.003 STT, per the docs.

## Actual
All five transactions are successful IOC orders (`orderType` 2 = ImmediateOrCancel, `dist/trade.d.ts:197-198`) sent directly to a perp pool (`successful: 5`, `toPerpPool: 5`):

| Market | Time (UTC) | Gas limit | `gasUsed` | Cost (STT) | Tx |
|---|---|---|---|---|---|
| ADA | 2026-10-20 16:30:45 | 10,000,000 | 838,808 | 0.005032848 | `0x94f9c6e14d1c6c94822f94082f4feac8a0993246db929f0ca5b7053559d5ffac` |
| ADA | 2026-10-20 16:34:50 | 10,000,000 | 2,771,932 | 0.016631592 | `0x9abaa49de446e8ca4203337cb8e9f5fd28c087a05d47f3b8fbc7298778ebf1c6` |
| XRP | 2026-10-20 17:41:21 | 29,166,906 | 13,445,881 | 0.080675286 | `0x20d76faf412d3a4b3d632b6fb95c4981cc8899568b03fad56bfb28613dbd8327` |
| XRP | 2026-10-20 17:43:06 | 58,971,189 | 13,104,709 | 0.078628254 | `0x5cdb4cf75c28f977b891b02f6d0805146323f1667dbcf12ca8dafced7ea2256e` |
| NEAR | 2026-10-20 17:45:41 | 46,738,641 | 10,356,133 | 0.062136798 | `0x978cc8ff166263878f4c1e6f514112233114a5f987593de62823b5686a0ae7cf` |

- 3 of 5 used more than 10,000,000 gas (`gasUsedAbove10M: 3`), the limit the docs call generous, and more than the 7.7M the docs report as `eth_estimateGas` for a crossing IOC (`iocGasUsedAbove7_7M: 3`). Each of those three used more than 10,000,000 gas in the state it executed in, so a 10,000,000 limit would not have covered it in that state (inferred; no failed order was observed). The same page says a transaction that runs out of gas "lands with status 0 and no reason in the receipt".
- 4 of 5 used more than the documented "about 1.56M" (`gasUsedAbove1_56M: 4`).
- All 5 cost more than 0.003 STT, the upper end of the range the docs report (`costAbove0_003STT: 5`), including the smallest one (838,808 gas). Every receipt has an `effectiveGasPrice` of 6 gwei (6,000,000,000 wei). At that price the docs' own figures do not fit together either: 1.56M gas costs 0.00936 STT, and 0.003 STT pays for 500,000 gas. The docs do not say what gas price their cost range assumed.

In these five transactions, a bot that budgeted 0.003 STT per order would have been under-funded every time, and a bot that sent 10,000,000 gas would have been under-limited for 3 of 5.

## Evidence
- `evidence/009-run1.json`, `evidence/009-run2.json`: two fresh-process runs, byte-identical. They hold the counts above and one row per transaction (hash, market, UTC time, `orderType`, `status`, `gasLimit`, `gasUsed`, `effectiveGasPrice`, `costSTT`).
- `evidence/009-find-2026-10-20T1800Z.json`: the saved re-run of the discovery script (2 direct `placeOrderFor` calls among 352 distinct transactions; both are in the table). The first run, which returned the five, was not saved.
- `evidence/docs-excerpts-2026-10-20.txt`: both docs passages, as served on 2026-10-20 (UTC).
- The five transactions are public chain data; this report only reads their receipts and sends no transaction.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1 (viem 2.57.7), Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20 (UTC)
