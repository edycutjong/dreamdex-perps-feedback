# bot-kit perp-starter arms its take-profit/stop-loss for PERP_SIDE, not for the position it found open: an existing short gets a long's sell-to-close stops
Severity: major
Area: app

## Steps to reproduce
Target: the official `somnia-chain/dreamdex-bot-kit` at commit `25798660bbe4674a6f83a960b202852896e2fed4`, `strategies/perp-starter/src/index.ts`. Nothing here touches the network or a key; the exchange is a mock and the strategy and every `perp-core` helper are the real upstream code.
1. `repro/botkit/run-botkit.sh 101` clones upstream at that commit into a temp directory, installs it, copies in `repro/botkit/harness.ts` and `repro/botkit/101-starter-existing-position-side.test.ts`, and runs the upstream `perp-core` vitest suite plus the new test.
2. The test runs `perp-starter`'s `main()` with `DRY_RUN=false` and `PERP_SIDE` unset (its default, `long`) against a mock account that already holds a 0.01 BTC **short**, with a mock mark of 100,000. It records what the bot sends to `trader.placePerpStopOrder`.
3. Unmodified upstream: the new test fails (`expected false to be true` on `arm.isBid`), the 31 upstream tests pass (`evidence/101-upstream-run.txt`).
4. `repro/botkit/run-botkit.sh 101 patches/101-starter-manage-existing-side.patch` applies the 4-hunk patch first: all 32 tests pass (`evidence/101-patched-run.txt`).

## Expected
The file's own header: "it opens ONE leveraged position and manages it with a take-profit and a stop-loss, then watches until one of them fires". For a position that is already open the bot logs `already <side> <size> BTC, managing it instead of opening another` (line 123) and goes on to arm the bracket. `armBracket`'s argument is documented in `perp-core/src/stops.ts`: `position: Side` is "The side of the POSITION being protected, not of the closing order", and the doc comment above it says both legs are reduce-only and that closing a long means selling.
So for an open short the bracket should be two buy orders (`isBid: true`): take-profit below the mark (fires at or below, operator 1), stop-loss above it (fires at or above, operator 0).

## Actual
`perp-starter` takes the side from `PERP_SIDE` (`index.ts:57`) and uses it for everything after the open step, including when it skipped the open because a position already existed (`index.ts:121-123`). The levels (`index.ts:176-177`), the `armBracket({ position: SIDE })` call (`index.ts:187`) and the watched-exit comparisons (`index.ts:224-225`) all use `SIDE`, never `existing.side`.
In the test, the account holds a short and `PERP_SIDE` is the default `long`. The bot places no order (it manages the existing position), then makes one `placePerpStopOrder` call for a **long**: `isBid: false` (sell), take-profit trigger above the mark with operator 0, stop-loss trigger below the mark with operator 1. For the short the take-profit is at the wrong end of the mark and both closing legs are sells.
What that does on-chain was not run: `stops.ts` says both legs are reduce-only, so a sell that cannot reduce a short is the "ordinary" `ReduceOnly*` drop described in `isRealStopFailure`, and the short would then have no working stop-loss while the bot prints `armed a long bracket` and later `done`. That consequence is inferred from the code comments, not observed.
The same `SIDE` is used in the trading-key (`OWNER_ADDRESS`) path, where the bot watches the mark itself: with an open short and `PERP_SIDE=long` it would close the short when the mark rises 2% (its "take-profit") and sit through a fall (its "stop-loss" is below the mark).
How the state arises: a restart after the bot's own position is still open with `PERP_SIDE` changed or unset, or an account whose position was opened in the app. The bot is built to resume (`existing` branch), so this is the resume path.

## Evidence
- `evidence/101-upstream-run.txt`: the run on pristine upstream (1 failed, 31 passed), the failing assertion is `expect(arm.isBid).toBe(true)`.
- `evidence/101-patched-run.txt`: the same test with `patches/101-starter-manage-existing-side.patch` applied (32 passed).
- `patches/101-starter-manage-existing-side.patch`: `const managed: Side = existing ? existing.side : SIDE;` after the position read, then `managed` in place of `SIDE` in the two level lines, the `armBracket` call and the two watched-exit comparisons. The opening path still uses `SIDE`. `tsc --noEmit` on `strategies/perp-starter` is clean with the patch.
- `repro/botkit/101-starter-existing-position-side.test.ts`, `repro/botkit/harness.ts`: the test and the mock exchange. The mock returns fixed values for margin, sizing and mark reads; it does not model the pool, so the test shows what the bot asks for, not how the registry answers.

## Environment
- `somnia-chain/dreamdex-bot-kit` @ `25798660bbe4674a6f83a960b202852896e2fed4`, `perp-core` resolves `@somnia-chain/markets-sdk` 0.31.0, vitest 2.1.9, Node v22.22.0
- Network: none (mock exchange)
- Wallet: none
- Date: 2026-10-21 (UTC)
