# bot-kit perp-maker pulls its quotes only on Ctrl-C: any error thrown between cycles exits the process with the last bid and ask still resting on the book
Severity: major
Area: app

## Steps to reproduce
Target: the official `somnia-chain/dreamdex-bot-kit` at commit `25798660bbe4674a6f83a960b202852896e2fed4`, `strategies/perp-maker/src/index.ts`. The exchange is a mock; the strategy and every `perp-core` helper are the real upstream code.
Shortcut: `node repro/102-botkit-maker-error-exit-leaves-quotes.mjs` does steps 1-4 below from fresh clones (it needs git, npm and network access) and prints `REPRODUCED` when the new test fails on upstream and passes with the patch.
1. `repro/botkit/run-botkit.sh 102` clones upstream at that commit into a temp directory, installs it, copies in `repro/botkit/harness.ts` and `repro/botkit/102-maker-error-exit-leaves-quotes.test.ts`, and runs the upstream `perp-core` vitest suite plus the new test.
2. The test runs `perp-maker`'s `main()` with `DRY_RUN=false`. Cycle 1 runs normally and places a post-only bid and ask (order ids 11 and 12 on the mock book). During the wait before cycle 2 the mock indexer starts failing, so `loadMarkets` throws `indexer request failed: 502 Bad Gateway`.
3. Unmodified upstream: the test fails. The process exits with code 1 and the mock book still holds orders `[11n, 12n]`; `cancelOrder` was never called (`evidence/102-upstream-run.txt`, 1 failed, 31 upstream tests passed).
4. `repro/botkit/run-botkit.sh 102 patches/102-maker-pull-quotes-on-error.patch`: same test, all 32 pass, exit code is still 1 and the book is empty (`evidence/102-patched-run.txt`).

## Expected
The file's own comments say the opposite of what happens on an error exit. `index.ts:190-191`: "Leaving quotes on the book after the process exits is how a stopped bot keeps trading." The inner `catch` at `index.ts:148-150` and `179-183` exists for the same reason ("pull the placed leg before the error propagates: a bot that exits here would otherwise leave a one-sided quote trading on the book with nobody watching it").
So whatever makes `main()` throw while quotes are resting, the bot should cancel them before the process ends.

## Actual
The only cleanup that covers a resting pair is the loop after the `while` (`index.ts:190-194`), which runs only when `stopped()` turns true (Ctrl-C / SIGTERM). The inner `catch` covers only the quotes placed in the current cycle (`next`). Everything else in the loop is unguarded while the previous pair rests: `requireMarket(..., { reload: true })` (`index.ts:111`, an indexer read), `inventoryUsdso` (`index.ts:136`, `fetchPositions`), `sizeOrder`, and any other throw. One failed read ends the process through `main().then(..., err => process.exit(1))` with both quotes live.
In the test the first cycle's pair is the one left behind. The orders are resting limit orders with the SDK's default expiry, which `perp-core/src/operator.ts:62-64` says is "fifty years out", so nothing expires them.
The repo's own deployment makes this repeat: `railway.toml` sets `restartPolicyType = "ON_FAILURE"` with `restartPolicyMaxRetries = 10`, and every restarted process starts with `resting = { atMark: 0 }` (`index.ts:106`), so it does not know about the previous run's orders. Each failed run can therefore leave one more pair (an inference from the config and the code; the restart path was not run).

## Evidence
- `evidence/102-upstream-run.txt`: pristine upstream, the failing assertion is `expect([...m.live]).toEqual([])` (received `[11n, 12n]`).
- `evidence/102-patched-run.txt`: with `patches/102-maker-pull-quotes-on-error.patch` applied, 32 passed.
- `patches/102-maker-pull-quotes-on-error.patch`: wraps the `while` loop in `try { ... } finally { ... }` and moves the existing cancel loop into the `finally`, so it runs on Ctrl-C and on an error alike. The `-w` diff is 5 added and 2 removed lines; the rest is re-indentation. `tsc --noEmit` on `strategies/perp-maker` is clean with the patch.
- `repro/botkit/102-maker-error-exit-leaves-quotes.test.ts`, `repro/botkit/harness.ts`: the test and the mock exchange. The mock book only records placed and cancelled orders; it does not model fills or the pool.

## Environment
- `somnia-chain/dreamdex-bot-kit` @ `25798660bbe4674a6f83a960b202852896e2fed4`, `perp-core` resolves `@somnia-chain/markets-sdk` 0.31.0, vitest 2.1.9, Node v22.22.0
- Network: none (mock exchange)
- Wallet: none
- Date: 2026-10-21 (UTC)
