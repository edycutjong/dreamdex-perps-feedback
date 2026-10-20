# bot-kit perp-guard ends the whole process on the first failed read: only the close call is wrapped in try/catch, so a transient indexer or RPC error stops the guard watching
Severity: normal
Area: app

## Steps to reproduce
Target: the official `somnia-chain/dreamdex-bot-kit` at commit `25798660bbe4674a6f83a960b202852896e2fed4`, `strategies/perp-guard/src/index.ts`. The exchange is a mock; the strategy and every `perp-core` helper are the real upstream code.
1. `repro/botkit/run-botkit.sh 104` clones upstream at that commit into a temp directory, installs it, copies in `repro/botkit/harness.ts` and `repro/botkit/104-guard-exits-on-failed-read.test.ts`, and runs the upstream `perp-core` vitest suite plus the new test.
2. The test runs `perp-guard`'s `main()` with `DRY_RUN=false` and a blank `PERP_SYMBOL` (the "watch what the account holds" mode) against a mock account holding a 0.01 BTC long at health 1.0x maintenance, below the default 1.15x flatten line. The first `fetchPositions` call throws `indexer request failed: 503 Service Unavailable`; every later call works.
3. Unmodified upstream: the test fails with `expected 1 to be +0`. The process exited with code 1 on that first failed read, no order was sent, and the position was never reached (`evidence/104-upstream-run.txt`, 1 failed, 31 upstream tests passed).
4. `repro/botkit/run-botkit.sh 104 patches/104-guard-survive-failed-read.patch`: all 32 pass. The guard logs the failure, polls again, and sends one IOC sell of the whole 1,000,000 raw units (0.01 BTC) (`evidence/104-patched-run.txt`).

## Expected
The guard's header says it "watches margin health and reduces a position before the protocol does it for you", and the loop comment at `index.ts:151-152` says "One market refusing ... must not stop the guard watching the rest." The `watchList` comment says the guard is built to work "at the only moment it matters", when the venue is in trouble, which is also when the indexer and RPC are most likely to error.
So a failed read in one poll should be logged and retried on the next one, not end the process.

## Actual
Only the `closePosition` calls are inside a `try/catch` (`index.ts:153-166`). Everything that runs before them in a cycle is not: `watchList` (`index.ts:128`, which reads positions through the indexer when `PERP_SYMBOL` is blank), `marginSnapshot` (`:137`), `positionIn` (`:139`) and `liveMark`'s caller (`:142`). A throw from any of them leaves `main()`, which ends in `process.exit(1)` (`index.ts:177`). In the test that means the first failed position read, at a moment when the account is already below the flatten threshold, ends the guard before it acts.
What happens next depends on the deployment: the repo's `railway.toml` restarts on failure at most 10 times (`restartPolicyType = "ON_FAILURE"`, `restartPolicyMaxRetries = 10`), after which a guard that keeps meeting the error stays down. The restart path was not run; the test shows only the exit.
The other strategies end the same way on a failed read; this report is limited to `perp-guard`, whose job is to be running when margin falls.

## Evidence
- `evidence/104-upstream-run.txt`: pristine upstream (1 failed, 31 passed), failing assertion `expect(code).toBe(0)` with 1 received.
- `evidence/104-patched-run.txt`: with `patches/104-guard-survive-failed-read.patch` applied, 32 passed.
- `patches/104-guard-survive-failed-read.patch`: wraps the body of the poll loop in `try { ... } catch (err) { console.log("guard cycle failed, will retry: ...") }` and keeps the single `sleep(POLL_MS)` after it. The `-w` diff is 6 added lines; the rest is re-indentation. `tsc --noEmit` on `strategies/perp-guard` is clean with the patch.
- `repro/botkit/104-guard-exits-on-failed-read.test.ts`, `repro/botkit/harness.ts`: the test and the mock exchange. The mock returns fixed margin, mark and book values; the error string is a test input, not captured from the live indexer.

## Environment
- `somnia-chain/dreamdex-bot-kit` @ `25798660bbe4674a6f83a960b202852896e2fed4`, `perp-core` resolves `@somnia-chain/markets-sdk` 0.31.0, vitest 2.1.9, Node v22.22.0
- Network: none (mock exchange)
- Wallet: none
- Date: 2026-10-21 (UTC)
