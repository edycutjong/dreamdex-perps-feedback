# bot-kit cancelQuietly swallows every cancel error, so perp-maker forgets a quote whose cancel failed and quotes a second pair on top of it
Severity: normal
Area: app

## Steps to reproduce
Target: the official `somnia-chain/dreamdex-bot-kit` at commit `25798660bbe4674a6f83a960b202852896e2fed4`: `packages/perp-core/src/orders.ts` (`cancelQuietly`) and `strategies/perp-maker/src/index.ts`, its only caller. The exchange is a mock; the strategy and every `perp-core` helper are the real upstream code.
Shortcut: `node repro/103-botkit-cancel-quietly-hides-failed-cancels.mjs` does steps 1-4 below from fresh clones (it needs git, npm and network access) and prints `REPRODUCED` when the new test fails on upstream and passes with the patch.
1. `repro/botkit/run-botkit.sh 103` clones upstream at that commit into a temp directory, installs it, copies in `repro/botkit/harness.ts` and `repro/botkit/103-cancel-quietly-swallows-failures.test.ts`, and runs the upstream `perp-core` vitest suite plus the new test.
2. The test runs `perp-maker`'s `main()` with `DRY_RUN=false`. Cycle 1 places a post-only bid and ask (ids 11 and 12). The mock mark then moves 50 bps, past the 8 bps re-quote trigger. In the mock, the first `cancelOrder` call for each order id throws `HTTP request failed: socket hang up (ECONNRESET)` and leaves the order live; a second call for the same id succeeds. The bot is stopped after cycle 2. A second test in the same file makes every cancel fail with a message nothing recognises (`execution reverted`) and checks that the bot is not left unable to quote.
3. Unmodified upstream: the test fails with `expected 4 to be less than or equal to 2`: the mock book held four of the bot's orders at once. The other 32 tests pass: the 31 upstream ones and the second new test (`evidence/103-upstream-run.txt`).
4. `repro/botkit/run-botkit.sh 103 patches/103-cancel-quietly-report-failures.patch`: all 33 pass, the book never holds more than one pair and is empty at exit (`evidence/103-patched-run.txt`).

## Expected
The helper's own comment, `orders.ts:215-216`: "An order that filled or expired between the read and the cancel is not a failure of the cancel; a cascade of these means the quote is too slow." So the errors it is meant to tolerate are the ones where the order is already gone. The contract has a named error for that case: `OrderDoesNotExist` is in `contractErrorsAbi` in the SDK, and `placePerp` in the same file already matches named errors by `message.includes(...)`.
A cancel that fails for another reason (a dropped connection, an RPC error, a revert for a different cause) leaves the order resting. The caller should be told, because `perp-maker`'s file header says the bot "re-quotes when the mark has moved far enough" and its comments say quotes left on the book keep trading with nobody watching.

## Actual
`cancelQuietly` has a bare `catch` (`orders.ts:214-218`) that logs `cancel <id> skipped: <message>` for every error and returns `void`. `perp-maker` then runs `resting = { atMark: 0 }` unconditionally (`index.ts:129-134`), so the order ids are dropped whether or not the cancels worked, and it goes straight on to place a new pair. In the test the first cancels fail, the bot places orders 13 and 14 while 11 and 12 are still live (peak 4 orders against the bot's one-pair design), and from then on no code holds ids 11 and 12, so the shutdown cleanup (`resting.bid`/`resting.ask`, now 13 and 14) cannot reach them.
The test shows four of the bot's orders live at once. That they would then fill past what the bot sizes for is inferred (the mock does not model fills): each re-quote can add a pair while the old one still rests. (The test injects one transport error per order; it does not claim how often cancels fail on the live pool.)

## Evidence
- `evidence/103-upstream-run.txt`: pristine upstream (1 failed, 32 passed), failing assertion `expect(m.peak).toBeLessThanOrEqual(2)` with 4 received.
- `evidence/103-patched-run.txt`: with `patches/103-cancel-quietly-report-failures.patch` applied, 33 passed.
- `patches/103-cancel-quietly-report-failures.patch`: `cancelQuietly` returns `Promise<boolean>`: true when the cancel went through or the error text contains `OrderDoesNotExist` / `OrderAlreadyExpired`, false otherwise (logged as `FAILED, the order may still be resting`). `perp-maker` keeps any id whose cancel returned false in `resting`, does not place new quotes that cycle, and tries the cancel again next cycle (and at shutdown), up to `MAX_CANCEL_TRIES = 3` cancel attempts in total per order; after that it logs `giving up on cancelling ... check it in the app` and quotes again, so a cancel that can never succeed (for example a revert nobody decodes) cannot stop the bot quoting for good; an order given up on can stay on the book and is no longer tracked. The patch matches the two error names in the message text, the same way `placePerp` matches `PostOnlyWouldCross`; whether the pool's reply to cancelling an already-filled order carries one of those names was not checked, so if it does not, that race now counts as a failed cancel and costs up to two skipped quote cycles. It also changes the `resting.bid || resting.ask` truthiness test to explicit `!== undefined` checks. `tsc --noEmit` on `perp-core` and `strategies/perp-maker` is clean with the patch.
- This bug is independent of report 102 (a cancel fails while the process keeps running; 102 is about the process ending). The patch touches `strategies/perp-maker/src/index.ts` like patch 102 (try/finally around the loop); applying both with `git apply --3way` worked cleanly on pristine upstream (not run through the test suite together); otherwise apply one at a time. Each is verified against pristine upstream on its own.
- `repro/botkit/103-cancel-quietly-swallows-failures.test.ts`, `repro/botkit/harness.ts`: the test and the mock exchange. The mock only records placed and cancelled orders; it does not model fills, and the error strings are test inputs, not captured from the live pool.

## Environment
- `somnia-chain/dreamdex-bot-kit` @ `25798660bbe4674a6f83a960b202852896e2fed4`, `perp-core` resolves `@somnia-chain/markets-sdk` 0.31.0, vitest 2.1.9, Node v22.22.0
- Network: none (mock exchange)
- Wallet: none
- Date: 2026-10-21 (UTC)
