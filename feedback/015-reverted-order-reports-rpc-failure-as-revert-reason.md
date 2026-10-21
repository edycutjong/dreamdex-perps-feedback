# `placePerpOrder` reports its own failed `eth_call` replay as the revert reason: "placeOrder reverted: rpc eth_call failed: RPC Request failed."
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. Use a testnet key with STT for gas and USDso in the wallet or the perps margin account. The repro prints the balances it ran with (runs 3 and 4 below: 50 USDso in the wallet, 49.6861 USDso in the margin account; stored in `funds` of `evidence/015-run3.json` and `015-run4.json`, not saved for runs 1 and 2); it needs `getMaxPerpOrderSize` (with `autoPull`) to be above the SOL minimum size. Put the key in `PROBE_PRIVATE_KEY`.
3. `PROBE_PRIVATE_KEY=0x… ATTEMPTS=30 node repro/015-failed-receipt-replay-failure-reported-as-revert-reason.mjs`. It asks the SDK for the largest SOL bid it allows (`getMaxPerpOrderSize` with `autoPull: true`), then calls `trader.placePerpOrder` 30 times with that size plus one lot (`lotSize` 10,000,000). Each call sends a real transaction that the pool reverts (the pool's token transfer exceeds the balance: "ERC20: transfer amount exceeds balance"). For every attempt the script prints the error the SDK threw and its `cause` chain, finds the attempt's transaction by nonce, and replays it as an `eth_call` at the receipt's block (what the SDK does) and one block earlier, decoding the reason. No funds move; each reverted tx costs about 190k to 390k gas.
4. The share of attempts that hit the failure changes a lot from run to run (see Actual); use 30 or more attempts and a few runs.

## Expected
SDK `docs/reference/errors.md` line 56: "A mined transaction with `status: "reverted"` carries no revert data. The SDK replays the call as `eth_call` at the receipt's block to recover `errorName` or `reason`. When the replay yields nothing, the error is still a `ContractRevertError` and its message ends with `(no revert data recoverable)`." So when the replay cannot run, the caller should see that message, not a transport message.
The SDK's own code comment says the same (`dist/writer.js` lines 210-213): the replay is "Strictly best-effort enrichment ... Never let the replay's own failure mask the real one", and lines 227-228: "Only trust the replay when it actually named an error".
`docs/reference/errors.md` line 38 puts a request that did not complete (connection refused, timeout) in `RpcError`, and line 40 describes `ContractRevertError` as "fails again unless state changes".

## Actual
Four saved runs of 30 attempts each. In 9, 14, 1 and 1 of the 30 attempts (`evidence/015-run1.json` to `015-run4.json`; runs 1 and 2 are from an earlier version of the script that did not log the `cause` chain), the SDK threw `ContractRevertError` with `errorName: null`, `reason: "@somnia-chain/markets-sdk: rpc eth_call failed: RPC Request failed."` and the message "@somnia-chain/markets-sdk: placeOrder reverted: @somnia-chain/markets-sdk: rpc eth_call failed: RPC Request failed.". The other attempts, same input, got `errorName: "Error"` and the message "placeOrder reverted: Error(ERC20: transfer amount exceeds balance)".
All 120 transactions are mined with status `reverted`, and replaying each one one block earlier gives "ERC20: transfer amount exceeds balance" every time (120 of 120); in runs 3 and 4, replaying at the receipt's own block (the block the SDK uses) also gives that reason for all 60. So the order failed for the same contract reason every time; in the affected attempts the SDK's replay hit an RPC failure and the SDK put that failure text into `reason` as if it were the contract's. In runs 3 and 4 the `cause` chain of the two affected attempts ends in `RpcRequestError`, code -1, details `unable to load historical state` (run 3 attempt 28, tx `0x512fa52cc359…`; run 4 attempt 9, tx `0xc02fa9a1cfb9…`); `evidence/015-cause-chain-single-run.txt` is an earlier 5-attempt run that shows the same. The node-side cause (a node that cannot serve state for a block it has just mined) is not determined by this report.
Why it matters: the error carries no `errorName`, so code that branches on `errorName` falls through, and `reason` says the call failed with an RPC error while the chain's reason was different (what failed was the SDK's diagnostic read). On this endpoint and in this scenario the failure was seen in up to 14 of 30 attempts, and the mined transaction (and its gas) is spent either way. Code that branches on `errorName` or reads `reason` gets the SDK's own RPC failure text where the chain's reason was "ERC20: transfer amount exceeds balance".
`decodeRevert` itself is documented to do this when handed a transport error (`docs/reference/errors.md` line 58, `dist/revert.js` line 186). The defect is that the receipt-replay path (`dist/writer.js` line 226) passes it the replay's failure without checking `isRevert`, and then keeps the result because `reason` is set (line 229). A reading of "working as intended" (the exported `decodeRevert` is documented to return a `ContractRevertError` without `errorName` for a transport error) does not cover this path: the SDK has `isRevert` for exactly this case and the comments at lines 210-213 and 227-228 say the replay must not mask the real failure.

## Suggested fix
In `revertErrorForReceipt`, check `isRevert(replayed)` (or that the replay error is a `ContractRevertError`) before passing it to `decodeRevert`; otherwise fall through to the documented "(no revert data recoverable)" message (or retry the replay once), so a failed replay never becomes `reason`.

## Evidence
- `evidence/015-run1.json` to `evidence/015-run4.json`: 120 attempts, each with the thrown error's fields (runs 3 and 4 also its `cause` chain), the tx hash, block, `txStatus`, `gasUsed`, and the reason from replaying the same call one block earlier (runs 3 and 4 also at the receipt's block). `summary` gives the 9, 14, 1 and 1 affected attempts; runs 3 and 4 also print the balances and `lotSize` they used.
- `evidence/015-cause-chain-single-run.txt`: an earlier 5-attempt run with the full `cause` chain of the one affected attempt.
- Source: `node_modules/@somnia-chain/markets-sdk/dist/writer.js` lines 208-236 (`revertErrorForReceipt`), `dist/revert.js` lines 98-131 (`isRevert`) and 170-231 (`decodeRevert`).

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383)
- Wallet: `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`
- Date: 2026-10-21 (UTC)
