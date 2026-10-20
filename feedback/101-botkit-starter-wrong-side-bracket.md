# bot-kit perp-starter arms its take-profit/stop-loss for PERP_SIDE, not for the position it found open: an existing short gets a long's sell-to-close stops
Severity: normal
Area: app

## Steps to reproduce
Target: the official `somnia-chain/dreamdex-bot-kit` at commit `25798660bbe4674a6f83a960b202852896e2fed4`, `strategies/perp-starter/src/index.ts`. Nothing here touches the network or a key; the exchange is a mock and the strategy and every `perp-core` helper are the real upstream code.
Shortcut: `node repro/101-botkit-starter-wrong-side-bracket.mjs` does steps 1-4 below from fresh clones (it needs git, npm and network access) and prints `REPRODUCED` when the new test fails on upstream and passes with the patch.
1. `repro/botkit/run-botkit.sh 101` clones upstream at that commit into a temp directory, installs it, copies in `repro/botkit/harness.ts` and `repro/botkit/101-starter-existing-position-side.test.ts`, and runs the upstream `perp-core` vitest suite plus the new test.
2. The test runs `perp-starter`'s `main()` with `DRY_RUN=false` and `PERP_SIDE` unset (its default, `long`) against a mock account that already holds a 0.01 BTC **short**, with a mock mark of 100,000. It records what the bot sends to `trader.placePerpStopOrder`.
3. Unmodified upstream: the new test fails (`expected false to be true` on `arm.isBid`), the 31 upstream tests pass (`evidence/101-upstream-run.txt`).
4. `repro/botkit/run-botkit.sh 101 patches/101-starter-manage-existing-side.patch` applies the 4-hunk patch first: all 32 tests pass (`evidence/101-patched-run.txt`).

## Expected
The file's own header: "it opens ONE leveraged position and manages it with a take-profit and a stop-loss, then watches until one of them fires". For a position that is already open the bot logs `already <side> <size> BTC, managing it instead of opening another` (line 123) and goes on to arm the bracket. `armBracket`'s argument is documented in `perp-core/src/stops.ts`: `position: Side` is "The side of the POSITION being protected, not of the closing order", and the doc comment above it says both legs are reduce-only and that closing a long means selling.
So for an open short the bracket should be two buy orders (`isBid: true`): take-profit below the mark (fires at or below, operator 1), stop-loss above it (fires at or above, operator 0).

## Actual
`perp-starter` takes the side from `PERP_SIDE` (`index.ts:57`) and uses it for everything after the open step, including when it skipped the open because a position already existed (`index.ts:121-123`). The levels (`index.ts:176-177`), the `armBracket({ position: SIDE })` call (`index.ts:187`) and the watched-exit comparisons (`index.ts:224-225`) all use `SIDE`, never `existing.side`.
In the test, the account holds a short and `PERP_SIDE` is the default `long`. The bot places no order (it manages the existing position), then makes one `placePerpStopOrder` call, carrying both legs, for a **long**: `isBid: false` (sell), the test's first failing assertion. The run stops there, so the trigger levels are read from the code, not the run: with `SIDE` `long`, `index.ts:176-177` set the take-profit to the level above the mark and the stop-loss to the level below it. For the short the take-profit is at the wrong end of the mark and both closing legs are sells.
What that does on-chain was not run, which is why this is filed as `normal`: it would be `major` if the registry accepts the wrong-way legs and drops them, which was not verified. `stops.ts` says both legs are reduce-only, so a sell that cannot reduce a short is the "ordinary" `ReduceOnly*` drop described in `isRealStopFailure`, and the short would then have no working stop-loss while the bot prints `armed a long bracket` and later `done`. That consequence is inferred from the code comments, not observed.
In the trading-key (`OWNER_ADDRESS`) mode the bot watches the mark itself and closes at either level (`index.ts:224-228`), and the two levels are the same prices whichever side is assumed, so only their labels (`take-profit` / `stop-loss`) follow `SIDE`; on upstream as it stands that mode is not affected beyond the label. Separately, the level distances for a short are wrong in both modes (report 105); once 105 is fixed, the side those levels follow has to be the open position's side (`managed` here), or this mode would use a long's levels on an open short.
How the state arises: the account already holds a position on the market when the bot starts (the `existing` branch at `index.ts:121-123`) and `PERP_SIDE` is not that position's side, for example because it was left at its default or the position was opened in the app. The README documents `PERP_SIDE` as `long`/`short` and does not say what the bot does about an open position on the other side; a maintainer could answer that `PERP_SIDE` should match, but the bot has already read the position's side (`existing.side`) and logs that it is managing that position.

## Evidence
- `evidence/101-upstream-run.txt`: the run on pristine upstream (1 failed, 31 passed), the failing assertion is `expect(arm.isBid).toBe(true)`.
- `evidence/101-patched-run.txt`: the same test with `patches/101-starter-manage-existing-side.patch` applied (32 passed).
- `patches/101-starter-manage-existing-side.patch`: `const managed: Side = existing ? existing.side : SIDE;` after the position read, then `managed` in place of `SIDE` in the two level lines, the `armBracket` call and the two watched-exit comparisons. The opening path still uses `SIDE`. This patch and patch 105 rewrite the same level lines and do not apply together; a hand merge has to derive 105's `dir` from `managed`, not `SIDE`. `tsc --noEmit` on `strategies/perp-starter` is clean with the patch.
- `repro/botkit/101-starter-existing-position-side.test.ts`, `repro/botkit/harness.ts`: the test and the mock exchange. The mock returns fixed values for margin, sizing and mark reads; it does not model the pool, so the test shows what the bot asks for, not how the registry answers.

## Environment
- `somnia-chain/dreamdex-bot-kit` @ `25798660bbe4674a6f83a960b202852896e2fed4`, `perp-core` resolves `@somnia-chain/markets-sdk` 0.31.0, vitest 2.1.9, Node v22.22.0
- Network: none (mock exchange)
- Wallet: none
- Date: 2026-10-21 (UTC)
