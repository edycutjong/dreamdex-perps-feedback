# An unreachable WebSocket is thrown as "genesis check failed" although no genesis was compared; the network cause (refused, HTTP 502) is only on `error.cause`
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/004-genesis-check-failed-hides-cause.mjs` (read-only, no key, no funds).
3. The script builds three clients on `hidekiTestnet`: one with no WebSocket URL, one whose WebSocket URL refuses connections (`ws://127.0.0.1:9/ws`), one pointing at a non-upgrading path on the real host (`wss://api.hideki2.infra.testnet.somnia.network/not-a-ws-path`). It calls `listPerpMarkets()` then `getPerpState()` and prints `error.name`, `error.message` and the first `Details:` line of `error.cause`.

## Expected
Developer docs `/docs/developers/perps-testnet`, "Common pitfalls": "The SDK reads the chain over WebSocket. An environment that only proxies HTTP fails on the first chain read with genesis check failed. Give it access to the WebSocket endpoint above."
The developer docs and the SDK agree on the behaviour: an unreachable WebSocket surfaces as "genesis check failed". This report is about the label and the missing cause, not the behaviour. A connectivity failure should not be labelled as a genesis-check failure when no genesis was compared. The error should say that the WebSocket could not be reached, and carry the transport failure (connection refused, HTTP 502 on the upgrade) in `error.message`, where a caller logs it. Today a missing URL gets a specific `NotConfiguredError` naming `wsRpcUrl`; an unreachable one gets `RpcError` "genesis check failed".

## Actual
The two unreachable cases (`wsRefused`, `wsWrongPath`) throw the same error: `RpcError: @somnia-chain/markets-sdk: rpc getBlock failed: genesis check failed`.
The real failure is only on `error.cause`: `connect ECONNREFUSED 127.0.0.1:9` in the first case, `Unexpected server response: 502` in the second. A caller who logs `error.message` (the usual thing) sees nothing about the network.
In `dist/client.js` (`makeGenesisCheck`) the check reads block 1 once to detect the retired Hideki v1 genesis. A block-1 hash on the retired list throws a clear `NotConfiguredError` ("this RPC serves the retired ... genesis"). Any `getBlock` failure other than a missing block or an SDK error is re-thrown as `new RpcError("getBlock", "genesis check failed", { cause })`. So the "genesis check failed" message is only produced when block 1 could not be read at all, that is, when no genesis was compared: a plain connectivity or gateway error is labelled as a genesis problem.
Related inconsistency: the case `noWsConfigured` (no `webSocket` URL at all) fails with a clear `NotConfiguredError` ("this operation needs chain access — needs wsRpcUrl in createClient (or a chain whose rpcUrls carry a webSocket endpoint)"), so only an unreachable WebSocket gets the misleading label.

## Evidence
- `evidence/004-run1.json`, `evidence/004-run2.json`: two fresh-process runs, byte-identical.
- `evidence/docs-excerpts-2026-10-20.txt`: the developer-docs pitfall quoted above, as served on 2026-10-20 (UTC).
- Output of run 1: `noWsConfigured` -> `NotConfiguredError` with the message above; `wsRefused` -> message "rpc getBlock failed: genesis check failed", cause "connect ECONNREFUSED 127.0.0.1:9"; `wsWrongPath` -> same message, cause "Unexpected server response: 502".

## Environment
- `@somnia-chain/markets-sdk` 0.32.1 (viem 2.57.7), Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20 (UTC)
