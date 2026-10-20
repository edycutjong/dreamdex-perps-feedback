# SDK docs disagree on what a late funding settlement charges: `funding.d.ts` says at most one interval, `docs/PERPS.md` says one settlement can charge more than one
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/008-sdk-funding-catch-up-docs-disagree.mjs` (no key, no network).
3. The script prints five passages from the installed package (rule number, file, line, text).

## Expected
`dist/funding.d.ts:109-110` (on `intervalsPerWindow`) states the contract's rule: "The contract's catch-up horizon is ONE interval, so a settlement charges at most `rate / n` however long the gap was, and the excess is forgiven rather than deferred." Lines 112-113 add that "deriving it as `min(intervalsSettled, n)` is the specific error the protocol interface warns against".
Every other passage in the package should agree with that rule, so funding code built from the types or the guide computes the same number as the chain.

## Actual
- `docs/PERPS.md:507-509` contradicts it outright: "for a HISTORICAL row that caught up over several intervals, multiply that by the row's `intervalsAccrued`, since one settlement can charge more than one interval's worth."
- Two code comments point the same way. `dist/store.d.ts:245` (on `LiveFundingUpdate.intervalsSettled`): "UNCLAMPED interval span, as emitted. Accrual is capped at n = window / interval." `dist/eventsAbi.js:195` (on the `FundingUpdated` event): "UNCLAMPED interval span; accrual is capped at n = window / interval." "Capped at n" alone is only an upper bound, but next to "UNCLAMPED interval span" it reads as accrual = `min(intervalsSettled, n)`: up to 8 intervals on today's 8 h / 1 h markets, and the derivation `funding.d.ts:112-113` calls an error.

The package contradicts itself whatever the chain does. Report 007 shows the chain follows `funding.d.ts`: over 27 settlements of up to 58 intervals, every one charged one interval (`evidence/007-run1.json`: `rowsAccruingMoreThanOneInterval: 0`, `stepOfOneInterval: 27`).
A developer who reads the comments as `min(intervalsSettled, 8)` gets 2 to 8 times what the chain charged on those settlements (2 to 58 intervals each). The `PERPS.md` procedure (multiply by `intervalsAccrued`) gives the right number, but its stated reason ("can charge more than one interval's worth") contradicts `funding.d.ts` and the history.

## Evidence
- `evidence/008-run1.json`, `evidence/008-run2.json`: two runs, byte-identical. `statements` holds each passage with its file and line (`rule` 1 = `funding.d.ts`, 2 = the two comments, 3 = `PERPS.md`).
- Chain behaviour: report 007 (`evidence/007-run1.json`, per-settlement rows with receipt checks and tx hashes).

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Package text only, no network (chain data: report 007, Somnia Hideki testnet, chain 50383)
- Wallet: none
- Date: 2026-10-20 (UTC)
