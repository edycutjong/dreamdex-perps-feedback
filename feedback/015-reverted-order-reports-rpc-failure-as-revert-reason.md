# When an order tx mines and reverts, the SDK sometimes puts its own failed `eth_call` replay in the revert reason: "placeOrder reverted: rpc eth_call failed: RPC Request failed." (9 and 14 of 30 attempts)
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. Use a testnet key whose account has STT for gas and some USDso (the run below had 50 USDso in the margin account and 50 in the wallet). Put it in `PROBE_PRIVATE_KEY`.
3. `PROBE_PRIVATE_KEY=0x… ATTEMPTS=30 node repro/015-failed-receipt-replay-failure-reported-as-revert-reason.mjs`. It asks the SDK for the largest SOL bid it allows (`getMaxPerpOrderSize` with `autoPull: true`, `maxQuantity` 23,430,000,000), then calls `trader.placePerpOrder` 30 times with that size plus one lot (23,440,000,000). Each call sends a real transaction that the pool reverts (the wallet pull exceeds the wallet balance). For every attempt the script prints the error the SDK threw, then finds the attempt's transaction by nonce and replays it one block earlier to show the reason the chain gave. No funds move; each reverted tx costs about 389k gas.

## Expected
SDK `docs/reference/errors.md` line 56: "A mined transaction with `status: "reverted"` carries no revert data. The SDK replays the call as `eth_call` at the receipt's block to recover `errorName` or `reason`. When the replay yields nothing, the error is still a `ContractRevertError` and its message ends with `(no revert data recoverable)`." So when the replay cannot run, the caller should see that message, not a transport message.
The SDK's own code comment says the same (`dist/writer.js` lines 210-213): the replay is "strictly best-effort enrichment ... Never let the replay's own failure mask the real one", and lines 227-228: "Only trust the replay when it actually named an error".
`docs/reference/errors.md` line 38 and `docs/how-to/handle-errors.md` line 43 put a request that "did not complete" in `RpcError` ("retry with backoff"), and line 40 puts `ContractRevertError` under "fails again unless state changes".

## Actual
In 9 of 30 attempts (`evidence/015-run1.json`) and 14 of 30 attempts (`evidence/015-run2.json`) the SDK threw `ContractRevertError` with `errorName: null`, `reason: "@somnia-chain/markets-sdk: rpc eth_call failed: RPC Request failed."` and message "@somnia-chain/markets-sdk: placeOrder reverted: @somnia-chain/markets-sdk: rpc eth_call failed: RPC Request failed.". The other 21 and 16 attempts, same input, got `errorName: "Error"` and the message "placeOrder reverted: Error(ERC20: transfer amount exceeds balance)".
All 60 transactions are mined with status `reverted` and the same reason when replayed one block earlier (`replayAtPreviousBlock`: "ERC20: transfer amount exceeds balance" for all 60). So the order did fail for the same contract reason every time; in the affected attempts the SDK's replay hit an RPC failure (a separate 5-attempt run, `evidence/015-cause-chain-single-run.txt`, shows the node's answer behind it: `unable to load historical state`, code -1) and the SDK put that failure text into `reason` as if it were the contract's. One example per run: attempt 0 in run 1 (`0x51fd6b634b…`, block in `evidence/015-run1.json`), attempt 1 in run 2 (`0x704a966f52…`).
Why it matters: the error carries no `errorName`, so code that branches on `errorName` falls through, and the type says "the chain rejected the call; fails again" although what failed here was the SDK's diagnostic read, which the same docs say to retry. The rate is not small (30 to 47% of attempts on this endpoint) and the mined transaction (and its gas) is spent either way.
`decodeRevert` itself is documented to behave like this when handed a transport error (`docs/reference/errors.md` line 58, `dist/revert.js` line 186). The defect is that the receipt-replay path (`dist/writer.js` line 226) passes it the replay's failure without checking `isRevert`, and then keeps the result because `reason` is set (line 229).

## Evidence
- `evidence/015-run1.json`, `evidence/015-run2.json`: 60 attempts, each with the thrown error's fields, the tx hash, block, `txStatus: "reverted"`, `gasUsed`, and the reason from replaying the same call one block earlier. `summary` gives the 9 and 14 affected attempts.
- Source: `node_modules/@somnia-chain/markets-sdk/dist/writer.js` lines 208-232 (`revertErrorForReceipt`), `dist/revert.js` lines 98-125 (`isRevert`) and 186-230 (`decodeRevert`).

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383)
- Wallet: `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`
- Date: 2026-10-21 (UTC)
