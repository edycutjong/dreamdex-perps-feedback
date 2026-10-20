# Any failed first chain read is reported as "genesis check failed"; the real cause (refused, 502) is only on `error.cause`
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/004-genesis-check-failed-hides-cause.mjs` (read-only, no key, no funds).
3. The script builds two clients on `hidekiTestnet` whose WebSocket URL is unreachable: one refused connection (`ws://127.0.0.1:9/ws`), one non-upgrading path on the real host (`wss://api.hideki2.infra.testnet.somnia.network/not-a-ws-path`). It calls `listPerpMarkets()` then `getPerpState()` and prints `error.name`, `error.message` and the first `Details:` line of `error.cause`.

## Expected
Developer docs `/docs/developers/perps-testnet`, "Common pitfalls": "The SDK reads the chain over WebSocket. An environment that only proxies HTTP fails on the first chain read with genesis check failed. Give it access to the WebSocket endpoint above."
The message a developer sees should say what failed (connection refused, HTTP 502 on the upgrade, timeout) so the WebSocket advice is findable from the error itself. "genesis check" suggests a wrong or retired chain, which is not what happened.

## Actual
Both cases throw the same error: `RpcError: @somnia-chain/markets-sdk: rpc getBlock failed: genesis check failed`.
The real failure is only on `error.cause`: `connect ECONNREFUSED 127.0.0.1:9` in the first case, `Unexpected server response: 502` in the second. A caller who logs `error.message` (the usual thing) sees nothing about the network.
In `dist/client.js` (`makeGenesisCheck`) the check reads block 1 once to detect the retired Hideki v1 genesis, and any `getBlock` failure other than a missing block is re-thrown as `new RpcError("getBlock", "genesis check failed", { cause })`. So a plain connectivity or gateway error is labelled as a genesis problem.
Related inconsistency: a chain config with no `webSocket` URL at all fails fast with a clear `NotConfiguredError` ("this operation needs chain access — needs wsRpcUrl in createClient ..."), so only the unreachable-WebSocket case gets the misleading label.

## Evidence
- `evidence/004-run1.json`, `evidence/004-run2.json`: two fresh-process runs, byte-identical.
- Output of run 1: `wsRefused` -> message "rpc getBlock failed: genesis check failed", cause "connect ECONNREFUSED 127.0.0.1:9"; `wsWrongPath` -> same message, cause "Unexpected server response: 502".

## Environment
- `@somnia-chain/markets-sdk` 0.32.1 (viem 2.57.7), Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none needed (probe wallet 0x440E03bb3AAdBE65D5Bf2Ad7f84A64c509ff438b not used)
- Date: 2026-10-20
