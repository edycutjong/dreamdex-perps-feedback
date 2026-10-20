# SDK says a late funding settlement charges at most one interval in one place, and more than one (up to n = 8) in three others
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/008-sdk-funding-catch-up-docs-disagree.mjs` (no key, no network).
3. The script prints five passages from the installed package (rule number, file, line, text).

## Expected
One rule, stated the same way everywhere in the SDK, for how much funding a settlement charges when it covers more than one interval (`intervalsSettled > 1`). Funding code built from the types or the guide then computes the same number as the chain.

## Actual
The package gives two rules that cannot both hold:
- **Rule A, at most one interval.** `dist/funding.d.ts:109-113` (on `intervalsPerWindow`): "The contract's catch-up horizon is ONE interval, so a settlement charges at most `rate / n` however long the gap was, and the excess is forgiven rather than deferred." It continues: "deriving it as `min(intervalsSettled, n)` is the specific error the protocol interface warns against".
- **Rule B, up to n intervals.**
  - `dist/store.d.ts:245` (on `LiveFundingUpdate.intervalsSettled`): "UNCLAMPED interval span, as emitted. Accrual is capped at n = window / interval." The comment in `dist/eventsAbi.js:195` (on the `FundingUpdated` event) says the same: "UNCLAMPED interval span; accrual is capped at n = window / interval." With the span unclamped, that is accrual = `min(intervalsSettled, n)`, up to 8 intervals on today's 8 h / 1 h markets. Rule A calls exactly that derivation an error.
  - `docs/PERPS.md:507-509` says: "for a HISTORICAL row that caught up over several intervals, multiply that by the row's `intervalsAccrued`, since one settlement can charge more than one interval's worth." Rule A says a settlement never charges more than one.

The package contradicts itself whatever the chain does. Report 007 shows that the chain follows rule A: over 27 late settlements of up to 58 intervals, every one charged one interval (`evidence/007-run1.json`: `rowsAccruingMoreThanOneInterval: 0`, `stepOfOneInterval: 27`).
A developer who follows the `store.d.ts` / `eventsAbi.js` comment computes `min(intervalsSettled, 8)` intervals for a late settlement. On those 27 settlements (2 to 58 intervals each) that is 2 to 8 times what the chain charged. The `PERPS.md` procedure (multiply by `intervalsAccrued`) gives the right number, but its stated reason ("can charge more than one interval's worth") contradicts rule A and the history.

## Evidence
- `evidence/008-run1.json`, `evidence/008-run2.json`: two runs, byte-identical. `statements` holds each passage with its file and line (`rule` 1 = rule A; 2 and 3 = rule B).
- Chain behaviour: report 007 (`evidence/007-run1.json`, per-settlement rows with receipt checks and tx hashes).

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Package text only, no network (chain data: report 007, Somnia Hideki testnet, chain 50383)
- Wallet: none
- Date: 2026-10-20 (UTC)
