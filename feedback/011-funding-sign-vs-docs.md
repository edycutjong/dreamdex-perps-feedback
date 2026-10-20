# Funding docs say a perp below the index has negative funding, but 8,831 of 9,041 settlements with the mark below the index settled positive (longs paid)
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/011-funding-sign-vs-docs.mjs` (read-only, no key).
3. What the script does: it reads `getFundingParameters()` on all 21 perp pools. It then pages through every indexed funding settlement up to 2026-10-20 16:00 UTC (`client.listFundingRateHistory`, the same cut-off as report 007, so two runs print the same counts). For each settlement it compares the sign of the settled `fundingRate` with `markPrice` vs `indexPrice` recorded at that settlement.

4. Live check of the same rule against the premium the contract actually uses: `node repro/011-watch-next-settlement.mjs` (read-only, takes up to about an hour). For every market it reads `client.getPerpFundingPremium(pool).timeWeightedPremium` about 20 s before that market's next settlement and the `fundingRate` it then settles.

## Expected
App docs page `/docs/trading/perps-testnet/funding`, "Who pays whom": "Perp above the index (positive funding): longs pay shorts." and "Perp below the index (negative funding): shorts pay longs."
The page describes funding as the perp-vs-index gap only ("When it is paid": "The funding rate is quoted per 8-hour window, and each hourly settlement applies an eighth of it"). It does not mention an interest rate, a dampener or a cap.
So when the perp settles below the index, the rate should be negative, or the page should name the other terms that set the sign.

## Actual
All 21 pools return the same `getFundingParameters()`. Besides the 8 h window and 1 h settlement the page describes, these include `interestRatePerWindow` 1e14 (+0.01% per 8 h), `dampener` 5e14 (raw value; its unit is not documented, 0.05% if read like the rate as a 1e18 fraction) and `maxFundingRatePerWindow` 4e16 (4%) (`fundingParametersDistinct`). None of the three appears on the funding page.
In the settlement history (9,721 settlements, `settlements`), comparing the settled rate with the `markPrice` and `indexPrice` recorded at each settlement (a point sample; the contract prices funding from a time-weighted order-book premium, see Evidence):
- The mark was below the index at 9,041 settlements (`markBelowIndex`). At 8,831 of them the settled rate was positive, so longs paid shorts (`markBelowIndexRatePositive`).
- 8,795 settlements settled at exactly +1e14, the interest rate (`rateEqualsInterestRate`). Only 210 settled negative (`rateNegative`).
- This is not only a narrow band around the index. The mark was more than 0.05% below the index at 5,038 settlements (`markBelowByMoreThanDampener`), and 4,864 of them still settled positive (`markBelowByMoreThanDampenerRatePositive`). The largest such gap was 0.140137% (`largestGapBelowIndexWithPositiveRatePct`). The smallest gap below the index that settled negative was 0.013779% (`smallestGapBelowIndexWithNegativeRatePct`), so the gap alone does not decide the sign.
- The mark was above the index at 669 settlements, and none of them settled negative (`markAboveIndexRateNegative: 0`).

Live check on the premium itself (`evidence/011-watch-2026-10-20T1816Z.json`, one settlement per market, due between 17:19:18 and 18:15:51 UTC on 2026-10-20). The SDK defines `timeWeightedPremium` as "the premium the NEXT settlement will charge" and says "Positive means the perp is rich and longs pay" (`dist/perp/state.d.ts:194-196`). 16 of the 21 markets went into their settlement with a negative premium, so the perp was cheap by the contract's own measure. 15 of them settled at +0.01% and longs paid; only LIT, at -0.0757%, settled negative:

| Market | Settlement due (UTC, `settledAt`) | `timeWeightedPremium` before | Settled `fundingRate` | Who paid |
|---|---|---|---|---|
| ZRO | 17:55:21 (1792518921) | -15713334173337 (-0.0016%) | 100000000000000 (+0.0100%) | longs |
| LIT | 17:55:21 (1792518921) | -756604571199069 (-0.0757%) | -328097951418642 (-0.0328%) | shorts |
| VVV | 17:55:21 (1792518921) | -149161190649109 (-0.0149%) | 100000000000000 (+0.0100%) | longs |
| PUMP | 17:55:21 (1792518921) | -14355877951636 (-0.0014%) | 100000000000000 (+0.0100%) | longs |
| ZEC | 17:55:21 (1792518921) | -201348823068359 (-0.0201%) | 100000000000000 (+0.0100%) | longs |
| TAO | 18:14:42 (1792520082) | -210870820069390 (-0.0211%) | 100000000000000 (+0.0100%) | longs |
| WLD | 18:14:42 (1792520082) | -137596391199522 (-0.0138%) | 100000000000000 (+0.0100%) | longs |
| NEAR | 18:14:42 (1792520082) | -229952854057827 (-0.0230%) | 100000000000000 (+0.0100%) | longs |
| LINK | 18:14:42 (1792520082) | -82704392250529 (-0.0083%) | 100000000000000 (+0.0100%) | longs |
| SUI | 18:14:42 (1792520082) | -7583146628841 (-0.0008%) | 100000000000000 (+0.0100%) | longs |
| ADA | 18:15:51 (1792520151) | -2702463587806 (-0.0003%) | 100000000000000 (+0.0100%) | longs |
| DOGE | 18:14:42 (1792520082) | -69150130144032 (-0.0069%) | 100000000000000 (+0.0100%) | longs |
| XRP | 18:14:42 (1792520082) | -121120182628821 (-0.0121%) | 100000000000000 (+0.0100%) | longs |
| HYPE | 18:14:42 (1792520082) | -88424857779871 (-0.0088%) | 100000000000000 (+0.0100%) | longs |
| SOL | 17:54:13 (1792518853) | -117136364105152 (-0.0117%) | 100000000000000 (+0.0100%) | longs |
| ETH | 17:19:18 (1792516758) | -23122196095276 (-0.0023%) | 100000000000000 (+0.0100%) | longs |

Example (BTC, 2026-09-22 11:11:45 UTC, tx `0xa0e2a0da6b1fb5229758d53aad8009bbcf74c1b12f253d8c0ae5516ef65e6b97`): `markPrice` 85,857.75 below `indexPrice` 85,893.595, and the settled `fundingRate` +1e14 (+0.01% per 8 h): longs paid shorts.
The settled rate equals `interestRatePerWindow` exactly at 8,795 settlements, so most of the time the interest-rate term, not the perp-vs-index gap, sets the sign: longs pay +0.01% per 8 h while the perp trades near the index, including slightly below it (inferred from the counts and parameters; the SDK does not publish the contract's formula). A trader who reads "below the index: shorts pay longs" and holds a long there pays funding instead of receiving it: +0.01% of notional per 8 h at the interest-rate value, small per hour but the opposite direction to the docs.
This is independent of reports 007 and 008, which are about how much a late settlement charges, not its sign.

## Evidence
- `evidence/011-run1.json`, `evidence/011-run2.json`: two fresh-process runs, byte-identical (`fundingParametersDistinct`, the counts and gap figures above, and three BTC example settlements with mark, index, rate and tx hash).
- `evidence/011-watch-2026-10-20T1816Z.json`: one run of `repro/011-watch-next-settlement.mjs` (all 21 markets, each across its own settlement; `capturedAt` 2026-10-20T18:16:01Z). A live capture cannot be byte-identical between runs; re-running it captures the next hour.
- `evidence/docs-excerpts-2026-10-20.txt`: the funding page text quoted above, as served on 2026-10-20 (UTC).
- `markPrice` and `indexPrice` are the values recorded with each settlement (`FundingUpdated` event, indexed by `listFundingRateHistory`). The SDK says the contract prices funding from a time-weighted order-book premium (`dist/perp/state.d.ts:195`, "PRE-clamp"), not from the mark at one instant. So this report does not claim the mark alone sets the sign; it shows that the docs' rule, which is stated in terms of perp vs index, fails at 8,831 settlements, and that the docs omit the interest-rate term that accounts for it.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1 (viem 2.57.7), Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20 (UTC; history up to 16:00 UTC)
