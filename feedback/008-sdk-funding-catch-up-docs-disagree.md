# SDK states three different rules for what a late funding settlement charges; only "one interval" matches the chain
Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/008-sdk-funding-catch-up-docs-disagree.mjs` (read-only, no key; takes about a minute).
3. The script prints four passages from the installed package (file, line, text). It then scans every indexed funding settlement of all 21 markets up to 2026-10-20 16:00 UTC (`client.listFundingRateHistory`) and reports how many came late and how many intervals the largest one covered. It also counts the settlements that charged more than one interval.

## Expected
One rule, stated the same way everywhere in the SDK, for how much funding a settlement charges when it covers more than one interval (`intervalsSettled > 1`). Funding code built from the types or the guide then computes the same number as the chain.

## Actual
The package states three different rules:
1. `dist/funding.d.ts:109` (on `intervalsPerWindow`): "The contract's catch-up horizon is ONE interval, so a settlement charges at most `rate / n` however long the gap was, and the excess is forgiven rather than deferred." It adds that "deriving it as `min(intervalsSettled, n)` is the specific error the protocol interface warns against".
2. `dist/store.d.ts:245` (on `LiveFundingUpdate.intervalsSettled`) and the comment in `dist/eventsAbi.js:195` (on the `FundingUpdated` event): "Accrual is capped at n = window / interval". That is, up to 8 intervals on today's 8 h / 1 h markets: the `min(intervalsSettled, n)` that rule 1 calls an error.
3. `docs/PERPS.md:507-509`: "for a HISTORICAL row that caught up over several intervals, multiply that by the row's `intervalsAccrued`, since one settlement can charge more than one interval's worth."

The package contradicts itself whatever the chain does. For which rule the chain follows, see report 007: every late settlement charged one interval. The scan in this repro prints the same totals (`maxIntervalsSettledInOneRow: 58`, `rowsAccruingMoreThanOneInterval: 0`), so rule 1 is the one that matches.
A developer who follows rule 2 computes `min(intervalsSettled, 8)` intervals for a late settlement. On these 27 rows that is 2 to 8 times what the chain charged. Rule 3's procedure (multiply by `intervalsAccrued`) gives the right number, but its stated reason ("can charge more than one interval's worth") contradicts rule 1 and the history.

## Evidence
- `evidence/008-run1.json`, `evidence/008-run2.json`: two fresh-process runs, byte-identical. `statements` holds each passage with its file and line. The scan result is in `settlementsScanned`, `lateSettlements`, `maxIntervalsSettledInOneRow` and `rowsAccruingMoreThanOneInterval`.
- No transaction is involved. The per-settlement rows, on-chain receipt checks and tx hashes are in report 007 (`evidence/007-run1.json`).

## Environment
- `@somnia-chain/markets-sdk` 0.32.1, Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-21 (history up to 2026-10-20 16:00 UTC)
