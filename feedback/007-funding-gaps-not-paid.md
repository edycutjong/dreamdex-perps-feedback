# Funding docs say it is paid every hour, but 25 late settlements each charged one hour and skipped the rest: 290 hourly intervals never charged
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/007-funding-gaps-not-paid.mjs` (read-only, no key).
3. For all 21 markets the script pages through `client.listFundingRateHistory(pool, { from: 0, to: 1792512000, order: "asc" })` (every indexed settlement up to 2026-10-20 16:00 UTC, so two runs print the same rows). It keeps each settlement with `intervalsSettled > 1`, marks whether it is the market's first indexed settlement (`firstSettlement`), and prints:
   - `intervalsAccrued`, the indexer's figure for what the settlement charged;
   - `intervalsInCumulativeStep`, the same figure re-derived from event fields only: the step in `cumulativeFundingPerUnit` from the previous settlement (from 0, where the index starts, for a market's first settlement), divided by `fundingRate x indexPrice / 8`;
   - `receiptIntervalsSettled`, decoded from the `FundingUpdated` log in the transaction receipt (`eth_getTransactionReceipt`).

## Expected
App docs page `/docs/trading/perps-testnet`, fees table: "Funding | Paid between longs and shorts every hour, never to the protocol."
App docs page `/docs/trading/perps-testnet/funding`: "Settlement | Every hour", "each hourly settlement applies an eighth of it", and "Funding is applied to your position the next time it is touched, by a trade, a withdrawal or a liquidation, and everything owed since the last time is settled at once. The result is the same as paying every hour."
So a settlement that runs late should still charge every hour since the previous one. If it does not, the docs should say so.

## Actual
The history holds 9,721 settlements up to the cut-off. 25 settlements came late after an earlier settlement of the same market, covering 2 to 58 hourly intervals (`intervalsSettled`). Every one of them charged one interval (`intervalsAccrued: 1`), and no settlement in the history charged more than one (`rowsAccruingMoreThanOneInterval: 0`). In total, 290 hourly intervals between two settlements were not charged (`hoursNotAccruedAfterPreviousSettlement`: 290).
The chain shows the same thing without the indexer's `intervalsAccrued` field:
- On every one of them, the `cumulativeFundingPerUnit` step from the previous settlement is exactly one interval at the emitted rate (`stepOfOneInterval`).
- Every transaction receipt carries a `FundingUpdated` log from the market's pool with the same `intervalsSettled` (`receiptsMatchingIndexer`). The receipts confirm the length of each gap; the cumulative step confirms what was charged.

Two more settlements are counted apart because they are the market's first indexed settlement, so no earlier hourly schedule is shown: ADA on 2026-09-25 (17 intervals) and ETH on 2026-09-24 (47). Each also charged one interval, measured from 0 where the index starts (`firstSettlementsCoveringSeveralIntervals`). With them, the totals are 27 settlements and 352 intervals (`lateSettlements`, `hoursNotAccrued`).

Examples:

| Market | Settled at (UTC) | `intervalsSettled` | Hours charged | Tx |
|---|---|---|---|---|
| SOL | 2026-09-25 10:14:42 | 58 | 1 | `0x1daecc04c6ef2906e1ed7c6644db26368cc2f7a45221945a9f20646de1d8cebc` |
| LIT | 2026-10-17 09:03:12 | 15 | 1 | `0x1995d52346e4d034f95fe3d942e0b7b4b68862e82f61529e5eb361bcf71d1474` |

Hours not charged between two settlements, by market (`hoursNotAccruedByMarketAfterPreviousSettlement`): SOL 74, TAO 17, NEAR 17, WLD 16, XRP 16, AVAX 15, SUI 15, LIT 14, VVV 14, 1000PEPE 14, HYPE 14, ZRO 13, ADA 12, LINK 11, BTC 9, DOGE 8, XLM 4, BNB 4, ETH 2, ZEC 1. PUMP has none.
The SDK documents this as the contract's rule. `dist/funding.d.ts:109-110` says: "The contract's catch-up horizon is ONE interval, so a settlement charges at most `rate / n` however long the gap was, and the excess is forgiven rather than deferred." So the forgiveness is the contract's design, and the app docs are what is wrong: they promise "the same as paying every hour" and never say that a missed hour is forgiven (a search for "forgiv" on the four perps docs pages returned 0 matches on 2026-10-20 UTC).
Positions settle against that cumulative index, so a position held through a gap was charged or credited one interval at the rate emitted at settlement, however long the gap was (inferred from the cumulative index; no position was read). For example, through the 2026-10-17 gap on LIT, VVV or 1000PEPE: one interval for 15 hours. This report does not estimate the USDso amount; that would need the premium during the gap, which is not recorded.

## Evidence
- `evidence/007-run1.json`, `evidence/007-run2.json`: two fresh-process runs, byte-identical. Each of the 27 settlements with `intervalsSettled > 1` is listed with market, pool, `firstSettlement`, timestamp, `intervalsSettled`, `intervalsAccrued`, `intervalsInCumulativeStep`, `receiptStatus`, `receiptIntervalsSettled` and `txHash`. The totals are `settlementsScanned`, `lateAfterPreviousSettlement`, `hoursNotAccruedAfterPreviousSettlement`, `lateSettlements`, `hoursNotAccrued`, `receiptsMatchingIndexer` and `stepOfOneInterval` (27 of 27).
- `evidence/docs-excerpts-2026-10-20.txt`: the fees-table row and the funding-page text quoted above, as served on 2026-10-20 (UTC), and the result of the "forgiv" search on the four perps docs pages (0 matches).
- Funding rows come from the indexer through `listFundingRateHistory`; receipts come from the chain RPC. No transaction is sent.
- This report does not claim why the settlements were late. It only shows that the gaps happened and were not charged, which the app docs do not describe.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1 (viem 2.57.7), Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20 (UTC; history up to 16:00 UTC)
