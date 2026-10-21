# `placePerpStopOrder` throws `NotConfiguredError` unless `operatorRegistry` is passed, although its JSDoc says it is resolved from the config when omitted
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/014-stop-order-needs-operator-registry.mjs` (no funds, no key needed: it uses a throwaway key and nothing is sent). It builds the client the way the docs do, with `addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES`, reads the SOL market row, and calls `trader.placePerpStopOrder({ registry: market.stopRegistry, pool, ... })` without `operatorRegistry`.

## Expected
SDK type docs, `dist/trade.d.ts:1443-1447` (`PlacePerpStopOrderParams.operatorRegistry`, the same text on `PlaceSpotStopOrderParams` at lines 1301-1304): "Shared OperatorPermissionsRegistry where the one-time global approval is granted. Resolved from the live config (addresses.operatorPermissionsRegistry) if omitted." The parameter is optional in the type (`operatorRegistry?: Address`).
SDK PERPS.md, "Where the registry address comes from": every stop write "takes the per-pool `PerpStopOrderRegistry` as a required `registry` argument. Read it off the market row". It names no other required address.
So with the SDK's own testnet address set and the `stopRegistry` from the market row, a stop order should be armable.

## Actual
`SOMNIA_HIDEKI_TESTNET_ADDRESSES` has no `operatorPermissionsRegistry` key (`hasOperatorPermissionsRegistry: false`); neither do the other two bundled sets, `SOMNIA_TESTNET_ADDRESSES` and `SOMNIA_MAINNET_ADDRESSES` (`keyInBundledSets`, all `false`), and the call throws `NotConfiguredError`: "@somnia-chain/markets-sdk: a perp stop order — needs operatorRegistry or addresses.operatorPermissionsRegistry". The fallback the JSDoc calls the live config is `addresses().operatorPermissionsRegistry` (`dist/perp/stops.js:490`), the address set the client was built with; no bundled set has the key, so the fallback is `undefined` and the call throws.
The address is published, in a different place: the developer page `/docs/developers/perps-testnet` contract table lists "OperatorPermissionsRegistry | 0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a". With that value passed as `operatorRegistry` (`OPERATOR_REGISTRY=0x6B2F... PROBE_PRIVATE_KEY=... node repro/014-stop-order-needs-operator-registry.mjs`), the SDK gets past the configuration check and the call reaches the registry, where it reverts for an unrelated reason in an account with no margin (`createTriggerOrder reverted: InsufficientMarginAtCreation()`; `evidence/014-explicit-registry-run.txt`, which also shows the wallet balance before and after). This report does not claim a working stop order.
The gap is known elsewhere. The SDK's own spot operator-grant docs say "no deployment manifest carries the key yet" (`dist/somniaMarketsClient.d.ts:4829-4832`, on `getOperatorPermissionsRegistry(pool)`, a SpotPool read; `docs/reference/configuration.md:157` lists the key as optional and points to that read), and the bot kit says so in code comments: "Arming a stop needs the OperatorPermissionsRegistry passed explicitly, because the SDK's bundled address sets do not carry that key." and "It is NOT in the SDK's bundled address sets (neither SOMNIA_TESTNET_ADDRESSES nor the mainnet one carries the key), so `placePerpStopOrder` throws `NotConfiguredError` unless it is passed explicitly." The stop-order docs a perps builder reads do not: the `operatorRegistry` JSDoc says it is resolved from the config if omitted, and PERPS.md's stop section does not mention the argument. So a builder who follows the perps docs meets a `NotConfiguredError` that the stop-order docs do not prepare them for. Possible fixes: add the key to the bundled address sets, or correct the JSDoc and document the argument next to `registry` in PERPS.md.

## Evidence
- `evidence/014-run1.json`, `evidence/014-run2.json`: two fresh-process runs, byte-identical (`hasOperatorPermissionsRegistry: false`, `keyInBundledSets` for the three bundled address sets, the market's `stopRegistry`, `result.name` `NotConfiguredError`, the message above).
- `evidence/014-explicit-registry-run.txt`: the same script with `OPERATOR_REGISTRY` set (balance, result, balance).
- `evidence/014-explicit-registry-stop-lifecycle.txt`: with the registry passed and 50 USDso of margin, the same call places a stop-entry (tx `0xa91a66f5bac92549c83dfa4962625b88f4bbf1b0374331133c4e77ea51426b30`) and `cancelPerpStopOrder` refunds the 0.15 SOMI exactly (tx `0x398e22d3052d77780a2f3875c196b463e297b3ce3041a73bbefca5dce95ad019`). So the only missing step in the omitted-registry case is the address resolution.
- Source: `dist/perp/stops.js:490-492` (`p.operatorRegistry ?? w.addresses().operatorPermissionsRegistry`, then the throw) and `dist/writer.js:610-619`.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383); without `OPERATOR_REGISTRY` the repro sends no transaction (throwaway key, generated per run); with it set, the probe wallet balance fell by 0.00083295 STT (49.422587742 to 49.421754792 STT, `evidence/014-explicit-registry-run.txt`), consistent with the SDK's operator-grant transaction being mined before the call reverted
- Reference account for the "continues with the explicit address" observation: `0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b`
- Date: 2026-10-20 (UTC)
