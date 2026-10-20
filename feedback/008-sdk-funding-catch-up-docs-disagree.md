# SDK states three different rules for what a late funding settlement charges: one interval, up to n = 8, or more than one
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/008-sdk-funding-catch-up-docs-disagree.mjs` (no key, no network).
3. The script prints five passages from the installed package (rule number, file, line, text).

## Expected
One rule, stated the same way everywhere in the SDK, for how much funding a settlement charges when it covers more than one interval (`intervalsSettled > 1`). Funding code built from the types or the guide then computes the same number as the chain.

## Actual
The package states three different rules:
1. `dist/funding.d.ts:109-112` (on `intervalsPerWindow`): "The contract's catch-up horizon is ONE interval, so a settlement charges at most `rate / n` however long the gap was, and the excess is forgiven rather than deferred." It adds that "deriving it as `min(intervalsSettled, n)` is the specific error the protocol interface warns against".
2. `dist/store.d.ts:245` (on `LiveFundingUpdate.intervalsSettled`) and the comment in `dist/eventsAbi.js:195` (on the `FundingUpdated` event): "Accrual is capped at n = window / interval". That is, up to 8 intervals on today's 8 h / 1 h markets: the `min(intervalsSettled, n)` that rule 1 calls an error.
3. `docs/PERPS.md:507-509`: "for a HISTORICAL row that caught up over several intervals, multiply that by the row's `intervalsAccrued`, since one settlement can charge more than one interval's worth."

The package contradicts itself whatever the chain does. Report 007 shows that the chain follows rule 1: over 27 late settlements of up to 58 intervals, every one charged one interval (`evidence/007-run1.json`: `rowsAccruingMoreThanOneInterval: 0`, `stepOfOneInterval: 27`).
A developer who follows rule 2 computes `min(intervalsSettled, 8)` intervals for a late settlement. On those 27 settlements (2 to 58 intervals each) that is 2 to 8 times what the chain charged. Rule 3's procedure (multiply by `intervalsAccrued`) gives the right number, but its stated reason ("can charge more than one interval's worth") contradicts rule 1 and the history.

## Evidence
- `evidence/008-run1.json`, `evidence/008-run2.json`: two runs, byte-identical. `statements` holds each passage with its rule number, file and line.
- Chain behaviour: report 007 (`evidence/007-run1.json`, per-settlement rows with receipt checks and tx hashes).

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Package text only, no network (chain data: report 007, Somnia Hideki testnet, chain 50383)
- Wallet: none
- Date: 2026-10-21
