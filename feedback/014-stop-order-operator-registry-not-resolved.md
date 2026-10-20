# `placePerpStopOrder` throws `NotConfiguredError` unless `operatorRegistry` is passed, although the SDK docs say it is resolved when omitted
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/014-stop-order-needs-operator-registry.mjs` (no funds, no key needed: it uses a throwaway key and nothing is sent). It builds the client the way the docs do, with `addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES`, reads the SOL market row, and calls `trader.placePerpStopOrder({ registry: market.stopRegistry, pool, ... })` without `operatorRegistry`.

## Expected
SDK type docs, `dist/trade.d.ts:1443-1447` (`PlacePerpStopOrderParams.operatorRegistry`, the same text on `PlaceSpotStopOrderParams` at line 1301): "Shared OperatorPermissionsRegistry where the one-time global approval is granted. Resolved from the live config (addresses.operatorPermissionsRegistry) if omitted." The parameter is optional in the type (`operatorRegistry?: Address`).
SDK PERPS.md, "Where the registry address comes from": every stop write "takes the per-pool `PerpStopOrderRegistry` as a required `registry` argument. Read it off the market row". It names no other required address.
So with the SDK's own testnet address set and the `stopRegistry` from the market row, a stop order should be armable.

## Actual
`SOMNIA_HIDEKI_TESTNET_ADDRESSES` has no `operatorPermissionsRegistry` key (`hasOperatorPermissionsRegistry: false`); neither do the other two bundled sets, `SOMNIA_TESTNET_ADDRESSES` and `SOMNIA_MAINNET_ADDRESSES` (`keyInBundledSets`, all `false`), and the call throws `NotConfiguredError`: "a perp stop order — needs operatorRegistry or addresses.operatorPermissionsRegistry". The fallback the JSDoc calls the live config is `addresses().operatorPermissionsRegistry` (`dist/perp/stops.js:490`), the address set the client was built with; no bundled set has the key, so the fallback is `undefined` and the call throws.
The address is published, in a different place: the developer page `/docs/developers/perps-testnet` contract table lists "OperatorPermissionsRegistry | 0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a". With that value passed as `operatorRegistry` (`OPERATOR_REGISTRY=0x6B2F... PROBE_PRIVATE_KEY=... node repro/014-stop-order-needs-operator-registry.mjs`), the SDK gets past the configuration check and the call reaches the registry, where it reverts for an unrelated reason in an account with no margin (`createTriggerOrder reverted: InsufficientMarginAtCreation()`; `evidence/014-explicit-registry-run.txt`, which also shows the wallet balance before and after). This report does not claim a working stop order.
The requirement is acknowledged in the bot kit, in code comments: "Arming a stop needs the OperatorPermissionsRegistry passed explicitly, because the SDK's bundled address sets do not carry that key." and "It is NOT in the SDK's bundled address sets (neither SOMNIA_TESTNET_ADDRESSES nor the mainnet one carries the key), so `placePerpStopOrder` throws `NotConfiguredError` unless it is passed explicitly." The SDK's type docs say the opposite and PERPS.md says nothing, so a builder who reads the SDK first meets an error that its docs tell them cannot happen. The fix is one line: add the key to the bundled address set (or correct the JSDoc and document the argument next to `registry`).

## Evidence
- `evidence/014-run1.json`, `evidence/014-run2.json`: two fresh-process runs, byte-identical (`hasOperatorPermissionsRegistry: false`, `keyInBundledSets` for the three bundled address sets, the market's `stopRegistry`, `result.name` `NotConfiguredError`, the message above).
- `evidence/014-explicit-registry-run.txt`: the same script with `OPERATOR_REGISTRY` set (balance, result, balance).
- Source: `dist/perp/stops.js:490-492` (`p.operatorRegistry ?? w.addresses().operatorPermissionsRegistry`, then the throw) and `dist/writer.js:610-619`.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383); without `OPERATOR_REGISTRY` the repro sends no transaction (throwaway key, generated per run); with it set, the SDK sends its operator-grant transaction before the call reverts (probe wallet balance 49.422587742 to 49.421754792 STT, `evidence/014-explicit-registry-run.txt`)
- Reference account for the "continues with the explicit address" observation: `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`
- Date: 2026-10-20 (UTC)
