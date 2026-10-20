# Funding docs say a perp below the index has negative funding (shorts pay longs); it settled positive (longs pay) at 8,831 of 9,041 such settlements, because of an interest rate the docs never mention
Severity: normal
Area: docs

## Steps to reproduce
1. `npm install` (pins `@somnia-chain/markets-sdk` 0.32.1).
2. `node repro/011-funding-sign-vs-docs.mjs` (read-only, no key).
3. What the script does: it reads `getFundingParameters()` on all 21 perp pools. It then pages through every indexed funding settlement up to 2026-10-20 16:00 UTC (`client.listFundingRateHistory`, the same cut-off as report 007, so two runs print the same counts). For each settlement it compares the sign of the settled `fundingRate` with `markPrice` vs `indexPrice` recorded at that settlement.

## Expected
App docs page `/docs/trading/perps-testnet/funding`, "Who pays whom": "Perp above the index (positive funding): longs pay shorts." and "Perp below the index (negative funding): shorts pay longs."
The page describes funding as the perp-vs-index gap only ("When it is paid": "The funding rate is quoted per 8-hour window, and each hourly settlement applies an eighth of it"). It does not mention an interest rate, a dampener or a cap.
So when the perp settles below the index, the rate should be negative, or the page should name the other terms that set the sign.

## Actual
All 21 pools return the same `getFundingParameters()`. Besides the 8 h window and 1 h settlement the page describes, these include `interestRatePerWindow` 1e14 (+0.01% per 8 h), `dampener` 5e14 (0.05%) and `maxFundingRatePerWindow` 4e16 (4%) (`fundingParametersDistinct`). None of the three appears on the funding page.
In the settlement history (9,721 settlements, `settlements`):
- The mark was below the index at 9,041 settlements (`markBelowIndex`). At 8,831 of them the settled rate was positive, so longs paid shorts (`markBelowIndexRatePositive`).
- 8,795 settlements settled at exactly +1e14, the interest rate (`rateEqualsInterestRate`). Only 210 settled negative (`rateNegative`).
- The mark was above the index at 669 settlements, and none of them settled negative (`markAboveIndexRateNegative: 0`).

Example (BTC, 2026-09-22 11:11:45 UTC, tx `0xa0e2a0da6b1fb5229758d53aad8009bbcf74c1b12f253d8c0ae5516ef65e6b97`): `markPrice` 85,857.75 below `indexPrice` 85,893.595, and the settled `fundingRate` +1e14 (+0.01% per 8 h): longs paid shorts.
The settled rate equals `interestRatePerWindow` exactly at 8,795 settlements, so most of the time the interest-rate term, not the perp-vs-index gap, sets the sign: longs pay +0.01% per 8 h while the perp trades near the index, including slightly below it (inferred from the counts and parameters; the SDK does not publish the contract's formula). A trader who reads "below the index: shorts pay longs" and holds a long there pays funding instead of receiving it.

## Evidence
- `evidence/011-run1.json`, `evidence/011-run2.json`: two fresh-process runs, byte-identical (`fundingParametersDistinct`, the counts above, and three BTC example settlements with mark, index, rate and tx hash).
- `evidence/docs-excerpts-2026-10-20.txt`: the funding page text quoted above, as served on 2026-10-20 (UTC).
- `markPrice` and `indexPrice` are the values recorded with each settlement (`FundingUpdated` event, indexed by `listFundingRateHistory`). The SDK says the contract prices funding from a time-weighted order-book premium (`dist/perp/state.d.ts:195`, "PRE-clamp"), not from the mark at one instant. So this report does not claim the mark alone sets the sign; it shows that the docs' rule, which is stated in terms of perp vs index, fails at 8,831 settlements, and that the docs omit the interest-rate term that accounts for it.

## Environment
- `@somnia-chain/markets-sdk` 0.32.1 (viem 2.57.7), Node v22.22.0
- Somnia Hideki testnet (Tokyo, chain 50383), read-only
- Wallet: none (read-only calls)
- Date: 2026-10-20 (UTC; history up to 16:00 UTC)
