# `claimPerpVoucher` throws "claim reverted: for an unknown reason." because the distributor's custom error is not in the SDK error ABI
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. Put a key with a little STT in `PROBE_PRIVATE_KEY`; the account must be flat and have never claimed (the claim reverts today, see report 012; it costs about 0.00014 STT). This report stays valid if report 012 is fixed: any custom error raised by `claim()` needs a name in `contractErrorsAbi`.
3. `node repro/013-claim-revert-undecoded.mjs`. It builds the SDK's own table of error selectors from the exported `contractErrorsAbi`, calls `trader.claimPerpVoucher({ marginBank })`, and prints every field of the error it throws.

## Expected
SDK errors page (`/docs/developers/sdk`, "Errors", `ContractRevertError` fields): `errorName` is set when "The revert data matched a custom error in `contractErrorsAbi`", and the page "lists ... the contract error names the SDK decodes into `ContractRevertError`". The SDK's own voucher flow is `getPerpVoucherEligibility` then `claimPerpVoucher`, and `contractErrorsAbi` already holds the bank-side voucher errors (`VoucherAccountCannotBeMainFunded`, `VoucherMarketNotAllowed`, `VoucherLeverageCapNotSet`, `VoucherAccountLeverageLocked`). So the errors that `VoucherDistributor.claim()` itself raises should be in `contractErrorsAbi` too, and a failed claim should carry an `errorName`.
SDK PERPS.md "Credit vouchers": "Check eligibility before you claim. A failed claim still mines and costs gas". The caller pays for the failure, so the failure should say why.

## Actual
The thrown error is `ContractRevertError` with `message` "claim reverted: for an unknown reason.", `errorName: null`, `reason` "for an unknown reason.", `data: "0x3e31dcc2"`, `address` the VoucherDistributor `0x2ACD9EFdA721450906bfE1bef3edE269636E42C4`, `functionName: "claim"`. The script's table over all 546 errors in `contractErrorsAbi` has no entry for `0x3e31dcc2` (`selectorKnownToSdk: false`). The selector does not appear in the public 4byte signature database either (`fourByteLookup: null` in `evidence/012-trace-run1.json`). The code that raises it is inside the distributor implementation `0x9657f0fd53efc01cd108d93c835bb4b517732b43` (`selectorInImplementationBytecode: true` and the trace in the same file), so it is a distributor error, not a MarginBank one.
Only the raw 4 bytes are available to the caller, so the cause of the revert in report 012 cannot be read from the SDK's output.

## Evidence
- `evidence/013-run1.json`, `evidence/013-run2.json`: two fresh-process runs, byte-identical (`eligibility`, `errorsInSdkAbi: 546`, the full `claim` error fields, `selectorKnownToSdk: false`).
- The reverting claim transactions, the trace and the implementation address are in report 012 and `evidence/012-trace-run1.json`.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383)
- Wallet: `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`
- Date: 2026-10-21 (UTC)
