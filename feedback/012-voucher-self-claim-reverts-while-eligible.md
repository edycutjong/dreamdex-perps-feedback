# Voucher self-claim reverts for a flat, never-claimed address although the developer docs and `getPerpVoucherEligibility` say it should work
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. Put a key that holds a little STT for gas in `PROBE_PRIVATE_KEY` (a reverted claim still mines; it costs about 0.00014 STT). The account must be flat and must never have claimed.
3. `node repro/012-voucher-claim-reverts.mjs`. It calls `client.getPerpVoucherEligibility(marginBank, account)`, then sends the SDK's own claim (`trader.buildClaimPerpVoucher`, a call to `VoucherDistributor.claim()`) with a fixed gas limit and reads the receipt.
4. `node repro/012-claim-revert-trace.mjs` (read-only, no key) traces the same `claim()` call with `debug_traceCall` and finds the implementation behind the distributor proxy.
5. `node repro/012-voucher-credit-senders.mjs` (read-only, no key) lists who actually receives the voucher: every indexed `Credited` margin event and the sender of the transaction behind it. `PAGES=40` reads all of them.

## Expected
Developer page `/docs/developers/perps-testnet`, "Get test funds": "Paper USDso. Any address can claim the 1,000 USDso perps credit once, as long as it holds no perp positions or orders:" followed by `getPerpVoucherEligibility(...)` and `if (eligibility.eligible) { await markets.trader.claimPerpVoucher(...) }`.
SDK PERPS.md "Credit vouchers": "Check eligibility before you claim." and "One claim per address, for the distributor's life."
SDK source `dist/perp/voucher.js`: the eligibility checks are "Same order as `VoucherDistributor.claim()`, so the first failure here is the revert a claim would produce at this block."
So an account with `eligible: true` should get the grant when it calls `claimPerpVoucher`.
The trading docs (`/docs/trading/perps-testnet`) give another route: "Join Perps Arena , the paper-trading competition, to receive 1,000 paper USDso to trade with." This report does not say that route is wrong. It asks for the developer page and the SDK to match the chain: either `claim()` works as documented, or `getPerpVoucherEligibility` / the developer page say that a self-claim is closed, or `claim()` reverts with a named reason (report 013).

## Actual
`eligible` is `true` (grant 1000 USDso), but the claim reverts, for two different addresses:
- Probe wallet `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`: tx `0xe3c86a83d294828a682e1f83d1d2f43b83c35b5191171fcc3e089a01638f6620`, status `reverted`, 22,781 gas, no logs, `getPerpVoucher` still `claimed: false`.
- A brand-new address `0x0d6D4dd4125477f5f0E380eDE951B37a395Fa036` (created for this test, funded with 0.5 STT in tx `0x144da8783d7364d17f1c7739f84bbb0930aa14cb22130fa1abe63ab6c7668b1b`): tx `0xf859df015c4d23dc4dd3f846bd228aa22d36c5a2de8ff5466f5a1d29514c343c`, same result.
An `eth_call` of `claim()` reverts the same way with data `0x3e31dcc2` (see report 013: the SDK cannot name it). The revert happens after 871 gas inside the distributor implementation `0x9657f0fd53efc01cd108d93c835bb4b517732b43`: `debug_traceCall` shows one DELEGATECALL into it and no inner calls (`evidence/012-trace-run1.json`). So it is one of the first checks in `claim()`, before any call to the bank. The campaign window (`startsAt` 1790553600, `endsAt` 1798477478) is open, and the account is flat, unfunded and unclaimed, so it is not one of the conditions the SDK checks.
No self-claim appears in the indexed data. The indexer holds 37,521 `Credited` margin events in 524 transactions (2026-10-19 16:20 UTC to 2026-10-20 23:05 UTC); all 524 transactions were sent by one address, `0x792182e6b2bd50deb22dc5436f7c518b34f9bd12`, and none was a claim by the credited account itself (`selfClaimTxs: 0`). That pattern may be intended (credits pushed by an operator, for example for Perps Arena members); the point here is that the developer page still advertises the self-claim and the SDK still answers `eligible: true`. The campaign also still shows `claimsRemaining` 423991 (`evidence/012-trace-run1.json`).
So the documented route to the first USDso (and therefore to the first perp order) does not work for a builder who follows the developer page: `eligible` says yes, the claim costs gas and reverts. The Perps Arena route in the trading docs ("Join Perps Arena ... to receive 1,000 paper USDso") may be the intended one, but the developer page and the SDK do not say so, and `getPerpVoucherEligibility` has no reason for it.

## Evidence
- `evidence/012-run1.json`, `evidence/012-run2.json` (probe wallet, two fresh processes: same fields, different tx hash) and `evidence/012-run3-fresh-wallet.json` (new address): `eligibility`, `simulatedClaim` (data `0x3e31dcc2`), `claimTx` (hash, status `reverted`, gasUsed, cost), `voucherAfter`.
- `evidence/012-senders-run1.json` (newest 2,000 rows: 1,990 rows, 20 transactions, one sender, `selfClaimTxs: 0`) and `evidence/012-credit-senders-full.json` (`PAGES=40`: 37,521 rows, 524 transactions, one sender, `selfClaimTxs: 0`).
- `evidence/012-trace-run1.json`, `evidence/012-trace-run2.json`: the trace, the implementation address, `selectorInImplementationBytecode: true` (the selector is a constant in that bytecode) and `fourByteLookup: null` (the selector is not in the public 4byte database, queried at run time). Only `headBlock` differs between runs.
- `evidence/012-fresh-wallet-setup.txt`: creation, funding and the claim of the new address.
- Claim transactions on the Somnia testnet explorer: the three hashes above.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383)
- Wallets: `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b` and `0x0d6D4dd4125477f5f0E380eDE951B37a395Fa036`
- VoucherDistributor `0x2ACD9EFdA721450906bfE1bef3edE269636E42C4`, MarginBank `0x478769e1177c0773c43a593dccc4ad15f15f1394`
- Date: 2026-10-20 (UTC)
