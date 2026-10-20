# bot-kit perp-guard ends the whole process on the first failed read: only the close call is wrapped in try/catch, so a transient indexer or RPC error stops the guard watching
Severity: normal
Area: app

## Steps to reproduce
Target: the official `somnia-chain/dreamdex-bot-kit` at commit `25798660bbe4674a6f83a960b202852896e2fed4`, `strategies/perp-guard/src/index.ts`. The exchange is a mock; the strategy and every `perp-core` helper are the real upstream code.
Shortcut: `node repro/104-botkit-guard-exits-on-failed-read.mjs` does steps 1-4 below from fresh clones (it needs git, npm and network access) and prints `REPRODUCED` when the new test fails on upstream and passes with the patch.
1. `repro/botkit/run-botkit.sh 104` clones upstream at that commit into a temp directory, installs it, copies in `repro/botkit/harness.ts` and `repro/botkit/104-guard-exits-on-failed-read.test.ts`, and runs the upstream `perp-core` vitest suite plus the new test.
2. The test runs `perp-guard`'s `main()` with `DRY_RUN=false` and a blank `PERP_SYMBOL` (the "watch what the account holds" mode) against a mock account holding a 0.01 BTC long at health 1.0x maintenance, below the default 1.15x flatten line. The second `fetchPositions` call throws `request failed: 503 Service Unavailable` (mocked); every other call works.
3. Unmodified upstream: the test fails with `expected 1 to be +0`. The process exited with code 1 on that failed read (the position read in the first cycle), no order was sent, and the position was never reached (`evidence/104-upstream-run.txt`, 1 failed, 31 upstream tests passed).
4. `repro/botkit/run-botkit.sh 104 patches/104-guard-survive-failed-read.patch`: all 32 pass. The guard logs the failure, polls again, and sends one IOC sell of the whole 1,000,000 raw units (0.01 BTC) (`evidence/104-patched-run.txt`).

## Expected
The guard's header says it "watches margin health and reduces a position before the protocol does it for you". The comment on the existing `catch` around the close (`index.ts:151-152`) says "One market refusing ... must not stop the guard watching the rest.", and the `watchList` comment says the guard is built to work "at the only moment it matters", when the venue is in trouble.
So a failed read in one poll should be logged and retried on the next one, not end the process.

## Actual
Only the `closePosition` calls are inside a `try/catch` (`index.ts:153-163`). Everything that runs before them in a cycle is not: `watchList` (`index.ts:128`, which reads the account's positions when `PERP_SYMBOL` is blank), `marginSnapshot` (`:137`), `positionIn` (`:139`) and `liveMark`'s caller (`:142`). A throw from any of them leaves `main()`, which ends in `process.exit(1)` (`index.ts:177`). In the test that means the failed position read, at a moment when the account is already below the flatten threshold, ends the guard before it acts. Between the exit and any restart nothing is watching the account.
What happens next depends on the deployment: the repo's `railway.toml` restarts on failure at most 10 times (`restartPolicyType = "ON_FAILURE"`, `restartPolicyMaxRetries = 10`), after which a guard that keeps meeting the error stays down. The restart path was not run; the test shows only the exit.

## Evidence
- `evidence/104-upstream-run.txt`: pristine upstream (1 failed, 31 passed), failing assertion `expect(code).toBe(0)` with 1 received.
- `evidence/104-patched-run.txt`: with `patches/104-guard-survive-failed-read.patch` applied, 32 passed.
- `patches/104-guard-survive-failed-read.patch`: wraps the body of the poll loop in `try { ... } catch (err) { console.log("guard cycle failed, will retry: ...") }` and keeps the single `sleep(POLL_MS)` after it. It also resolves the watch list once before the loop (`await watchList(ctx, me)`), so a bad `PERP_SYMBOL` still stops the guard at start-up rather than being retried forever. The `-w` diff is about 11 added lines; the rest is re-indentation. `tsc --noEmit` on `strategies/perp-guard` is clean with the patch.
- `repro/botkit/104-guard-exits-on-failed-read.test.ts`, `repro/botkit/harness.ts`: the test and the mock exchange. The mock returns fixed margin, mark and book values; the error string is a test input, not captured from a live endpoint. The test would also pass with a broader catch than the patch's, so it shows the guard surviving a read error, not that this is the narrowest handling.

## Environment
- `somnia-chain/dreamdex-bot-kit` @ `25798660bbe4674a6f83a960b202852896e2fed4`, `perp-core` resolves `@somnia-chain/markets-sdk` 0.31.0, vitest 2.1.9, Node v22.22.0
- Network: none (mock exchange)
- Wallet: none
- Date: 2026-10-21 (UTC)
