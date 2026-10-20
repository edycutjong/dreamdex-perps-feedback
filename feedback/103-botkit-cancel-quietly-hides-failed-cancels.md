# bot-kit cancelQuietly swallows every cancel error, so perp-maker forgets a quote whose cancel failed and quotes a second pair on top of it
Severity: normal
Area: app

## Steps to reproduce
Target: the official `somnia-chain/dreamdex-bot-kit` at commit `25798660bbe4674a6f83a960b202852896e2fed4`: `packages/perp-core/src/orders.ts` (`cancelQuietly`) and `strategies/perp-maker/src/index.ts`, its only caller. The exchange is a mock; the strategy and every `perp-core` helper are the real upstream code.
Shortcut: `node repro/103-botkit-cancel-quietly-hides-failed-cancels.mjs` does steps 1-4 below from fresh clones (it needs git, npm and network access) and prints `REPRODUCED` when the new test fails on upstream and passes with the patch.
1. `repro/botkit/run-botkit.sh 103` clones upstream at that commit into a temp directory, installs it, copies in `repro/botkit/harness.ts` and `repro/botkit/103-cancel-quietly-swallows-failures.test.ts`, and runs the upstream `perp-core` vitest suite plus the new test.
2. The test runs `perp-maker`'s `main()` with `DRY_RUN=false`. Cycle 1 places a post-only bid and ask (ids 11 and 12). The mock mark then moves 50 bps, past the 8 bps re-quote trigger. In the mock, the first `cancelOrder` call for each order id throws `HTTP request failed: socket hang up (ECONNRESET)` and leaves the order live; a second call for the same id succeeds. The bot is stopped after cycle 2.
3. Unmodified upstream: the test fails with `expected 4 to be less than or equal to 2`: the mock book held four of the bot's orders at once. 31 upstream tests pass (`evidence/103-upstream-run.txt`). Without the peak assertion, the book at exit is `[11n, 12n, 13n, 14n]`: both pairs are still resting (checked by running the test with that one line removed; that variant is not in `repro/`).
4. `repro/botkit/run-botkit.sh 103 patches/103-cancel-quietly-report-failures.patch`: all 32 pass, the book never holds more than one pair and is empty at exit (`evidence/103-patched-run.txt`).

## Expected
The helper's own comment, `orders.ts:215-216`: "An order that filled or expired between the read and the cancel is not a failure of the cancel; a cascade of these means the quote is too slow." So the errors it is meant to tolerate are the ones where the order is already gone. The contract has a named error for that case: `OrderDoesNotExist` is in `contractErrorsAbi` in the SDK, and `placePerp` in the same file already matches named errors by `message.includes(...)`.
A cancel that fails for another reason (a dropped connection, an RPC error, a revert for a different cause) leaves the order resting. The caller should be told, because `perp-maker`'s file header says the bot "re-quotes when the mark has moved far enough" and its comments say quotes left on the book keep trading with nobody watching.

## Actual
`cancelQuietly` has a bare `catch` (`orders.ts:214-218`) that logs `cancel <id> skipped: <message>` for every error and returns `void`. `perp-maker` then runs `resting = { atMark: 0 }` unconditionally (`index.ts:129-134`), so the order ids are dropped whether or not the cancels worked, and it goes straight on to place a new pair. In the test the first cancels fail, the bot places orders 13 and 14 while 11 and 12 are still live (peak 4 orders against the bot's one-pair design), and from then on no code holds ids 11 and 12, so the shutdown cleanup (`resting.bid`/`resting.ask`, now 13 and 14) cannot reach them.
This stacks resting inventory past what the bot sizes for: each re-quote can add a pair while the old one still fills. (A cancel that fails only for transport reasons is the common case on a long-running bot; the test uses one such error and does not claim a rate.)

## Evidence
- `evidence/103-upstream-run.txt`: pristine upstream (1 failed, 31 passed), failing assertion `expect(m.peak).toBeLessThanOrEqual(2)` with 4 received.
- `evidence/103-patched-run.txt`: with `patches/103-cancel-quietly-report-failures.patch` applied, 32 passed.
- `patches/103-cancel-quietly-report-failures.patch`: `cancelQuietly` returns `Promise<boolean>`: true when the cancel went through or the error text contains `OrderDoesNotExist` / `OrderAlreadyExpired`, false otherwise (logged as `FAILED, the order may still be resting`). `perp-maker` keeps any id whose cancel returned false in `resting`, does not place new quotes that cycle, and tries the cancel again next cycle (and at shutdown). `tsc --noEmit` on `perp-core` and `strategies/perp-maker` is clean with the patch.
- The patch touches `strategies/perp-maker/src/index.ts` like patch 102 (try/finally around the loop); applying both with `git apply --3way` worked cleanly on pristine upstream (not run through the test suite together); otherwise apply one at a time. Each is verified against pristine upstream on its own.
- `repro/botkit/103-cancel-quietly-swallows-failures.test.ts`, `repro/botkit/harness.ts`: the test and the mock exchange. The mock only records placed and cancelled orders; it does not model fills, and the error strings are test inputs, not captured from the live pool.

## Environment
- `somnia-chain/dreamdex-bot-kit` @ `25798660bbe4674a6f83a960b202852896e2fed4`, `perp-core` resolves `@somnia-chain/markets-sdk` 0.31.0, vitest 2.1.9, Node v22.22.0
- Network: none (mock exchange)
- Wallet: none
- Date: 2026-10-21 (UTC)
