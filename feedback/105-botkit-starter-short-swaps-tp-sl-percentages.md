# bot-kit perp-starter with PERP_SIDE=short arms its take-profit at the stop-loss percentage and its stop-loss at the take-profit percentage
Severity: major
Area: app

## Steps to reproduce
Target: the official `somnia-chain/dreamdex-bot-kit` at commit `25798660bbe4674a6f83a960b202852896e2fed4`, `strategies/perp-starter/src/index.ts`. The exchange is a mock; the strategy and every `perp-core` helper are the real upstream code.
Shortcut: `node repro/105-botkit-starter-short-swaps-tp-sl-percentages.mjs` does steps 1-4 below from fresh clones (it needs git, npm and network access) and prints `REPRODUCED` when the new test fails on upstream and passes with the patch.
1. `repro/botkit/run-botkit.sh 105` clones upstream at that commit into a temp directory, installs it, copies in `repro/botkit/harness.ts` and `repro/botkit/105-starter-short-swaps-tp-sl-percentages.test.ts`, and runs the upstream `perp-core` vitest suite plus the new test.
2. The test runs `perp-starter`'s `main()` with `DRY_RUN=false`, `PERP_SIDE=short`, `PERP_TAKE_PROFIT_PCT=2` and `PERP_STOP_LOSS_PCT=1` (the defaults) against a mock account with no position and a mock mark of 100,000. The bot opens a short and arms its bracket. The test reads the two trigger prices the bot passes to `trader.placePerpStopOrder`.
3. Unmodified upstream: the test fails with `expected 98999.99 to be close to 98000`, the 31 upstream tests pass (`evidence/105-upstream-run.txt`).
4. `repro/botkit/run-botkit.sh 105 patches/105-starter-short-tp-sl-percentages.patch` applies the patch first: all 32 tests pass (`evidence/105-patched-run.txt`).

## Expected
The file's own log line and the README: `perp-starter ... take-profit ${TAKE_PROFIT_PCT}% stop-loss ${STOP_LOSS_PCT}%` (`index.ts:74`) and `PERP_TAKE_PROFIT_PCT`, `PERP_STOP_LOSS_PCT` in the README's env list. No document defines what the two percentages mean for a short; the names and the long branch (take-profit above the mark by `PERP_TAKE_PROFIT_PCT`, stop-loss below it by `PERP_STOP_LOSS_PCT`) imply it. So for a short with take-profit 2% and stop-loss 1%, the take-profit should sit 2% below the mark (98,000) and the stop-loss 1% above it (101,000). For a long the code already does this: take-profit +2%, stop-loss -1%.

## Actual
The levels are computed once, without regard to the side, and then assigned to legs by side (`index.ts:174-177`):
```
const up   = mark * (1 + TAKE_PROFIT_PCT / 100)
const down = mark * (1 - STOP_LOSS_PCT / 100)
const takeProfit = SIDE === "long" ? up : down;
const stopLoss   = SIDE === "long" ? down : up;
```
`up` always uses the take-profit percentage and `down` always uses the stop-loss percentage. For a long that is right. For a short, `takeProfit = down` therefore uses `STOP_LOSS_PCT` and `stopLoss = up` uses `TAKE_PROFIT_PCT`: the legs are on the right sides of the mark but at each other's distances.
In the test (mark 100,000, defaults) the short's take-profit leg is armed at 98,999.99 (about -1%, tick alignment takes the last cent off 99,000; -2% was configured) and its stop-loss leg at about 102,000 (+2%, where +1% was configured; the test asserts 101,000 and stops at the first failing assertion, so the 102,000 figure comes from the same formula and was not printed). The start-up line still says `take-profit 2% stop-loss 1%`.
The effect is that, on a short, a user who sets a tight stop-loss gets a stop-loss that many times wider (with the defaults twice as wide), and the take-profit is taken at half the configured distance. That follows from the code and the test's observed trigger price; no order was filled against the real pool.
The same `takeProfit`/`stopLoss` values are used by the registry bracket (`armBracket`, index.ts:187) and by the trading-key mode's own watch (`hitTakeProfit` / `hitStopLoss`, index.ts:224-225), so both modes inherit the wrong distances for a short.

## Evidence
- `evidence/105-upstream-run.txt`: pristine upstream (1 failed, 31 passed), failing assertion on the take-profit trigger, received 98,999.99 against 98,000.
- `evidence/105-patched-run.txt`: with `patches/105-starter-short-tp-sl-percentages.patch` applied, 32 passed.
- `patches/105-starter-short-tp-sl-percentages.patch`: computes each leg from its own percentage and the side (`dir = SIDE === "long" ? 1 : -1`; `takeProfit = mark * (1 + dir * TP%)`, `stopLoss = mark * (1 - dir * SL%)`). Longs get the same levels as before. `tsc --noEmit` on `strategies/perp-starter` is clean with the patch. It touches the same lines as patch 101 (which changes `SIDE` to the open position's side on these lines); the two do not apply together (`git apply --check` of 101 fails after 105), so apply one at a time; a hand merge has to derive `dir` from the open position's side (`managed` in patch 101), not `SIDE`.
- `repro/botkit/105-starter-short-swaps-tp-sl-percentages.test.ts`, `repro/botkit/harness.ts`: the test and the mock exchange. The mock fills an IOC order completely and returns fixed margin, sizing and mark values; it does not model the pool.

## Environment
- `somnia-chain/dreamdex-bot-kit` @ `25798660bbe4674a6f83a960b202852896e2fed4`, `perp-core` resolves `@somnia-chain/markets-sdk` 0.31.0, vitest 2.1.9, Node v22.22.0
- Network: none (mock exchange)
- Wallet: none
- Date: 2026-10-21 (UTC)
